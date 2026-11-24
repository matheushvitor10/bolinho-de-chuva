using BolinhoDeChuva.Api.Models;

namespace BolinhoDeChuva.Api.Data;

/// <summary>
/// Contatos de emergência — números nacionais/estaduais (SP), válidos em
/// Ribeirão Preto e região. Ligações gratuitas e 24h, salvo indicação contrária.
/// </summary>
public static class ContatosData
{
    public static readonly IReadOnlyList<Contato> Todos =
    [
        new("defesa-civil", "Defesa Civil", "199", "enchente",
            "Alagamentos, deslizamentos e imóveis com risco de desabamento. Um técnico vai até o local avaliar a situação.", 1),

        new("bombeiros", "Corpo de Bombeiros", "193", "resgate",
            "Resgate de pessoas ilhadas, soterramentos, incêndios e animais peçonhentos.", 1),

        new("samu", "SAMU", "192", "saude",
            "Emergência médica, mal súbito e acidentes com vítimas.", 1),

        new("policia", "Polícia Militar", "190", "seguranca",
            "Emergências policiais e situações de risco à segurança.", 1),

        new("alerta-sms", "Alerta da Defesa Civil por SMS", "40199", "enchente",
            "Mande uma mensagem com o seu CEP para 40199 e receba alertas de chuva forte e alagamento no celular. É gratuito.", 2),

        new("cpfl", "CPFL Paulista — emergência", "0800 010 1010", "energia",
            "Fio de energia caído ou solto e risco de choque elétrico. Ligação gratuita.", 2),

        new("rodoviaria-estadual", "Polícia Rodoviária Estadual", "198", "seguranca",
            "Ocorrências em rodovias estaduais — importante se a chuva afetar as estradas de acesso à cidade.", 3),

        new("cvv", "Centro de Valorização da Vida (CVV)", "188", "saude",
            "Apoio emocional. Passar por um alagamento pode ser traumático — esse canal também vale nesses momentos.", 3)
    ];
}
