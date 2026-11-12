using System.Globalization;
using System.Text.Json;
using BolinhoDeChuva.Api.Models;
using Microsoft.Extensions.Caching.Memory;

namespace BolinhoDeChuva.Api.Services;

/// <summary>
/// Clima ao vivo de Ribeirão Preto, usando a Open-Meteo (https://open-meteo.com):
/// API pública e gratuita, que não precisa de chave.
///
/// - O resultado fica guardado por 5 minutos (cache). A própria Open-Meteo
///   atualiza os dados "de agora" a cada 15 minutos, então não adianta menos.
/// - Se a consulta falhar, tenta mais uma vez.
/// - Se ainda assim falhar (internet caiu, por exemplo), devolve o ÚLTIMO clima
///   que deu certo, marcado como "desatualizado", em vez de deixar o site sem clima.
/// </summary>
public class ClimaService(HttpClient http, IMemoryCache cache, IConfiguration config, ILogger<ClimaService> logger)
{
    private const double Latitude = -21.1775;
    private const double Longitude = -47.8103;
    private const string ChaveCache = "clima-atual";

    // Último clima que deu certo (compartilhado entre todas as consultas)
    private static readonly object TravaUltimo = new();
    private static ClimaAtual? _ultimoBom;

    private static readonly Dictionary<int, string> Condicoes = new()
    {
        [0] = "Céu limpo",
        [1] = "Poucas nuvens",
        [2] = "Parcialmente nublado",
        [3] = "Nublado",
        [45] = "Neblina",
        [48] = "Neblina com geada",
        [51] = "Garoa fraca",
        [53] = "Garoa moderada",
        [55] = "Garoa forte",
        [56] = "Garoa congelante",
        [57] = "Garoa congelante forte",
        [61] = "Chuva fraca",
        [63] = "Chuva moderada",
        [65] = "Chuva forte",
        [66] = "Chuva congelante",
        [67] = "Chuva congelante forte",
        [80] = "Pancadas de chuva fracas",
        [81] = "Pancadas de chuva moderadas",
        [82] = "Pancadas de chuva fortes",
        [95] = "Trovoada",
        [96] = "Trovoada com granizo",
        [99] = "Trovoada com granizo forte"
    };

    public static bool EhTrovoada(int codigo) => codigo >= 95;

    // Qualquer precipitação (inclui garoa): usado pra animação de chuva do site.
    private static bool CodigoDeChuva(int codigo) => codigo is (>= 51 and <= 67) or (>= 80 and <= 82) or >= 95;

    /// <summary>
    /// Chuva "de verdade" (pro alerta por email): chuva, pancadas ou trovoada,
    /// ou pelo menos <paramref name="minimoMm"/> de água na última hora. Garoa fraca não conta.
    /// </summary>
    public static bool EstaChovendoDeVerdade(ClimaAtual c, double minimoMm) =>
        c.CodigoCondicao is (>= 61 and <= 67) or (>= 80 and <= 82) or >= 95 || c.PrecipitacaoMm >= minimoMm;

    private TimeSpan TempoDeCache => TimeSpan.FromMinutes(Math.Max(0.01, config.GetValue("Clima:MinutosDeCache", 5.0)));

    private string UrlBase => (config["Clima:UrlBase"] is { Length: > 0 } u ? u : "https://api.open-meteo.com").TrimEnd('/');

    public async Task<ClimaAtual> ObterAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(ChaveCache, out ClimaAtual? emCache) && emCache is not null)
        {
            return emCache;
        }

        Exception? ultimoErro = null;
        for (var tentativa = 1; tentativa <= 2; tentativa++)
        {
            try
            {
                var clima = await BuscarNaOpenMeteoAsync(ct);
                cache.Set(ChaveCache, clima, TempoDeCache);
                lock (TravaUltimo) _ultimoBom = clima;
                return clima;
            }
            catch (Exception erro) when (!ct.IsCancellationRequested)
            {
                ultimoErro = erro;
                if (tentativa == 1) await Task.Delay(800, ct);
            }
        }

        logger.LogWarning("Não consegui buscar o clima na Open-Meteo: {Mensagem}", ultimoErro?.Message);

        ClimaAtual? ultimo;
        lock (TravaUltimo) ultimo = _ultimoBom;
        if (ultimo is not null && DateTimeOffset.UtcNow - ultimo.ObtidoEm < TimeSpan.FromHours(3))
        {
            var antigo = ultimo with { Desatualizado = true };
            cache.Set(ChaveCache, antigo, TimeSpan.FromMinutes(Math.Min(1, TempoDeCache.TotalMinutes))); // tenta de novo logo
            return antigo;
        }

        throw new InvalidOperationException($"A Open-Meteo não respondeu ({ultimoErro?.Message}).", ultimoErro);
    }

    private async Task<ClimaAtual> BuscarNaOpenMeteoAsync(CancellationToken ct)
    {
        var lat = Latitude.ToString(CultureInfo.InvariantCulture);
        var lng = Longitude.ToString(CultureInfo.InvariantCulture);
        var url = $"{UrlBase}/v1/forecast?latitude={lat}&longitude={lng}" +
                  "&current=temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m" +
                  "&daily=weather_code,precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min" +
                  "&forecast_days=4&timezone=America%2FSao_Paulo";

        using var resposta = await http.GetAsync(url, ct);
        resposta.EnsureSuccessStatusCode();

        await using var conteudo = await resposta.Content.ReadAsStreamAsync(ct);
        using var json = await JsonDocument.ParseAsync(conteudo, cancellationToken: ct);

        var atual = json.RootElement.GetProperty("current");
        var diario = json.RootElement.GetProperty("daily");

        var codigoAtual = atual.GetProperty("weather_code").GetInt32();
        var chuvaAgora = atual.GetProperty("precipitation").GetDouble();

        var dias = new List<PrevisaoDia>();
        var datas = diario.GetProperty("time");
        for (var i = 0; i < datas.GetArrayLength(); i++)
        {
            var codigoDia = LerInt(diario.GetProperty("weather_code"), i) ?? -1;
            dias.Add(new PrevisaoDia(
                Data: datas[i].GetString() ?? "",
                Condicao: NomeDaCondicao(codigoDia),
                CodigoCondicao: codigoDia,
                ChuvaMm: LerDouble(diario.GetProperty("precipitation_sum"), i) ?? 0,
                ProbabilidadeChuva: LerInt(diario.GetProperty("precipitation_probability_max"), i),
                Maxima: LerDouble(diario.GetProperty("temperature_2m_max"), i) ?? 0,
                Minima: LerDouble(diario.GetProperty("temperature_2m_min"), i) ?? 0));
        }

        return new ClimaAtual(
            Cidade: "Ribeirão Preto, SP",
            AtualizadoEm: atual.GetProperty("time").GetString() ?? "",
            Temperatura: atual.GetProperty("temperature_2m").GetDouble(),
            PrecipitacaoMm: chuvaAgora,
            Umidade: atual.GetProperty("relative_humidity_2m").GetInt32(),
            VentoKmh: atual.GetProperty("wind_speed_10m").GetDouble(),
            Condicao: NomeDaCondicao(codigoAtual),
            CodigoCondicao: codigoAtual,
            EstaChovendo: CodigoDeChuva(codigoAtual) || chuvaAgora > 0,
            PrevisaoHoje: dias.FirstOrDefault() ?? new PrevisaoDia("", "", -1, 0, null, 0, 0),
            ProximosDias: dias.Skip(1).ToList(),
            Desatualizado: false,
            ObtidoEm: DateTimeOffset.UtcNow);
    }

    private static string NomeDaCondicao(int codigo) =>
        Condicoes.TryGetValue(codigo, out var nome) ? nome : "Condição desconhecida";

    private static double? LerDouble(JsonElement lista, int i) =>
        lista[i].ValueKind == JsonValueKind.Number ? lista[i].GetDouble() : null;

    private static int? LerInt(JsonElement lista, int i) =>
        lista[i].ValueKind == JsonValueKind.Number ? (int)Math.Round(lista[i].GetDouble()) : null;
}
