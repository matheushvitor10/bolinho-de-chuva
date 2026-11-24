using System.Security.Cryptography;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace BolinhoDeChuva.Api.Services;

/// <summary>
/// Lê e grava o appsettings.Local.json (as configurações "secretas" deste
/// computador). É assim que a página de configuração do site salva o link do
/// Google sem ninguém precisar abrir o arquivo na mão.
/// </summary>
public class ConfigLocalService(IConfiguration config, IWebHostEnvironment ambiente, ILogger<ConfigLocalService> logger)
{
    private readonly object _trava = new();
    private string Arquivo => Path.Combine(ambiente.ContentRootPath, "appsettings.Local.json");

    private const string Cabecalho = """
        // ============================================================================
        // Configurações deste computador — NÃO vão pro GitHub e NÃO mande pra ninguém.
        // Este arquivo é preenchido pela página de configuração do site
        // (http://localhost:5080/configuracao.html). Não precisa editar na mão.
        // ============================================================================

        """;

    /// <summary>Grava valores (ex.: "Google:UrlScript") e recarrega a configuração na hora.</summary>
    public void Salvar(params (string Chave, string? Valor)[] valores)
    {
        lock (_trava)
        {
            var raiz = Ler();
            foreach (var (chave, valor) in valores)
            {
                var partes = chave.Split(':');
                var no = raiz;
                for (var i = 0; i < partes.Length - 1; i++)
                {
                    if (no[partes[i]] is not JsonObject filho)
                    {
                        filho = new JsonObject();
                        no[partes[i]] = filho;
                    }
                    no = filho;
                }
                no[partes[^1]] = valor;
            }

            var json = raiz.ToJsonString(new JsonSerializerOptions
            {
                WriteIndented = true,
                Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
            });
            File.WriteAllText(Arquivo, Cabecalho + json + Environment.NewLine);
        }

        if (config is IConfigurationRoot raizConfig) raizConfig.Reload();
        logger.LogInformation("Configurações salvas em appsettings.Local.json: {Chaves}", string.Join(", ", valores.Select(v => v.Chave)));
    }

    /// <summary>Chave secreta que o sistema usa para falar com o script do Google (criada uma vez só).</summary>
    public string ChaveDoGoogle()
    {
        var atual = config.ValorPreenchido("Google:Chave");
        if (!string.IsNullOrWhiteSpace(atual)) return atual;

        var nova = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        Salvar(("Google:Chave", nova));
        return nova;
    }

    private JsonObject Ler()
    {
        try
        {
            if (File.Exists(Arquivo))
            {
                var no = JsonNode.Parse(File.ReadAllText(Arquivo), documentOptions: new JsonDocumentOptions
                {
                    CommentHandling = JsonCommentHandling.Skip,
                    AllowTrailingCommas = true
                });
                if (no is JsonObject obj) return obj;
            }
        }
        catch (Exception erro)
        {
            logger.LogWarning("Não consegui ler {Arquivo} ({Mensagem}). Vou criar um novo.", Arquivo, erro.Message);
        }
        return new JsonObject();
    }
}

public static class ConfigExtensoes
{
    /// <summary>
    /// Pega o valor da configuração ignorando os vazios. Assim, um arquivo
    /// antigo com "Usuario": "" não apaga um valor preenchido em outro lugar.
    /// </summary>
    public static string ValorPreenchido(this IConfiguration config, string chave)
    {
        if (config is IConfigurationRoot raiz)
        {
            foreach (var fonte in raiz.Providers.Reverse())
            {
                if (fonte.TryGet(chave, out var valor) && !string.IsNullOrWhiteSpace(valor)) return valor;
            }
            return "";
        }
        return config[chave] ?? "";
    }
}
