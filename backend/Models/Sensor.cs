namespace BolinhoDeChuva.Api.Models;

/// <summary>
/// O JSON que o ESP32 (ou o simulador) manda em POST /api/sensor-leitura.
/// Os campos são opcionais aqui só pra gente conseguir devolver uma mensagem
/// de erro clara quando algum faltar.
/// </summary>
public class LeituraSensorEntrada
{
    public string? ZonaId { get; set; }
    public double? DistanciaCm { get; set; }
    public double? AlturaInstalacaoM { get; set; }
}

/// <summary>Uma leitura já processada e guardada no histórico.</summary>
public record LeituraSensor(
    string ZonaId,
    double DistanciaCm,
    double AlturaInstalacaoM,
    double NivelM,
    string Status,
    DateTimeOffset RecebidaEm,
    string Origem = "sensor");  // "sensor" ou "simulacao"

/// <summary>O que a rota /api/sensor/status devolve.</summary>
public record StatusSensor(
    bool Conectado,
    bool JaRecebeuLeitura,
    DateTimeOffset? UltimaLeituraEm,
    int TotalLeituras,
    int SegundosSemSinal,
    ZonaAlagamento Zona,
    LeituraSensor? UltimaLeitura,
    IReadOnlyList<LeituraSensor> Historico);

/// <summary>
/// O JSON de POST /api/simulacao/maquete. Mande UM dos dois:
///   nivelCm:    altura da água que você quer (ex.: 15)
///   variacaoCm: quanto a água sobe (positivo) ou desce (negativo) (ex.: 2 ou -1)
/// </summary>
public class SimulacaoEntrada
{
    public double? NivelCm { get; set; }
    public double? VariacaoCm { get; set; }
}
