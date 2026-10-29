using BolinhoDeChuva.Api.Models;
using BolinhoDeChuva.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace BolinhoDeChuva.Api.Controllers;

/// <summary>
/// Tudo o que tem a ver com o sensor ultrassônico (ESP32).
///
/// O ESP32 manda leituras para POST /api/sensor-leitura.
/// O site consulta GET /api/sensor/status pra mostrar a aba "Sensor".
/// </summary>
[ApiController]
[Route("api")]
public class SensorController(ZonasService zonas, IConfiguration configuracao) : ControllerBase
{
    private const string CabecalhoDaChave = "X-Chave-Sensor";

    /// <summary>
    /// POST /api/sensor-leitura
    ///
    /// Corpo (JSON):
    /// {
    ///   "zonaId": "maquete-demo",
    ///   "distanciaCm": 15.2,
    ///   "alturaInstalacaoM": 0.28
    /// }
    /// </summary>
    [HttpPost("sensor-leitura")]
    public IActionResult ReceberLeitura([FromBody] LeituraSensorEntrada? entrada)
    {
        // Chave opcional: se "Sensor:Chave" estiver preenchida no appsettings.json,
        // o sensor precisa mandar a mesma chave no cabeçalho X-Chave-Sensor.
        // Deixe vazia enquanto estiverem testando; preencha quando publicar o site.
        var chaveEsperada = configuracao["Sensor:Chave"];
        if (!string.IsNullOrEmpty(chaveEsperada) &&
            Request.Headers[CabecalhoDaChave].ToString() != chaveEsperada)
        {
            return Unauthorized(new { erro = $"Chave do sensor ausente ou incorreta (cabeçalho {CabecalhoDaChave})." });
        }

        if (entrada is null || string.IsNullOrWhiteSpace(entrada.ZonaId) ||
            entrada.DistanciaCm is null || entrada.AlturaInstalacaoM is null)
        {
            return BadRequest(new { erro = "Envie zonaId, distanciaCm e alturaInstalacaoM no corpo da requisição (JSON)." });
        }

        if (entrada.DistanciaCm < 0 || entrada.DistanciaCm > 500)
        {
            return BadRequest(new { erro = "distanciaCm precisa estar entre 0 e 500 (o HC-SR04 mede até uns 400 cm)." });
        }

        if (entrada.AlturaInstalacaoM <= 0 || entrada.AlturaInstalacaoM > 20)
        {
            return BadRequest(new { erro = "alturaInstalacaoM precisa ser maior que 0 (em metros: 28 cm = 0.28)." });
        }

        var leitura = zonas.RegistrarLeitura(entrada.ZonaId, entrada.DistanciaCm.Value, entrada.AlturaInstalacaoM.Value);
        if (leitura is null)
        {
            return NotFound(new { erro = $"zonaId \"{entrada.ZonaId}\" não existe. Confira os ids em Data/ZonasIniciais.cs." });
        }

        return Ok(new
        {
            mensagem = "Leitura recebida e zona atualizada.",
            leitura,
            zona = zonas.ObterPorId(entrada.ZonaId)
        });
    }

    /// <summary>GET /api/sensor/status?zonaId=maquete-demo</summary>
    [HttpGet("sensor/status")]
    public IActionResult Status([FromQuery] string zonaId = "maquete-demo")
    {
        var status = zonas.ObterStatusDoSensor(zonaId);
        return status is null
            ? NotFound(new { erro = $"Zona \"{zonaId}\" não encontrada." })
            : Ok(status);
    }
}
