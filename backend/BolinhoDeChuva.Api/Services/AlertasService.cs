using BolinhoDeChuva.Api.Models;

namespace BolinhoDeChuva.Api.Services;

/// <summary>Manda um email para cada pessoa inscrita, uma de cada vez.</summary>
public class AlertasService(InscricoesService inscricoes, EmailService email, ILogger<AlertasService> logger)
{
    // Garante que dois disparos não aconteçam ao mesmo tempo.
    private readonly SemaphoreSlim _umDeCadaVez = new(1, 1);

    public async Task<(int Enviados, int Total)> EnviarParaTodosAsync(
        string descricao, Func<Inscrito, MensagemEmail> montar, CancellationToken ct = default)
    {
        await _umDeCadaVez.WaitAsync(ct);
        try
        {
            var lista = inscricoes.Listar();
            if (lista.Count == 0)
            {
                logger.LogInformation("Alerta \"{Descricao}\": ninguém inscrito ainda, nenhum email enviado.", descricao);
                return (0, 0);
            }

            logger.LogInformation("Enviando alerta \"{Descricao}\" para {Total} pessoa(s)…", descricao, lista.Count);
            var enviados = 0;
            foreach (var inscrito in lista)
            {
                if (await email.EnviarAsync(montar(inscrito), ct)) enviados++;
                if (!email.ModoTeste) await Task.Delay(400, ct); // não sobrecarregar o Gmail
            }

            logger.LogInformation("Alerta \"{Descricao}\": {Enviados} de {Total} email(s) enviado(s).", descricao, enviados, lista.Count);
            return (enviados, lista.Count);
        }
        finally
        {
            _umDeCadaVez.Release();
        }
    }
}
