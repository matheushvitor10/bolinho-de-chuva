namespace BolinhoDeChuva.Api.Services;

/// <summary>
/// Diz se a API está rodando numa hospedagem (Render e parecidos) ou no seu computador.
/// As hospedagens informam a porta pela variável de ambiente PORT.
/// </summary>
public static class Hospedagem
{
    public static bool EstaHospedado =>
        !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("PORT"));
}
