using BolinhoDeChuva.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace BolinhoDeChuva.Api.Controllers;

[ApiController]
[Route("api/noticias")]
public class NoticiasController(NoticiasService noticias) : ControllerBase
{
    /// <summary>
    /// GET /api/noticias?abrangencia=ribeirao-preto|franca|nacional|regional|todas
    /// Só notícias de chuva e alagamento.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string abrangencia = "todas", CancellationToken ct = default)
    {
        var resposta = await noticias.ObterAsync(abrangencia.ToLowerInvariant(), ct);
        return Ok(resposta);
    }
}
