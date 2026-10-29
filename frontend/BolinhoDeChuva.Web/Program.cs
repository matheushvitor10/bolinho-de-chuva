// ============================================================================
// Bolinho de Chuva — servidor do front-end
// ============================================================================
// Este programa só entrega os arquivos da pasta wwwroot (HTML, CSS, JS e
// imagens). Toda a lógica do site está em wwwroot/js/app.js, e os dados vêm
// da API (projeto BolinhoDeChuva.Api). O endereço da API fica em
// wwwroot/js/config.js.
//
// Rodando pelo Visual Studio, o site abre em: http://localhost:5500
// ============================================================================

var builder = WebApplication.CreateBuilder(args);

var portaHospedagem = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(portaHospedagem))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{portaHospedagem}");
}

var app = builder.Build();

app.UseDefaultFiles();   // abre o index.html quando a pessoa acessa "/"
app.UseStaticFiles();    // entrega os arquivos de wwwroot

app.Run();
