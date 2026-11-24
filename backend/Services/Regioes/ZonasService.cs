using System.Threading.Channels;
using BolinhoDeChuva.Api.Data;
using BolinhoDeChuva.Api.Models;

namespace BolinhoDeChuva.Api.Services;

/// <summary>
/// Guarda as zonas monitoradas e as leituras dos sensores, em memória.
///
/// Por que o "lock"? Várias requisições podem chegar ao mesmo tempo (o site
/// pedindo as zonas enquanto o ESP32 manda uma leitura). O lock garante que
/// uma não atrapalhe a outra no meio da atualização.
/// </summary>
public class ZonasService(IConfiguration configuracao, ILogger<ZonasService> logger)
{
    private const int TamanhoDoHistorico = 60;

    private readonly object _trava = new();
    private readonly List<ZonaAlagamento> _zonas = ZonasIniciais.Criar();
    private readonly Dictionary<string, Queue<LeituraSensor>> _historico = new();
    private readonly Dictionary<string, int> _totalDeLeituras = new();

    // Fila de "a zona X mudou de situação". O vigia de alertas lê daqui na hora,
    // então nenhuma mudança se perde, mesmo que dure só um segundo.
    private readonly Channel<(ZonaAlagamento Zona, string StatusAnterior)> _mudancas =
        Channel.CreateUnbounded<(ZonaAlagamento, string)>();
    public ChannelReader<(ZonaAlagamento Zona, string StatusAnterior)> Mudancas => _mudancas.Reader;

    private int SegundosSemSinal => configuracao.GetValue("Sensor:SegundosSemSinal", 60);

    public IReadOnlyList<ZonaAlagamento> ObterTodas()
    {
        lock (_trava) return _zonas.ToList();
    }

    public ZonaAlagamento? ObterPorId(string id)
    {
        lock (_trava) return _zonas.FirstOrDefault(z => z.Id == id);
    }

    /// <summary>
    /// Recebe uma leitura do sensor ultrassônico e atualiza a zona.
    ///
    /// O sensor fica parado, olhando pra baixo, e mede a distância até a água:
    ///     nível da água = altura de instalação − distância medida
    /// Quanto MENOR a distância, MAIS ALTA está a água.
    /// </summary>
    public LeituraSensor? RegistrarLeitura(string zonaId, double distanciaCm, double alturaInstalacaoM,
        string origem = StatusZona.FonteSensor)
    {
        lock (_trava)
        {
            var indice = _zonas.FindIndex(z => z.Id == zonaId);
            if (indice < 0) return null;

            var zona = _zonas[indice];

            // Se a distância for maior que a altura (ruído do sensor), o nível fica em 0.
            var nivelM = Math.Max(0, Math.Round(alturaInstalacaoM - distanciaCm / 100.0, 3));
            var status = StatusZona.Calcular(nivelM, zona.CotaAtencao, zona.CotaAlerta);
            var agora = DateTimeOffset.UtcNow;

            _zonas[indice] = zona with
            {
                CotaAtual = nivelM,
                Status = status,
                AtualizadoEm = agora,
                Fonte = origem,
                Observacao = ObservacaoPara(status, origem)
            };

            if (zona.Status != status) _mudancas.Writer.TryWrite((_zonas[indice], zona.Status));

            var leitura = new LeituraSensor(zonaId, Math.Round(distanciaCm, 1), alturaInstalacaoM, nivelM, status, agora, origem);

            if (!_historico.TryGetValue(zonaId, out var fila))
            {
                fila = new Queue<LeituraSensor>();
                _historico[zonaId] = fila;
            }
            fila.Enqueue(leitura);
            while (fila.Count > TamanhoDoHistorico) fila.Dequeue();

            _totalDeLeituras[zonaId] = _totalDeLeituras.GetValueOrDefault(zonaId) + 1;

            logger.LogInformation("Leitura ({Origem}): zona {Zona}, distância {Distancia:0.0} cm, nível {Nivel:0.000} m → {Status}",
                origem, zonaId, distanciaCm, nivelM, status);

            return leitura;
        }
    }

    /// <summary>Situação do sensor de uma zona (por padrão, a da maquete).</summary>
    public StatusSensor? ObterStatusDoSensor(string zonaId)
    {
        lock (_trava)
        {
            var zona = _zonas.FirstOrDefault(z => z.Id == zonaId);
            if (zona is null) return null;

            var historico = _historico.TryGetValue(zonaId, out var fila) ? fila.ToList() : [];
            var ultima = historico.LastOrDefault();
            var conectado = ultima is not null &&
                            (DateTimeOffset.UtcNow - ultima.RecebidaEm).TotalSeconds <= SegundosSemSinal;

            return new StatusSensor(
                Conectado: conectado,
                JaRecebeuLeitura: ultima is not null,
                UltimaLeituraEm: ultima?.RecebidaEm,
                TotalLeituras: _totalDeLeituras.GetValueOrDefault(zonaId),
                SegundosSemSinal: SegundosSemSinal,
                Zona: zona,
                UltimaLeitura: ultima,
                Historico: historico);
        }
    }

    // ---------- Simulação (botões da página Sensor) ----------

    /// <summary>Altura de instalação usada pela simulação da maquete (igual à do sensor de verdade).</summary>
    public const double AlturaSimulacaoM = 0.28;
    /// <summary>Nível máximo que a simulação aceita (a maquete transborda acima disso).</summary>
    public const double NivelMaximoSimulacaoCm = 25;

    /// <summary>
    /// Simula uma leitura da maquete. Converte o nível de água desejado na
    /// distância que o sensor mediria, e registra como se fosse o sensor.
    /// </summary>
    public LeituraSensor? SimularNivel(string zonaId, double? nivelCm, double? variacaoCm)
    {
        double alvoCm;
        lock (_trava)
        {
            var zona = _zonas.FirstOrDefault(z => z.Id == zonaId);
            if (zona is null) return null;
            var atualCm = zona.CotaAtual * 100;
            alvoCm = nivelCm ?? atualCm + (variacaoCm ?? 0);
        }

        alvoCm = Math.Clamp(Math.Round(alvoCm, 1), 0, NivelMaximoSimulacaoCm);
        var distanciaCm = AlturaSimulacaoM * 100 - alvoCm;
        return RegistrarLeitura(zonaId, distanciaCm, AlturaSimulacaoM, StatusZona.FonteSimulacao);
    }

    private static string ObservacaoPara(string status, string origem)
    {
        var medido = origem == StatusZona.FonteSimulacao ? "simulado" : "medido pelo sensor";
        return status switch
        {
            StatusZona.Perigo => "Nível acima do limite de transbordamento. Evite a área e siga as orientações da Defesa Civil.",
            StatusZona.Atencao => "Nível subindo. Evite passar pela área e acompanhe as atualizações.",
            _ => $"Nível normal, {medido}."
        };
    }
}
