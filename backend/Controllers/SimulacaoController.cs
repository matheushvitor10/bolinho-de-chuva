using BolinhoDeChuva.Api.Models;
using BolinhoDeChuva.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BolinhoDeChuva.Api.Controllers;

/// <summary>
/// Simulação do sensor da maquete, usada pelos botões da aba "Sensor".
/// Serve para apresentar o sistema mesmo sem o hardware: cada clique vira uma
/// "leitura" igualzinha à que o ESP32 mandaria (atualiza tanque, gráfico,
/// alertas e até os emails).
///
/// Para desligar (ex.: depois de publicar com o sensor de verdade), coloque
/// "Simulacao": { "Habilitada": false } no appsettings.json.
/// </summary>
[ApiController]
[Route("api/simulacao")]
public class SimulacaoController(ZonasService zonas, IConfiguration config) : ControllerBase
{
    private bool Habilitada => config.GetValue("Simulacao:Habilitada", true);

    /// <summary>GET /api/simulacao — diz se a simulação está ligada (o site usa isso pra mostrar os botões).</summary>
    [HttpGet]
    public IActionResult Status() => Ok(new
    {
        habilitada = Habilitada,
        nivelMaximoCm = ZonasService.NivelMaximoSimulacaoCm
    });

    /// <summary>
    /// POST /api/simulacao/maquete
    ///   { "nivelCm": 15 }      → deixa a água com 15 cm
    ///   { "variacaoCm": 2 }    → a água sobe 2 cm
    ///   { "variacaoCm": -1 }   → a água desce 1 cm
    /// </summary>
    [HttpPost("maquete")]
    [EnableRateLimiting("simulacao")]
    public IActionResult SimularMaquete([FromBody] SimulacaoEntrada? entrada)
    {
        if (!Habilitada)
            return StatusCode(403, new { erro = "A simulação está desligada (Simulacao:Habilitada = false no appsettings.json)." });

        if (entrada is null || (entrada.NivelCm is null && entrada.VariacaoCm is null))
            return BadRequest(new { erro = "Envie nivelCm (altura da água) ou variacaoCm (quanto sobe ou desce)." });

        if (entrada.VariacaoCm is { } v && Math.Abs(v) > 10)
            return BadRequest(new { erro = "variacaoCm precisa estar entre -10 e 10." });

        var leitura = zonas.SimularNivel("maquete-demo", entrada.NivelCm, entrada.VariacaoCm);
        if (leitura is null) return NotFound(new { erro = "A zona da maquete não foi encontrada." });

        return Ok(zonas.ObterStatusDoSensor("maquete-demo"));
    }
}
