using System.Text.Json;
using BolinhoDeChuva.Api.Models;

namespace BolinhoDeChuva.Api.Services;

/// <summary>
/// Guarda quem se cadastrou para receber alertas:
/// - no arquivo dados/inscritos.json (dentro da pasta da API), sempre;
/// - e, com o Google conectado, também na planilha "Bolinho de Chuva — Inscritos"
///   do Google Drive, que funciona como banco de dados: dá pra abrir e ver a
///   lista, e ela não se perde se trocarem de computador.
/// </summary>
public class InscricoesService
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    private readonly object _trava = new();
    private readonly string _arquivo;
    private readonly ILogger<InscricoesService> _logger;
    private readonly GoogleScriptService _google;
    private EstadoInscricoes _estado;

    public InscricoesService(IWebHostEnvironment ambiente, GoogleScriptService google, ILogger<InscricoesService> logger)
    {
        _logger = logger;
        _google = google;
        var pasta = Path.Combine(ambiente.ContentRootPath, "dados");
        Directory.CreateDirectory(pasta);
        _arquivo = Path.Combine(pasta, "inscritos.json");
        _estado = Carregar();
        _logger.LogInformation("Inscritos para alertas por email: {Total}", _estado.Inscritos.Count);
    }

    public IReadOnlyList<Inscrito> Listar()
    {
        lock (_trava) return _estado.Inscritos.ToList();
    }

    /// <summary>Cadastra o email. Devolve "novo = false" se ele já estava cadastrado.</summary>
    public (Inscrito Inscrito, bool Novo) Adicionar(string email)
    {
        lock (_trava)
        {
            var existente = _estado.Inscritos.FirstOrDefault(i => i.Email == email);
            if (existente is not null) return (existente, false);

            var novo = new Inscrito(email, Guid.NewGuid().ToString("N"), DateTimeOffset.UtcNow);
            _estado.Inscritos.Add(novo);
            Salvar();
            NoGoogle(ct => _google.SalvarInscritoAsync(novo.Email, novo.Token, novo.InscritoEm, ct), "salvar inscrito");
            return (novo, true);
        }
    }

    public Inscrito? BuscarPorToken(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        lock (_trava) return _estado.Inscritos.FirstOrDefault(i => i.Token == token);
    }

    public bool Remover(string? token)
    {
        lock (_trava)
        {
            var removidos = _estado.Inscritos.RemoveAll(i => i.Token == token);
            if (removidos > 0)
            {
                Salvar();
                NoGoogle(ct => _google.RemoverInscritoAsync(token!, ct), "remover inscrito");
            }
            return removidos > 0;
        }
    }

    public DateOnly? UltimoAlertaDeTemporal
    {
        get { lock (_trava) return _estado.UltimoAlertaDeTemporal; }
    }

    public void MarcarAlertaDeTemporal(DateOnly dia)
    {
        lock (_trava)
        {
            _estado.UltimoAlertaDeTemporal = dia;
            Salvar();
        }
    }

    /// <summary>
    /// Junta a lista deste computador com a da planilha do Google:
    /// quem está só na planilha vem pra cá, e quem está só aqui vai pra planilha.
    /// </summary>
    public async Task<(int Trazidos, int Levados, string? Erro)> SincronizarComGoogleAsync(CancellationToken ct = default)
    {
        if (!_google.Configurado) return (0, 0, "O Google não está conectado.");

        var resposta = await _google.ListarInscritosAsync(ct);
        if (!resposta.Ok) return (0, 0, resposta.Erro);

        var daPlanilha = new List<Inscrito>();
        foreach (var no in resposta.Dados?["inscritos"]?.AsArray() ?? [])
        {
            var email = no?["email"]?.GetValue<string>()?.Trim().ToLowerInvariant();
            var token = no?["token"]?.GetValue<string>()?.Trim();
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(token)) continue;
            var data = DateTimeOffset.TryParse(no?["inscritoEm"]?.GetValue<string>(), out var d) ? d : DateTimeOffset.UtcNow;
            daPlanilha.Add(new Inscrito(email, token, data));
        }

        List<Inscrito> paraLevar;
        var trazidos = 0;
        lock (_trava)
        {
            foreach (var i in daPlanilha.Where(i => _estado.Inscritos.All(x => x.Email != i.Email)))
            {
                _estado.Inscritos.Add(i);
                trazidos++;
            }
            if (trazidos > 0) Salvar();
            paraLevar = _estado.Inscritos.Where(i => daPlanilha.All(x => x.Email != i.Email)).ToList();
        }

        foreach (var i in paraLevar)
            await _google.SalvarInscritoAsync(i.Email, i.Token, i.InscritoEm, ct);

        _logger.LogInformation("Planilha do Google sincronizada: {Trazidos} inscrito(s) trazido(s), {Levados} levado(s).", trazidos, paraLevar.Count);
        return (trazidos, paraLevar.Count, null);
    }

    // Manda pra planilha do Google em segundo plano (o site não espera por isso).
    private void NoGoogle(Func<CancellationToken, Task<GoogleScriptService.Resposta>> acao, string descricao)
    {
        if (!_google.Configurado) return;
        _ = Task.Run(async () =>
        {
            var r = await acao(CancellationToken.None);
            if (!r.Ok) _logger.LogWarning("Planilha do Google ({Descricao}): {Erro}", descricao, r.Erro);
        });
    }

    private EstadoInscricoes Carregar()
    {
        try
        {
            if (File.Exists(_arquivo))
                return JsonSerializer.Deserialize<EstadoInscricoes>(File.ReadAllText(_arquivo), Json) ?? new();
        }
        catch (Exception erro)
        {
            _logger.LogWarning("Não consegui ler {Arquivo}: {Mensagem}. Começando com a lista vazia.", _arquivo, erro.Message);
        }
        return new();
    }

    private void Salvar()
    {
        // Escreve num arquivo temporário e depois troca: se a API cair no meio,
        // o arquivo antigo continua inteiro.
        var temporario = _arquivo + ".tmp";
        File.WriteAllText(temporario, JsonSerializer.Serialize(_estado, Json));
        File.Move(temporario, _arquivo, overwrite: true);
    }
}
