// ===================================================================
// comum.js — o que TODAS as páginas usam
// -------------------------------------------------------------------
//   1. Ferramentas: buscar na API, formatar números e datas
//   2. Clima do topo (o "23° Chuva moderada" do cabeçalho)
//   3. Regiões: a barra vermelha de alerta e o sininho
//   4. Destaque (quando a pesquisa leva você até um lugar da página)
//   5. Início: o que roda quando a página abre
//
// Cada página tem também o seu próprio arquivo, com o mesmo nome:
// sensor.html → js/sensor.js, alagamentos.html → js/alagamentos.js...
// ===================================================================


// ===================================================================
// 1. Ferramentas
// ===================================================================

// A API fica no mesmo endereço do site, em /api
const API_BASE = "/api";

// Busca algo na API. Se a API estiver fora do ar, mostra o aviso amarelo no topo.
async function api(caminho) {
  const aviso = document.getElementById("aviso-api");
  let resposta;
  try {
    resposta = await fetch(API_BASE + caminho);
  } catch (erro) {
    if (aviso) aviso.hidden = false;
    throw erro;
  }
  if (aviso) aviso.hidden = true;
  if (!resposta.ok) throw new Error("A API respondeu " + resposta.status);
  return resposta.json();
}

// Tudo o que vem de fora (títulos de notícia, por exemplo) passa por aqui
// antes de ir pro HTML, pra ninguém conseguir colocar código no site.
function esc(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Só aceita links que começam com http ou https.
function linkSeguro(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "#";
  } catch {
    return "#";
  }
}

// Números e horas no jeito brasileiro (19,5 e 21:40)
const formatoNumero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const formatoHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const formatoHoraSeg = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const tempoRelativo = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

function num(n) {
  return formatoNumero.format(n ?? 0);
}

// "há 5 minutos", "ontem"...
function haQuantoTempo(dataIso) {
  if (!dataIso) return "";
  const segundos = (new Date(dataIso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(segundos);
  if (abs < 60) return "agora há pouco";
  if (abs < 3600) return tempoRelativo.format(Math.round(segundos / 60), "minute");
  if (abs < 86400) return tempoRelativo.format(Math.round(segundos / 3600), "hour");
  return tempoRelativo.format(Math.round(segundos / 86400), "day");
}

// Texto sem acento e em minúsculas: assim "ribeirao" acha "Ribeirão".
function semAcento(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Nome e cor de cada situação
const STATUS_LABEL = { perigo: "Perigo", atencao: "Atenção", tranquilo: "Tranquilo" };
const STATUS_COR = { perigo: "#C0392B", atencao: "#E0A526", tranquilo: "#2E8B57" };

// A região está recebendo leituras de verdade (sensor) ou da simulação?
function recebeLeituras(zona) {
  return zona.fonte === "sensor" || zona.fonte === "simulacao";
}


// ===================================================================
// 2. Clima do topo
// ===================================================================
// As páginas que precisam do clima (Início, Clima, Bolin) entram na lista
// "quandoChegarClima" e recebem o clima sempre que ele é atualizado.
let ultimoClima = null;
const quandoChegarClima = [];

let avisarPrimeiroClima;
const primeiroClima = new Promise(resolver => { avisarPrimeiroClima = resolver; });

async function carregarClima() {
  const chip = document.getElementById("weather-chip");
  try {
    const clima = await api("/clima");
    ultimoClima = clima;
    chip.innerHTML = `
      <span class="weather-temp">${Math.round(clima.temperatura)}°</span>
      <span class="weather-cond">${esc(clima.condicao)}${clima.desatualizado ? " · sem atualização" : ""}</span>`;
  } catch {
    ultimoClima = null;
    chip.innerHTML = `<span class="weather-cond">Clima indisponível</span>`;
  }
  quandoChegarClima.forEach(funcao => funcao(ultimoClima));
  avisarPrimeiroClima();
}


// ===================================================================
// 3. Regiões: barra vermelha de alerta e sininho
// ===================================================================
// As páginas que precisam das regiões entram na lista "quandoChegaremRegioes".
let ultimasZonas = [];
let zonasCarregadas = false;
const quandoChegaremRegioes = [];

async function carregarZonas() {
  try {
    const zonas = await api("/enchentes");
    ultimasZonas = zonas;
    zonasCarregadas = true;
    verificarAlertas(zonas);
    quandoChegaremRegioes.forEach(funcao => funcao(zonas));
  } catch {
    quandoChegaremRegioes.forEach(funcao => funcao(null));
  }
}

const jaNotificou = new Set(); // não avisa a mesma região duas vezes seguidas
let avisoAtual = "";

function avisoFechado() {
  try { return sessionStorage.getItem("bolinho-aviso-fechado"); } catch { return null; }
}

function verificarAlertas(zonas) {
  const barra = document.getElementById("alert-bar");
  const textoBarra = document.getElementById("alert-bar-text");
  const contador = document.getElementById("bell-count");
  const listaSininho = document.getElementById("notif-list");

  // A maquete só entra nos alertas quando o sensor dela estiver mandando dados.
  const consideradas = zonas.filter(z => !z.ehMaquete || recebeLeituras(z));
  const emPerigo = consideradas.filter(z => z.status === "perigo");
  const emRisco = consideradas.filter(z => z.status === "perigo" || z.status === "atencao");

  // Barra vermelha. Pode ser fechada no X; só volta se outra região entrar em perigo.
  avisoAtual = emPerigo.map(z => z.id).sort().join(",");
  if (emPerigo.length > 0 && avisoAtual !== avisoFechado()) {
    barra.hidden = false;
    textoBarra.textContent = emPerigo.length === 1
      ? `${emPerigo[0].nome} está em nível de perigo. Evite a área.`
      : `${emPerigo.length} regiões estão em nível de perigo. Confira a página Alagamentos.`;
  } else {
    barra.hidden = true;
  }

  // Sininho
  if (emRisco.length > 0) {
    contador.textContent = emRisco.length;
    contador.hidden = false;
    listaSininho.innerHTML = emRisco.map(z => `
      <div class="notif-item">
        <span class="notif-dot ${esc(z.status)}"></span>
        <div>
          <strong>${esc(z.nome)}</strong><br>
          <span>${STATUS_LABEL[z.status]}, nível ${num(z.cotaAtual)} m</span>
        </div>
      </div>`).join("");
  } else {
    contador.hidden = true;
    listaSininho.innerHTML = `<p class="notif-empty">Nenhuma região em alerta agora.</p>`;
  }

  // Notificação do navegador, se a pessoa permitiu
  emPerigo.forEach(z => {
    if (!jaNotificou.has(z.id) && "Notification" in window && Notification.permission === "granted") {
      new Notification("Bolinho de Chuva — alerta de alagamento", {
        body: `${z.nome} está em nível de perigo agora.`,
        icon: "img/favicon.png"
      });
    }
    jaNotificou.add(z.id);
  });
  // Se a região saiu do perigo, pode avisar de novo numa próxima vez.
  [...jaNotificou].forEach(id => { if (!emPerigo.some(z => z.id === id)) jaNotificou.delete(id); });
}

function textoPermissao() {
  if (!("Notification" in window)) return "Este navegador não mostra notificações fora da página.";
  if (Notification.permission === "granted") return "Notificações ativadas: você será avisado quando uma região entrar em perigo.";
  if (Notification.permission === "denied") return "As notificações estão bloqueadas. Para ativar, libere nas configurações do navegador.";
  return "Permita as notificações para ser avisado mesmo com a página em segundo plano.";
}

function ligarBarraESininho() {
  const barra = document.getElementById("alert-bar");
  const sino = document.getElementById("bell-btn");
  const painel = document.getElementById("notif-panel");
  const permissao = document.getElementById("notif-permissao");

  // X da barra vermelha
  document.getElementById("alert-bar-fechar").addEventListener("click", () => {
    try { sessionStorage.setItem("bolinho-aviso-fechado", avisoAtual); } catch { /* tudo bem */ }
    barra.hidden = true;
  });

  // Sininho: abre e fecha o painel. Só pede permissão depois que a pessoa clica.
  sino.addEventListener("click", async () => {
    painel.hidden = !painel.hidden;
    sino.setAttribute("aria-expanded", String(!painel.hidden));
    permissao.textContent = textoPermissao();
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
      permissao.textContent = textoPermissao();
    }
  });
  document.getElementById("notif-close").addEventListener("click", () => {
    painel.hidden = true;
    sino.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("click", (e) => {
    if (!painel.hidden && !painel.contains(e.target) && !sino.contains(e.target)) {
      painel.hidden = true;
      sino.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !painel.hidden) { painel.hidden = true; sino.focus(); }
  });
}


// ===================================================================
// 4. Destaque: leva até um lugar da página e pinta a borda por uns segundos
// ===================================================================
// Usado pela pesquisa. Ex.: ajuda.html#contato-defesa-civil destaca a Defesa Civil.
function destacar(elemento) {
  if (!elemento) return;
  setTimeout(() => {
    elemento.scrollIntoView({ behavior: "smooth", block: "center" });
    elemento.classList.remove("destaque-busca");
    void elemento.offsetWidth;
    elemento.classList.add("destaque-busca");
    setTimeout(() => elemento.classList.remove("destaque-busca"), 2600);
  }, 150);
}

function destacarPeloEndereco() {
  if (location.hash.length > 1) destacar(document.getElementById(location.hash.slice(1)));
}


// ===================================================================
// 5. Início: roda quando a página termina de carregar
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
  ligarBarraESininho();

  carregarClima();
  carregarZonas();
  setInterval(carregarZonas, 15000);   // regiões: a cada 15 segundos
  setInterval(carregarClima, 300000);  // clima: a cada 5 minutos

  destacarPeloEndereco();
  window.addEventListener("hashchange", destacarPeloEndereco);

  // Link "Configurar emails" no rodapé: só aparece no computador que roda o sistema.
  fetch(API_BASE + "/config")
    .then(r => { if (r.ok) document.getElementById("link-config").hidden = false; })
    .catch(() => {});
});
