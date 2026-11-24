// ============================================================================
// Bolinho de Chuva — o programa principal (C#)
// ============================================================================
// Este é o ÚNICO programa do sistema. Ele faz duas coisas:
//   1. Entrega o SITE (os arquivos HTML, CSS e JS da pasta "frontend").
//   2. Responde a API em /api/... (clima, notícias, regiões, sensor, emails).
//
// No seu computador, tudo fica em: http://localhost:5080
//
// Este arquivo está dividido em 4 partes:
//   PARTE 1 — Configurações (senhas, porta, endereço público)
//   PARTE 2 — Serviços (quem faz cada trabalho)
//   PARTE 3 — Segurança (limite de tentativas)
//   PARTE 4 — Liga o site e a API
// ============================================================================

using System.Threading.RateLimiting;
using BolinhoDeChuva.Api.Services;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// ============================================================================
// PARTE 1 — Configurações
// ============================================================================

// Senhas e configurações deste computador (link do Google, chave secreta)
// ficam no appsettings.Local.json, que NÃO vai pro GitHub.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// Na hospedagem (Render), a porta vem da variável PORT.
// No seu computador vale a porta do launchSettings.json (5080).
if (Hospedagem.EstaHospedado)
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{Environment.GetEnvironmentVariable("PORT")}");
}

// Endereço público do site hospedado (o Render informa sozinho).
// É usado nos links dos emails ("ver o site", "cancelar inscrição").
var urlPublica = (Environment.GetEnvironmentVariable("URL_PUBLICA")
                  ?? Environment.GetEnvironmentVariable("RENDER_EXTERNAL_URL"))?.TrimEnd('/');
if (!string.IsNullOrWhiteSpace(urlPublica))
{
    builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["Site:Url"] = urlPublica,
        ["Site:UrlApi"] = urlPublica
    });
}

// ============================================================================
// PARTE 2 — Serviços (cada um cuida de um assunto; ficam na pasta Services)
// ============================================================================

builder.Services.AddControllers();   // as rotas da API (pasta Controllers)
builder.Services.AddMemoryCache();   // guarda clima e notícias por alguns minutos

// Clima e notícias: buscam dados na internet. Timeout curto: se uma fonte
// demorar, desistimos dela e o site continua funcionando.
builder.Services.AddHttpClient<ClimaService>(cliente => cliente.Timeout = TimeSpan.FromSeconds(8));
builder.Services.AddHttpClient<NoticiasService>(cliente =>
{
    cliente.Timeout = TimeSpan.FromSeconds(8);
    cliente.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (compatible; BolinhoDeChuva/1.0)");
});

// Regiões e sensor (ficam na memória enquanto o programa está ligado)
builder.Services.AddSingleton<ZonasService>();

// Emails (enviados pelo script do Google da conta do projeto)
builder.Services.AddHttpClient("google", cliente => cliente.Timeout = TimeSpan.FromSeconds(40));
builder.Services.AddSingleton<GoogleScriptService>();
builder.Services.AddSingleton<ConfigLocalService>();
builder.Services.AddSingleton<InscricoesService>();
builder.Services.AddSingleton<EmailService>();
builder.Services.AddSingleton<EmailTemplates>();

// Alertas: o histórico e o "vigia" que decide quando mandar email
builder.Services.AddSingleton<AlertasService>();
builder.Services.AddSingleton<HistoricoAlertasService>();
builder.Services.AddHostedService<MonitorDeAlertasService>();

// ============================================================================
// PARTE 3 — Segurança: limite de tentativas
// ============================================================================
// Cadastro de email: no máximo 10 por minuto vindos do mesmo computador.
// Botões de simulação: no máximo 120 cliques por minuto.
builder.Services.AddRateLimiter(opcoes =>
{
    opcoes.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    opcoes.AddPolicy("inscricao", contexto => RateLimitPartition.GetFixedWindowLimiter(
        contexto.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    opcoes.AddPolicy("simulacao", contexto => RateLimitPartition.GetFixedWindowLimiter(
        contexto.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1) }));
    opcoes.OnRejected = async (contexto, ct) =>
    {
        contexto.HttpContext.Response.ContentType = "application/json; charset=utf-8";
        await contexto.HttpContext.Response.WriteAsync(
            "{\"erro\":\"Muitas tentativas seguidas. Espere um minutinho e tente de novo.\"}", ct);
    };
});

// ============================================================================
// PARTE 4 — Liga o site e a API
// ============================================================================
var app = builder.Build();

// Na hospedagem, os pedidos passam por um "porteiro" (proxy) antes de chegar
// aqui. Isto faz o programa enxergar o endereço de quem acessou de verdade.
if (Hospedagem.EstaHospedado)
{
    var cabecalhos = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
    };
    cabecalhos.KnownNetworks.Clear();
    cabecalhos.KnownProxies.Clear();
    app.UseForwardedHeaders(cabecalhos);
}

// O SITE: os arquivos da pasta "frontend" (HTML, CSS, JS e imagens).
// No seu computador ela fica ao lado da pasta "backend". Na hospedagem, o
// Dockerfile copia ela para dentro do programa, com o nome "wwwroot".
var pastaDoSite = new[]
{
    Path.Combine(app.Environment.ContentRootPath, "wwwroot"),
    Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "frontend"))
}.FirstOrDefault(Directory.Exists);

if (pastaDoSite is not null)
{
    var arquivos = new PhysicalFileProvider(pastaDoSite);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = arquivos });  // "/" abre o index.html
    app.UseStaticFiles(new StaticFileOptions { FileProvider = arquivos });
    app.Logger.LogInformation("Site: arquivos da pasta {Pasta}", pastaDoSite);
}
else
{
    app.Logger.LogWarning("Não achei a pasta do site (frontend). Só a API vai funcionar.");
}

app.UseRateLimiter();
app.MapControllers();   // liga todas as rotas da pasta Controllers

// GET /api — lista das rotas, pra conferir no navegador que a API está no ar.
app.MapGet("/api", () => Results.Json(new
{
    sistema = "Bolinho de Chuva — SPA (Sistema de Prevenção de Alagamentos)",
    mensagem = "A API está no ar. O site fica em /.",
    rotas = new[]
    {
        "GET  /api/status",
        "GET  /api/clima",
        "GET  /api/noticias?abrangencia=ribeirao-preto|franca|nacional|todas",
        "GET  /api/enchentes",
        "GET  /api/enchentes/{id}",
        "GET  /api/alertas",
        "GET  /api/contatos",
        "GET  /api/sensor/status?zonaId=maquete-demo",
        "POST /api/sensor-leitura",
        "POST /api/simulacao/maquete",
        "POST /api/emails/inscrever",
        "GET  /api/emails/cancelar?token=..."
    }
}));

if (!string.IsNullOrWhiteSpace(urlPublica))
    app.Logger.LogInformation("Site hospedado em {Url}", urlPublica);

app.Run();
