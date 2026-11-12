using System.Net;
using BolinhoDeChuva.Api.Models;
using BolinhoDeChuva.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BolinhoDeChuva.Api.Controllers;

[ApiController]
[Route("api/emails")]
public class EmailsController(
    InscricoesService inscricoes,
    EmailService email,
    EmailTemplates templates,
    AlertasService alertas,
    ZonasService zonas,
    IServiceProvider servicos,
    IWebHostEnvironment ambiente,
    ILogger<EmailsController> logger) : ControllerBase
{
    /// <summary>
    /// POST /api/emails/inscrever   { "email": "fulano@gmail.com" }
    /// Cadastra o email e manda o email de boas-vindas do Bolin.
    /// </summary>
    [HttpPost("inscrever")]
    [EnableRateLimiting("inscricao")]
    public async Task<IActionResult> Inscrever([FromBody] InscricaoEntrada? entrada, CancellationToken ct)
    {
        var validacao = ValidadorEmail.Validar(entrada?.Email);
        if (!validacao.Valido)
        {
            return BadRequest(new { erro = validacao.Erro, sugestao = validacao.Sugestao });
        }

        var (inscrito, novo) = inscricoes.Adicionar(validacao.Email!);
        if (!novo)
        {
            return Ok(new
            {
                mensagem = "Esse email já está cadastrado. Os alertas vão continuar chegando nele.",
                jaInscrito = true
            });
        }

        logger.LogInformation("Novo inscrito: {Email}", ValidadorEmail.Mascarar(inscrito.Email));
        var enviado = await email.EnviarAsync(templates.BoasVindas(inscrito), ct);

        string mensagem;
        if (email.ModoTeste)
            mensagem = "Cadastro feito! Atenção: o envio de email ainda está em modo de teste, então o email de boas-vindas " +
                       "foi salvo na pasta emails-de-teste da API, e não enviado. Para ligar o envio, abra a página http://localhost:5500/config.html.";
        else if (enviado)
            mensagem = $"Pronto! O Bolin mandou um email de boas-vindas para {inscrito.Email}. " +
                       "Se não aparecer em alguns minutos, olhe a caixa de spam ou promoções.";
        else
            mensagem = "Cadastro feito, mas o email de boas-vindas não pôde ser enviado agora. " +
                       "Quem cuida do sistema pode ver o motivo na página http://localhost:5500/config.html.";

        return Ok(new { mensagem, emailEnviado = enviado && !email.ModoTeste, modoTeste = email.ModoTeste });
    }

    /// <summary>
    /// GET /api/emails/cancelar?token=...  (o link que vai no rodapé de cada email)
    /// Mostra uma página com um botão de confirmação. A inscrição só é cancelada
    /// quando a pessoa clica no botão, porque alguns programas de email "abrem"
    /// os links sozinhos para checar se são seguros.
    /// </summary>
    [HttpGet("cancelar")]
    public IActionResult PaginaCancelar([FromQuery] string? token)
    {
        var inscrito = inscricoes.BuscarPorToken(token);
        if (inscrito is null)
        {
            return Pagina("Inscrição não encontrada",
                "<p>Esse link não está mais valendo. Talvez a inscrição já tenha sido cancelada.</p>");
        }

        return Pagina("Cancelar inscrição", $"""
            <p>Quer mesmo parar de receber os alertas de temporal e alagamento em <strong>{WebUtility.HtmlEncode(inscrito.Email)}</strong>?</p>
            <form method="post" action="cancelar">
              <input type="hidden" name="token" value="{WebUtility.HtmlEncode(inscrito.Token)}">
              <button type="submit">Sim, cancelar inscrição</button>
            </form>
            """);
    }

    /// <summary>POST /api/emails/cancelar — confirma o cancelamento (botão da página acima).</summary>
    [HttpPost("cancelar")]
    [Consumes("application/x-www-form-urlencoded")]
    public IActionResult Cancelar([FromForm] string? token)
    {
        var inscrito = inscricoes.BuscarPorToken(token);
        if (inscrito is null || !inscricoes.Remover(token))
        {
            return Pagina("Inscrição não encontrada",
                "<p>Esse link não está mais valendo. Talvez a inscrição já tenha sido cancelada.</p>");
        }

        logger.LogInformation("Inscrição cancelada: {Email}", ValidadorEmail.Mascarar(inscrito.Email));
        return Pagina("Inscrição cancelada",
            "<p>Pronto, você não vai mais receber nossos emails. O Bolin vai sentir sua falta! 🥲</p>" +
            "<p>Se mudar de ideia, é só se cadastrar de novo no site.</p>");
    }

    /// <summary>GET /api/emails/bolin.png — a carinha do Bolin usada na página de cancelamento.</summary>
    [HttpGet("bolin.png")]
    public IActionResult ImagemBolin() => File(EmailService.LerImagem("bolin-avatar"), "image/png");

    /// <summary>
    /// POST /api/emails/teste-alerta?tipo=temporal   ou   ?tipo=zona
    /// Manda um alerta de teste para todos os inscritos. SÓ FUNCIONA no seu
    /// computador (ambiente "Development"); depois de publicado, essa rota some.
    /// </summary>
    [HttpPost("teste-alerta")]
    public async Task<IActionResult> TesteAlerta([FromQuery] string tipo = "temporal", CancellationToken ct = default)
    {
        if (!ambiente.IsDevelopment()) return NotFound();

        if (tipo == "chuva")
        {
            var climaChuva = new ClimaAtual("Ribeirão Preto, SP", "", 22, 2.4, 92, 14, "Chuva moderada", 63, true,
                new PrevisaoDia("", "Chuva moderada", 63, 18, 85, 26, 19), []);
            var rc = await alertas.EnviarParaTodosAsync("teste de chuva", i => templates.AlertaChuva(i, climaChuva), ct);
            return Ok(new { mensagem = $"Alerta de teste (chuva) enviado para {rc.Enviados} de {rc.Total} inscrito(s).", modoTeste = email.ModoTeste });
        }

        if (tipo == "zona")
        {
            var zona = zonas.ObterTodas().First(z => !z.EhMaquete && z.Status == StatusZona.Perigo);
            var r = await alertas.EnviarParaTodosAsync("teste de alagamento", i => templates.AlertaZona(i, zona), ct);
            return Ok(new { mensagem = $"Alerta de teste (alagamento) enviado para {r.Enviados} de {r.Total} inscrito(s).", modoTeste = email.ModoTeste });
        }

        ClimaAtual clima;
        try
        {
            clima = await servicos.GetRequiredService<ClimaService>().ObterAsync(ct);
        }
        catch
        {
            // sem internet: usa um clima de exemplo, só pra ver o email
            clima = new ClimaAtual("Ribeirão Preto, SP", "", 24, 3.2, 90, 28, "Trovoada", 95, true,
                new PrevisaoDia("", "Trovoada", 95, 42, 95, 27, 19), []);
        }

        var res = await alertas.EnviarParaTodosAsync("teste de temporal",
            i => templates.AlertaTemporal(i, "Este é um alerta de TESTE: a previsão indica temporal com trovoadas hoje.", clima), ct);
        return Ok(new { mensagem = $"Alerta de teste (temporal) enviado para {res.Enviados} de {res.Total} inscrito(s).", modoTeste = email.ModoTeste });
    }

    /// <summary>
    /// POST /api/emails/diagnostico?para=alguem@gmail.com  ("npm run teste-email")
    /// Confere a configuração passo a passo e manda um email de teste.
    /// Só funciona no seu computador (ambiente "Development").
    /// </summary>
    [HttpPost("diagnostico")]
    public async Task<IActionResult> Diagnostico([FromQuery] string? para, CancellationToken ct)
    {
        if (!ambiente.IsDevelopment()) return NotFound();
        var passos = await email.DiagnosticarAsync(para, ct);
        return Ok(new { modoTeste = email.ModoTeste, passos });
    }

    // Página HTML simples, usada no cancelamento de inscrição.
    private ContentResult Pagina(string titulo, string conteudo) => Content($$"""
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{{WebUtility.HtmlEncode(titulo)}} — Bolinho de Chuva</title>
        <style>
          body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#E3EFF8;
               font-family:Arial,Helvetica,sans-serif;color:#17324A;padding:1rem;box-sizing:border-box;}
          .card{background:#fff;max-width:440px;border-radius:22px;padding:2rem;text-align:center;box-shadow:0 10px 30px rgba(18,63,102,.12);}
          img{width:96px;height:96px;border-radius:50%;}
          h1{color:#6F3512;font-size:1.6rem;margin:.6rem 0 .8rem;}
          p{line-height:1.6;}
          button{background:#C0392B;color:#fff;border:none;border-radius:999px;padding:.8rem 1.4rem;font-size:1rem;font-weight:bold;cursor:pointer;}
          button:hover{background:#A93226;}
        </style>
        </head>
        <body>
          <div class="card">
            <img src="bolin.png" alt="Bolin">
            <h1>{{WebUtility.HtmlEncode(titulo)}}</h1>
            {{conteudo}}
          </div>
        </body>
        </html>
        """, "text/html; charset=utf-8");
}
