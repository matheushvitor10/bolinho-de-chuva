using System.Globalization;
using System.Text.Json;
using BolinhoDeChuva.Api.Models;
using Microsoft.Extensions.Caching.Memory;

namespace BolinhoDeChuva.Api.Services;

/// <summary>
/// Clima ao vivo de Ribeirão Preto, usando a Open-Meteo (https://open-meteo.com):
/// API pública e gratuita, que não precisa de chave.
/// O resultado fica guardado por 5 minutos (cache).
/// </summary>
public class ClimaService(HttpClient http, IMemoryCache cache)
{
    private const double Latitude = -21.1775;
    private const double Longitude = -47.8103;
    private const string ChaveCache = "clima-atual";

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

    private static bool CodigoDeChuva(int codigo) => codigo is (>= 51 and <= 67) or (>= 80 and <= 82) or >= 95;

    public async Task<ClimaAtual> ObterAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(ChaveCache, out ClimaAtual? emCache) && emCache is not null)
        {
            return emCache;
        }

        var lat = Latitude.ToString(CultureInfo.InvariantCulture);
        var lng = Longitude.ToString(CultureInfo.InvariantCulture);
        var url = $"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}" +
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

        var clima = new ClimaAtual(
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
            ProximosDias: dias.Skip(1).ToList());

        cache.Set(ChaveCache, clima, TimeSpan.FromMinutes(5));
        return clima;
    }

    private static string NomeDaCondicao(int codigo) =>
        Condicoes.TryGetValue(codigo, out var nome) ? nome : "Condição desconhecida";

    private static double? LerDouble(JsonElement lista, int i) =>
        lista[i].ValueKind == JsonValueKind.Number ? lista[i].GetDouble() : null;

    private static int? LerInt(JsonElement lista, int i) =>
        lista[i].ValueKind == JsonValueKind.Number ? (int)Math.Round(lista[i].GetDouble()) : null;
}
