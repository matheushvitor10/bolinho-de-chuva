using System.Globalization;
using System.Net;
using BolinhoDeChuva.Api.Models;

namespace BolinhoDeChuva.Api.Services;

/// <summary>
/// O visual dos emails. Email não é site: os programas de email (Gmail,
/// Outlook...) ignoram boa parte do CSS moderno, por isso aqui é tudo feito
/// com tabelas e estilo direto em cada tag. É feio de escrever, mas é o que
/// funciona em todo lugar.
/// </summary>
public class EmailTemplates(IConfiguration config)
{
    private string UrlSite => (config["Site:Url"] ?? "http://localhost:5080").TrimEnd('/');
    private string UrlApi => (config["Site:UrlApi"] ?? "http://localhost:5080").TrimEnd('/');

    public string LinkCancelar(Inscrito i) => $"{UrlApi}/api/emails/cancelar?token={i.Token}";

    private static string H(string? texto) => WebUtility.HtmlEncode(texto ?? "");

    // Números sempre no formato brasileiro (19,5 cm), seja qual for o idioma do computador.
    private static readonly CultureInfo Br = new("pt-BR");

    private static string AgoraNoBrasil() =>
        DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-3)).ToString("dd/MM 'às' HH:mm");

    // ======================================================================
    // Boas-vindas (o email fofinho)
    // ======================================================================
    public MensagemEmail BoasVindas(Inscrito i)
    {
        var cancelar = LinkCancelar(i);

        var html = $$"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Que bom ter você aqui!</title>
</head>
<body style="margin:0;padding:0;background:#E3EFF8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">O Bolin agradece o seu cadastro e já está de olho no céu por você.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E3EFF8;">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#17324A;">

        <tr>
          <td align="center" style="background:#CFE5F5;padding:26px 20px 0;">
            <img src="cid:bolin-corpo" width="234" height="220" alt="O Bolin, de capa de chuva azul, acenando para você" style="display:block;border:0;outline:none;">
          </td>
        </tr>

        <tr>
          <td style="padding:30px 36px 6px;">
            <h1 style="margin:0 0 14px;font-size:27px;line-height:1.25;color:#6F3512;">Oba! Que bom ter você aqui 🧡</h1>
            <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Oi! Eu sou o <strong>Bolin</strong>, o mascote do Bolinho de Chuva. Muito, muito obrigado por se cadastrar! 🥹</p>
            <p style="margin:0 0 6px;font-size:16px;line-height:1.6;">A partir de agora eu fico de olho no céu e nos córregos de Ribeirão Preto por você. Quando o tempo fechar de verdade, eu te aviso aqui:</p>
          </td>
        </tr>

        <tr>
          <td style="padding:10px 36px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#F3F7FA;border-radius:16px;padding:14px 18px;font-size:15px;line-height:1.5;">
                  ⛈️ <strong>Alerta de temporal</strong><br>
                  <span style="color:#56697A;">quando a previsão indicar trovoada ou chuva forte na cidade</span>
                </td>
              </tr>
              <tr><td style="height:10px;line-height:10px;font-size:10px;">&nbsp;</td></tr>
              <tr>
                <td style="background:#F3F7FA;border-radius:16px;padding:14px 18px;font-size:15px;line-height:1.5;">
                  🌊 <strong>Alerta de alagamento</strong><br>
                  <span style="color:#56697A;">quando alguma região monitorada entrar em nível de perigo</span>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#56697A;">E não se preocupe: eu só escrevo quando é importante. Nada de encher a sua caixa de entrada. ☂️</p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 36px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#FBF1E4;border-radius:16px;padding:14px 18px;font-size:15px;line-height:1.55;">
                  <strong style="color:#6F3512;">Dica do Bolin:</strong> salve o <strong>199</strong> da Defesa Civil nos contatos do celular. Em emergência, cada segundo conta.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:26px 36px 6px;">
            <a href="{{H(UrlSite)}}" style="display:inline-block;background:#1D5A8E;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:999px;">Ver como está a chuva agora</a>
          </td>
        </tr>

        <tr>
          <td style="padding:22px 36px 32px;font-size:16px;line-height:1.6;">
            Um abraço quentinho (e bem sequinho),<br>
            <strong style="color:#6F3512;font-size:18px;">Bolin</strong> 🌂
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr>
          <td style="padding:18px 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:#56697A;text-align:center;">
            Você recebeu este email porque cadastrou <strong>{{H(i.Email)}}</strong> no Bolinho de Chuva — Sistema de Prevenção de Alagamentos de Ribeirão Preto.<br>
            Não quer mais receber? <a href="{{H(cancelar)}}" style="color:#1D5A8E;">Cancelar inscrição</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
""";

        var texto = $"""
Oba! Que bom ter você aqui!

Oi! Eu sou o Bolin, o mascote do Bolinho de Chuva. Muito obrigado por se cadastrar!

A partir de agora eu fico de olho no céu e nos córregos de Ribeirão Preto por você. Vou te avisar:
- quando a previsão indicar trovoada ou chuva forte na cidade;
- quando alguma região monitorada entrar em nível de perigo.

Eu só escrevo quando é importante.

Dica do Bolin: salve o 199 da Defesa Civil nos contatos do celular.

Ver como está a chuva agora: {UrlSite}

Um abraço quentinho (e bem sequinho),
Bolin

---
Não quer mais receber? Cancele aqui: {cancelar}
""";

        return new MensagemEmail(i.Email, "Oba! O Bolin agradece o seu cadastro 🧡", html, texto, "boas-vindas", cancelar);
    }

    // ======================================================================
    // Alertas — visual sério: cabeçalho azul-escuro, faixa colorida com o
    // nível de risco e o Bolin no canto. Cor vermelha = alagamento,
    // laranja = temporal.
    // ======================================================================

    private const string CorAlagamento = "#C0392B";
    private const string CorTemporal = "#C9600C";
    private const string CorChuva = "#2F6FA8";

    /// <summary>Um "medidor" (barra) no email: nível da água ou chance de chuva.</summary>
    private record Medidor(string Rotulo, string Valor, double Percentual, string Legenda);

    /// <summary>Alerta de temporal (pela previsão do tempo).</summary>
    public MensagemEmail AlertaTemporal(Inscrito i, string motivo, ClimaAtual clima)
    {
        var hoje = clima.PrevisaoHoje;
        var chance = hoje.ProbabilidadeChuva ?? 0;

        return Alerta(i,
            assunto: "⚠️ Alerta de temporal — Ribeirão Preto",
            rotulo: "Alerta de temporal",
            titulo: "Temporal previsto para hoje",
            nivelRisco: "Alto",
            cor: CorTemporal,
            chamada: motivo,
            paragrafo: "Temporais costumam trazer chuva muito forte em pouco tempo, raios e ventania. " +
                       "Ruas podem alagar em minutos, principalmente perto de córregos e em fundos de vale.",
            medidor: new Medidor("Chance de chuva hoje", $"{chance}%", chance,
                string.Create(Br, $"Chuva prevista para hoje: cerca de {hoje.ChuvaMm:0.#} mm.")),
            detalhes:
            [
                ("Condição agora", string.Create(Br, $"{clima.Condicao}, {clima.Temperatura:0}°C")),
                ("Vento", string.Create(Br, $"{clima.VentoKmh:0} km/h")),
                ("Umidade do ar", $"{clima.Umidade}%"),
                ("Emitido em", AgoraNoBrasil())
            ],
            passos:
            [
                "Se puder, adie saídas pelas próximas horas. Na rua, procure um abrigo seguro — nunca embaixo de árvores ou postes.",
                "Não atravesse ruas alagadas, nem a pé nem de carro: a água esconde buracos e correnteza.",
                "Durante os raios, fique longe de janelas e tire aparelhos eletrônicos da tomada."
            ],
            recado: "Deixe o celular carregado e fique perto de quem precisa de ajuda, como idosos e crianças. " +
                    "Temporais passam — e passam com mais tranquilidade para quem está em segurança.",
            tipo: "alerta-temporal",
            linkBotao: $"{UrlSite}/clima.html",
            textoBotao: "Acompanhar a previsão");
    }

    /// <summary>Aviso de que começou a chover de verdade em Ribeirão Preto.</summary>
    public MensagemEmail AlertaChuva(Inscrito i, ClimaAtual clima)
    {
        var hoje = clima.PrevisaoHoje;
        var percentual = Math.Clamp(clima.PrecipitacaoMm / 10 * 100, 0, 100);
        var legenda = hoje.ProbabilidadeChuva is int p
            ? string.Create(Br, $"Previsão para hoje: cerca de {hoje.ChuvaMm:0.#} mm, com {p}% de chance de chuva.")
            : string.Create(Br, $"Previsão para hoje: cerca de {hoje.ChuvaMm:0.#} mm.");

        return Alerta(i,
            assunto: "🌧️ Começou a chover em Ribeirão Preto",
            rotulo: "Alerta de chuva",
            titulo: "Está chovendo agora",
            nivelRisco: "Atenção",
            cor: CorChuva,
            chamada: $"Começou a chover em Ribeirão Preto: {clima.Condicao.ToLowerInvariant()}.",
            paragrafo: "Chuva sozinha não é perigo, mas é o primeiro sinal para ficar de olho. " +
                       "Ruas de fundo de vale e perto de córregos são as primeiras a acumular água.",
            medidor: new Medidor("Chuva na última hora", string.Create(Br, $"{clima.PrecipitacaoMm:0.#} mm"), percentual, legenda),
            detalhes:
            [
                ("Condição agora", string.Create(Br, $"{clima.Condicao}, {clima.Temperatura:0}°C")),
                ("Vento", string.Create(Br, $"{clima.VentoKmh:0} km/h")),
                ("Umidade do ar", $"{clima.Umidade}%"),
                ("Emitido em", AgoraNoBrasil())
            ],
            passos:
            [
                "Evite passar por ruas que costumam alagar, fundos de vale e beiras de córrego.",
                "No trânsito, vá devagar e mantenha distância: a pista fica escorregadia.",
                "Se a chuva apertar, acompanhe o site. Se alguma região entrar em perigo, você recebe outro aviso."
            ],
            recado: "Leve o guarda-chuva e, se puder, espere a chuva forte passar antes de sair. " +
                    "Eu continuo de olho nos córregos por você.",
            tipo: "alerta-chuva",
            linkBotao: $"{UrlSite}/clima.html",
            textoBotao: "Acompanhar o clima");
    }

    /// <summary>Alerta de região em nível de perigo (sensor, simulação ou monitoramento).</summary>
    public MensagemEmail AlertaZona(Inscrito i, ZonaAlagamento zona)
    {
        var emCm = zona.EhMaquete;
        string Formatar(double metros) => emCm ? string.Create(Br, $"{metros * 100:0.#} cm") : string.Create(Br, $"{metros:0.00} m");
        var percentual = Math.Clamp(zona.CotaAtual / (zona.CotaAlerta * 1.25) * 100, 0, 100);

        return Alerta(i,
            assunto: $"⚠️ Alerta de alagamento — {zona.Nome}",
            rotulo: "Alerta de alagamento",
            titulo: "Perigo de alagamento",
            nivelRisco: "Perigo",
            cor: CorAlagamento,
            chamada: $"{zona.Nome} entrou em nível de perigo.",
            paragrafo: zona.Observacao,
            medidor: new Medidor("Nível da água", Formatar(zona.CotaAtual), percentual,
                $"Limite de perigo: {Formatar(zona.CotaAlerta)}. O nível está acima do limite."),
            detalhes:
            [
                ("Região", zona.Nome),
                ("Medido por", zona.Fonte switch { StatusZona.FonteSensor => "sensor", StatusZona.FonteSimulacao => "simulação", _ => "monitoramento" }),
                ("Emitido em", AgoraNoBrasil())
            ],
            passos:
            [
                "Não atravesse ruas alagadas, nem a pé nem de carro: 15 cm de água em movimento já derrubam uma pessoa.",
                "Afaste-se de córregos, fundos de vale, bueiros e fios caídos.",
                "Se a água entrar em casa, desligue a chave geral de energia e vá para o ponto mais alto."
            ],
            recado: "Sei que dá vontade de ir ver como está a rua, mas agora o mais importante é ficar longe da água. " +
                    "Fique em um lugar seguro e acompanhe as atualizações pelo site.",
            tipo: "alerta-zona",
            linkBotao: zona.EhMaquete ? $"{UrlSite}/sensor.html" : $"{UrlSite}/alagamentos.html",
            textoBotao: zona.EhMaquete ? "Ver o sensor ao vivo" : "Ver o mapa de alagamentos");
    }

    private MensagemEmail Alerta(Inscrito i, string assunto, string rotulo, string titulo, string nivelRisco, string cor,
        string chamada, string paragrafo, Medidor medidor, List<(string Rotulo, string Valor)> detalhes,
        List<string> passos, string recado, string tipo, string linkBotao, string textoBotao)
    {
        var cancelar = LinkCancelar(i);
        var preenchido = Math.Round(Math.Clamp(medidor.Percentual, 4, 100));

        var linhasDetalhes = string.Concat(detalhes.Select((d, n) => $$"""
                    <tr>
                      <td style="padding:9px 0;{{(n > 0 ? "border-top:1px solid #E3EBF2;" : "")}}font-size:14px;color:#56697A;width:40%;vertical-align:top;">{{H(d.Rotulo)}}</td>
                      <td style="padding:9px 0;{{(n > 0 ? "border-top:1px solid #E3EBF2;" : "")}}font-size:15px;font-weight:bold;color:#17324A;vertical-align:top;">{{H(d.Valor)}}</td>
                    </tr>
"""));

        var linhasPassos = string.Concat(passos.Select((texto, n) => $$"""
              <tr>
                <td width="34" style="vertical-align:top;padding:0 0 12px;">
                  <div style="width:24px;height:24px;border-radius:12px;background:#123F66;color:#FFFFFF;font-size:13px;font-weight:bold;line-height:24px;text-align:center;">{{n + 1}}</div>
                </td>
                <td style="vertical-align:top;padding:2px 0 12px;font-size:15px;line-height:1.5;color:#17324A;">{{H(texto)}}</td>
              </tr>
"""));

        string Emergencia(string numero, string nome) => $$"""
                <td width="33%" style="padding:0 4px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F7FA;border-radius:12px;">
                    <tr><td align="center" style="padding:12px 4px 10px;">
                      <div style="font-size:26px;line-height:1.1;font-weight:bold;color:#123F66;">{{numero}}</div>
                      <div style="font-size:12px;color:#56697A;margin-top:3px;">{{nome}}</div>
                    </td></tr>
                  </table>
                </td>
""";

        var html = $$"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{{H(titulo)}}</title>
</head>
<body style="margin:0;padding:0;background:#EEF3F7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{H(chamada)}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF3F7;">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:18px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#17324A;">

        <!-- faixa colorida do nível de risco -->
        <tr><td style="background:{{cor}};height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr>

        <!-- cabeçalho: título à esquerda, Bolin à direita -->
        <tr>
          <td style="background:#123F66;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:24px 8px 22px 28px;vertical-align:middle;">
                  <div style="font-size:12px;letter-spacing:1.6px;text-transform:uppercase;font-weight:bold;color:#9CC7EA;">{{H(rotulo)}}</div>
                  <div style="font-size:27px;line-height:1.15;font-weight:bold;color:#FFFFFF;margin-top:8px;">{{H(titulo)}}</div>
                  <div style="font-size:14px;color:#CFE3F3;margin-top:8px;">Ribeirão Preto · {{H(AgoraNoBrasil())}}</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
                    <tr><td style="background:{{cor}};color:#FFFFFF;font-size:13px;font-weight:bold;padding:6px 14px;border-radius:999px;white-space:nowrap;">Nível de risco: {{H(nivelRisco)}}</td></tr>
                  </table>
                </td>
                <td width="146" style="width:146px;padding:16px 14px 0 0;vertical-align:bottom;" align="right">
                  <img src="cid:bolin-alerta" width="132" height="124" alt="Bolin, o mascote do Bolinho de Chuva" style="display:block;border:0;outline:none;">
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- o que está acontecendo -->
        <tr>
          <td style="padding:26px 30px 4px;">
            <p style="margin:0 0 10px;font-size:19px;line-height:1.4;font-weight:bold;color:#17324A;">{{H(chamada)}}</p>
            <p style="margin:0;font-size:16px;line-height:1.6;color:#33495C;">{{H(paragrafo)}}</p>
          </td>
        </tr>

        <!-- medidor -->
        <tr>
          <td style="padding:18px 30px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F7FA;border-radius:14px;">
              <tr><td style="padding:16px 18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:14px;color:#56697A;">{{H(medidor.Rotulo)}}</td>
                    <td align="right" style="font-size:22px;font-weight:bold;color:{{cor}};">{{H(medidor.Valor)}}</td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;background:#DCE6EE;border-radius:6px;">
                  <tr>
                    <td width="{{preenchido}}%" style="width:{{preenchido}}%;background:{{cor}};height:10px;line-height:10px;font-size:0;border-radius:6px;">&nbsp;</td>
                    <td style="height:10px;line-height:10px;font-size:0;">&nbsp;</td>
                  </tr>
                </table>
                <div style="font-size:13px;color:#56697A;margin-top:9px;">{{H(medidor.Legenda)}}</div>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- detalhes -->
        <tr>
          <td style="padding:10px 30px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
{{linhasDetalhes}}
            </table>
          </td>
        </tr>

        <!-- o que fazer -->
        <tr>
          <td style="padding:22px 30px 0;">
            <div style="font-size:17px;font-weight:bold;color:#123F66;margin-bottom:12px;">O que fazer agora</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
{{linhasPassos}}
            </table>
          </td>
        </tr>

        <!-- recado do Bolin -->
        <tr>
          <td style="padding:6px 30px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF1E4;border-radius:12px;">
              <tr>
                <td width="4" style="width:4px;background:#C9863C;border-radius:12px 0 0 12px;font-size:0;">&nbsp;</td>
                <td style="padding:14px 18px;font-size:15px;line-height:1.55;color:#33495C;">
                  <strong style="color:#6F3512;">Recado do Bolin:</strong> {{H(recado)}}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- emergência -->
        <tr>
          <td style="padding:24px 26px 0;">
            <div style="font-size:15px;font-weight:bold;color:#123F66;margin:0 4px 10px;">Em emergência, ligue</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
{{Emergencia("199", "Defesa Civil")}}
{{Emergencia("193", "Bombeiros")}}
{{Emergencia("192", "SAMU")}}
              </tr>
            </table>
          </td>
        </tr>

        <!-- botão -->
        <tr>
          <td align="center" style="padding:26px 30px 30px;">
            <a href="{{H(linkBotao)}}" style="display:inline-block;background:#123F66;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:999px;">{{H(textoBotao)}}</a>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr>
          <td style="padding:18px 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:#56697A;text-align:center;">
            <strong style="color:#33495C;">Bolinho de Chuva</strong> — Sistema de Prevenção de Alagamentos · Ribeirão Preto e Franca, SP<br>
            Você recebe estes alertas porque cadastrou <strong>{{H(i.Email)}}</strong>. <a href="{{H(cancelar)}}" style="color:#1D5A8E;">Cancelar inscrição</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
""";

        var texto = $"""
{rotulo.ToUpperInvariant()} — NÍVEL DE RISCO: {nivelRisco.ToUpperInvariant()}
{titulo}

{chamada}

{paragrafo}

{medidor.Rotulo}: {medidor.Valor}
{medidor.Legenda}

{string.Join("\n", detalhes.Select(d => $"{d.Rotulo}: {d.Valor}"))}

O que fazer agora:
{string.Join("\n", passos.Select((p, n) => $"{n + 1}. {p}"))}

Recado do Bolin: {recado}

Em emergência: Defesa Civil 199 | Bombeiros 193 | SAMU 192

{textoBotao}: {linkBotao}

---
Bolinho de Chuva — Sistema de Prevenção de Alagamentos
Não quer mais receber? Cancele aqui: {cancelar}
""";

        return new MensagemEmail(i.Email, assunto, html, texto, tipo, cancelar);
    }
}
