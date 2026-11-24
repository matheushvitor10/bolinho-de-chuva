using BolinhoDeChuva.Api.Data;
using Microsoft.AspNetCore.Mvc;

namespace BolinhoDeChuva.Api.Controllers;

[ApiController]
[Route("api/contatos")]
public class ContatosController : ControllerBase
{
    /// <summary>GET /api/contatos — telefones de emergência.</summary>
    [HttpGet]
    public IActionResult Get() => Ok(ContatosData.Todos.OrderBy(c => c.Prioridade));
}
