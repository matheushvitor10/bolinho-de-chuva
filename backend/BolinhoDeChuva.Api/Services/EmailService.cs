using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Reflection;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;

namespace BolinhoDeChuva.Api.Services;

/// <summary>Um email pronto pra ser enviado.</summary>
public record MensagemEmail(
    string Para,
    string Assunto,
    string Html,
    string Texto,
    string Tipo,                 // "boas-vindas", "alerta-temporal", "alerta-zona" (usado no nome do arquivo de teste)
    string? LinkCancelar = null);

/// <summary>
/// Envia os emails.
///
/// Há três jeitos de enviar, nesta ordem de preferência:
///
/// 1. GOOGLE (recomendado): pelo script do Google da conta do projeto.
///    Vai por HTTPS, então funciona até em rede de escola. Configurado pela
///    página http://localhost:5500/config.html, sem terminal.
/// 2. GMAIL COM SENHA DE APP (SMTP): o jeito antigo. Algumas redes bloqueiam.
/// 3. MODO DE TESTE: nada é enviado; cada email é salvo na pasta
///    "emails-de-teste" da API, pra vocês verem como ficou.
///
/// As imagens do Bolin vão DENTRO do email (anexadas como "cid:"), então
/// aparecem no Gmail mesmo com o site rodando só no seu computador.
/// </summary>
public class EmailService
{
    private readonly IConfiguration _config;
    private readonly GoogleScriptService _google;
    private readonly ILogger<EmailService> _logger;
    private readonly string _pastaDeTeste;

    public const string MetodoGoogle = "google";
    public const string MetodoSmtp = "smtp";
    public const string MetodoTeste = "teste";

    // Imagens que podem aparecer no HTML como src="cid:nome"
    private static readonly Dictionary<string, (string Recurso, string Tipo)> Imagens = new()
    {
        ["bolin-corpo"] = ("BolinhoDeChuva.Api.Emails.bolin-email.jpg", MediaTypeNames.Image.Jpeg),
        ["bolin-avatar"] = ("BolinhoDeChuva.Api.Emails.bolin-avatar.png", "image/png"),
        ["bolin-alerta"] = ("BolinhoDeChuva.Api.Emails.bolin-alerta.png", "image/png")
    };
    private static readonly Dictionary<string, byte[]> CacheDeImagens = new();

    public EmailService(IConfiguration config, GoogleScriptService google, IWebHostEnvironment ambiente, ILogger<EmailService> logger)
    {
        _config = config;
        _google = google;
        _logger = logger;
        _pastaDeTeste = Path.Combine(ambiente.ContentRootPath, "emails-de-teste");

        switch (Metodo)
        {
            case MetodoGoogle:
                _logger.LogInformation("Emails: enviando pelo Google (script da conta do projeto).");
                break;
            case MetodoSmtp:
                _logger.LogInformation("Emails: enviando por {Servidor} como {Usuario} (senha de app).", Servidor, Usuario);
                break;
            default:
                _logger.LogWarning("Emails em MODO DE TESTE: nada é enviado de verdade (ficam salvos em {Pasta}). " +
                                   "Para ligar o envio, abra http://localhost:5500/config.html", _pastaDeTeste);
                break;
        }
    }

    // As configurações são lidas a cada envio: mudou na página de configuração, já vale.
    private string Usuario => _config.ValorPreenchido("Email:Usuario").Trim();

    // A senha de app do Google aparece em grupos ("abcd efgh ijkl mnop") e, ao
    // copiar, às vezes vêm espaços especiais invisíveis. Tiramos todos.
    private string Senha => Regex.Replace(_config.ValorPreenchido("Email:Senha"), @"[\s\u00A0\u2007\u202F\u200B]", "");
    private string Servidor => _config["Email:Servidor"] is { Length: > 0 } s ? s.Trim() : "smtp.gmail.com";
    private int Porta => _config.GetValue("Email:Porta", 587);
    public string NomeRemetente => _config["Email:NomeRemetente"] is { Length: > 0 } n ? n : "Bolin — Bolinho de Chuva";

    /// <summary>"google", "smtp" ou "teste".</summary>
    public string Metodo =>
        _google.Configurado ? MetodoGoogle :
        !string.IsNullOrWhiteSpace(Usuario) && !string.IsNullOrWhiteSpace(Senha) ? MetodoSmtp :
        MetodoTeste;

    public bool ModoTeste => Metodo == MetodoTeste;
    public string UsuarioSmtp => Usuario;
    public bool TemSenhaSmtp => Senha.Length > 0;

    public static byte[] LerImagem(string nome)
    {
        lock (CacheDeImagens)
        {
            if (CacheDeImagens.TryGetValue(nome, out var bytes)) return bytes;
            using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(Imagens[nome].Recurso)
                ?? throw new InvalidOperationException($"Imagem {nome} não encontrada dentro da API.");
            using var memoria = new MemoryStream();
            stream.CopyTo(memoria);
            return CacheDeImagens[nome] = memoria.ToArray();
        }
    }

    /// <summary>Envia um email. Devolve true se deu certo (ou se foi salvo, no modo de teste).</summary>
    public async Task<bool> EnviarAsync(MensagemEmail mensagem, CancellationToken ct = default)
    {
        try
        {
            var metodo = Metodo;

            if (metodo == MetodoGoogle)
            {
                var imagens = Imagens
                    .Where(i => mensagem.Html.Contains($"cid:{i.Key}"))
                    .Select(i => (i.Key, i.Value.Tipo, LerImagem(i.Key)));
                var r = await _google.EnviarEmailAsync(mensagem, NomeRemetente, imagens, ct);
                if (!r.Ok)
                {
                    _logger.LogWarning("Não consegui enviar o email \"{Tipo}\" para {Para} pelo Google: {Erro}",
                        mensagem.Tipo, ValidadorEmail.Mascarar(mensagem.Para), r.Erro);
                    return false;
                }
                _logger.LogInformation("Email \"{Tipo}\" enviado pelo Google para {Para}.", mensagem.Tipo, ValidadorEmail.Mascarar(mensagem.Para));
                return true;
            }

            using var email = MontarMailMessage(mensagem);

            if (metodo == MetodoTeste)
            {
                SalvarNaPastaDeTeste(mensagem, email);
                return true;
            }

            using var smtp = CriarClienteSmtp();
            await smtp.SendMailAsync(email, ct);

            _logger.LogInformation("Email \"{Tipo}\" enviado para {Para}.", mensagem.Tipo, ValidadorEmail.Mascarar(mensagem.Para));
            return true;
        }
        catch (Exception erro) when (erro is not OperationCanceledException)
        {
            _logger.LogWarning("Não consegui enviar o email \"{Tipo}\" para {Para}: {Mensagem}{Dica}",
                mensagem.Tipo, ValidadorEmail.Mascarar(mensagem.Para), erro.Message, Dica(erro));
            return false;
        }
    }

    private SmtpClient CriarClienteSmtp() => new(Servidor, Porta)
    {
        EnableSsl = true,
        DeliveryMethod = SmtpDeliveryMethod.Network,
        UseDefaultCredentials = false,
        Credentials = new NetworkCredential(Usuario, Senha),
        Timeout = 20000
    };

    private MailMessage MontarMailMessage(MensagemEmail m)
    {
        var remetente = ModoTeste ? "bolin@bolinhodechuva.teste" : Usuario;

        var email = new MailMessage
        {
            From = new MailAddress(remetente, NomeRemetente, Encoding.UTF8),
            Subject = m.Assunto,
            SubjectEncoding = Encoding.UTF8,
            HeadersEncoding = Encoding.UTF8,
            BodyEncoding = Encoding.UTF8
        };
        email.To.Add(m.Para);

        if (m.LinkCancelar is not null)
        {
            // Faz o Gmail mostrar o botão "Cancelar inscrição" lá em cima do email.
            email.Headers.Add("List-Unsubscribe", $"<{m.LinkCancelar}>");
        }

        var texto = AlternateView.CreateAlternateViewFromString(m.Texto, Encoding.UTF8, MediaTypeNames.Text.Plain);
        var html = AlternateView.CreateAlternateViewFromString(m.Html, Encoding.UTF8, MediaTypeNames.Text.Html);

        foreach (var (nome, (_, tipo)) in Imagens)
        {
            if (!m.Html.Contains($"cid:{nome}")) continue;
            html.LinkedResources.Add(new LinkedResource(new MemoryStream(LerImagem(nome)), tipo)
            {
                ContentId = nome,
                TransferEncoding = TransferEncoding.Base64
            });
        }

        email.AlternateViews.Add(texto);
        email.AlternateViews.Add(html);
        return email;
    }

    private void SalvarNaPastaDeTeste(MensagemEmail m, MailMessage email)
    {
        Directory.CreateDirectory(_pastaDeTeste);
        var nomeBase = $"{DateTime.Now:yyyy-MM-dd_HH-mm-ss}_{m.Tipo}_{m.Para.Split('@')[0]}";

        // 1) Uma versão .html, pra abrir com dois cliques no navegador.
        //    As imagens "cid:" viram imagens embutidas, só pra visualizar.
        var htmlParaVer = m.Html;
        foreach (var (nome, (_, tipo)) in Imagens)
            htmlParaVer = htmlParaVer.Replace($"cid:{nome}", $"data:{tipo};base64,{Convert.ToBase64String(LerImagem(nome))}");
        var cabecalho = $"<!-- Para: {m.Para} | Assunto: {m.Assunto} -->\n";
        File.WriteAllText(Path.Combine(_pastaDeTeste, nomeBase + ".html"), cabecalho + htmlParaVer, Encoding.UTF8);

        // 2) O email completo (.eml), igualzinho ao que seria enviado.
        using var smtp = new SmtpClient
        {
            DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory,
            PickupDirectoryLocation = _pastaDeTeste
        };
        smtp.Send(email);

        _logger.LogInformation("[modo de teste] Email \"{Tipo}\" para {Para} salvo em {Arquivo}.html",
            m.Tipo, ValidadorEmail.Mascarar(m.Para), Path.Combine("emails-de-teste", nomeBase));
    }

    private static string Dica(Exception erro)
    {
        var texto = (erro.Message + " " + erro.InnerException?.Message + " " + erro.InnerException?.InnerException?.Message).ToLowerInvariant();
        if (texto.Contains("authentication") || texto.Contains("5.7.0") || texto.Contains("5.7.8") || texto.Contains("5.7.9") ||
            texto.Contains("username and password") || texto.Contains("autentica"))
            return " → O Gmail recusou o usuário/senha. Use uma SENHA DE APP de 16 letras (não a senha normal da conta) " +
                   "e confira se o Usuario é o Gmail completo (ex.: nome@gmail.com).";
        if (texto.Contains("certificate") || texto.Contains("certificado") || texto.Contains("ssl") || texto.Contains("tls"))
            return " → A conexão segura com o Gmail foi bloqueada. Costuma ser o antivírus ou a rede da escola " +
                   "\"abrindo\" a conexão. Teste em outra rede (ex.: roteador do celular).";
        if (texto.Contains("timed out") || texto.Contains("tempo limite") || texto.Contains("unable to connect") ||
            texto.Contains("failure sending") || texto.Contains("falha") || texto.Contains("refused") || texto.Contains("recus"))
            return " → Não consegui conectar no servidor de email. Redes de escola costumam bloquear a porta 587: " +
                   "teste em casa ou no roteador do celular.";
        return "";
    }

    // ======================================================================
    // Diagnóstico ("npm run teste-email"): confere passo a passo o que pode dar errado.
    // ======================================================================
    public record PassoDiagnostico(string Passo, bool Ok, string Detalhe);

    public async Task<List<PassoDiagnostico>> DiagnosticarAsync(string? para, CancellationToken ct)
    {
        var passos = new List<PassoDiagnostico>();

        if (Metodo == MetodoGoogle)
        {
            var ping = await _google.PingAsync(ct);
            if (!ping.Ok)
            {
                passos.Add(new("Conexão com o Google", false, ping.Erro ?? "sem resposta"));
                return passos;
            }
            var conta = ping.Dados?["conta"]?.GetValue<string>() ?? "conta do Google";
            var cota = ping.Dados?["cotaRestante"]?.GetValue<int>();
            passos.Add(new("Conexão com o Google", true, $"conectado como {conta}" + (cota is int c ? $" (ainda pode enviar {c} emails hoje)" : "")));

            var destinoGoogle = string.IsNullOrWhiteSpace(para) ? conta : para.Trim();
            var teste = new MensagemEmail(destinoGoogle, "Teste do Bolinho de Chuva ✔",
                "<p style=\"font-family:Arial,sans-serif;font-size:16px\">Se você está lendo isto, o envio de emails do " +
                "<strong>Bolinho de Chuva</strong> está funcionando! — Bolin</p>",
                "Se você está lendo isto, o envio de emails do Bolinho de Chuva está funcionando! — Bolin", "teste");
            var envio = await _google.EnviarEmailAsync(teste, NomeRemetente, [], ct);
            passos.Add(envio.Ok
                ? new("Envio de teste", true, $"email enviado para {destinoGoogle}. Confira a caixa de entrada (e o spam).")
                : new("Envio de teste", false, envio.Erro ?? "erro desconhecido"));
            return passos;
        }

        if (Metodo == MetodoTeste)
        {
            passos.Add(new("Envio de email ligado", false,
                "o sistema está em MODO DE TESTE (salva os emails na pasta emails-de-teste em vez de enviar). " +
                "Conecte o Google na página http://localhost:5500/config.html."));
            return passos;
        }

        // ---- Gmail com senha de app (SMTP) ----
        var usuarioOk = ValidadorEmail.Validar(Usuario).Valido;
        passos.Add(new("Usuário", usuarioOk, usuarioOk ? Usuario : $"\"{Usuario}\" não é um email válido."));

        var tamanho = Senha.Length;
        passos.Add(new("Senha de app", tamanho == 16, tamanho == 16
            ? "16 letras (formato certo)"
            : $"tem {tamanho} caracteres; a senha de app do Google tem 16 letras. Será que é a senha normal da conta?"));

        try
        {
            using var tcp = new TcpClient();
            using var limite = CancellationTokenSource.CreateLinkedTokenSource(ct);
            limite.CancelAfter(TimeSpan.FromSeconds(8));
            await tcp.ConnectAsync(Servidor, Porta, limite.Token);
            passos.Add(new($"Conexão com {Servidor}:{Porta}", true, "a rede deixa conectar"));
        }
        catch (Exception erro) when (!ct.IsCancellationRequested)
        {
            passos.Add(new($"Conexão com {Servidor}:{Porta}", false,
                $"não conectou ({erro.Message}). A rede bloqueia esse tipo de envio. " +
                "Use o Google (página http://localhost:5500/config.html), que funciona nessas redes."));
            return passos;
        }

        var destino = string.IsNullOrWhiteSpace(para) ? Usuario : para.Trim();
        try
        {
            using var email = new MailMessage
            {
                From = new MailAddress(Usuario, NomeRemetente, Encoding.UTF8),
                Subject = "Teste do Bolinho de Chuva ✔",
                SubjectEncoding = Encoding.UTF8,
                BodyEncoding = Encoding.UTF8,
                Body = "Se você está lendo isto, o envio de emails do Bolinho de Chuva está funcionando! — Bolin"
            };
            email.To.Add(destino);
            using var smtp = CriarClienteSmtp();
            await smtp.SendMailAsync(email, ct);
            passos.Add(new("Envio de teste", true, $"email enviado para {destino}. Confira a caixa de entrada (e o spam)."));
        }
        catch (Exception erro) when (erro is not OperationCanceledException)
        {
            passos.Add(new("Envio de teste", false, erro.Message + Dica(erro)));
        }

        return passos;
    }
}
