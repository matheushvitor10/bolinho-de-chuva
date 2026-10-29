// ===================================================================
// Página de configuração dos emails (config.html)
// Só funciona no computador que está rodando a API (localhost).
// ===================================================================

const API = (window.BOLINHO_CONFIG && window.BOLINHO_CONFIG.API_URL) || "http://localhost:5080/api";

function esc(t) {
  return String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function chamar(metodo, caminho, corpo) {
  const resposta = await fetch(`${API}/config${caminho}`, {
    method: metodo,
    headers: corpo ? { "Content-Type": "application/json" } : {},
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  if (resposta.status === 404) throw new Error("Esta página só funciona no computador que está rodando o sistema.");
  if (!resposta.ok) throw new Error(`A API respondeu ${resposta.status}.`);
  return resposta.json();
}

// Mostra a lista de passos com ✔ e ✘
function mostrarPassos(alvo, dados) {
  const el = document.getElementById(alvo);
  const passos = dados.passos || [];
  el.innerHTML = `
    <ul class="lista-passos">
      ${passos.map(p => `
        <li class="${p.ok ? "ok" : "falhou"}">
          <span class="marca" aria-hidden="true">${p.ok ? "✔" : "✘"}</span>
          <span><strong>${esc(p.passo)}:</strong> ${esc(p.detalhe)}</span>
        </li>`).join("")}
    </ul>
    ${dados.ok ? `<p class="tudo-certo">Tudo certo!</p>` : ""}`;
}

function mostrarErro(alvo, erro) {
  mostrarPassos(alvo, { ok: false, passos: [{ ok: false, passo: "Erro", detalhe: erro.message }] });
}

async function comBotao(botao, textoEsperando, acao) {
  const original = botao.textContent;
  botao.disabled = true;
  botao.textContent = textoEsperando;
  try { await acao(); } finally { botao.disabled = false; botao.textContent = original; }
}

// ---------- Situação ----------
const NOMES_METODO = {
  google: { classe: "ok", texto: "Enviando pelo Google ✔" },
  smtp: { classe: "atencao", texto: "Enviando pelo Gmail com senha de app" },
  teste: { classe: "desligado", texto: "Modo de teste: os emails NÃO são enviados" }
};

async function carregarSituacao() {
  const alvo = document.getElementById("situacao");
  try {
    const s = await chamar("GET", "/status");
    document.getElementById("aviso-sem-acesso").hidden = true;

    let metodo = NOMES_METODO[s.metodo];
    let detalhe = "";
    if (s.metodo === "google" && !s.google.funcionando) {
      metodo = { classe: "erro", texto: "Google conectado, mas com problema" };
      detalhe = `<p class="situacao-erro">${esc(s.google.erro)}</p>`;
    } else if (s.metodo === "google") {
      detalhe = `<p>Conta: <strong>${esc(s.google.conta)}</strong>${s.google.cotaRestante != null ? ` · ainda pode enviar <strong>${s.google.cotaRestante}</strong> emails hoje` : ""}</p>`;
    } else if (s.metodo === "smtp") {
      detalhe = `<p>Conta: <strong>${esc(s.smtp.usuario)}</strong>. Se não funcionar, use o Google abaixo: a rede da escola costuma bloquear esse jeito.</p>`;
    } else {
      detalhe = `<p>Os emails estão sendo salvos na pasta <code>emails-de-teste</code> da API, e não enviados. Siga os passos abaixo para ligar o envio.</p>`;
    }

    alvo.innerHTML = `
      <span class="pilula ${metodo.classe}">${esc(metodo.texto)}</span>
      ${detalhe}
      <p>Inscritos para receber alertas: <strong>${s.inscritos}</strong></p>
      <div class="linha-botoes">
        ${s.google.planilha ? `<a class="botao-secundario" href="${esc(s.google.planilha)}" target="_blank" rel="noopener">Abrir planilha de inscritos</a>` : ""}
        ${s.google.conectado ? `<button class="botao-link" id="sincronizar">Sincronizar com a planilha</button><button class="botao-link" id="desconectar">Desconectar o Google</button>` : ""}
      </div>
      <div id="resultado-situacao" class="resultado" aria-live="polite"></div>`;

    document.getElementById("sincronizar")?.addEventListener("click", (e) =>
      comBotao(e.target, "Sincronizando…", async () => {
        try { mostrarPassos("resultado-situacao", await chamar("POST", "/sincronizar")); await carregarSituacao(); }
        catch (erro) { mostrarErro("resultado-situacao", erro); }
      }));
    document.getElementById("desconectar")?.addEventListener("click", async () => {
      if (!confirm("Desconectar o Google? Os emails voltam para o modo de teste.")) return;
      await chamar("POST", "/google/desconectar");
      carregarSituacao();
    });
  } catch (erro) {
    document.getElementById("aviso-sem-acesso").hidden = false;
    alvo.innerHTML = `<p class="situacao-erro">${esc(erro.message)}</p>`;
  }
}

// ---------- Código do Google ----------
let codigoGoogle = "";
async function carregarCodigo() {
  try {
    codigoGoogle = (await chamar("GET", "/codigo-google")).codigo;
    document.getElementById("codigo-google").textContent = codigoGoogle;
    document.getElementById("copiar-codigo").disabled = false;
  } catch (erro) {
    document.getElementById("codigo-google").textContent = erro.message;
  }
}

document.getElementById("copiar-codigo").addEventListener("click", async () => {
  const aviso = document.getElementById("copiado");
  try {
    await navigator.clipboard.writeText(codigoGoogle);
    aviso.textContent = "Código copiado! Agora cole no Google (Ctrl + V).";
  } catch {
    // navegador sem permissão de copiar: abre o código pra copiar na mão
    document.querySelector(".ver-codigo").open = true;
    const pre = document.getElementById("codigo-google");
    const selecao = window.getSelection(); const faixa = document.createRange();
    faixa.selectNodeContents(pre); selecao.removeAllRanges(); selecao.addRange(faixa);
    aviso.textContent = "Selecionei o código: aperte Ctrl + C para copiar.";
  }
});

// ---------- Conectar ----------
document.getElementById("conectar-google").addEventListener("click", (e) =>
  comBotao(e.target, "Conectando…", async () => {
    const url = document.getElementById("url-google").value.trim();
    if (!url) return mostrarErro("resultado-google", new Error("Cole o link do App da Web primeiro."));
    try {
      const r = await chamar("POST", "/google", { url });
      mostrarPassos("resultado-google", r);
      if (r.ok) carregarSituacao();
    } catch (erro) { mostrarErro("resultado-google", erro); }
  }));

// ---------- Testes ----------
document.getElementById("enviar-teste").addEventListener("click", (e) =>
  comBotao(e.target, "Enviando…", async () => {
    try {
      mostrarPassos("resultado-teste", await chamar("POST", "/testar", { para: document.getElementById("email-teste").value.trim() }));
      carregarSituacao();
    } catch (erro) { mostrarErro("resultado-teste", erro); }
  }));

document.querySelectorAll("[data-alerta]").forEach(botao => botao.addEventListener("click", () =>
  comBotao(botao, "Enviando…", async () => {
    try { mostrarPassos("resultado-teste", await chamar("POST", `/alerta-teste?tipo=${botao.dataset.alerta}`)); }
    catch (erro) { mostrarErro("resultado-teste", erro); }
  })));

document.getElementById("salvar-senha").addEventListener("click", (e) =>
  comBotao(e.target, "Salvando…", async () => {
    try {
      await chamar("POST", "/senha-app", { senha: document.getElementById("senha-app").value });
      document.getElementById("senha-app").value = "";
      mostrarPassos("resultado-senha", { ok: true, passos: [{ ok: true, passo: "Senha de app", detalhe: "salva. Use “Enviar email de teste” para conferir." }] });
      carregarSituacao();
    } catch (erro) { mostrarErro("resultado-senha", erro); }
  }));

carregarSituacao();
carregarCodigo();
