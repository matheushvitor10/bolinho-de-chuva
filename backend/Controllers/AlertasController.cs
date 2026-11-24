using BolinhoDeChuva.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace BolinhoDeChuva.Api.Controllers;

[ApiController]
[Route("api/alertas")]
public class AlertasController(HistoricoAlertasService historico) : ControllerBase
{
    /// <summary>
    /// GET /api/alertas — histórico de alertas (os mais novos primeiro).
    /// O site filtra por local e por "só ativos" no navegador, com Vue.
    /// </summary>
    [HttpGet]
    public IActionResult Get() => Ok(historico.Listar());
}
