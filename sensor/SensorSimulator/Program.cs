// ============================================================================
// Bolinho de Chuva — Simulador do sensor (C#)
// ============================================================================
// Enquanto o ESP32 + sensor ultrassônico não estão ligados, este programa
// finge ser eles: manda leituras para a API pelo MESMO endereço e no MESMO
// formato que o ESP32 vai usar (POST /api/sensor-leitura).
//
// Como rodar:
//   1. Deixe a API rodando (projeto BolinhoDeChuva.Api).
//   2. Rode este projeto e escolha o modo no menu.
//
// Dá pra passar o endereço da API como argumento, se ele for outro:
//   dotnet run -- https://minha-api.onrender.com
// ============================================================================

using System.Globalization;
using System.Text;
using System.Text.Json;

CultureInfo.DefaultThreadCurrentCulture = new CultureInfo("pt-BR");

var baseApi = (args.Length > 0 ? args[0] : "http://localhost:5080").TrimEnd('/');
var urlLeitura = $"{baseApi}/api/sensor-leitura";

// Se a API exigir chave (Sensor:Chave no appsettings.json), coloque a mesma aqui.
const string ChaveDoSensor = "";

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
if (!string.IsNullOrEmpty(ChaveDoSensor))
{
    http.DefaultRequestHeaders.Add("X-Chave-Sensor", ChaveDoSensor);
}

Console.OutputEncoding = Encoding.UTF8;
Console.WriteLine("=== Simulador do sensor — Bolinho de Chuva ===");
Console.WriteLine($"Mandando leituras para: {urlLeitura}\n");
Console.WriteLine("Escolha o modo:");
Console.WriteLine("  1 - Maquete: a água sobe até o perigo e depois baixa (bom pra ensaiar a apresentação)");
Console.WriteLine("  2 - Cidade: as regiões da cidade sobem e descem aos poucos");
Console.Write("\nModo (1 ou 2): ");

var modo = Console.ReadLine()?.Trim();
Console.WriteLine("\nPressione Ctrl+C para parar.\n");

if (modo == "2")
{
    await SimularCidadeAsync();
}
else
{
    await SimularMaqueteAsync();
}

// ----------------------------------------------------------------------------
// Modo 1: maquete. Sensor a 28 cm do fundo; a água vai de 0 a ~20 cm e volta.
// ----------------------------------------------------------------------------
async Task SimularMaqueteAsync()
{
    const double alturaInstalacaoM = 0.28;
    const double alturaInstalacaoCm = alturaInstalacaoM * 100;
    var aleatorio = new Random();
    double nivelCm = 0;
    var subindo = true;

    while (true)
    {
        nivelCm += subindo ? 1.2 : -1.6;
        if (nivelCm >= 20) subindo = false;
        if (nivelCm <= 0) { nivelCm = 0; subindo = true; }

        // um pouco de "ruído", como num sensor de verdade
        var distanciaCm = alturaInstalacaoCm - nivelCm + (aleatorio.NextDouble() - 0.5) * 0.6;
        await EnviarLeituraAsync("maquete-demo", Math.Round(distanciaCm, 1), alturaInstalacaoM);

        await Task.Delay(3000);
    }
}

// ----------------------------------------------------------------------------
// Modo 2: regiões da cidade, com o sensor a 4,5 m acima do nível normal do rio.
// ----------------------------------------------------------------------------
async Task SimularCidadeAsync()
{
    const double alturaInstalacaoM = 4.5;
    var aleatorio = new Random();

    // distância inicial (cm) de cada zona — os ids estão em Data/ZonasIniciais.cs da API
    var distancias = new Dictionary<string, double>
    {
        ["fundo-vale-centro"] = 120,
        ["vila-virginia"] = 200,
        ["jardim-zara"] = 210
    };

    while (true)
    {
        foreach (var zonaId in distancias.Keys.ToList())
        {
            var variacao = aleatorio.Next(-8, 6); // tende mais a subir do que a descer
            distancias[zonaId] = Math.Clamp(distancias[zonaId] + variacao, 10, 400);
            await EnviarLeituraAsync(zonaId, distancias[zonaId], alturaInstalacaoM);
        }

        await Task.Delay(10_000);
    }
}

async Task EnviarLeituraAsync(string zonaId, double distanciaCm, double alturaInstalacaoM)
{
    var corpo = JsonSerializer.Serialize(new { zonaId, distanciaCm, alturaInstalacaoM });
    using var conteudo = new StringContent(corpo, Encoding.UTF8, "application/json");

    try
    {
        using var resposta = await http.PostAsync(urlLeitura, conteudo);
        var texto = await resposta.Content.ReadAsStringAsync();

        if (resposta.IsSuccessStatusCode)
        {
            using var json = JsonDocument.Parse(texto);
            var leitura = json.RootElement.GetProperty("leitura");
            var nivel = leitura.GetProperty("nivelM").GetDouble();
            var status = leitura.GetProperty("status").GetString();
            Console.WriteLine($"[OK]   {zonaId,-18} distância {distanciaCm,6:0.0} cm  →  nível {nivel:0.00} m  ({status})");
        }
        else
        {
            Console.WriteLine($"[ERRO] {zonaId}: a API respondeu {(int)resposta.StatusCode} — {texto}");
        }
    }
    catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
    {
        Console.WriteLine($"[ERRO] Não consegui falar com a API em {baseApi}. Ela está rodando? ({ex.Message})");
    }
}
