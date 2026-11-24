using System.Net.Mail;
using System.Text.RegularExpressions;

namespace BolinhoDeChuva.Api.Services;

/// <summary>
/// Confere se um email é válido e pega erros de digitação comuns
/// (ex.: "gmial.com" → "gmail.com", "gmail.com.br" → "gmail.com").
/// </summary>
public static class ValidadorEmail
{
    public record Resultado(bool Valido, string? Email, string? Erro, string? Sugestao);

    private static readonly Regex Formato = new(@"^[^\s@]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$", RegexOptions.Compiled);

    private static readonly Dictionary<string, string> DominiosComErro = new()
    {
        ["gmial.com"] = "gmail.com", ["gmai.com"] = "gmail.com", ["gmal.com"] = "gmail.com",
        ["gnail.com"] = "gmail.com", ["gmail.co"] = "gmail.com", ["gmail.con"] = "gmail.com",
        ["gmail.cm"] = "gmail.com", ["gmail.om"] = "gmail.com", ["gmail.com.br"] = "gmail.com",
        ["gamil.com"] = "gmail.com", ["gmaill.com"] = "gmail.com", ["gemail.com"] = "gmail.com",
        ["hotmal.com"] = "hotmail.com", ["hotmial.com"] = "hotmail.com", ["hotmail.con"] = "hotmail.com",
        ["hotmail.co"] = "hotmail.com", ["hotmai.com"] = "hotmail.com", ["hotmeil.com"] = "hotmail.com",
        ["outlok.com"] = "outlook.com", ["outlook.con"] = "outlook.com", ["outloo.com"] = "outlook.com",
        ["yaho.com.br"] = "yahoo.com.br", ["yahoo.com.b"] = "yahoo.com.br", ["yahho.com.br"] = "yahoo.com.br",
        ["icloud.con"] = "icloud.com", ["iclod.com"] = "icloud.com"
    };

    public static Resultado Validar(string? entrada)
    {
        var email = (entrada ?? "").Trim().ToLowerInvariant();

        if (email.Length == 0)
            return new(false, null, "Digite o seu email.", null);

        if (email.Length > 254 || !Formato.IsMatch(email))
            return new(false, null, "Esse email não parece válido. Confira se ele tem @ e termina com algo como .com ou .com.br.", null);

        try
        {
            if (new MailAddress(email).Address != email)
                return new(false, null, "Esse email não parece válido.", null);
        }
        catch (FormatException)
        {
            return new(false, null, "Esse email não parece válido.", null);
        }

        var partes = email.Split('@');
        if (DominiosComErro.TryGetValue(partes[1], out var dominioCerto))
        {
            var sugestao = $"{partes[0]}@{dominioCerto}";
            return new(false, null, $"Parece que tem um erro de digitação. Você quis dizer {sugestao}?", sugestao);
        }

        return new(true, email, null, null);
    }

    /// <summary>Esconde parte do email nos registros (ex.: "fu***@gmail.com"), por privacidade.</summary>
    public static string Mascarar(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 0) return "***";
        var nome = email[..at];
        return (nome.Length <= 2 ? nome[..1] : nome[..2]) + "***" + email[at..];
    }
}
