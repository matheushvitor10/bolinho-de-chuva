namespace BolinhoDeChuva.Api.Models;

// CodigoCondicao segue a tabela da Open-Meteo (WMO): 95, 96 e 99 são trovoadas.

public record ClimaAtual(
    string Cidade,
    string AtualizadoEm,
    double Temperatura,
    double PrecipitacaoMm,
    int Umidade,
    double VentoKmh,
    string Condicao,
    int CodigoCondicao,
    bool EstaChovendo,
    PrevisaoDia PrevisaoHoje,
    IReadOnlyList<PrevisaoDia> ProximosDias,
    // true quando a Open-Meteo não respondeu e estamos mostrando o último clima que deu certo
    bool Desatualizado = false,
    DateTimeOffset? ObtidoEm = null);

public record PrevisaoDia(
    string Data,
    string Condicao,
    int CodigoCondicao,
    double ChuvaMm,
    int? ProbabilidadeChuva,
    double Maxima,
    double Minima);
