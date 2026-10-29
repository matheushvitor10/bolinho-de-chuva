using System.Text.Json.Serialization;

namespace BolinhoDeChuva.Api.Models;

/// <summary>
/// Uma notícia sobre chuva ou alagamento. Guardamos só título, um resumo curto
/// e o link: a matéria completa é lida no site de origem.
/// </summary>
public record Noticia
{
    public required string Titulo { get; init; }
    public string Resumo { get; init; } = "";
    public required string Link { get; init; }
    public required string Fonte { get; init; }
    public DateTimeOffset? PublicadoEm { get; init; }

    /// <summary>"regional" (Ribeirão Preto, Franca e região) ou "nacional".</summary>
    public required string Abrangencia { get; init; }

    /// <summary>Cidades da notícia: "ribeirao-preto", "franca" (pode ter as duas, ou nenhuma).</summary>
    public IReadOnlyList<string> Cidades { get; init; } = [];

    /// <summary>Cidade da busca que encontrou a notícia (uso interno, não vai pro site).</summary>
    [JsonIgnore]
    public string? CidadeDaBusca { get; init; }
}

/// <summary>O que a rota /api/noticias devolve.</summary>
public record RespostaNoticias(
    IReadOnlyList<Noticia> Noticias,
    IReadOnlyList<string> FontesComErro,
    DateTimeOffset AtualizadoEm);
