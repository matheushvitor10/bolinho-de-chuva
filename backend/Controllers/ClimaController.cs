using BolinhoDeChuva.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace BolinhoDeChuva.Api.Controllers;

[ApiController]
[Route("api/clima")]
public class ClimaController(ClimaService clima, ILogger<ClimaController> logger) : ControllerBase
{
    /// <summary>GET /api/clima — clima ao vivo de Ribeirão Preto.</summary>
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        try
        {
            return Ok(await clima.ObterAsync(ct));
        }
        catch (Exception erro) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Não consegui buscar o clima: {Mensagem}", erro.Message);
            return StatusCode(503, new { erro = "O serviço de clima não respondeu. Tente de novo em alguns minutos." });
        }
    }
}
