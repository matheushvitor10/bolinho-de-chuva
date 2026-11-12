using System.Globalization;
using BolinhoDeChuva.Api.Models;

namespace BolinhoDeChuva.Api.Services;

/// <summary>
/// Guarda o histórico de alertas (os últimos 200), em memória.
/// Quem abre e fecha os alertas é o vigia (MonitorDeAlertasService).
/// </summary>
public class HistoricoAlertasService
{
    private const int Maximo = 200;
    private readonly object _trava = new();
    private readonly List<AlertaRegistro> _alertas = [];

    public IReadOnlyList<AlertaRegistro> Listar()
    {
        lock (_trava) return _alertas.OrderByDescending(a => a.Inicio).ToList();
    }

    /// <summary>
    /// Uma região mudou de situação: abre um alerta (atenção/perigo), sobe o
    /// nível do alerta que já estava aberto, ou encerra quando voltou ao normal.
    /// </summary>
    public void RegistrarZona(ZonaAlagamento zona)
    {
        lock (_trava)
        {
            var aberto = _alertas.FindIndex(a => a.ZonaId == zona.Id && a.Ativo);

            if (zona.Status == StatusZona.Tranquilo)
            {
                if (aberto >= 0) _alertas[aberto] = _alertas[aberto] with { Fim = DateTimeOffset.UtcNow };
                return;
            }

            var br = new CultureInfo("pt-BR");
            var detalhe = zona.EhMaquete
                ? string.Create(br, $"Nível da água: {zona.CotaAtual * 100:0.#} cm")
                : string.Create(br, $"Nível da água: {zona.CotaAtual:0.00} m");

            if (aberto >= 0)
            {
                // Já estava em alerta: atualiza o nível (ex.: de atenção para perigo).
                var atual = _alertas[aberto];
                var nivel = atual.Nivel == StatusZona.Perigo ? StatusZona.Perigo : zona.Status;
                _alertas[aberto] = atual with { Nivel = nivel, Detalhe = detalhe };
                return;
            }

            Adicionar(new AlertaRegistro
            {
                Id = Guid.NewGuid().ToString("N")[..10],
                Tipo = "alagamento",
                Local = zona.Nome,
                ZonaId = zona.Id,
                Nivel = zona.Status,
                Detalhe = detalhe,
                Inicio = DateTimeOffset.UtcNow
            });
        }
    }

    /// <summary>Abre um alerta de clima ("chuva" ou "temporal"), se ainda não houver um aberto.</summary>
    public void AbrirClima(string tipo, string nivel, string detalhe)
    {
        lock (_trava)
        {
            if (_alertas.Any(a => a.Tipo == tipo && a.Ativo)) return;
            Adicionar(new AlertaRegistro
            {
                Id = Guid.NewGuid().ToString("N")[..10],
                Tipo = tipo,
                Local = "Ribeirão Preto",
                Nivel = nivel,
                Detalhe = detalhe,
                Inicio = DateTimeOffset.UtcNow
            });
        }
    }

    /// <summary>Encerra o alerta de clima aberto (a chuva parou, o temporal passou).</summary>
    public void FecharClima(string tipo)
    {
        lock (_trava)
        {
            var aberto = _alertas.FindIndex(a => a.Tipo == tipo && a.Ativo);
            if (aberto >= 0) _alertas[aberto] = _alertas[aberto] with { Fim = DateTimeOffset.UtcNow };
        }
    }

    public bool TemClimaAtivo(string tipo)
    {
        lock (_trava) return _alertas.Any(a => a.Tipo == tipo && a.Ativo);
    }

    private void Adicionar(AlertaRegistro alerta)
    {
        _alertas.Add(alerta);
        if (_alertas.Count > Maximo)
        {
            // tira os encerrados mais antigos primeiro
            var maisAntigo = _alertas.Where(a => !a.Ativo).OrderBy(a => a.Inicio).FirstOrDefault();
            if (maisAntigo is not null) _alertas.Remove(maisAntigo);
        }
    }
}
