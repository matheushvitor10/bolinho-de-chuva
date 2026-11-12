namespace BolinhoDeChuva.Api.Models;

/// <summary>Uma pessoa cadastrada para receber alertas por email.</summary>
public record Inscrito(
    string Email,
    string Token,          // código secreto do link "cancelar inscrição" de cada email
    DateTimeOffset InscritoEm);

/// <summary>Tudo o que fica salvo no arquivo dados/inscritos.json.</summary>
public class EstadoInscricoes
{
    public List<Inscrito> Inscritos { get; set; } = [];

    /// <summary>Dia do último alerta de temporal (pra mandar no máximo um por dia).</summary>
    public DateOnly? UltimoAlertaDeTemporal { get; set; }

    /// <summary>Quando foi o último email de "começou a chover" (no máximo um a cada X horas).</summary>
    public DateTimeOffset? UltimoAlertaDeChuva { get; set; }
}

/// <summary>O JSON que o site manda em POST /api/emails/inscrever.</summary>
public class InscricaoEntrada
{
    public string? Email { get; set; }
}
