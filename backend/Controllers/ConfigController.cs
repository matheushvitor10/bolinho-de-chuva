using System.Net;
using System.Reflection;
using System.Text.RegularExpressions;
using BolinhoDeChuva.Api.Models;
using BolinhoDeChuva.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace BolinhoDeChuva.Api.Controllers;

/// <summary>
/// Rotas da página de configuração (http://localhost:5080/configuracao.html).
///
/// SEGURANÇA: só respondem para quem está NO PRÓPRIO COMPUTADOR que roda a API
/// (localhost). Para qualquer outro, é como se não existissem (404).
/// </summary>
[ApiController]
[Route("api/config")]
[SomenteNesteComputador]
public class ConfigController(
    EmailService email,
    GoogleScriptService google,
    ConfigLocalService configLocal,
    InscricoesService inscricoes,
    AlertasService alertas,
    EmailTemplates templates,
    ZonasService zonas,
    IServiceProvider servicos) : ControllerBase
{
    private static readonly Regex UrlDoScript = new(
        @"^(https://script\.google\.com/(macros|a/macros/[^/]+)/s/[A-Za-z0-9_-]+/exec|http://(localhost|127\.0\.0\.1):\d+/.+)$",
        RegexOptions.Compiled);

    public record UrlEntrada(string? Url);
    public record EmailEntrada(string? Para);
    public record SenhaEntrada(string? Senha);

    /// <summary>GET /api/config — só diz "estou aqui" (o site usa pra mostrar o link "Configurar emails").</summary>
    [HttpGet("")]
    public IActionResult Disponivel() => Ok(new { ok = true });

    /// <summary>GET /api/config/status — como está o envio de emails agora.</summary>
    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        string? conta = null, planilha = null, erroGoogle = null;
        int? cota = null;
        if (google.Configurado)
        {
            var ping = await google.PingAsync(ct);
            if (ping.Ok)
            {
                conta = ping.Dados?["conta"]?.GetValue<string>();
                planilha = ping.Dados?["planilha"]?.GetValue<string>();
                cota = ping.Dados?["cotaRestante"]?.GetValue<int>();
            }
            else erroGoogle = ping.Erro;
        }

        // Clima: confere se a Open-Meteo está respondendo agora.
        object clima;
        try
        {
            var c = await servicos.GetRequiredService<ClimaService>().ObterAsync(ct);
            clima = new { ok = !c.Desatualizado, c.Condicao, c.Temperatura, c.EstaChovendo, c.Desatualizado, erro = (string?)null };
        }
        catch (Exception erro) when (!ct.IsCancellationRequested)
        {
            clima = new { ok = false, condicao = (string?)null, temperatura = (double?)null, estaChovendo = false, desatualizado = false, erro = erro.Message };
        }

        return Ok(new
        {
            clima,
            metodo = email.Metodo,
            google = new { conectado = google.Configurado, funcionando = google.Configurado && erroGoogle is null, conta, planilha, cotaRestante = cota, erro = erroGoogle },
            smtp = new { usuario = email.UsuarioSmtp, temSenha = email.TemSenhaSmtp },
            inscritos = inscricoes.Listar().Count
        });
    }

    /// <summary>GET /api/config/codigo-google — o código para colar no Google (já com a chave secreta).</summary>
    [HttpGet("codigo-google")]
    public IActionResult CodigoGoogle()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("script-google.js")!;
        using var leitor = new StreamReader(stream);
        var codigo = leitor.ReadToEnd().Replace("{{CHAVE}}", configLocal.ChaveDoGoogle());
        return Ok(new { codigo });
    }

    /// <summary>POST /api/config/google { "url": "https://script.google.com/macros/s/.../exec" }</summary>
    [HttpPost("google")]
    public async Task<IActionResult> ConectarGoogle([FromBody] UrlEntrada entrada, CancellationToken ct)
    {
        var url = (entrada.Url ?? "").Trim();
        if (url.EndsWith("/dev"))
            return Ok(Falha("Esse é o link de TESTE (termina em /dev). Use o link da implantação, que termina em /exec."));
        if (!UrlDoScript.IsMatch(url))
            return Ok(Falha("Esse link não parece ser de um script do Google. Ele começa com https://script.google.com/macros/s/ e termina com /exec."));

        configLocal.ChaveDoGoogle(); // garante que a chave existe

        var passos = new List<EmailService.PassoDiagnostico>();
        var ping = await google.PingAsync(ct, url);
        if (!ping.Ok)
        {
            passos.Add(new("Conexão com o Google", false, ping.Erro ?? "sem resposta"));
            return Ok(new { ok = false, passos });
        }

        configLocal.Salvar(("Google:UrlScript", url));
        var conta = ping.Dados?["conta"]?.GetValue<string>();
        passos.Add(new("Conexão com o Google", true, $"conectado como {conta}"));

        var sincronia = await inscricoes.SincronizarComGoogleAsync(ct);
        passos.Add(sincronia.Erro is null
            ? new("Planilha de inscritos", true, $"pronta ({inscricoes.Listar().Count} inscrito(s); {sincronia.Trazidos} trazido(s) da planilha, {sincronia.Levados} enviado(s) para ela)")
            : new("Planilha de inscritos", false, sincronia.Erro));

        return Ok(new { ok = passos.All(p => p.Ok), passos, planilha = ping.Dados?["planilha"]?.GetValue<string>() });
    }

    /// <summary>POST /api/config/google/desconectar — volta a não usar o Google.</summary>
    [HttpPost("google/desconectar")]
    public IActionResult DesconectarGoogle()
    {
        configLocal.Salvar(("Google:UrlScript", ""));
        return Ok(new { ok = true });
    }

    /// <summary>POST /api/config/testar { "para": "alguem@gmail.com" } — confere tudo e manda um email de teste.</summary>
    [HttpPost("testar")]
    public async Task<IActionResult> Testar([FromBody] EmailEntrada entrada, CancellationToken ct)
    {
        var para = (entrada.Para ?? "").Trim();
        if (para.Length > 0 && !ValidadorEmail.Validar(para).Valido)
            return Ok(Falha("Esse email não parece válido."));

        var passos = await email.DiagnosticarAsync(para.Length > 0 ? para : null, ct);
        return Ok(new { ok = passos.All(p => p.Ok), passos });
    }

    /// <summary>POST /api/config/alerta-teste?tipo=chuva|temporal|zona — manda um alerta de teste para todos os inscritos.</summary>
    [HttpPost("alerta-teste")]
    public async Task<IActionResult> AlertaTeste([FromQuery] string tipo = "zona", CancellationToken ct = default)
    {
        if (inscricoes.Listar().Count == 0)
            return Ok(Falha("Ninguém está inscrito ainda. Cadastre um email na página inicial do site primeiro."));

        (int Enviados, int Total) r;
        if (tipo == "chuva")
        {
            var climaChuva = new ClimaAtual("Ribeirão Preto, SP", "", 22, 2.4, 92, 14, "Chuva moderada", 63, true,
                new PrevisaoDia("", "Chuva moderada", 63, 18, 85, 26, 19), []);
            r = await alertas.EnviarParaTodosAsync("teste de chuva", i => templates.AlertaChuva(i, climaChuva), ct);
        }
        else if (tipo == "temporal")
        {
            var clima = new ClimaAtual("Ribeirão Preto, SP", "", 24, 3.2, 90, 28, "Trovoada", 95, true,
                new PrevisaoDia("", "Trovoada", 95, 42, 95, 27, 19), []);
            r = await alertas.EnviarParaTodosAsync("teste de temporal",
                i => templates.AlertaTemporal(i, "Este é um alerta de TESTE: a previsão indica temporal com trovoadas hoje.", clima), ct);
        }
        else
        {
            var zona = zonas.ObterTodas().First(z => !z.EhMaquete && z.Status == StatusZona.Perigo);
            r = await alertas.EnviarParaTodosAsync("teste de alagamento", i => templates.AlertaZona(i, zona), ct);
        }

        var ok = r.Enviados == r.Total;
        var onde = email.ModoTeste ? " (modo de teste: salvos na pasta emails-de-teste)" : "";
        return Ok(new
        {
            ok,
            passos = new[]
            {
                new EmailService.PassoDiagnostico("Alerta de teste", ok, $"enviado para {r.Enviados} de {r.Total} inscrito(s){onde}.")
            }
        });
    }

    /// <summary>POST /api/config/sincronizar — junta a lista deste computador com a planilha do Google.</summary>
    [HttpPost("sincronizar")]
    public async Task<IActionResult> Sincronizar(CancellationToken ct)
    {
        var r = await inscricoes.SincronizarComGoogleAsync(ct);
        return Ok(r.Erro is null
            ? new { ok = true, passos = new[] { new EmailService.PassoDiagnostico("Planilha de inscritos", true, $"{r.Trazidos} trazido(s) da planilha, {r.Levados} enviado(s) para ela.") } }
            : Falha(r.Erro));
    }

    /// <summary>POST /api/config/senha-app { "senha": "abcd efgh ijkl mnop" } — opção alternativa (SMTP).</summary>
    [HttpPost("senha-app")]
    public IActionResult SalvarSenhaApp([FromBody] SenhaEntrada entrada)
    {
        configLocal.Salvar(("Email:Senha", (entrada.Senha ?? "").Trim()));
        return Ok(new { ok = true });
    }

    private static object Falha(string mensagem) => new
    {
        ok = false,
        passos = new[] { new EmailService.PassoDiagnostico("Configuração", false, mensagem) }
    };
}

/// <summary>Só deixa passar pedidos que vêm do próprio computador (localhost).</summary>
public class SomenteNesteComputadorAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext contexto)
    {
        // Na hospedagem, a página de configuração nunca funciona: lá as
        // configurações vêm das variáveis de ambiente do Render.
        var ip = contexto.HttpContext.Connection.RemoteIpAddress;
        if (Hospedagem.EstaHospedado || ip is null || !IPAddress.IsLoopback(ip))
            contexto.Result = new NotFoundResult();
    }
}
