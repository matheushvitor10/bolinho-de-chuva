// ===================================================================
// busca.js — barra de pesquisa do topo (feita em Vue.js, Options API)
// -------------------------------------------------------------------
// Mostra os resultados ENQUANTO a pessoa digita: páginas, regiões,
// notícias, riscos, cuidados, telefones e perguntas do Bolin.
// Escolhendo um resultado, leva até a página certa e destaca o lugar.
//
// O HTML dela fica no cabeçalho de cada página: procure id="app-busca".
// O estilo fica em css/busca.css.
// ===================================================================

// ---------- O que dá pra achar (pode acrescentar palavras) ----------
const PAGINAS_DA_BUSCA = [
  { url: "index.html", titulo: "Início", texto: "Resumo do tempo, notícias de chuva e alagamento por cidade.", palavras: "inicio pagina inicial resumo noticias" },
  { url: "alagamentos.html", titulo: "Alagamentos", texto: "Mapa das regiões monitoradas e histórico de alertas.", palavras: "mapa regioes enchente alagamento historico alertas pendentes ativos" },
  { url: "sensor.html", titulo: "Sensor", texto: "Nível da água na maquete, em tempo real, e simulação.", palavras: "sensor nivel agua maquete arduino usb cabo conectar breno esp32 ultrassonico simulacao tempo real tanque grafico" },
  { url: "clima.html", titulo: "Clima", texto: "Temperatura, chuva prevista e previsão dos próximos dias.", palavras: "clima tempo temperatura chuva previsao vento umidade graus" },
  { url: "riscos.html", titulo: "Riscos", texto: "Por que é perigoso sair durante um alagamento.", palavras: "riscos perigo perigoso" },
  { url: "cuidados.html", titulo: "Cuidados", texto: "O que fazer antes, durante e depois de um alagamento.", palavras: "cuidados dicas prevencao o que fazer" },
  { url: "ajuda.html", titulo: "Ajuda e telefones", texto: "Telefones de emergência: Defesa Civil, Bombeiros, SAMU.", palavras: "ajuda telefone telefones emergencia contato ligar" },
  { url: "bolin.html", titulo: "Conheça o Bolin", texto: "O mascote do Bolinho de Chuva.", palavras: "bolin mascote bolinho personagem" },
  { url: "index.html#alerta-email", titulo: "Receber alertas por email", texto: "Cadastre seu email para receber avisos de chuva, temporal e alagamento.", palavras: "email e-mail alerta alertas aviso notificacao cadastro cadastrar inscrever receber gmail" }
];

// Os riscos e os cuidados (os mesmos textos das páginas riscos.html e cuidados.html)
const RISCOS_DA_BUSCA = [
  {
    "id": "risco-1",
    "titulo": "Força da água",
    "texto": "15 cm de água em movimento derrubam uma pessoa; 50 cm arrastam um carro. A correnteza engana — parece pouco, mas basta um desequilíbrio para cair."
  },
  {
    "id": "risco-2",
    "titulo": "Água contaminada",
    "texto": "A água do alagamento se mistura com esgoto e lixo e é a principal via de contágio da leptospirose. Um pequeno corte na pele já vira porta de entrada."
  },
  {
    "id": "risco-3",
    "titulo": "Choque elétrico",
    "texto": "Fios submersos podem eletrificar a água ao redor, sem nenhum sinal visível. A água conduz eletricidade muito bem."
  },
  {
    "id": "risco-4",
    "titulo": "Buracos escondidos",
    "texto": "Bueiros abertos e valas ficam escondidos debaixo da água turva. É comum alguém cair num buraco que não sabia que estava ali."
  },
  {
    "id": "risco-5",
    "titulo": "Animais peçonhentos",
    "texto": "A cheia expulsa cobras, escorpiões e aranhas dos seus esconderijos, e eles procuram áreas secas por perto — inclusive casas."
  },
  {
    "id": "risco-6",
    "titulo": "Desabamento",
    "texto": "O solo encharcado perde firmeza, e isso aumenta o risco de queda de muros, encostas e paredes de casas mais antigas."
  }
];
const CUIDADOS_DA_BUSCA = [
  {
    "id": "cuidado-antes-1",
    "etapa": "antes",
    "titulo": "Receba alertas no celular",
    "texto": "Mande seu CEP por SMS para 40199 e a Defesa Civil avisa quando houver risco de chuva forte. É gratuito."
  },
  {
    "id": "cuidado-antes-2",
    "etapa": "antes",
    "titulo": "Eleve o que for possível",
    "texto": "Guarde documentos e aparelhos elétricos em lugares altos."
  },
  {
    "id": "cuidado-antes-3",
    "etapa": "antes",
    "titulo": "Monte um kit de emergência",
    "texto": "Água, lanterna, remédios e documentos dentro de um saco plástico."
  },
  {
    "id": "cuidado-antes-4",
    "etapa": "antes",
    "titulo": "Planeje uma rota de saída",
    "texto": "Saiba para onde ir e combine um ponto de encontro com a família — e não esqueça dos animais de estimação."
  },
  {
    "id": "cuidado-durante-1",
    "etapa": "durante",
    "titulo": "Não atravesse a água",
    "texto": "Nem a pé, nem de carro — a profundidade e a correnteza enganam."
  },
  {
    "id": "cuidado-durante-2",
    "etapa": "durante",
    "titulo": "Desligue a energia elétrica",
    "texto": "Corte a chave geral se a água começar a entrar em casa."
  },
  {
    "id": "cuidado-durante-3",
    "etapa": "durante",
    "titulo": "Busque um ponto mais alto",
    "texto": "Suba para andares superiores e aguarde o resgate em segurança."
  },
  {
    "id": "cuidado-durante-4",
    "etapa": "durante",
    "titulo": "Não vá ver de perto",
    "texto": "Ir até a área alagada por curiosidade ocupa as vias e coloca você em risco."
  },
  {
    "id": "cuidado-depois-1",
    "etapa": "depois",
    "titulo": "Use luvas e botas",
    "texto": "Evite contato direto da pele com a lama e a água do alagamento."
  },
  {
    "id": "cuidado-depois-2",
    "etapa": "depois",
    "titulo": "Descarte alimentos que molharam",
    "texto": "Jogue fora tudo o que teve contato com a água do alagamento."
  },
  {
    "id": "cuidado-depois-3",
    "etapa": "depois",
    "titulo": "Procure atendimento se tiver febre",
    "texto": "Pode ser leptospirose. Vá a um posto de saúde e conte que teve contato com a água."
  },
  {
    "id": "cuidado-depois-4",
    "etapa": "depois",
    "titulo": "Confira a casa antes de voltar",
    "texto": "Só volte a usar a casa depois de checar a parte elétrica e o encanamento."
  }
];

const ROTULOS_DA_BUSCA = {
  pagina: "Página", regiao: "Região", noticia: "Notícia", risco: "Risco",
  cuidado: "Cuidado", contato: "Telefone", pergunta: "Pergunta ao Bolin"
};

function encurtar(texto, limite = 90) {
  texto = String(texto ?? "");
  return texto.length > limite ? texto.slice(0, texto.lastIndexOf(" ", limite)) + "…" : texto;
}

// ---------- O painel Vue ----------
const PainelBusca = {
  data() {
    return {
      termo: "",          // ligado ao campo de busca (v-model)
      aberto: false,      // a lista de resultados está aparecendo?
      selecionado: 0,     // resultado marcado pelas setas do teclado
      noticias: [],       // carregadas na primeira vez que a pessoa clica na busca
      contatos: [],
      regioes: [],
      jaCarregou: false
    };
  },

  computed: {
    // Tudo o que dá pra achar, num formato só
    indice() {
      const itens = [];

      for (const p of PAGINAS_DA_BUSCA)
        itens.push({ tipo: "pagina", titulo: p.titulo, texto: p.texto, palavras: p.palavras, url: p.url });

      for (const z of this.regioes.filter(z => !z.ehMaquete))
        itens.push({ tipo: "regiao", titulo: z.nome, texto: `${STATUS_LABEL[z.status]} · ${z.observacao}`, palavras: "regiao bairro alagamento",
                     url: "alagamentos.html?regiao=" + encodeURIComponent(z.nome) });

      for (const n of this.noticias)
        itens.push({ tipo: "noticia", titulo: n.titulo, texto: `${n.fonte} · ${haQuantoTempo(n.publicadoEm)}`,
                     palavras: "noticia " + (n.cidades || []).join(" ").replace("ribeirao-preto", "ribeirao preto"), link: n.link });

      for (const r of RISCOS_DA_BUSCA)
        itens.push({ tipo: "risco", titulo: r.titulo, texto: r.texto, palavras: "risco perigo", url: "riscos.html#" + r.id });

      for (const c of CUIDADOS_DA_BUSCA)
        itens.push({ tipo: "cuidado", titulo: c.titulo, texto: c.texto, palavras: "cuidado dica " + c.etapa,
                     url: `cuidados.html?etapa=${c.etapa}#${c.id}` });

      for (const c of this.contatos)
        itens.push({ tipo: "contato", titulo: `${c.nome} — ${c.numero}`, texto: c.descricao,
                     palavras: "telefone ligar emergencia " + c.numero.replace(/\D/g, ""), url: "ajuda.html#contato-" + c.id });

      PERGUNTAS_DO_BOLIN.forEach((q, i) =>
        itens.push({ tipo: "pergunta", titulo: q.pergunta, texto: typeof q.resposta === "string" ? q.resposta : "Resposta com a previsão de agora.",
                     palavras: "bolin pergunta", indice: i }));

      return itens.map((item, id) => ({
        ...item,
        id,
        rotulo: ROTULOS_DA_BUSCA[item.tipo],
        resumo: encurtar(item.texto),
        busca: semAcento(`${item.titulo} ${item.texto} ${item.palavras}`),
        buscaTitulo: semAcento(item.titulo)
      }));
    },

    // Os resultados: recalculados a cada letra digitada, no navegador.
    resultados() {
      const palavras = semAcento(this.termo).split(/\s+/).filter(p => p.length >= 2);
      if (palavras.length === 0) return [];
      return this.indice
        .filter(item => palavras.every(p => item.busca.includes(p)))
        .map(item => ({ item, pontos: palavras.reduce((total, p) => total + (item.buscaTitulo.includes(p) ? 3 : 1), 0) }))
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, 8)
        .map(r => r.item);
    },

    mostrarLista() {
      return this.aberto && semAcento(this.termo).trim().length >= 2;
    }
  },

  watch: {
    // Quando o texto muda, abre a lista e volta pro primeiro resultado
    termo() {
      this.aberto = true;
      this.selecionado = 0;
    }
  },

  methods: {
    // Na primeira vez que a pessoa clica na busca, carrega notícias e telefones
    async carregarExtras() {
      this.aberto = true;
      if (this.jaCarregou) return;
      this.jaCarregou = true;
      try { this.noticias = (await api("/noticias?abrangencia=todas")).noticias || []; } catch { /* sem notícias */ }
      try { this.contatos = await api("/contatos"); } catch { /* sem telefones */ }
    },
    mover(passo) {
      if (!this.resultados.length) return;
      this.aberto = true;
      this.selecionado = (this.selecionado + passo + this.resultados.length) % this.resultados.length;
    },
    escolherSelecionado() {
      const item = this.resultados[this.selecionado];
      if (item) this.abrir(item);
    },
    fechar() {
      this.aberto = false;
    },

    // O que acontece ao escolher um resultado
    abrir(item) {
      this.aberto = false;
      this.termo = "";
      this.$refs.campo.blur();

      if (item.tipo === "noticia") {
        window.open(item.link, "_blank", "noopener");
      } else if (item.tipo === "pergunta") {
        bolinMostrarPerguntas();
        bolinResponder(item.indice);
      } else {
        window.location.href = item.url;   // vai pra página (e o comum.js destaca o lugar)
      }
    },

    // Clicou fora da busca: fecha a lista
    cliqueFora(evento) {
      if (!document.getElementById("app-busca").contains(evento.target)) this.aberto = false;
    },
    // Atalho: a tecla "/" vai direto pra busca
    atalho(evento) {
      const digitando = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
      if (evento.key === "/" && !digitando) {
        evento.preventDefault();
        this.$refs.campo.focus();
      }
    }
  },

  mounted() {
    document.addEventListener("click", this.cliqueFora);
    document.addEventListener("keydown", this.atalho);
    // As regiões chegam pelo comum.js (a cada 15 segundos)
    quandoChegaremRegioes.push(zonas => { if (zonas) this.regioes = zonas; });
  },

  beforeUnmount() {
    document.removeEventListener("click", this.cliqueFora);
    document.removeEventListener("keydown", this.atalho);
  }
};

// Liga a busca na <div id="app-busca"> do cabeçalho
Vue.createApp(PainelBusca).mount("#app-busca");
