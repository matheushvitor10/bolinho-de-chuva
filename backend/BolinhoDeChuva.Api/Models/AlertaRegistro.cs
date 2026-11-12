namespace BolinhoDeChuva.Api.Models;

/// <summary>
/// Um alerta do histórico (aba Alagamentos → "Histórico de alertas").
/// Fica ATIVO (Fim = null) enquanto a situação continua; quando a água baixa
/// ou a chuva para, ganha um Fim e passa a "encerrado".
/// </summary>
public record AlertaRegistro
{
    public required string Id { get; init; }
    /// <summary>"alagamento", "chuva" ou "temporal".</summary>
    public required string Tipo { get; init; }
    public required string Local { get; init; }
    public string? ZonaId { get; init; }
    /// <summary>"atencao" ou "perigo" (alagamento); "atencao" (chuva); "perigo" (temporal).</summary>
    public required string Nivel { get; init; }
    public required string Detalhe { get; init; }
    public DateTimeOffset Inicio { get; init; }
    public DateTimeOffset? Fim { get; init; }
    public bool Ativo => Fim is null;
}
