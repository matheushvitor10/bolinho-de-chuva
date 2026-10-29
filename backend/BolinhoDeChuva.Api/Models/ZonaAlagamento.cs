namespace BolinhoDeChuva.Api.Models;

/// <summary>
/// Uma região monitorada. "Cota" é a altura da água, em metros.
/// </summary>
public record ZonaAlagamento
{
    public required string Id { get; init; }
    public required string Nome { get; init; }
    public double Lat { get; init; }
    public double Lng { get; init; }
    public int Raio { get; init; }

    public double CotaAtual { get; init; }
    /// <summary>A partir desta cota, o status vira "atencao".</summary>
    public double CotaAtencao { get; init; }
    /// <summary>A partir desta cota, o status vira "perigo".</summary>
    public double CotaAlerta { get; init; }

    /// <summary>"tranquilo", "atencao" ou "perigo".</summary>
    public required string Status { get; init; }
    public DateTimeOffset AtualizadoEm { get; init; }
    public string Observacao { get; init; } = "";

    /// <summary>"simulado" (dado de exemplo), "sensor" (ESP32) ou "simulacao" (botões da aba Sensor).</summary>
    public string Fonte { get; init; } = StatusZona.FonteSimulada;

    /// <summary>
    /// True para a zona da maquete física. Ela não é um lugar real da cidade,
    /// por isso o site mostra ela na aba "Sensor", e não no mapa.
    /// </summary>
    public bool EhMaquete { get; init; }
}

public static class StatusZona
{
    public const string Tranquilo = "tranquilo";
    public const string Atencao = "atencao";
    public const string Perigo = "perigo";

    public const string FonteSimulada = "simulado";     // dado de demonstração fixo (regiões da cidade)
    public const string FonteSensor = "sensor";         // veio do ESP32
    public const string FonteSimulacao = "simulacao";   // veio dos botões de simulação da aba Sensor

    /// <summary>True se a zona está recebendo leituras (do sensor ou da simulação).</summary>
    public static bool RecebeLeituras(string fonte) => fonte is FonteSensor or FonteSimulacao;

    public static string Calcular(double cota, double cotaAtencao, double cotaAlerta)
    {
        if (cota >= cotaAlerta) return Perigo;
        if (cota >= cotaAtencao) return Atencao;
        return Tranquilo;
    }
}
