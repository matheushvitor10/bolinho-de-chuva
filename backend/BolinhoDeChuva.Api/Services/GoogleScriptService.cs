using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace BolinhoDeChuva.Api.Services;

/// <summary>
/// Conversa com o script do Google (Apps Script) da conta do projeto.
/// Tudo vai por HTTPS, a mesma "porta" de qualquer site, por isso funciona
/// em redes de escola que bloqueiam o envio de email comum.
/// </summary>
public class GoogleScriptService(IHttpClientFactory fabrica, IConfiguration config, ILogger<GoogleScriptService> logger)
{
    public string Url => config.ValorPreenchido("Google:UrlScript").Trim();
    private string Chave => config.ValorPreenchido("Google:Chave").Trim();

    public bool Configurado => Url.Length > 0 && Chave.Length > 0;

    /// <summary>Resposta do script: ok + dados, ou ok = false + erro (sempre em português).</summary>
    public record Resposta(bool Ok, string? Erro, JsonObject? Dados);

    public Task<Resposta> PingAsync(CancellationToken ct = default, string? urlOutra = null) =>
        ChamarAsync(new JsonObject { ["acao"] = "ping" }, ct, urlOutra);

    public Task<Resposta> EnviarEmailAsync(MensagemEmail m, string nomeRemetente,
        IEnumerable<(string Nome, string Tipo, byte[] Bytes)> imagens, CancellationToken ct = default)
    {
        var lista = new JsonArray();
        foreach (var (nome, tipo, bytes) in imagens)
            lista.Add(new JsonObject { ["nome"] = nome, ["tipo"] = tipo, ["base64"] = Convert.ToBase64String(bytes) });

        return ChamarAsync(new JsonObject
        {
            ["acao"] = "enviar",
            ["para"] = m.Para,
            ["assunto"] = m.Assunto,
            ["html"] = m.Html,
            ["texto"] = m.Texto,
            ["nomeRemetente"] = nomeRemetente,
            ["imagens"] = lista
        }, ct);
    }

    public Task<Resposta> SalvarInscritoAsync(string email, string token, DateTimeOffset inscritoEm, CancellationToken ct = default) =>
        ChamarAsync(new JsonObject
        {
            ["acao"] = "salvarInscrito",
            ["email"] = email,
            ["token"] = token,
            ["inscritoEm"] = inscritoEm.ToString("O")
        }, ct);

    public Task<Resposta> RemoverInscritoAsync(string token, CancellationToken ct = default) =>
        ChamarAsync(new JsonObject { ["acao"] = "removerInscrito", ["token"] = token }, ct);

    public Task<Resposta> ListarInscritosAsync(CancellationToken ct = default) =>
        ChamarAsync(new JsonObject { ["acao"] = "listarInscritos" }, ct);

    private async Task<Resposta> ChamarAsync(JsonObject pedido, CancellationToken ct, string? urlOutra = null)
    {
        var url = urlOutra ?? Url;
        if (string.IsNullOrWhiteSpace(url)) return new(false, "O Google ainda não foi conectado.", null);

        pedido["chave"] = Chave;
        var acao = pedido["acao"]?.GetValue<string>();

        try
        {
            var cliente = fabrica.CreateClient("google");
            using var conteudo = new StringContent(pedido.ToJsonString(), Encoding.UTF8, "application/json");
            using var resposta = await cliente.PostAsync(url, conteudo, ct);
            var corpo = await resposta.Content.ReadAsStringAsync(ct);

            if ((int)resposta.StatusCode == 404)
                return new(false, "O Google não encontrou o script nesse link. Confira se copiou o link inteiro da implantação (termina em /exec).", null);

            JsonObject? dados = null;
            try { dados = JsonNode.Parse(corpo) as JsonObject; } catch (JsonException) { }

            if (dados is null)
            {
                // Quando a implantação não está liberada para "Qualquer pessoa", o Google
                // devolve uma página de login em vez dos dados.
                return new(false, "O Google respondeu com uma página em vez de dados. Na implantação do script, " +
                                  "\"Quem pode acessar\" precisa estar como \"Qualquer pessoa\".", null);
            }

            var ok = dados["ok"]?.GetValue<bool>() == true;
            var erro = dados["erro"]?.GetValue<string>();
            if (!ok)
            {
                logger.LogWarning("Google ({Acao}) recusou: {Erro}", acao, erro);
                return new(false, TraduzirErro(erro), dados);
            }
            return new(true, null, dados);
        }
        catch (Exception erro) when (erro is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            logger.LogWarning("Não consegui falar com o Google ({Acao}): {Mensagem}", acao, erro.Message);
            return new(false, $"Não consegui falar com o Google ({erro.Message}). Confira a internet deste computador.", null);
        }
    }

    private static string TraduzirErro(string? erro)
    {
        var e = erro ?? "erro desconhecido";
        if (e.Contains("too many times", StringComparison.OrdinalIgnoreCase) || e.Contains("quota", StringComparison.OrdinalIgnoreCase))
            return "O limite diário de emails da conta do Google acabou (100 por dia). Amanhã ele volta.";
        if (e.Contains("permission", StringComparison.OrdinalIgnoreCase) || e.Contains("authoriz", StringComparison.OrdinalIgnoreCase))
            return "O script ainda não tem permissão. No editor do script, rode a função \"autorizar\" e aceite as permissões.";
        if (e.Contains("Invalid email", StringComparison.OrdinalIgnoreCase))
            return "O Google disse que o email de destino é inválido.";
        return e;
    }
}
