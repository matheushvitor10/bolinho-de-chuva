// ============================================================================
// Bolinho de Chuva — script do Google (Apps Script)
// ----------------------------------------------------------------------------
// Este código roda DENTRO da conta bolinhodechuva2026@gmail.com e faz duas coisas:
//   1. Envia os emails do sistema (boas-vindas e alertas) pela própria conta.
//   2. Guarda a lista de inscritos numa planilha do Google Drive
//      ("Bolinho de Chuva — Inscritos"), criada sozinha na primeira vez.
//
// Como o sistema fala com o Google por HTTPS (igual a qualquer site), funciona
// mesmo em redes que bloqueiam envio de email, como as de escola.
//
// NÃO mude a CHAVE abaixo: ela é a "senha" que o sistema usa para falar com
// este script, e já vem preenchida pela página de configuração do site.
// ============================================================================

const CHAVE = "{{CHAVE}}";

function doPost(e) {
  let dados;
  try {
    dados = JSON.parse(e.postData.contents);
  } catch (erro) {
    return resposta({ ok: false, erro: "O pedido não veio em JSON." });
  }

  if (dados.chave !== CHAVE) {
    return resposta({ ok: false, erro: "Chave incorreta. Copie o código de novo pela página de configuração do site." });
  }

  try {
    switch (dados.acao) {
      case "ping":            return resposta(ping());
      case "enviar":          return resposta(enviar(dados));
      case "salvarInscrito":  return resposta(salvarInscrito(dados));
      case "removerInscrito": return resposta(removerInscrito(dados));
      case "listarInscritos": return resposta(listarInscritos());
      default:                return resposta({ ok: false, erro: "Ação desconhecida: " + dados.acao });
    }
  } catch (erro) {
    return resposta({ ok: false, erro: String(erro && erro.message ? erro.message : erro) });
  }
}

// Abrindo o link no navegador, aparece esta mensagem (serve pra conferir se está no ar).
function doGet() {
  return resposta({ ok: true, mensagem: "Script do Bolinho de Chuva no ar. O sistema usa este endereço por POST." });
}

function ping() {
  return {
    ok: true,
    conta: Session.getEffectiveUser().getEmail(),
    planilha: abaInscritos().getParent().getUrl(),
    cotaRestante: MailApp.getRemainingDailyQuota()
  };
}

function enviar(d) {
  const imagens = {};
  (d.imagens || []).forEach(function (img) {
    imagens[img.nome] = Utilities.newBlob(Utilities.base64Decode(img.base64), img.tipo, img.nome);
  });

  MailApp.sendEmail({
    to: d.para,
    subject: d.assunto,
    htmlBody: d.html,
    body: d.texto,
    name: d.nomeRemetente || "Bolin — Bolinho de Chuva",
    inlineImages: imagens
  });

  return { ok: true, cotaRestante: MailApp.getRemainingDailyQuota() };
}

// ---------- Planilha de inscritos ----------

function abaInscritos() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("PLANILHA_ID");
  let planilha = null;

  if (id) {
    try { planilha = SpreadsheetApp.openById(id); } catch (erro) { planilha = null; }
  }
  if (!planilha) {
    planilha = SpreadsheetApp.create("Bolinho de Chuva — Inscritos");
    props.setProperty("PLANILHA_ID", planilha.getId());
  }

  let aba = planilha.getSheetByName("Inscritos");
  if (!aba) {
    aba = planilha.getSheets()[0];
    aba.setName("Inscritos");
    aba.getRange("A:C").setNumberFormat("@");          // tudo como texto
    aba.getRange(1, 1, 1, 3).setValues([["Email", "Token (não apague)", "Inscrito em"]]).setFontWeight("bold");
    aba.setFrozenRows(1);
    aba.setColumnWidth(1, 260);
    aba.setColumnWidth(2, 280);
    aba.setColumnWidth(3, 200);
  }
  return aba;
}

function salvarInscrito(d) {
  const trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    const aba = abaInscritos();
    const linhas = aba.getDataRange().getValues();
    for (let i = 1; i < linhas.length; i++) {
      if (String(linhas[i][0]).toLowerCase() === String(d.email).toLowerCase()) return { ok: true, jaExistia: true };
    }
    aba.appendRow([d.email, d.token, d.inscritoEm]);
    return { ok: true, jaExistia: false };
  } finally {
    trava.releaseLock();
  }
}

function removerInscrito(d) {
  const trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    const aba = abaInscritos();
    const linhas = aba.getDataRange().getValues();
    for (let i = linhas.length - 1; i >= 1; i--) {
      if (String(linhas[i][1]) === String(d.token)) aba.deleteRow(i + 1);
    }
    return { ok: true };
  } finally {
    trava.releaseLock();
  }
}

function listarInscritos() {
  const linhas = abaInscritos().getDataRange().getValues();
  const inscritos = [];
  for (let i = 1; i < linhas.length; i++) {
    if (!linhas[i][0] || !linhas[i][1]) continue;
    inscritos.push({ email: String(linhas[i][0]), token: String(linhas[i][1]), inscritoEm: String(linhas[i][2] || "") });
  }
  return { ok: true, inscritos: inscritos };
}

function resposta(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

// Se o Google pedir permissão e não aparecer o aviso, selecione esta função
// lá em cima e clique em "Executar": ele vai pedir as autorizações.
function autorizar() {
  abaInscritos();
  MailApp.getRemainingDailyQuota();
  Logger.log("Tudo autorizado! Agora é só implantar como App da Web.");
}
