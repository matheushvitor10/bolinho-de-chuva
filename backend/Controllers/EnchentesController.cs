using BolinhoDeChuva.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace BolinhoDeChuva.Api.Controllers;

[ApiController]
[Route("api/enchentes")]
public class EnchentesController(ZonasService zonas) : ControllerBase
{
    /// <summary>GET /api/enchentes — status de todas as zonas monitoradas.</summary>
    [HttpGet]
    public IActionResult Get() => Ok(zonas.ObterTodas());

    /// <summary>GET /api/enchentes/{id} — uma zona específica.</summary>
    [HttpGet("{id}")]
    public IActionResult GetPorId(string id)
    {
        var zona = zonas.ObterPorId(id);
        return zona is null
            ? NotFound(new { erro = $"Zona \"{id}\" não encontrada." })
            : Ok(zona);
    }
}
