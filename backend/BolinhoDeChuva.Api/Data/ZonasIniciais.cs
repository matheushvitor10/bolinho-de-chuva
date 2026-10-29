using BolinhoDeChuva.Api.Models;

namespace BolinhoDeChuva.Api.Data;

/// <summary>
/// Regiões de risco de alagamento em Ribeirão Preto.
///
/// As zonas da cidade ainda usam DADOS SIMULADOS. Quando houver um sensor
/// instalado em alguma delas, basta ele mandar leituras com o "id" da zona
/// para POST /api/sensor-leitura: a cota e o status são recalculados sozinhos
/// e a zona passa a aparecer como "sensor" no site.
///
/// A zona "maquete-demo" é a da maquete física (sensor do ESP32).
/// </summary>
public static class ZonasIniciais
{
    public static List<ZonaAlagamento> Criar()
    {
        var agora = DateTimeOffset.UtcNow;

        return
        [
            new()
            {
                Id = "fundo-vale-centro",
                Nome = "Fundo de vale — Córrego Ribeirão Preto (Centro)",
                Lat = -21.1855, Lng = -47.8180, Raio = 900,
                CotaAtual = 3.65, CotaAtencao = 2.80, CotaAlerta = 3.50,
                Status = StatusZona.Perigo,
                AtualizadoEm = agora,
                Observacao = "Cota acima do limite de transbordamento. Evacuação recomendada para moradores próximos à margem."
            },
            new()
            {
                Id = "vila-virginia",
                Nome = "Vila Virgínia / margens leste",
                Lat = -21.1690, Lng = -47.7950, Raio = 850,
                CotaAtual = 3.05, CotaAtencao = 2.80, CotaAlerta = 3.50,
                Status = StatusZona.Atencao,
                AtualizadoEm = agora,
                Observacao = "Nível subindo nas últimas horas. Evite deslocamentos e mantenha-se informado."
            },
            new()
            {
                Id = "jardim-zara",
                Nome = "Jardim Zara / proximidades de córregos",
                Lat = -21.2020, Lng = -47.8340, Raio = 800,
                CotaAtual = 2.95, CotaAtencao = 2.80, CotaAlerta = 3.50,
                Status = StatusZona.Atencao,
                AtualizadoEm = agora,
                Observacao = "Histórico de alagamentos pontuais. Atenção redobrada em caso de chuva forte."
            },
            new()
            {
                Id = "ribeirania",
                Nome = "Ribeirânia — região alta",
                Lat = -21.1620, Lng = -47.8280, Raio = 950,
                CotaAtual = 1.10, CotaAtencao = 2.80, CotaAlerta = 3.50,
                Status = StatusZona.Tranquilo,
                AtualizadoEm = agora,
                Observacao = "Sem indícios de risco de alagamento nas últimas horas."
            },
            new()
            {
                Id = "jardim-botanico",
                Nome = "Jardim Botânico — região alta",
                Lat = -21.1900, Lng = -47.7870, Raio = 950,
                CotaAtual = 0.95, CotaAtencao = 2.80, CotaAlerta = 3.50,
                Status = StatusZona.Tranquilo,
                AtualizadoEm = agora,
                Observacao = "Área afastada de córregos, sem ocorrências registradas."
            },
            new()
            {
                // Maquete física: escala pequena. As cotas estão em metros,
                // mas representam centímetros reais (0,12 m = 12 cm).
                Id = "maquete-demo",
                Nome = "Maquete (demonstração ao vivo)",
                Lat = -21.1775, Lng = -47.8103, Raio = 400,
                CotaAtual = 0, CotaAtencao = 0.12, CotaAlerta = 0.18,
                Status = StatusZona.Tranquilo,
                AtualizadoEm = agora,
                Observacao = "Aguardando a primeira leitura do sensor.",
                EhMaquete = true
            }
        ];
    }
}
