using Microsoft.AspNetCore.Mvc;

namespace BolinhoDeChuva.Api.Controllers;

[ApiController]
[Route("api/status")]
public class StatusController : ControllerBase
{
    /// <summary>GET /api/status — usado pelo site pra saber se a API está no ar.</summary>
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        ok = true,
        sistema = "Bolinho de Chuva — SPA",
        horario = DateTimeOffset.UtcNow
    });
}
