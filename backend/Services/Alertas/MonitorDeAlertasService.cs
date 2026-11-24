using BolinhoDeChuva.Api.Models;

namespace BolinhoDeChuva.Api.Services;

/// <summary>
/// Fica rodando em segundo plano enquanto a API estiver ligada, e decide
/// QUANDO mandar alerta por email:
///
/// 1. Regiões (na hora): quando uma região MUDA para "perigo".
///    - Ao ligar a API, as regiões que já começam em perigo não geram email
///      (senão todo mundo receberia alerta a cada vez que a API reinicia).
///    - A maquete só conta quando estiver recebendo leituras (sensor ou simulação).
///    - No máximo um alerta por região a cada X minutos (Alertas:MinutosEntreAlertasDaMesmaZona).
///
/// 2. Clima (a cada 10 minutos), pela Open-Meteo:
///    - CHUVA: quando começa a chover de verdade (garoa fraca não conta).
///      No máximo um email a cada X horas (Alertas:HorasEntreAlertasDeChuva).
///    - TEMPORAL: trovoada agora, trovoada prevista para hoje ou chuva forte
///      prevista. No máximo um email de temporal por dia.
///
/// Tudo o que acontece também vai para o HISTÓRICO DE ALERTAS (página Alagamentos),
/// mesmo quando ninguém está inscrito para receber email.
/// </summary>
public class MonitorDeAlertasService(
    ZonasService zonas,
    InscricoesService inscricoes,
    HistoricoAlertasService historico,
    AlertasService alertas,
    EmailTemplates templates,
    IServiceProvider servicos,
    IConfiguration config,
    ILogger<MonitorDeAlertasService> logger) : BackgroundService
{
    private readonly Dictionary<string, DateTimeOffset> _ultimoAlertaPorZona = new();

    private TimeSpan IntervaloEntreAlertasDaZona =>
        TimeSpan.FromMinutes(config.GetValue("Alertas:MinutosEntreAlertasDaMesmaZona", 30));
    private double ChuvaForteMm => config.GetValue("Alertas:ChuvaForteMm", 30.0);
    private int ChanceMinimaDeTrovoada => config.GetValue("Alertas:ChanceMinimaDeTrovoada", 60);
    private double ChuvaMinimaMm => config.GetValue("Alertas:ChuvaMinimaMm", 0.5);
    private TimeSpan IntervaloEntreAlertasDeChuva =>
        TimeSpan.FromHours(config.GetValue("Alertas:HorasEntreAlertasDeChuva", 6.0));

    protected override Task ExecuteAsync(CancellationToken ct)
    {
        // Regiões que já começam em atenção ou perigo entram no histórico como
        // alertas ativos (mas sem email: senão todo mundo receberia a cada reinício).
        foreach (var zona in zonas.ObterTodas().Where(z => !z.EhMaquete && z.Status != StatusZona.Tranquilo))
            historico.RegistrarZona(zona);

        return Task.WhenAll(VigiarZonasAsync(ct), VigiarClimaAsync(ct), SincronizarPlanilhaAsync(ct));
    }

    // Ao ligar, junta a lista de inscritos deste computador com a planilha do Google.
    private async Task SincronizarPlanilhaAsync(CancellationToken ct)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(3), ct);
            var r = await inscricoes.SincronizarComGoogleAsync(ct);
            if (r.Erro is not null && r.Erro != "O Google não está conectado.")
                logger.LogWarning("Não consegui sincronizar com a planilha do Google: {Erro}", r.Erro);
        }
        catch (OperationCanceledException) { }
    }

    // Regiões: reage NA HORA em que uma zona muda de situação.
    // (Zonas que já começam em perigo quando a API liga não geram email.)
    private async Task VigiarZonasAsync(CancellationToken ct)
    {
        await foreach (var (zona, anterior) in zonas.Mudancas.ReadAllAsync(ct))
        {
            try
            {
                await TratarMudancaAsync(zona, anterior, ct);
            }
            catch (Exception erro) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning("Erro ao mandar alerta da zona {Zona}: {Mensagem}", zona.Nome, erro.Message);
            }
        }
    }

    private async Task TratarMudancaAsync(ZonaAlagamento zona, string anterior, CancellationToken ct)
    {
        historico.RegistrarZona(zona);

        var entrouEmPerigo = zona.Status == StatusZona.Perigo && anterior != StatusZona.Perigo;
        if (!entrouEmPerigo) return;
        if (zona.EhMaquete && !StatusZona.RecebeLeituras(zona.Fonte)) return;

        if (_ultimoAlertaPorZona.TryGetValue(zona.Id, out var ultimo) &&
            DateTimeOffset.UtcNow - ultimo < IntervaloEntreAlertasDaZona)
        {
            logger.LogInformation("{Zona} voltou ao perigo, mas já houve alerta há menos de {Minutos} min. Email não reenviado.",
                zona.Nome, IntervaloEntreAlertasDaZona.TotalMinutes);
            return;
        }

        _ultimoAlertaPorZona[zona.Id] = DateTimeOffset.UtcNow;
        await alertas.EnviarParaTodosAsync($"perigo em {zona.Nome}", i => templates.AlertaZona(i, zona), ct);
    }

    // Clima: olha 30 s depois de ligar e, depois, a cada 10 minutos.
    private async Task VigiarClimaAsync(CancellationToken ct)
    {
        await Task.Delay(TimeSpan.FromSeconds(30), ct);
        var minutos = Math.Max(0.1, config.GetValue("Alertas:MinutosEntreChecagensDoClima", 10.0));
        using var relogio = new PeriodicTimer(TimeSpan.FromMinutes(minutos));
        do
        {
            try
            {
                await ChecarClimaAsync(ct);
            }
            catch (Exception erro) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning("Erro ao checar o clima: {Mensagem}", erro.Message);
            }
        } while (await relogio.WaitForNextTickAsync(ct));
    }

    public async Task ChecarClimaAsync(CancellationToken ct)
    {
        ClimaAtual clima;
        try
        {
            clima = await servicos.GetRequiredService<ClimaService>().ObterAsync(ct);
        }
        catch (Exception erro) when (!ct.IsCancellationRequested)
        {
            logger.LogInformation("Não deu pra checar o clima agora: {Mensagem}", erro.Message);
            return;
        }

        // Clima antigo (a Open-Meteo não respondeu): não dispara alerta com dado velho.
        if (clima.Desatualizado) return;

        var agora = DateTimeOffset.UtcNow;
        var hoje = DateOnly.FromDateTime(agora.ToOffset(TimeSpan.FromHours(-3)).DateTime);

        // ---------- Temporal ----------
        var emailDeTemporalEnviado = false;
        var motivo = MotivoDeTemporal(clima);
        if (motivo is null)
        {
            historico.FecharClima("temporal");
        }
        else
        {
            historico.AbrirClima("temporal", StatusZona.Perigo, motivo);
            if (inscricoes.UltimoAlertaDeTemporal != hoje)
            {
                inscricoes.MarcarAlertaDeTemporal(hoje);
                await alertas.EnviarParaTodosAsync("temporal", i => templates.AlertaTemporal(i, motivo, clima), ct);
                emailDeTemporalEnviado = true;
            }
        }

        // ---------- Chuva ----------
        var chovendo = ClimaService.EstaChovendoDeVerdade(clima, ChuvaMinimaMm);
        if (!chovendo)
        {
            historico.FecharClima("chuva");
            return;
        }

        var comecouAgora = !historico.TemClimaAtivo("chuva");
        historico.AbrirClima("chuva", StatusZona.Atencao,
            string.Create(new System.Globalization.CultureInfo("pt-BR"), $"{clima.Condicao}, {clima.PrecipitacaoMm:0.#} mm na última hora"));

        if (!comecouAgora) return;

        var ultimo = inscricoes.UltimoAlertaDeChuva;
        if (ultimo is not null && agora - ultimo < IntervaloEntreAlertasDeChuva)
        {
            logger.LogInformation("Começou a chover, mas já houve aviso de chuva há pouco. Email não reenviado.");
            return;
        }

        inscricoes.MarcarAlertaDeChuva(agora);
        // Se o email de temporal acabou de sair, ele já avisou: não manda dois de uma vez.
        if (emailDeTemporalEnviado) return;

        await alertas.EnviarParaTodosAsync("chuva", i => templates.AlertaChuva(i, clima), ct);
    }

    /// <summary>Devolve o motivo do alerta de temporal, ou null se o tempo estiver tranquilo.</summary>
    public string? MotivoDeTemporal(ClimaAtual clima)
    {
        var hoje = clima.PrevisaoHoje;

        if (ClimaService.EhTrovoada(clima.CodigoCondicao))
            return $"Está acontecendo uma trovoada agora em Ribeirão Preto ({clima.Condicao.ToLowerInvariant()}).";

        if (ClimaService.EhTrovoada(hoje.CodigoCondicao) && (hoje.ProbabilidadeChuva ?? 0) >= ChanceMinimaDeTrovoada)
            return $"A previsão indica temporal com trovoadas hoje, com {hoje.ProbabilidadeChuva}% de chance de chuva.";

        if (hoje.ChuvaMm >= ChuvaForteMm)
            return $"A previsão indica chuva forte hoje: cerca de {hoje.ChuvaMm:0} mm.";

        return null;
    }
}
