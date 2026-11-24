namespace BolinhoDeChuva.Api.Models;

public record Contato(
    string Id,
    string Nome,
    string Numero,
    string Categoria,
    string Descricao,
    int Prioridade);
