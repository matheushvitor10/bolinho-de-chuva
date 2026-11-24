using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using BolinhoDeChuva.Api.Models;
using Microsoft.Extensions.Caching.Memory;

namespace BolinhoDeChuva.Api.Services;

/// <summary>
/// Busca notícias SÓ sobre chuva e alagamento, via RSS, e marca de qual
/// cidade cada uma é (Ribeirão Preto ou Franca).
///
/// Como funciona:
///   1. Buscamos várias fontes ao mesmo tempo (em paralelo).
///   2. Toda notícia passa por um filtro de palavras (chuva, alagamento,
///      enchente, temporal...). O que não for sobre chuva é descartado,
///      mesmo que venha de uma busca já focada em chuva.
///   3. Juntamos tudo, tiramos as repetidas e ordenamos da mais nova pra mais antiga.
///   4. Guardamos o resultado por 10 minutos (cache), pra não ficar
///      consultando as fontes a cada pessoa que abre o site.
///
/// Se uma fonte falhar, as outras continuam funcionando.
/// Pra adicionar uma fonte nova, é só colocar mais uma linha na lista Fontes.
/// </summary>
public class NoticiasService(HttpClient http, IMemoryCache cache, ILogger<NoticiasService> logger)
{
    private const string ChaveCache = "noticias-chuva";
    private const int MaximoDeNoticias = 40;

    private record FonteRss(string Nome, string Url, string Abrangencia, bool EhGoogleNews = false, string? Cidade = null);

    private static readonly FonteRss[] Fontes =
    [
        // Buscas do Google Notícias focadas em chuva em cada cidade (últimos 14 dias).
        new("Google Notícias — Ribeirão Preto",
            GoogleNews("(chuva OR alagamento OR enchente OR temporal OR tempestade) (\"Ribeirão Preto\" OR \"região de Ribeirão\") when:14d"),
            "regional", EhGoogleNews: true, Cidade: "ribeirao-preto"),
        new("Google Notícias — Franca",
            GoogleNews("(chuva OR alagamento OR enchente OR temporal OR tempestade) (\"Franca SP\" OR \"em Franca\" OR \"de Franca\" OR \"Franca-SP\") when:14d"),
            "regional", EhGoogleNews: true, Cidade: "franca"),

        // Busca do Google Notícias sobre chuva e alagamento no Brasil (últimos 3 dias).
        new("Google Notícias — Brasil",
            GoogleNews("(alagamento OR enchente OR \"chuva forte\" OR temporal OR inundação) when:3d"),
            "nacional", EhGoogleNews: true),

        // Feeds gerais: aqui o filtro de palavras é o que separa o que é sobre chuva.
        new("G1 Ribeirão Preto e Franca", "https://g1.globo.com/rss/g1/sp/ribeirao-preto-franca/", "regional"),
        new("G1", "https://g1.globo.com/rss/g1/", "nacional"),
        new("Agência Brasil", "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml", "nacional")
    ];

    private static string GoogleNews(string busca) =>
        "https://news.google.com/rss/search?q=" + Uri.EscapeDataString(busca) + "&hl=pt-BR&gl=BR&ceid=BR:pt-419";

    // ---------- Filtro de assunto ----------
    // O texto é comparado sem acento e em minúsculas, então "inundação" vira "inundacao".
    private static readonly Regex PalavrasDeChuva = new(
        @"\b(chuva|chuvas|chuvoso|chuvosa|chuvarada|chove|choveu|chover|garoa|temporal|temporais|tempestade|tempestades|" +
        @"alagamento|alagamentos|alagad\w*|alagou|alagam|alagar|enchente|enchentes|inundac\w*|inundad\w*|inundou|" +
        @"transbord\w*|granizo|deslizamento\w*|desabrigad\w*|desalojad\w*)\b",
        RegexOptions.Compiled);

    // Expressões que têm "chuva" mas não são sobre o tempo.
    private static readonly string[] FalsosPositivos =
    [
        "guarda-chuva", "guarda chuva", "chuva de gols", "chuva de criticas", "chuva de meteoros",
        "chuva de estrelas", "chuva de premios", "chuva de dinheiro", "chuva de likes",
        "chuva de pedidos", "chuva de memes", "chuva de reclamacoes", "tempestade perfeita"
    ];

    // ---------- Classificação por cidade ----------
    // Cidades vizinhas entram junto com a cidade-polo mais próxima.
    private static readonly Regex RegiaoRibeirao = new(
        @"\b(ribeirao preto|sertaozinho|jardinopolis|cravinhos|serrana|brodowski|dumont|pradopolis|barrinha|pontal|guatapara|batatais|serra azul|santa rosa de viterbo)\b",
        RegexOptions.Compiled);
    private static readonly Regex RegiaoFranca = new(
        @"\b(restinga|patrocinio paulista|cristais paulista|pedregulho|itirapua|ribeirao corrente|jeriquara|sao jose da bela vista|claraval)\b",
        RegexOptions.Compiled);
    // "Franca" a cidade, escrita SEM cedilha. "França" (o país) tem ç e não entra.
    private static readonly Regex CidadeFranca = new(@"\bfranca\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static IReadOnlyList<string> ClassificarCidades(string? texto)
    {
        var original = texto ?? "";
        var normalizado = Normalizar(original);
        var cidades = new List<string>();

        if (RegiaoRibeirao.IsMatch(normalizado)) cidades.Add("ribeirao-preto");

        // A checagem de "Franca" é feita no texto ORIGINAL (com acentos),
        // senão "França" viraria "franca" e entraria por engano.
        if (CidadeFranca.IsMatch(original.Replace("França", "").Replace("FRANÇA", "")) || RegiaoFranca.IsMatch(normalizado))
            cidades.Add("franca");

        return cidades;
    }

    public static bool EhSobreChuva(string? texto)
    {
        var normalizado = Normalizar(texto);
        foreach (var expressao in FalsosPositivos)
        {
            normalizado = normalizado.Replace(expressao, " ");
        }
        return PalavrasDeChuva.IsMatch(normalizado);
    }

    // ---------- API pública do serviço ----------

    public async Task<RespostaNoticias> ObterAsync(string abrangencia, CancellationToken ct)
    {
        var todas = await ObterTodasAsync(ct);

        var filtradas = abrangencia switch
        {
            "regional" => todas.Noticias.Where(n => n.Abrangencia == "regional").ToList(),
            "ribeirao-preto" => todas.Noticias.Where(n => n.Cidades.Contains("ribeirao-preto")).ToList(),
            "franca" => todas.Noticias.Where(n => n.Cidades.Contains("franca")).ToList(),
            "nacional" => todas.Noticias.Where(n => n.Abrangencia == "nacional").ToList(),
            _ => todas.Noticias.ToList()
        };

        return todas with { Noticias = filtradas };
    }

    private async Task<RespostaNoticias> ObterTodasAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(ChaveCache, out RespostaNoticias? emCache) && emCache is not null)
        {
            return emCache;
        }

        var tarefas = Fontes.Select(f => BuscarFonteAsync(f, ct)).ToArray();
        var resultados = await Task.WhenAll(tarefas);

        var fontesComErro = resultados.Where(r => r.Erro).Select(r => r.Fonte.Nome).ToList();

        var vistas = new HashSet<string>();
        var noticias = resultados
            .SelectMany(r => r.Itens)
            .Where(n => EhSobreChuva(n.Titulo + " " + n.Resumo))
            .Select(ComCidades)
            .OrderByDescending(n => n.PublicadoEm ?? DateTimeOffset.MinValue)
            .Where(n => vistas.Add(ChaveDeDuplicidade(n.Titulo)))
            .Take(MaximoDeNoticias)
            .ToList();

        var resposta = new RespostaNoticias(noticias, fontesComErro, DateTimeOffset.UtcNow);

        // Se todas as fontes falharam, guardamos por pouco tempo, pra tentar de novo logo.
        var tempo = fontesComErro.Count == Fontes.Length ? TimeSpan.FromMinutes(1) : TimeSpan.FromMinutes(10);
        cache.Set(ChaveCache, resposta, tempo);

        logger.LogInformation("Notícias de chuva atualizadas: {Total} encontradas, {Erros} fonte(s) com erro.",
            noticias.Count, fontesComErro.Count);

        return resposta;
    }

    /// <summary>
    /// Descobre a cidade da notícia. Notícia "regional" que não fala nem de
    /// Ribeirão Preto nem de Franca (ex.: de Barretos) passa para "nacional",
    /// pra não aparecer no filtro da cidade errada.
    /// </summary>
    private static Noticia ComCidades(Noticia n)
    {
        var cidades = ClassificarCidades(n.Titulo + " " + n.Resumo);
        // Veio da busca de uma cidade e o texto não cita nenhuma? Fica na cidade da busca.
        if (cidades.Count == 0 && n.CidadeDaBusca is not null) cidades = [n.CidadeDaBusca];
        var abrangencia = n.Abrangencia == "regional" && cidades.Count == 0 ? "nacional" : n.Abrangencia;
        return n with { Cidades = cidades, Abrangencia = abrangencia };
    }

    private record ResultadoFonte(FonteRss Fonte, List<Noticia> Itens, bool Erro);

    private async Task<ResultadoFonte> BuscarFonteAsync(FonteRss fonte, CancellationToken ct)
    {
        try
        {
            var xml = await http.GetStringAsync(fonte.Url, ct);
            return new ResultadoFonte(fonte, LerRss(xml, fonte), false);
        }
        catch (Exception erro) when (erro is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            logger.LogWarning("Não consegui buscar a fonte \"{Fonte}\": {Mensagem}", fonte.Nome, erro.Message);
            return new ResultadoFonte(fonte, [], true);
        }
    }

    private static List<Noticia> LerRss(string xml, FonteRss fonte)
    {
        var documento = XDocument.Parse(xml);
        var lista = new List<Noticia>();

        foreach (var item in documento.Descendants("item"))
        {
            var titulo = LimparTexto(item.Element("title")?.Value);
            var link = item.Element("link")?.Value?.Trim();

            if (string.IsNullOrWhiteSpace(titulo) || !LinkValido(link)) continue;

            var nomeFonte = fonte.Nome;
            var resumo = LimparTexto(item.Element("description")?.Value);

            if (fonte.EhGoogleNews)
            {
                // No Google Notícias o título vem como "Título - Nome do jornal",
                // e o nome do jornal também vem na tag <source>.
                var veiculo = LimparTexto(item.Element("source")?.Value);
                if (!string.IsNullOrEmpty(veiculo))
                {
                    nomeFonte = veiculo;
                    var sufixo = " - " + veiculo;
                    if (titulo.EndsWith(sufixo)) titulo = titulo[..^sufixo.Length];
                }
                resumo = ""; // a descrição do Google Notícias só repete o título
            }

            lista.Add(new Noticia
            {
                Titulo = titulo,
                Resumo = Encurtar(resumo, 180),
                Link = link!,
                Fonte = nomeFonte,
                PublicadoEm = LerData(item.Element("pubDate")?.Value),
                Abrangencia = fonte.Abrangencia,
                CidadeDaBusca = fonte.Cidade
            });
        }

        return lista;
    }

    // ---------- Funções auxiliares ----------

    private static bool LinkValido(string? link) =>
        Uri.TryCreate(link, UriKind.Absolute, out var uri) &&
        (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp);

    private static string LimparTexto(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return "";
        var semTags = Regex.Replace(texto, "<[^>]+>", " ");
        var decodificado = WebUtility.HtmlDecode(semTags);
        return Regex.Replace(decodificado, @"\s+", " ").Trim();
    }

    private static string Encurtar(string texto, int limite)
    {
        if (texto.Length <= limite) return texto;
        var corte = texto.LastIndexOf(' ', limite);
        return texto[..(corte > 0 ? corte : limite)].TrimEnd(',', '.', ';', ':') + "…";
    }

    private static DateTimeOffset? LerData(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return null;
        texto = texto.Trim();

        if (DateTimeOffset.TryParse(texto, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var data))
            return data;

        // Alguns feeds usam fuso no formato "-0300"; o .NET prefere "-03:00".
        var ajustado = Regex.Replace(texto, @"([+-]\d{2})(\d{2})$", "$1:$2");
        if (DateTimeOffset.TryParse(ajustado, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out data))
            return data;

        return null;
    }

    private static string Normalizar(string? texto)
    {
        if (string.IsNullOrEmpty(texto)) return "";
        var decomposto = texto.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposto.Length);
        foreach (var c in decomposto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    private static string ChaveDeDuplicidade(string titulo)
    {
        var somenteLetras = Regex.Replace(Normalizar(titulo), "[^a-z0-9]", "");
        return somenteLetras.Length > 60 ? somenteLetras[..60] : somenteLetras;
    }
}
