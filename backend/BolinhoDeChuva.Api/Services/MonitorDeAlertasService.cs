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
/// 2. Temporal (a cada 15 minutos): pela previsão do tempo, quando houver
///    trovoada agora, previsão de trovoada hoje, ou chuva forte prevista.
///    No máximo um alerta de temporal por dia.
/// </summary>
public class MonitorDeAlertasService(
    ZonasService zonas,
    InscricoesService inscricoes,
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

    protected override Task ExecuteAsync(CancellationToken ct) =>
        Task.WhenAll(VigiarZonasAsync(ct), VigiarTemporalAsync(ct), SincronizarPlanilhaAsync(ct));

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

    // Temporal: olha a previsão 30 s depois de ligar e, depois, a cada 15 minutos.
    private async Task VigiarTemporalAsync(CancellationToken ct)
    {
        await Task.Delay(TimeSpan.FromSeconds(30), ct);
        using var relogio = new PeriodicTimer(TimeSpan.FromMinutes(15));
        do
        {
            try
            {
                await ChecarTemporalAsync(ct);
            }
            catch (Exception erro) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning("Erro ao checar temporal: {Mensagem}", erro.Message);
            }
        } while (await relogio.WaitForNextTickAsync(ct));
    }

    private async Task ChecarTemporalAsync(CancellationToken ct)
    {
        if (inscricoes.Listar().Count == 0) return;

        var hoje = DateOnly.FromDateTime(DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-3)).DateTime);
        if (inscricoes.UltimoAlertaDeTemporal == hoje) return;

        ClimaAtual clima;
        try
        {
            clima = await servicos.GetRequiredService<ClimaService>().ObterAsync(ct);
        }
        catch (Exception erro) when (!ct.IsCancellationRequested)
        {
            logger.LogInformation("Não deu pra checar temporal agora (clima indisponível: {Mensagem}).", erro.Message);
            return;
        }

        var motivo = MotivoDeTemporal(clima);
        if (motivo is null) return;

        inscricoes.MarcarAlertaDeTemporal(hoje);
        await alertas.EnviarParaTodosAsync("temporal", i => templates.AlertaTemporal(i, motivo, clima), ct);
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
