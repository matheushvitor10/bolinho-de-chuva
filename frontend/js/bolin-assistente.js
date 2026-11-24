// ===================================================================
// bolin-assistente.js — o Bolin que aparece no canto da tela
// -------------------------------------------------------------------
// 1. Na primeira página que a pessoa abre, ele aparece e conta como
//    está o tempo (se vai chover, temperatura, vento, umidade e alertas).
// 2. Depois de 30 segundos (a barrinha embaixo do balão), ele sai e
//    fica espiando na beirada da tela, acenando.
// 3. Clicando nele, ele volta com uma caixinha de perguntas prontas.
// Nas outras páginas ele já começa espiando (não repete a fala).
//
// O HTML dele fica no fim de cada página (procure "Bolin assistente").
// O estilo fica em css/bolin-assistente.css.
// ===================================================================

// ---------- Perguntas prontas (pode editar e acrescentar) ----------
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
      if (!c) return "Agora não consegui olhar a previsão. Dá uma olhada na página Clima daqui a pouquinho!";
      return `${fraseChuva(c)} Agora estão ${Math.round(c.temperatura)}°C, com vento de ${num(c.ventoKmh)} km/h. A previsão completa fica na página Clima.`;
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

// ---------- Estados: escondido → falando → espiando ⇄ perguntas ----------
function bolinEstado(estado) {
  const caixa = document.getElementById("bolin-assistente");
  const balao = document.getElementById("bolin-balao");
  const personagem = document.getElementById("bolin-personagem");

  caixa.dataset.estado = estado;
  const balaoAberto = estado === "falando" || estado === "perguntas";
  balao.hidden = !balaoAberto;
  personagem.setAttribute("aria-expanded", String(balaoAberto));
  personagem.setAttribute("aria-label", balaoAberto ? "Esconder o Bolin" : "Conversar com o Bolin");

  if (estado === "espiando") {
    // mostra o "Clique em mim!" por alguns segundos
    caixa.classList.add("chamando");
    clearTimeout(bolinEstado.timer);
    bolinEstado.timer = setTimeout(() => caixa.classList.remove("chamando"), 5000);
  } else {
    caixa.classList.remove("chamando");
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
    return { classe: "alerta", icone: "⚠️", texto: `<b>${perigo} ${perigo === 1 ? "região em perigo" : "regiões em perigo"}</b>${extra} agora. Veja na página Alagamentos.` };
  }
  if (atencao) return { classe: "", icone: "👀", texto: `${atencao} ${atencao === 1 ? "região está" : "regiões estão"} em atenção. Fique de olho!` };
  return { classe: "", icone: "✅", texto: "Nenhuma região em alerta agora." };
}

// A fala de quando a pessoa entra no site
function bolinFalaDoTempo() {
  const c = ultimoClima;
  const alerta = linhaDeAlerta();
  const itens = c ? `
      <li><span>🌧️</span><span>${fraseChuva(c)}</span></li>
      <li><span>🌡️</span><span>Lá fora estão <b>${Math.round(c.temperatura)}°C</b> (hoje vai de ${Math.round(c.previsaoHoje.minima)}° a ${Math.round(c.previsaoHoje.maxima)}°).</span></li>
      <li><span>💨</span><span>Vento de <b>${num(c.ventoKmh)} km/h</b>.</span></li>
      <li><span>💧</span><span>Umidade do ar em <b>${c.umidade}%</b>.</span></li>`
    : `<li><span>🙈</span><span>Não consegui olhar o céu agora, mas tento de novo daqui a pouco.</span></li>`;

  document.getElementById("bolin-conteudo").innerHTML = `
    <p class="bolin-ola">Oi! Eu sou o Bolin 👋</p>
    <p>Dei uma espiada lá fora em Ribeirão Preto pra você:</p>
    <ul class="bolin-lista">
      ${itens}
      <li class="${alerta.classe}"><span>${alerta.icone}</span><span>${alerta.texto}</span></li>
    </ul>
    <p class="bolin-rodape">Vou ficar ali no cantinho. Se quiser conversar, é só clicar em mim!</p>`;

  // reinicia a barrinha dos 30 segundos
  const barra = document.getElementById("bolin-tempo-barra");
  barra.style.animation = "none";
  void barra.offsetWidth;
  barra.style.animation = "";
  bolinEstado("falando");
}

// A caixinha de perguntas
function bolinMostrarPerguntas({ focar = false } = {}) {
  const conteudo = document.getElementById("bolin-conteudo");
  conteudo.innerHTML = `
    <p class="bolin-ola">O que você quer saber? 🤔</p>
    <p>Escolhe uma pergunta que eu respondo:</p>
    <div class="bolin-perguntas">
      ${PERGUNTAS_DO_BOLIN.map((q, i) => `<button class="bolin-pergunta" data-i="${i}">${esc(q.pergunta)}</button>`).join("")}
    </div>`;
  bolinEstado("perguntas");
  if (focar) conteudo.querySelector(".bolin-pergunta")?.focus();
}

function bolinResponder(i) {
  const q = PERGUNTAS_DO_BOLIN[i];
  const resposta = typeof q.resposta === "function" ? q.resposta() : esc(q.resposta);
  const conteudo = document.getElementById("bolin-conteudo");
  conteudo.innerHTML = `
    <p class="bolin-msg-pessoa">${esc(q.pergunta)}</p>
    <p class="bolin-msg-bolin">${resposta}</p>
    <button class="bolin-voltar">← Outras perguntas</button>`;
  conteudo.querySelector(".bolin-voltar").focus();
}

// ---------- Cliques e teclas ----------
document.addEventListener("DOMContentLoaded", () => {
  const caixa = document.getElementById("bolin-assistente");
  const balao = document.getElementById("bolin-balao");
  const personagem = document.getElementById("bolin-personagem");

  document.getElementById("bolin-conteudo").addEventListener("click", (e) => {
    const pergunta = e.target.closest(".bolin-pergunta");
    if (pergunta) return bolinResponder(Number(pergunta.dataset.i));
    if (e.target.closest(".bolin-voltar")) bolinMostrarPerguntas({ focar: true });
  });

  personagem.addEventListener("click", (e) => {
    if (caixa.dataset.estado === "perguntas") return bolinEstado("espiando");
    // e.detail === 0 quando foi ativado pelo teclado (Enter/Espaço)
    bolinMostrarPerguntas({ focar: e.detail === 0 });
  });

  document.getElementById("bolin-fechar").addEventListener("click", () => {
    bolinEstado("espiando");
    personagem.focus();
  });

  // Quando a barrinha dos 30 segundos acaba, ele vai espiar.
  document.getElementById("bolin-tempo-barra").addEventListener("animationend", () => {
    if (caixa.dataset.estado === "falando") bolinEstado("espiando");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !balao.hidden) {
      bolinEstado("espiando");
      personagem.focus();
    }
  });

  // Ele só "fala" na primeira página que a pessoa abre (guardado no navegador).
  let jaFalou = false;
  try { jaFalou = sessionStorage.getItem("bolin-ja-falou") === "sim"; } catch { /* tudo bem */ }

  if (jaFalou) {
    setTimeout(() => bolinEstado("espiando"), 400);
  } else {
    // Espera o clima chegar (ou 3 segundos, o que vier primeiro).
    Promise.race([primeiroClima, new Promise(r => setTimeout(r, 3000))]).then(() => {
      setTimeout(bolinFalaDoTempo, 600);
      try { sessionStorage.setItem("bolin-ja-falou", "sim"); } catch { /* tudo bem */ }
    });
  }
});
