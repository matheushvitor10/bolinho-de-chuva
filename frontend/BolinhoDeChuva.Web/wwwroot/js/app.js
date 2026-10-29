// ===================================================================
// Bolinho de Chuva — front-end
// -------------------------------------------------------------------
// Este arquivo cuida de: trocar de aba, buscar os dados na API
// (back-end), desenhar o mapa, mostrar o sensor da maquete e avisar
// quando alguma região entra em perigo.
//
// O endereço da API vem de js/config.js.
// ===================================================================

const API_BASE = (window.BOLINHO_CONFIG && window.BOLINHO_CONFIG.API_URL) || "http://localhost:5080/api";

// ---------- Utilidades ----------

// Tudo o que vem de fora (títulos de notícia, por exemplo) passa por aqui
// antes de ir pro HTML, pra ninguém conseguir injetar código no site.
function esc(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function linkSeguro(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "#";
  } catch {
    return "#";
  }
}

const formatoNumero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const num = (n) => formatoNumero.format(n ?? 0);

const formatoHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const formatoHoraSeg = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const tempoRelativo = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

function haQuantoTempo(dataIso) {
  if (!dataIso) return "";
  const segundos = (new Date(dataIso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(segundos);
  if (abs < 60) return "agora há pouco";
  if (abs < 3600) return tempoRelativo.format(Math.round(segundos / 60), "minute");
  if (abs < 86400) return tempoRelativo.format(Math.round(segundos / 3600), "hour");
  return tempoRelativo.format(Math.round(segundos / 86400), "day");
}

// Busca algo na API. Se a API estiver fora do ar, mostra o aviso amarelo no topo.
const avisoApi = document.getElementById("aviso-api");
document.getElementById("aviso-api-url").textContent = API_BASE;

async function api(caminho) {
  let resposta;
  try {
    resposta = await fetch(`${API_BASE}${caminho}`);
  } catch (erro) {
    avisoApi.hidden = false;
    throw erro;
  }
  avisoApi.hidden = true;
  if (!resposta.ok) throw new Error(`A API respondeu ${resposta.status}`);
  return resposta.json();
}

// ---------- Abas ----------
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const ABAS = [...tabButtons].map(b => b.dataset.tab);

function abrirAba(nome, { atualizarEndereco = true } = {}) {
  if (!ABAS.includes(nome)) nome = "inicio";

  tabButtons.forEach(b => {
    const ativa = b.dataset.tab === nome;
    b.classList.toggle("active", ativa);
    if (ativa) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  tabPanels.forEach(p => p.classList.toggle("active", p.id === `tab-${nome}`));

  // Deixa o endereço com #nome-da-aba, pra dar pra mandar o link direto (ex.: .../#sensor)
  if (atualizarEndereco) history.replaceState(null, "", nome === "inicio" ? location.pathname : `#${nome}`);

  // O Leaflet só calcula o tamanho do mapa direito quando ele está visível.
  if (nome === "alagamentos") {
    desenharMapa(ultimasZonas);
    setTimeout(() => mapaInstancia && mapaInstancia.invalidateSize(), 0);
  }

  if (nome === "sensor") carregarSensor();
  reiniciarAtualizacaoDoSensor();
}

tabButtons.forEach(btn => btn.addEventListener("click", () => abrirAba(btn.dataset.tab)));
document.querySelectorAll("[data-ir-para]").forEach(el =>
  el.addEventListener("click", (e) => { e.preventDefault(); abrirAba(el.dataset.irPara); window.scrollTo(0, 0); })
);
window.addEventListener("hashchange", () => abrirAba(location.hash.slice(1), { atualizarEndereco: false }));

// ---------- Notícias (só chuva e alagamento), por cidade ----------
let todasAsNoticias = [];
let fontesComErro = [];

// A cidade escolhida fica guardada no navegador: na próxima visita já abre nela.
const CHAVE_CIDADE = "bolinho-cidade";
const NOMES_FILTRO = { "ribeirao-preto": "Ribeirão Preto", "franca": "Franca", "nacional": "todo o Brasil" };
let filtroAtual = (() => {
  try { const c = localStorage.getItem(CHAVE_CIDADE); return c in NOMES_FILTRO ? c : null; } catch { return null; }
})();

function noticiasDoFiltro(filtro) {
  if (filtro === "nacional") return todasAsNoticias.filter(n => n.abrangencia === "nacional");
  return todasAsNoticias.filter(n => (n.cidades || []).includes(filtro));
}

async function carregarNoticias() {
  const grid = document.getElementById("news-grid");
  try {
    const dados = await api("/noticias?abrangencia=todas");
    todasAsNoticias = dados.noticias || [];
    fontesComErro = dados.fontesComErro || [];

    for (const filtro of Object.keys(NOMES_FILTRO)) {
      document.getElementById(`n-${filtro}`).textContent = `(${noticiasDoFiltro(filtro).length})`;
    }

    if (!filtroAtual) filtroAtual = "ribeirao-preto";
    mostrarNoticias();
  } catch {
    grid.innerHTML = vazio("Não foi possível carregar as notícias agora. Tente recarregar a página daqui a pouco.");
  }
}

function mostrarNoticias() {
  const grid = document.getElementById("news-grid");
  document.querySelectorAll(".filtro-btn").forEach(b => {
    const ativo = b.dataset.abrangencia === filtroAtual;
    b.classList.toggle("active", ativo);
    b.setAttribute("aria-pressed", String(ativo));
  });

  const lista = noticiasDoFiltro(filtroAtual);

  if (!lista.length) {
    const todasFalharam = fontesComErro.length >= 6;
    grid.innerHTML = vazio(todasFalharam
      ? "Não consegui acessar as fontes de notícia agora. Pode ser a internet ou alguma fonte fora do ar — tento de novo em alguns minutos."
      : filtroAtual === "nacional"
        ? "Nenhuma notícia de chuva ou alagamento no Brasil nos últimos dias."
        : `Nenhuma notícia de chuva ou alagamento em ${NOMES_FILTRO[filtroAtual]} nos últimos dias. Melhor assim!`);
    return;
  }

  grid.innerHTML = lista.map(n => `
    <a class="news-card" href="${esc(linkSeguro(n.link))}" target="_blank" rel="noopener noreferrer">
      <h3>${esc(n.titulo)}</h3>
      ${n.resumo ? `<p>${esc(n.resumo)}</p>` : ""}
      <span class="news-meta">
        <span class="news-fonte">${esc(n.fonte)}</span>
        <span>${esc(haQuantoTempo(n.publicadoEm))}</span>
      </span>
    </a>
  `).join("");
}

function vazio(mensagem) {
  return `<div class="vazio"><img src="img/bolin-avatar.png" alt=""><p>${esc(mensagem)}</p></div>`;
}

document.querySelectorAll(".filtro-btn").forEach(btn =>
  btn.addEventListener("click", () => {
    filtroAtual = btn.dataset.abrangencia;
    try { localStorage.setItem(CHAVE_CIDADE, filtroAtual); } catch { /* navegador sem armazenamento: tudo bem */ }
    mostrarNoticias();
  })
);

// ---------- Clima ----------
let ultimoClima = null;
let avisarPrimeiroClima;
const primeiroClima = new Promise(resolver => { avisarPrimeiroClima = resolver; });

async function carregarClima() {
  const chip = document.getElementById("weather-chip");
  const detalhe = document.getElementById("weather-detail");
  const dias = document.getElementById("weather-dias");

  try {
    const clima = await api("/clima");
    ultimoClima = clima;
    const hoje = clima.previsaoHoje;

    chip.innerHTML = `
      <span class="weather-temp">${Math.round(clima.temperatura)}°</span>
      <span class="weather-cond">${esc(clima.condicao)}</span>
    `;

    detalhe.innerHTML = `
      <div class="weather-card destaque">
        <div class="value">${num(hoje.chuvaMm)} mm</div>
        <div class="label">Chuva prevista para hoje</div>
      </div>
      <div class="weather-card">
        <div class="value">${hoje.probabilidadeChuva ?? "—"}%</div>
        <div class="label">Chance de chuva hoje</div>
      </div>
      <div class="weather-card">
        <div class="value">${esc(clima.condicao)}</div>
        <div class="label">Agora${clima.precipitacaoMm > 0 ? `, ${num(clima.precipitacaoMm)} mm na última hora` : ""}</div>
      </div>
      <div class="weather-card">
        <div class="value">${num(clima.temperatura)}°C</div>
        <div class="label">Temperatura agora</div>
      </div>
      <div class="weather-card">
        <div class="value">${num(hoje.minima)}° / ${num(hoje.maxima)}°</div>
        <div class="label">Mínima e máxima hoje</div>
      </div>
      <div class="weather-card">
        <div class="value">${clima.umidade}%</div>
        <div class="label">Umidade do ar</div>
      </div>
      <div class="weather-card">
        <div class="value">${num(clima.ventoKmh)} km/h</div>
        <div class="label">Vento</div>
      </div>
    `;

    const formatoDia = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "short" });
    dias.innerHTML = (clima.proximosDias || []).map(d => {
      const [a, m, dd] = d.data.split("-").map(Number);
      const prob = d.probabilidadeChuva ?? 0;
      return `
        <div class="dia-card">
          <h3>${esc(formatoDia.format(new Date(a, m - 1, dd)))}</h3>
          <p>${esc(d.condicao)}, ${num(d.minima)}° a ${num(d.maxima)}°</p>
          <p>${num(d.chuvaMm)} mm de chuva previstos</p>
          <div class="dia-chuva" title="Chance de chuva">
            <div class="dia-barra"><i style="width:${Math.min(100, Math.max(0, prob))}%"></i></div>
            <span>${prob}%</span>
          </div>
        </div>`;
    }).join("");

    atualizarHero();
    avisarPrimeiroClima();
  } catch {
    avisarPrimeiroClima();
    chip.innerHTML = `<span class="weather-cond">Clima indisponível</span>`;
    detalhe.innerHTML = `<p class="loading">Não foi possível carregar o clima agora. Tento de novo em 5 minutos.</p>`;
    dias.innerHTML = "";
    atualizarHero();
  }
}

// ---------- Zonas e mapa ----------
let mapaInstancia = null;
let circulosAtuais = [];
let ultimasZonas = [];
let zonasCarregadas = false;

// A zona está recebendo leituras de verdade (sensor) ou da simulação?
const recebeLeituras = (z) => z.fonte === "sensor" || z.fonte === "simulacao";

const STATUS_LABEL = { perigo: "Perigo", atencao: "Atenção", tranquilo: "Tranquilo" };
const STATUS_COR = { perigo: "#C0392B", atencao: "#E0A526", tranquilo: "#2E8B57" };

async function carregarZonas() {
  const lista = document.getElementById("zones-list");

  try {
    const zonas = await api("/enchentes");
    ultimasZonas = zonas;
    zonasCarregadas = true;

    // A maquete não é um lugar da cidade: ela aparece na aba "Sensor".
    const daCidade = zonas.filter(z => !z.ehMaquete);
    const ordem = { perigo: 0, atencao: 1, tranquilo: 2 };
    daCidade.sort((a, b) => ordem[a.status] - ordem[b.status]);

    lista.innerHTML = daCidade.map(z => `
      <div class="zone-card ${esc(z.status)}">
        <div>
          <h3>${esc(z.nome)}</h3>
          <p>${esc(z.observacao)}</p>
        </div>
        <div class="zone-lado">
          <span class="status-pill ${esc(z.status)}">${STATUS_LABEL[z.status]}, ${num(z.cotaAtual)} m</span>
          <span class="zone-fonte ${recebeLeituras(z) ? "sensor" : ""}">
            ${z.fonte === "sensor" ? "sensor" : z.fonte === "simulacao" ? "simulação" : "dado de demonstração"}, às ${formatoHora.format(new Date(z.atualizadoEm))}
          </span>
        </div>
      </div>
    `).join("");

    if (document.getElementById("tab-alagamentos").classList.contains("active")) {
      desenharMapa(zonas);
    }

    verificarAlertas(zonas);
    atualizarHero();
  } catch {
    lista.innerHTML = `<p class="loading">Não foi possível carregar as regiões agora.</p>`;
  }
}

function desenharMapa(zonas) {
  const daCidade = (zonas || []).filter(z => !z.ehMaquete);
  if (!daCidade.length || typeof L === "undefined") return;

  if (!mapaInstancia) {
    mapaInstancia = L.map("flood-map", { scrollWheelZoom: false }).setView([-21.1775, -47.8103], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapaInstancia);
  }

  // Tira os círculos antigos antes de desenhar os novos, senão eles se acumulam.
  circulosAtuais.forEach(c => mapaInstancia.removeLayer(c));
  circulosAtuais = [];

  daCidade.forEach(z => {
    const cor = STATUS_COR[z.status];
    const circulo = L.circle([z.lat, z.lng], {
      radius: z.raio,
      color: cor,
      fillColor: cor,
      fillOpacity: 0.35,
      weight: 2
    }).addTo(mapaInstancia);

    circulo.bindPopup(`
      <strong>${esc(z.nome)}</strong><br>
      ${STATUS_LABEL[z.status]}, nível ${num(z.cotaAtual)} m<br>
      ${esc(z.observacao)}
    `);

    circulosAtuais.push(circulo);
  });
}

// ---------- Sensor da maquete ----------
let intervaloSensor = null;

async function carregarSensor() {
  try {
    const s = await api("/sensor/status?zonaId=maquete-demo");
    mostrarSensor(s);
  } catch {
    document.getElementById("sensor-estado").dataset.estado = "sem-sinal";
    document.getElementById("sensor-estado-titulo").textContent = "Sem conexão com a API";
    document.getElementById("sensor-estado-texto").textContent = "Não consegui perguntar à API como está o sensor.";
  }
}

function mostrarSensor(s) {
  const zona = s.zona;
  const estado = document.getElementById("sensor-estado");
  const titulo = document.getElementById("sensor-estado-titulo");
  const texto = document.getElementById("sensor-estado-texto");

  if (!s.jaRecebeuLeitura) {
    estado.dataset.estado = "aguardando";
    titulo.textContent = "Aguardando o sensor";
    texto.textContent = "O sensor ainda não mandou nenhuma leitura. Assim que ele for ligado, esta página começa a se mexer sozinha.";
  } else if (s.ultimaLeitura && s.ultimaLeitura.origem === "simulacao") {
    estado.dataset.estado = "simulacao";
    titulo.textContent = "Modo simulação";
    texto.textContent = "O nível está vindo dos botões de simulação logo abaixo, não do sensor.";
  } else if (s.conectado) {
    estado.dataset.estado = "conectado";
    titulo.textContent = "Sensor conectado";
    texto.textContent = "Recebendo leituras ao vivo da maquete.";
  } else {
    estado.dataset.estado = "sem-sinal";
    titulo.textContent = "Sensor sem sinal";
    texto.textContent = `A última leitura chegou ${haQuantoTempo(s.ultimaLeituraEm)}. Confira se o ESP32 está ligado e conectado ao Wi-Fi.`;
  }

  // Tanque: a escala vai até um pouco acima do limite de perigo.
  const maximo = zona.cotaAlerta * 1.25;
  const pct = (v) => Math.max(0, Math.min(100, (v / maximo) * 100));
  const tanque = document.getElementById("tanque");
  tanque.dataset.status = s.jaRecebeuLeitura ? zona.status : "tranquilo";
  document.getElementById("tanque-agua").style.height = `${pct(s.jaRecebeuLeitura ? zona.cotaAtual : 0)}%`;
  document.getElementById("linha-atencao").style.bottom = `${pct(zona.cotaAtencao)}%`;
  document.getElementById("linha-perigo").style.bottom = `${pct(zona.cotaAlerta)}%`;
  document.getElementById("linha-atencao").querySelector("span").textContent = `Atenção, ${num(zona.cotaAtencao * 100)} cm`;
  document.getElementById("linha-perigo").querySelector("span").textContent = `Perigo, ${num(zona.cotaAlerta * 100)} cm`;
  tanque.setAttribute("aria-label", s.jaRecebeuLeitura
    ? `Nível da água na maquete: ${num(zona.cotaAtual * 100)} centímetros, ${STATUS_LABEL[zona.status]}`
    : "Nível da água na maquete: aguardando o sensor");

  document.getElementById("sensor-nivel").textContent = s.jaRecebeuLeitura ? `${num(zona.cotaAtual * 100)} cm` : "— cm";
  document.getElementById("sensor-status").innerHTML = s.jaRecebeuLeitura
    ? `<span class="status-pill ${esc(zona.status)}">${STATUS_LABEL[zona.status]}</span>`
    : "—";
  document.getElementById("sensor-distancia").textContent = s.ultimaLeitura ? `${num(s.ultimaLeitura.distanciaCm)} cm` : "—";
  document.getElementById("sensor-ultima").textContent = s.ultimaLeituraEm ? formatoHoraSeg.format(new Date(s.ultimaLeituraEm)) : "—";
  document.getElementById("sensor-total").textContent = s.totalLeituras;

  desenharGrafico(s.historico || [], zona);
  sincronizarSimulacao(zona);
}

// Gráfico simples em SVG, sem biblioteca: nível (cm) ao longo das leituras.
function desenharGrafico(historico, zona) {
  const alvo = document.getElementById("sensor-grafico");
  if (historico.length < 2) {
    alvo.innerHTML = `<p class="loading">${historico.length
      ? "Primeira leitura recebida. O gráfico aparece a partir da segunda."
      : "O gráfico aparece quando chegarem as primeiras leituras."}</p>`;
    return;
  }

  const L_ = 640, A = 180, mEsq = 44, mDir = 12, mTopo = 10, mBase = 26;
  const larg = L_ - mEsq - mDir, alt = A - mTopo - mBase;
  const maxCm = zona.cotaAlerta * 125;
  const x = (i) => mEsq + (i / (historico.length - 1)) * larg;
  const y = (cm) => mTopo + alt - (Math.min(cm, maxCm) / maxCm) * alt;

  const pontos = historico.map((l, i) => `${x(i).toFixed(1)},${y(l.nivelM * 100).toFixed(1)}`).join(" ");
  const ultima = historico[historico.length - 1];
  const linhaRef = (cm, cor) =>
    `<line x1="${mEsq}" x2="${L_ - mDir}" y1="${y(cm)}" y2="${y(cm)}" stroke="${cor}" stroke-dasharray="5 5" stroke-width="1.5"/>
     <text x="${mEsq - 6}" y="${y(cm) + 4}" text-anchor="end" font-size="11" fill="${cor}">${num(cm)}</text>`;

  alvo.innerHTML = `
    <svg viewBox="0 0 ${L_} ${A}" role="img" aria-label="Gráfico do nível da água nas últimas ${historico.length} leituras">
      <line x1="${mEsq}" x2="${L_ - mDir}" y1="${y(0)}" y2="${y(0)}" stroke="#DCE6EE"/>
      <text x="${mEsq - 6}" y="${y(0) + 4}" text-anchor="end" font-size="11" fill="#56697A">0 cm</text>
      ${linhaRef(zona.cotaAtencao * 100, "#B97C0C")}
      ${linhaRef(zona.cotaAlerta * 100, "#C0392B")}
      <polyline points="${pontos}" fill="none" stroke="#1D5A8E" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(historico.length - 1)}" cy="${y(ultima.nivelM * 100)}" r="5" fill="${STATUS_COR[ultima.status]}" stroke="#fff" stroke-width="2"/>
      <text x="${mEsq}" y="${A - 6}" font-size="11" fill="#56697A">${formatoHoraSeg.format(new Date(historico[0].recebidaEm))}</text>
      <text x="${L_ - mDir}" y="${A - 6}" font-size="11" fill="#56697A" text-anchor="end">${formatoHoraSeg.format(new Date(ultima.recebidaEm))}</text>
    </svg>`;
}

// Com a aba "Sensor" aberta, atualiza a cada 3 segundos; fora dela, a cada 30.
function reiniciarAtualizacaoDoSensor() {
  clearInterval(intervaloSensor);
  const abaSensorAberta = document.getElementById("tab-sensor").classList.contains("active");
  intervaloSensor = setInterval(async () => {
    await carregarSensor();
    if (abaSensorAberta) carregarZonas(); // mantém o sininho e a barra de alerta em dia durante a demonstração
  }, abaSensorAberta ? 3000 : 30000);
}

// ---------- Simulação da água na maquete (aba Sensor) ----------
const simPainel = document.getElementById("simulacao");
const simSlider = document.getElementById("sim-slider");
const simValor = document.getElementById("sim-valor");
const simErro = document.getElementById("sim-erro");
const simParar = document.getElementById("sim-parar");
const simChuvaBtns = document.querySelectorAll(".sim-chuva-btn");
let simIntervalo = null;
let simArrastando = false;

async function simular(corpo) {
  try {
    const resposta = await fetch(`${API_BASE}/simulacao/maquete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo)
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || `A API respondeu ${resposta.status}`);
    simErro.textContent = "";
    avisoApi.hidden = true;
    mostrarSensor(dados);
    carregarZonas(); // atualiza barra de alerta, sininho e o resumo do Bolin na hora
  } catch (erro) {
    simErro.textContent = `Não consegui simular: ${erro.message}`;
    pararChuva();
  }
}

function sincronizarSimulacao(zona) {
  if (simArrastando) return;
  const cm = Math.round(zona.cotaAtual * 1000) / 10;
  simSlider.value = cm;
  simValor.textContent = `${num(cm)} cm`;
}

function pararChuva() {
  clearInterval(simIntervalo);
  simIntervalo = null;
  simChuvaBtns.forEach(b => b.setAttribute("aria-pressed", "false"));
  simParar.disabled = true;
}

document.querySelectorAll(".sim-btn").forEach(b =>
  b.addEventListener("click", () => simular({ variacaoCm: Number(b.dataset.variacao) })));

document.querySelectorAll(".sim-atalho").forEach(b =>
  b.addEventListener("click", () => { pararChuva(); simular({ nivelCm: Number(b.dataset.nivel) }); }));

simSlider.addEventListener("input", () => { simArrastando = true; simValor.textContent = `${num(Number(simSlider.value))} cm`; });
simSlider.addEventListener("change", () => { simArrastando = false; pararChuva(); simular({ nivelCm: Number(simSlider.value) }); });

simChuvaBtns.forEach(b => b.addEventListener("click", () => {
  const taxa = Number(b.dataset.taxa);
  pararChuva();
  b.setAttribute("aria-pressed", "true");
  simParar.disabled = false;
  simular({ variacaoCm: taxa });
  simIntervalo = setInterval(() => {
    const atual = Number(simSlider.value);
    // para sozinho quando a maquete enche ou seca
    if ((taxa > 0 && atual >= Number(simSlider.max)) || (taxa < 0 && atual <= 0)) return pararChuva();
    simular({ variacaoCm: taxa });
  }, 2000);
}));
simParar.addEventListener("click", pararChuva);

async function verificarSimulacao() {
  try {
    const s = await api("/simulacao");
    simPainel.hidden = !s.habilitada;
    simSlider.max = s.nivelMaximoCm;
  } catch { /* sem API: o painel continua escondido */ }
}

// ---------- O Bolin resume a situação (página inicial) ----------
function atualizarHero() {
  const balao = document.getElementById("balao-bolin");
  const hero = document.querySelector(".hero");
  const zonas = ultimasZonas.filter(z => !z.ehMaquete || recebeLeituras(z));
  const perigo = zonas.filter(z => z.status === "perigo");
  const atencao = zonas.filter(z => z.status === "atencao");
  const c = ultimoClima;

  hero.dataset.chovendo = c && c.estaChovendo ? "sim" : "nao";

  document.getElementById("hr-chuva").textContent = c ? `${num(c.previsaoHoje.chuvaMm)} mm` : "—";
  document.getElementById("hr-chance").textContent = c && c.previsaoHoje.probabilidadeChuva != null ? `${c.previsaoHoje.probabilidadeChuva}%` : "—";
  document.getElementById("hr-zonas").textContent = zonasCarregadas ? perigo.length + atencao.length : "—";

  if (!c && !zonasCarregadas) return;

  let frase;
  if (perigo.length === 1) {
    frase = `<strong>Cuidado!</strong> ${esc(perigo[0].nome)} está em nível de perigo. Fique longe da área e, se precisar, ligue 199 (Defesa Civil).`;
  } else if (perigo.length > 1) {
    frase = `<strong>Cuidado!</strong> ${perigo.length} regiões estão em nível de perigo. Veja quais na aba Alagamentos e evite essas áreas.`;
  } else if (atencao.length) {
    frase = `${atencao.length === 1 ? "Uma região está" : `${atencao.length} regiões estão`} em atenção: ${esc(atencao.map(z => z.nome.split(" —")[0].split(" /")[0]).join(", "))}. Se puder, evite passar por lá.`;
  } else if (c && c.estaChovendo) {
    frase = `Está chovendo agora (${esc(c.condicao.toLowerCase())}, ${Math.round(c.temperatura)}°). As regiões monitoradas estão tranquilas, mas fique de olho.`;
  } else if (c && (c.previsaoHoje.probabilidadeChuva ?? 0) >= 60) {
    frase = `Hoje tem ${c.previsaoHoje.probabilidadeChuva}% de chance de chuva. Bom dia pra deixar o guarda-chuva por perto — e o bolinho também.`;
  } else if (c) {
    frase = `Tempo firme por aqui: ${esc(c.condicao.toLowerCase())}, ${Math.round(c.temperatura)}°. Nenhuma região monitorada em alerta.`;
  } else {
    frase = "Nenhuma região monitorada em alerta agora. O clima ainda está carregando.";
  }
  balao.innerHTML = frase;
}

// ---------- Contatos ----------
async function carregarContatos() {
  const grid = document.getElementById("contacts-grid");
  try {
    const contatos = await api("/contatos");
    grid.innerHTML = contatos.map(c => {
      const ehSms = c.id === "alerta-sms";
      const href = ehSms ? `sms:${c.numero}` : `tel:${c.numero.replace(/\D/g, "")}`;
      return `
        <div class="contact-card prioridade-${c.prioridade}">
          <a class="numero" href="${href}" aria-label="${ehSms ? "Mandar SMS para" : "Ligar para"} ${esc(c.nome)}, ${esc(c.numero)}">${esc(c.numero)}</a>
          <div class="nome">${esc(c.nome)}</div>
          <p class="descricao">${esc(c.descricao)}</p>
        </div>`;
    }).join("");
  } catch {
    grid.innerHTML = `<p class="loading">Não foi possível carregar os contatos agora. Em emergência: Defesa Civil 199, Bombeiros 193, SAMU 192.</p>`;
  }
}

// ---------- Sub-abas de "Cuidados" ----------
const carePillButtons = document.querySelectorAll(".care-pill-btn");
const carePanels = document.querySelectorAll(".care-panel");

carePillButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    carePillButtons.forEach(b => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
    carePanels.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    document.getElementById(`care-${btn.dataset.care}`).classList.add("active");
  });
});

// ---------- Dicas do Bolin ----------
const DICAS_DO_BOLIN = [
  "Nunca atravesse uma rua alagada, nem a pé nem de carro. A água engana: parece rasa e esconde buracos e correnteza.",
  "Mande seu CEP por SMS para 40199 e receba os alertas da Defesa Civil no celular. É de graça.",
  "Lixo na rua entope bueiro, e bueiro entupido vira alagamento. Lixo é no lixo!",
  "Guarde documentos dentro de um saco plástico bem fechado, num lugar alto da casa.",
  "Se a água começar a entrar em casa, desligue a chave geral de energia.",
  "Choveu forte? Evite passar perto de córregos e fundos de vale até a água baixar.",
  "Teve febre depois de pisar em água de enchente? Procure um posto de saúde e conte isso pro médico. Pode ser leptospirose.",
  "Seu cachorro e seu gato também precisam de um plano de saída. Pense neles antes da chuva chegar.",
  "Salve o 199 da Defesa Civil nos contatos do celular. Em emergência, cada segundo conta.",
  "Toque no sininho aqui do site e permita as notificações: eu aviso quando alguma região entrar em perigo."
];
let indiceDica = Math.floor(Math.random() * DICAS_DO_BOLIN.length);
const dicaTexto = document.getElementById("dica-texto");

function mostrarDica() {
  dicaTexto.textContent = DICAS_DO_BOLIN[indiceDica];
}
document.getElementById("dica-proxima").addEventListener("click", () => {
  indiceDica = (indiceDica + 1) % DICAS_DO_BOLIN.length;
  mostrarDica();
});

// ---------- Notificações ----------
const alertBar = document.getElementById("alert-bar");
const alertBarText = document.getElementById("alert-bar-text");
const bellBtn = document.getElementById("bell-btn");
const bellCount = document.getElementById("bell-count");
const notifPanel = document.getElementById("notif-panel");
const notifList = document.getElementById("notif-list");
const notifClose = document.getElementById("notif-close");
const notifPermissao = document.getElementById("notif-permissao");

const jaNotificou = new Set(); // não avisa a mesma região duas vezes seguidas

// Aviso do topo fechado pelo X (fica lembrado enquanto a aba do navegador estiver aberta)
let avisoAtual = "";
const avisoFechado = () => { try { return sessionStorage.getItem("bolinho-aviso-fechado"); } catch { return null; } };
document.getElementById("alert-bar-fechar").addEventListener("click", () => {
  try { sessionStorage.setItem("bolinho-aviso-fechado", avisoAtual); } catch { /* tudo bem */ }
  alertBar.hidden = true;
});

function verificarAlertas(zonas) {
  // A maquete só entra nos alertas quando o sensor dela estiver mandando dados.
  const consideradas = zonas.filter(z => !z.ehMaquete || recebeLeituras(z));
  const emPerigo = consideradas.filter(z => z.status === "perigo");
  const emRisco = consideradas.filter(z => z.status === "perigo" || z.status === "atencao");

  // O aviso pode ser fechado no X. Ele só volta se a lista de regiões em
  // perigo mudar (ex.: outra região entrou em perigo).
  avisoAtual = emPerigo.map(z => z.id).sort().join(",");
  if (emPerigo.length > 0 && avisoAtual !== avisoFechado()) {
    alertBar.hidden = false;
    alertBarText.textContent = emPerigo.length === 1
      ? `${emPerigo[0].nome} está em nível de perigo. Evite a área.`
      : `${emPerigo.length} regiões estão em nível de perigo. Confira a aba Alagamentos.`;
  } else {
    alertBar.hidden = true;
  }

  if (emRisco.length > 0) {
    bellCount.textContent = emRisco.length;
    bellCount.hidden = false;
    notifList.innerHTML = emRisco.map(z => `
      <div class="notif-item">
        <span class="notif-dot ${esc(z.status)}"></span>
        <div>
          <strong>${esc(z.nome)}</strong><br>
          <span>${STATUS_LABEL[z.status]}, nível ${num(z.cotaAtual)} m</span>
        </div>
      </div>
    `).join("");
  } else {
    bellCount.hidden = true;
    notifList.innerHTML = `<p class="notif-empty">Nenhuma região em alerta agora.</p>`;
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

bellBtn.addEventListener("click", async () => {
  notifPanel.hidden = !notifPanel.hidden;
  bellBtn.setAttribute("aria-expanded", String(!notifPanel.hidden));
  notifPermissao.textContent = textoPermissao();

  // Só pede permissão depois que a pessoa clica no sininho (nunca sozinho).
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
    notifPermissao.textContent = textoPermissao();
  }
});
notifClose.addEventListener("click", () => { notifPanel.hidden = true; bellBtn.setAttribute("aria-expanded", "false"); });
document.addEventListener("click", (e) => {
  if (!notifPanel.hidden && !notifPanel.contains(e.target) && !bellBtn.contains(e.target)) {
    notifPanel.hidden = true;
    bellBtn.setAttribute("aria-expanded", "false");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !notifPanel.hidden) { notifPanel.hidden = true; bellBtn.focus(); }
});

// ---------- Cadastro de email para alertas ----------
const formEmail = document.getElementById("form-email");
const campoEmail = document.getElementById("campo-email");
const botaoEmail = document.getElementById("botao-email");
const retornoEmail = document.getElementById("email-retorno");

function mostrarRetornoEmail(tipo, mensagem, sugestao) {
  retornoEmail.className = `email-retorno ${tipo}`;
  retornoEmail.textContent = mensagem;
  campoEmail.setAttribute("aria-invalid", tipo === "erro" ? "true" : "false");

  if (sugestao) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "sugestao";
    botao.textContent = `Usar ${sugestao}`;
    botao.addEventListener("click", () => { campoEmail.value = sugestao; formEmail.requestSubmit(); });
    retornoEmail.append(botao);
  }
}

formEmail.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = campoEmail.value.trim();

  // Primeira conferência aqui mesmo no navegador; a de verdade é feita pela API.
  if (!email) return mostrarRetornoEmail("erro", "Digite o seu email.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return mostrarRetornoEmail("erro", "Esse email não parece válido. Confira se ele tem @ e termina com algo como .com ou .com.br.");
  }

  botaoEmail.disabled = true;
  botaoEmail.textContent = "Cadastrando…";
  try {
    const resposta = await fetch(`${API_BASE}/emails/inscrever`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    avisoApi.hidden = true;
    const dados = await resposta.json().catch(() => ({}));

    if (resposta.ok) {
      mostrarRetornoEmail("ok", dados.mensagem || "Cadastro feito!");
      if (!dados.jaInscrito) formEmail.reset();
    } else {
      mostrarRetornoEmail("erro", dados.erro || "Não foi possível cadastrar agora. Tente de novo daqui a pouco.", dados.sugestao);
    }
  } catch {
    avisoApi.hidden = false;
    mostrarRetornoEmail("erro", "Não consegui falar com o servidor agora. Tente de novo daqui a pouco.");
  } finally {
    botaoEmail.disabled = false;
    botaoEmail.textContent = "Quero receber alertas";
  }
});

// Link no painel do sininho: vai até o formulário de email.
document.getElementById("notif-link-email").addEventListener("click", (e) => {
  e.preventDefault();
  notifPanel.hidden = true;
  abrirAba("inicio");
  document.getElementById("alerta-email").scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => campoEmail.focus({ preventScroll: true }), 400);
});

// ===================================================================
// Bolin assistente (canto inferior direito)
// -------------------------------------------------------------------
// 1. Ao entrar no sistema, ele aparece e conta como está o tempo.
// 2. Depois de 30 segundos (a barrinha embaixo do balão), ele sai e
//    fica espiando na beirada da tela, acenando.
// 3. Clicando nele, ele volta com uma caixinha de perguntas prontas.
// ===================================================================
const bolinBox = document.getElementById("bolin-assistente");
const bolinBalao = document.getElementById("bolin-balao");
const bolinConteudo = document.getElementById("bolin-conteudo");
const bolinPersonagem = document.getElementById("bolin-personagem");
const bolinBarra = document.getElementById("bolin-tempo-barra");

function bolinEstado(estado) {
  bolinBox.dataset.estado = estado;
  const balaoAberto = estado === "falando" || estado === "perguntas";
  bolinBalao.hidden = !balaoAberto;
  bolinPersonagem.setAttribute("aria-expanded", String(balaoAberto));
  bolinPersonagem.setAttribute("aria-label", balaoAberto ? "Esconder o Bolin" : "Conversar com o Bolin");

  if (estado === "espiando") {
    // mostra o "Clique em mim!" por alguns segundos
    bolinBox.classList.add("chamando");
    clearTimeout(bolinEstado.timer);
    bolinEstado.timer = setTimeout(() => bolinBox.classList.remove("chamando"), 5000);
  } else {
    bolinBox.classList.remove("chamando");
  }
}

// Frase "vai chover?" a partir do clima
function fraseChuva(c) {
  const hoje = c.previsaoHoje;
  const chance = hoje.probabilidadeChuva ?? 0;
  if (c.estaChovendo) return `Está chovendo agora (${c.condicao.toLowerCase()}). Leve o guarda-chuva!`;
  if (chance >= 60) return `Vai chover, sim! Hoje tem <b>${chance}%</b> de chance, cerca de <b>${num(hoje.chuvaMm)} mm</b>.`;
  if (chance >= 30) return `Pode chover: hoje tem <b>${chance}%</b> de chance de chuva.`;
  return `Hoje não deve chover: só <b>${chance}%</b> de chance.`;
}

function linhaDeAlerta() {
  const zonas = ultimasZonas.filter(z => !z.ehMaquete || recebeLeituras(z));
  const perigo = zonas.filter(z => z.status === "perigo").length;
  const atencao = zonas.filter(z => z.status === "atencao").length;
  if (perigo) {
    const extra = atencao ? ` e ${atencao} em atenção` : "";
    return { classe: "alerta", icone: "⚠️", texto: `<b>${perigo} ${perigo === 1 ? "região em perigo" : "regiões em perigo"}</b>${extra} agora. Veja na aba Alagamentos.` };
  }
  if (atencao) return { classe: "", icone: "👀", texto: `${atencao} ${atencao === 1 ? "região está" : "regiões estão"} em atenção. Fique de olho!` };
  return { classe: "", icone: "✅", texto: "Nenhuma região em alerta agora." };
}

function bolinFalaDoTempo() {
  const c = ultimoClima;
  const alerta = linhaDeAlerta();
  const itens = c ? `
      <li><span>🌧️</span><span>${fraseChuva(c)}</span></li>
      <li><span>🌡️</span><span>Lá fora estão <b>${Math.round(c.temperatura)}°C</b> (hoje vai de ${Math.round(c.previsaoHoje.minima)}° a ${Math.round(c.previsaoHoje.maxima)}°).</span></li>
      <li><span>💨</span><span>Vento de <b>${num(c.ventoKmh)} km/h</b>.</span></li>
      <li><span>💧</span><span>Umidade do ar em <b>${c.umidade}%</b>.</span></li>`
    : `<li><span>🙈</span><span>Não consegui olhar o céu agora, mas tento de novo daqui a pouco.</span></li>`;

  bolinConteudo.innerHTML = `
    <p class="bolin-ola">Oi! Eu sou o Bolin 👋</p>
    <p>Dei uma espiada lá fora em Ribeirão Preto pra você:</p>
    <ul class="bolin-lista">
      ${itens}
      <li class="${alerta.classe}"><span>${alerta.icone}</span><span>${alerta.texto}</span></li>
    </ul>
    <p class="bolin-rodape">Vou ficar ali no cantinho. Se quiser conversar, é só clicar em mim!</p>`;

  // reinicia a barrinha dos 30 segundos
  bolinBarra.style.animation = "none";
  void bolinBarra.offsetWidth;
  bolinBarra.style.animation = "";
  bolinEstado("falando");
}

// ---------- Perguntas prontas ----------
const PERGUNTAS_DO_BOLIN = [
  {
    pergunta: "Onde você foi criado, Bolin?",
    resposta: "Nasci em Ribeirão Preto, numa cozinha, numa tarde de chuva forte! A massa estava descansando, a água começou a subir lá fora e… pluft, eu ganhei vida. Desde então fico de olho no céu pra avisar todo mundo."
  },
  {
    pergunta: "Quando você foi feito?",
    resposta: "Há 5 anos, num dia de temporal. Por isso eu comemoro meu aniversário sempre que chove — e, claro, com muito café com leite! ☕"
  },
  {
    pergunta: "Quantos anos você tem?",
    resposta: "Tenho 5 aninhos! Sou pequeno, mas já vi muita chuva nessa vida. 😄"
  },
  {
    pergunta: "Do que você é feito?",
    resposta: "Farinha, ovo, leite, açúcar e uma boa camada de canela por cima. Ah, e muita vontade de ajudar!"
  },
  {
    pergunta: "Por que você usa capa de chuva?",
    resposta: "Bolinho de chuva molhado vira bolinho murcho! 😅 A capa e as galochas me deixam sequinho pra trabalhar com qualquer tempo. E o guarda-chuva fica sempre na mão, pronto pra abrir."
  },
  {
    pergunta: "Vai chover hoje?",
    resposta: () => {
      const c = ultimoClima;
      if (!c) return "Agora não consegui olhar a previsão. Dá uma olhada na aba Clima daqui a pouquinho!";
      return `${fraseChuva(c)} Agora estão ${Math.round(c.temperatura)}°C, com vento de ${num(c.ventoKmh)} km/h. A previsão completa fica na aba Clima.`;
    }
  },
  {
    pergunta: "O que você faz aqui no site?",
    resposta: "Fico de olho no tempo e nos córregos. Quando alguma região entra em perigo, eu aviso pela barra vermelha lá em cima, pelo sininho e por email — é só se cadastrar na página inicial."
  },
  {
    pergunta: "O que fazer se a rua alagar?",
    resposta: "Não atravesse, nem a pé nem de carro: 15 cm de água correndo já derrubam uma pessoa. Procure um lugar alto e, em emergência, ligue 199 (Defesa Civil) ou 193 (Bombeiros)."
  },
  {
    pergunta: "Quem criou o Bolinho de Chuva?",
    resposta: "Um grupo de estudantes de Ribeirão Preto, no Projeto Integrador (PINT2). Eles queriam que todo mundo ficasse sabendo a tempo quando a chuva vira perigo — e me chamaram pra ajudar!"
  },
  {
    pergunta: "Qual é a sua comida favorita?",
    resposta: "Café com leite bem quentinho em dia de chuva! Bolinho eu não como… seria meio estranho, né? 😅"
  }
];

function bolinMostrarPerguntas({ focar = false } = {}) {
  bolinConteudo.innerHTML = `
    <p class="bolin-ola">O que você quer saber? 🤔</p>
    <p>Escolhe uma pergunta que eu respondo:</p>
    <div class="bolin-perguntas">
      ${PERGUNTAS_DO_BOLIN.map((q, i) => `<button class="bolin-pergunta" data-i="${i}">${esc(q.pergunta)}</button>`).join("")}
    </div>`;
  bolinEstado("perguntas");
  if (focar) bolinConteudo.querySelector(".bolin-pergunta")?.focus();
}

function bolinResponder(i) {
  const q = PERGUNTAS_DO_BOLIN[i];
  const resposta = typeof q.resposta === "function" ? q.resposta() : esc(q.resposta);
  bolinConteudo.innerHTML = `
    <p class="bolin-msg-pessoa">${esc(q.pergunta)}</p>
    <p class="bolin-msg-bolin">${resposta}</p>
    <button class="bolin-voltar">← Outras perguntas</button>`;
  bolinConteudo.querySelector(".bolin-voltar").focus();
}

bolinConteudo.addEventListener("click", (e) => {
  const pergunta = e.target.closest(".bolin-pergunta");
  if (pergunta) return bolinResponder(Number(pergunta.dataset.i));
  if (e.target.closest(".bolin-voltar")) bolinMostrarPerguntas({ focar: true });
});

bolinPersonagem.addEventListener("click", (e) => {
  const estado = bolinBox.dataset.estado;
  if (estado === "perguntas") return bolinEstado("espiando");
  // e.detail === 0 quando foi ativado pelo teclado (Enter/Espaço)
  bolinMostrarPerguntas({ focar: e.detail === 0 });
});

document.getElementById("bolin-fechar").addEventListener("click", () => {
  bolinEstado("espiando");
  bolinPersonagem.focus();
});

// Quando a barrinha dos 30 segundos acaba, ele vai espiar.
bolinBarra.addEventListener("animationend", () => {
  if (bolinBox.dataset.estado === "falando") bolinEstado("espiando");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !bolinBalao.hidden) {
    bolinEstado("espiando");
    bolinPersonagem.focus();
  }
});

// Ele aparece quando o clima chegar (ou depois de 3 segundos, o que vier primeiro).
Promise.race([primeiroClima, new Promise(r => setTimeout(r, 3000))])
  .then(() => setTimeout(bolinFalaDoTempo, 600));

// ---------- Inicialização ----------
mostrarDica();
abrirAba(location.hash.slice(1) || "inicio", { atualizarEndereco: false });

carregarNoticias();
carregarClima();
carregarZonas();
carregarContatos();
carregarSensor();
verificarSimulacao();

// Link "Configurar emails" no rodapé: só aparece no computador que roda o sistema.
fetch(`${API_BASE}/config`).then(r => { if (r.ok) document.getElementById("link-config").hidden = false; }).catch(() => {});

setInterval(carregarZonas, 30000);      // regiões: a cada 30 segundos
setInterval(carregarClima, 300000);     // clima: a cada 5 minutos
setInterval(carregarNoticias, 600000);  // notícias: a cada 10 minutos
