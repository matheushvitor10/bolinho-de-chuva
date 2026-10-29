// ============================================================================
// Bolinho de Chuva — API (back-end)
// ============================================================================
// Este projeto é SÓ o back-end: ele não tem tela. Ele responde em /api/...
// e quem desenha o site é o projeto BolinhoDeChuva.Web (front-end).
//
// Rodando pelo Visual Studio, a API fica em: http://localhost:5080
// ============================================================================

using System.Threading.RateLimiting;
using BolinhoDeChuva.Api.Services;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

// Senhas e configurações pessoais (ex.: a senha de app do Gmail) ficam no
// appsettings.Local.json, que NÃO vai pro GitHub (está no .gitignore).
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// Serviços de hospedagem (Render, Railway etc.) costumam informar a porta pela
// variável de ambiente PORT. Se ela existir, usamos ela. No seu computador ela
// não existe, então vale a porta do launchSettings.json (5080).
var portaHospedagem = Environment.GetEnvironmentVariable("PORT");
if (Hospedagem.EstaHospedado)
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{portaHospedagem}");
}

// Endereço público do site hospedado (o Render informa sozinho em RENDER_EXTERNAL_URL).
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

builder.Services.AddControllers();
builder.Services.AddMemoryCache();

// HttpClient para as fontes externas. Timeout curto: se uma fonte demorar,
// desistimos dela e o site continua funcionando com as outras.
builder.Services.AddHttpClient<NoticiasService>(cliente =>
{
    cliente.Timeout = TimeSpan.FromSeconds(8);
    cliente.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (compatible; BolinhoDeChuva/1.0)");
});
builder.Services.AddHttpClient<ClimaService>(cliente =>
{
    cliente.Timeout = TimeSpan.FromSeconds(8);
});

// As zonas ficam em memória, num único objeto compartilhado por todas as
// requisições (Singleton). Se a API reiniciar, elas voltam ao estado inicial.
builder.Services.AddSingleton<ZonasService>();

// ---------- Emails ----------
// Cliente para o script do Google (envio de email e planilha de inscritos).
// O Google às vezes demora alguns segundos para responder, por isso 40 s.
builder.Services.AddHttpClient("google", cliente => cliente.Timeout = TimeSpan.FromSeconds(40));
builder.Services.AddSingleton<GoogleScriptService>();
builder.Services.AddSingleton<ConfigLocalService>();
builder.Services.AddSingleton<InscricoesService>();
builder.Services.AddSingleton<EmailService>();
builder.Services.AddSingleton<EmailTemplates>();
builder.Services.AddSingleton<AlertasService>();
builder.Services.AddHostedService<MonitorDeAlertasService>(); // o "vigia" que dispara os alertas

// Limite de cadastros: no máximo 10 por minuto vindos do mesmo computador,
// pra ninguém usar o formulário pra mandar email em massa.
builder.Services.AddRateLimiter(opcoes =>
{
    opcoes.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    opcoes.AddPolicy("inscricao", contexto => RateLimitPartition.GetFixedWindowLimiter(
        contexto.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    // Botões de simulação: até 120 cliques por minuto por pessoa (a chuva automática usa 30).
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

// CORS: como o front-end e o back-end agora são separados (rodam em endereços
// diferentes), a API precisa autorizar o endereço do site. A lista fica no
// appsettings.json, em "Cors:OrigensPermitidas".
var origensPermitidas = builder.Configuration
    .GetSection("Cors:OrigensPermitidas")
    .Get<string[]>() ?? [];

builder.Services.AddCors(opcoes =>
{
    opcoes.AddPolicy("Frontend", politica => politica
        .WithOrigins(origensPermitidas)
        .AllowAnyHeader()
        .AllowAnyMethod());
});

var app = builder.Build();

// Na hospedagem, os pedidos passam por um "porteiro" (proxy) antes de chegar
// aqui. Isto faz a API enxergar o endereço de quem acessou de verdade.
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

// Na hospedagem, a pasta wwwroot tem o site (o Dockerfile copia ela pra cá).
// Assim API e site ficam no MESMO endereço. No seu computador essa pasta não
// existe e o site continua no projeto BolinhoDeChuva.Web, como sempre.
var temSite = Directory.Exists(Path.Combine(app.Environment.ContentRootPath, "wwwroot"));
if (temSite)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseCors("Frontend");
app.UseRateLimiter();
app.MapControllers();

// Página inicial da API: só pra conferir no navegador que ela está no ar.
// (Na hospedagem, o endereço "/" mostra o site, então essa página fica em /api.)
app.MapGet(temSite ? "/api" : "/", () => Results.Json(new
{
    sistema = "Bolinho de Chuva — SPA (Sistema de Prevenção de Alagamentos)",
    mensagem = "A API está no ar. O site fica no projeto BolinhoDeChuva.Web.",
    rotas = new[]
    {
        "GET  /api/status",
        "GET  /api/noticias?abrangencia=regional|nacional|todas",
        "GET  /api/clima",
        "GET  /api/enchentes",
        "GET  /api/enchentes/{id}",
        "GET  /api/contatos",
        "GET  /api/sensor/status?zonaId=maquete-demo",
        "POST /api/sensor-leitura",
        "POST /api/simulacao/maquete",
        "POST /api/emails/inscrever",
        "GET  /api/emails/cancelar?token=..."
    }
}));

app.Logger.LogInformation("Origens liberadas no CORS: {Origens}", string.Join(", ", origensPermitidas));
if (!string.IsNullOrWhiteSpace(urlPublica))
    app.Logger.LogInformation("Site hospedado em {Url}", urlPublica);

app.Run();
