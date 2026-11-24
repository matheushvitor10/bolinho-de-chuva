// ===================================================================
// inicio.js — página Início (index.html)
// -------------------------------------------------------------------
//   1. O Bolin no topo resume a situação (balão azul)
//   2. Cadastro de email para receber alertas
//   3. Notícias de chuva e alagamento, por cidade
// ===================================================================


// ===================================================================
// 1. O Bolin no topo resume a situação
// ===================================================================
function atualizarResumo() {
  const balao = document.getElementById("balao-bolin");
  const hero = document.querySelector(".hero");
  const zonas = ultimasZonas.filter(z => !z.ehMaquete || recebeLeituras(z));
  const perigo = zonas.filter(z => z.status === "perigo");
  const atencao = zonas.filter(z => z.status === "atencao");
  const c = ultimoClima;

  // chuva caindo no fundo azul quando está chovendo
  hero.dataset.chovendo = c && c.estaChovendo ? "sim" : "nao";

  document.getElementById("hr-chuva").textContent = c ? `${num(c.previsaoHoje.chuvaMm)} mm` : "—";
  document.getElementById("hr-chance").textContent = c && c.previsaoHoje.probabilidadeChuva != null ? `${c.previsaoHoje.probabilidadeChuva}%` : "—";
  document.getElementById("hr-zonas").textContent = zonasCarregadas ? perigo.length + atencao.length : "—";

  if (!c && !zonasCarregadas) return;

  let frase;
  if (perigo.length === 1) {
    frase = `<strong>Cuidado!</strong> ${esc(perigo[0].nome)} está em nível de perigo. Fique longe da área e, se precisar, ligue 199 (Defesa Civil).`;
  } else if (perigo.length > 1) {
    frase = `<strong>Cuidado!</strong> ${perigo.length} regiões estão em nível de perigo. Veja quais na página Alagamentos e evite essas áreas.`;
  } else if (atencao.length) {
    const nomes = atencao.map(z => z.nome.split(" —")[0].split(" /")[0]).join(", ");
    frase = `${atencao.length === 1 ? "Uma região está" : `${atencao.length} regiões estão`} em atenção: ${esc(nomes)}. Se puder, evite passar por lá.`;
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

// O resumo muda sempre que chegam clima ou regiões novos (comum.js avisa)
quandoChegarClima.push(atualizarResumo);
quandoChegaremRegioes.push(atualizarResumo);


// ===================================================================
// 2. Cadastro de email para alertas
// ===================================================================
function mostrarRetornoEmail(tipo, mensagem, sugestao) {
  const retorno = document.getElementById("email-retorno");
  const campo = document.getElementById("campo-email");
  retorno.className = `email-retorno ${tipo}`;
  retorno.textContent = mensagem;
  campo.setAttribute("aria-invalid", tipo === "erro" ? "true" : "false");

  // Ex.: "Você quis dizer fulano@gmail.com?" → botão "Usar fulano@gmail.com"
  if (sugestao) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "sugestao";
    botao.textContent = `Usar ${sugestao}`;
    botao.addEventListener("click", () => {
      campo.value = sugestao;
      document.getElementById("form-email").requestSubmit();
    });
    retorno.append(botao);
  }
}

async function cadastrarEmail(evento) {
  evento.preventDefault();
  const formulario = document.getElementById("form-email");
  const campo = document.getElementById("campo-email");
  const botao = document.getElementById("botao-email");
  const email = campo.value.trim();

  // Primeira conferência aqui mesmo no navegador; a de verdade é feita pela API.
  if (!email) return mostrarRetornoEmail("erro", "Digite o seu email.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return mostrarRetornoEmail("erro", "Esse email não parece válido. Confira se ele tem @ e termina com algo como .com ou .com.br.");
  }

  botao.disabled = true;
  botao.textContent = "Cadastrando…";
  try {
    const resposta = await fetch(API_BASE + "/emails/inscrever", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (resposta.ok) {
      mostrarRetornoEmail("ok", dados.mensagem || "Cadastro feito!");
      if (!dados.jaInscrito) formulario.reset();
    } else {
      mostrarRetornoEmail("erro", dados.erro || "Não foi possível cadastrar agora. Tente de novo daqui a pouco.", dados.sugestao);
    }
  } catch {
    mostrarRetornoEmail("erro", "Não consegui falar com o servidor agora. Tente de novo daqui a pouco.");
  } finally {
    botao.disabled = false;
    botao.textContent = "Quero receber alertas";
  }
}


// ===================================================================
// 3. Notícias de chuva e alagamento, por cidade
// ===================================================================
let todasAsNoticias = [];
let fontesComErro = [];

// A cidade escolhida fica guardada no navegador: na próxima visita já abre nela.
const NOMES_DAS_CIDADES = { "ribeirao-preto": "Ribeirão Preto", "franca": "Franca", "nacional": "todo o Brasil" };
let cidadeEscolhida = "ribeirao-preto";
try {
  const salva = localStorage.getItem("bolinho-cidade");
  if (salva in NOMES_DAS_CIDADES) cidadeEscolhida = salva;
} catch { /* tudo bem */ }

function noticiasDaCidade(cidade) {
  if (cidade === "nacional") return todasAsNoticias.filter(n => n.abrangencia === "nacional");
  return todasAsNoticias.filter(n => (n.cidades || []).includes(cidade));
}

async function carregarNoticias() {
  try {
    const dados = await api("/noticias?abrangencia=todas");
    todasAsNoticias = dados.noticias || [];
    fontesComErro = dados.fontesComErro || [];
    for (const cidade of Object.keys(NOMES_DAS_CIDADES)) {
      document.getElementById(`n-${cidade}`).textContent = `(${noticiasDaCidade(cidade).length})`;
    }
    mostrarNoticias();
  } catch {
    document.getElementById("news-grid").innerHTML =
      caixaVazia("Não foi possível carregar as notícias agora. Tente recarregar a página daqui a pouco.");
  }
}

function mostrarNoticias() {
  const grade = document.getElementById("news-grid");
  document.querySelectorAll(".filtro-btn[data-cidade]").forEach(b => {
    const ativo = b.dataset.cidade === cidadeEscolhida;
    b.classList.toggle("active", ativo);
    b.setAttribute("aria-pressed", String(ativo));
  });

  const lista = noticiasDaCidade(cidadeEscolhida);
  if (!lista.length) {
    grade.innerHTML = caixaVazia(fontesComErro.length >= 6
      ? "Não consegui acessar as fontes de notícia agora. Pode ser a internet ou alguma fonte fora do ar — tento de novo em alguns minutos."
      : cidadeEscolhida === "nacional"
        ? "Nenhuma notícia de chuva ou alagamento no Brasil nos últimos dias."
        : `Nenhuma notícia de chuva ou alagamento em ${NOMES_DAS_CIDADES[cidadeEscolhida]} nos últimos dias. Melhor assim!`);
    return;
  }

  grade.innerHTML = lista.map(n => `
    <a class="news-card" href="${esc(linkSeguro(n.link))}" target="_blank" rel="noopener noreferrer">
      <h3>${esc(n.titulo)}</h3>
      ${n.resumo ? `<p>${esc(n.resumo)}</p>` : ""}
      <span class="news-meta">
        <span class="news-fonte">${esc(n.fonte)}</span>
        <span>${esc(haQuantoTempo(n.publicadoEm))}</span>
      </span>
    </a>`).join("");
}

function caixaVazia(mensagem) {
  return `<div class="vazio"><img src="img/bolin-avatar.png" alt=""><p>${esc(mensagem)}</p></div>`;
}


// ===================================================================
// Quando a página abre
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("form-email").addEventListener("submit", cadastrarEmail);

  document.querySelectorAll(".filtro-btn[data-cidade]").forEach(botao =>
    botao.addEventListener("click", () => {
      cidadeEscolhida = botao.dataset.cidade;
      try { localStorage.setItem("bolinho-cidade", cidadeEscolhida); } catch { /* tudo bem */ }
      mostrarNoticias();
    }));

  carregarNoticias();
  setInterval(carregarNoticias, 600000);  // notícias: a cada 10 minutos

  // Veio pelo link "Receber alertas por email"? Coloca o cursor no campo.
  if (location.hash === "#alerta-email") {
    setTimeout(() => document.getElementById("campo-email").focus({ preventScroll: true }), 700);
  }
});
