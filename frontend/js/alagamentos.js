// ===================================================================
// alagamentos.js — página Alagamentos (alagamentos.html)
// -------------------------------------------------------------------
//   1. Mapa das regiões (biblioteca Leaflet)
//   2. Lista de regiões com busca e filtro       → Vue.js (Options API)
//   3. Histórico de alertas com filtros          → Vue.js (Options API)
//
// O HTML dos painéis Vue fica no alagamentos.html, dentro de
// <div id="app-regioes"> e <div id="app-alertas">. Os cartões (componentes)
// ficam nos <template id="molde-..."> no fim do alagamentos.html.
// ===================================================================


// ===================================================================
// 1. Mapa das regiões
// ===================================================================
let mapa = null;
let circulosNoMapa = [];

function desenharMapa(zonas) {
  if (!zonas || typeof L === "undefined") return;   // L = biblioteca de mapas Leaflet
  const daCidade = zonas.filter(z => !z.ehMaquete);

  if (!mapa) {
    mapa = L.map("flood-map", { scrollWheelZoom: false }).setView([-21.1775, -47.8103], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapa);
  }

  // Tira os círculos antigos antes de desenhar os novos, senão eles se acumulam.
  circulosNoMapa.forEach(c => mapa.removeLayer(c));
  circulosNoMapa = daCidade.map(z => {
    const cor = STATUS_COR[z.status];
    return L.circle([z.lat, z.lng], { radius: z.raio, color: cor, fillColor: cor, fillOpacity: 0.35, weight: 2 })
      .addTo(mapa)
      .bindPopup(`<strong>${esc(z.nome)}</strong><br>${STATUS_LABEL[z.status]}, nível ${num(z.cotaAtual)} m<br>${esc(z.observacao)}`);
  });
}

quandoChegaremRegioes.push(desenharMapa);


// ===================================================================
// 2. Lista de regiões (Vue)
// ===================================================================

// Componente: o cartão de UMA região. Recebe a região pela "prop" zona.
// Uso no HTML: <cartao-regiao :zona="z"></cartao-regiao>
const CartaoRegiao = {
  props: {
    zona: { type: Object, required: true }
  },
  computed: {
    situacao() { return STATUS_LABEL[this.zona.status] ?? this.zona.status; },
    nivel() { return num(this.zona.cotaAtual); },
    deLeitura() { return recebeLeituras(this.zona); },
    origem() {
      if (this.zona.fonte === "sensor") return "sensor";
      if (this.zona.fonte === "simulacao") return "simulação";
      return "dado de demonstração";
    },
    hora() { return formatoHora.format(new Date(this.zona.atualizadoEm)); }
  },
  template: "#molde-cartao-regiao"
};

const PainelRegioes = {
  components: { CartaoRegiao },

  // data(): os dados do painel. Quando mudam, a tela muda sozinha.
  data() {
    return {
      zonas: [],            // chegam do comum.js a cada 15 segundos
      carregou: false,
      erro: false,
      busca: "",            // o que foi digitado (v-model)
      situacao: "todas",    // o botão de filtro escolhido
      opcoes: [
        { valor: "todas", rotulo: "Todas" },
        { valor: "perigo", rotulo: "Perigo" },
        { valor: "atencao", rotulo: "Atenção" },
        { valor: "tranquilo", rotulo: "Tranquilo" }
      ]
    };
  },

  // computed: contas feitas a partir dos dados. O filtro é feito AQUI,
  // no navegador, sem perguntar nada de novo pra API.
  computed: {
    regioesDaCidade() {
      const ordem = { perigo: 0, atencao: 1, tranquilo: 2 };
      return this.zonas.filter(z => !z.ehMaquete).sort((a, b) => ordem[a.status] - ordem[b.status]);
    },
    contagem() {
      const c = { todas: this.regioesDaCidade.length, perigo: 0, atencao: 0, tranquilo: 0 };
      for (const z of this.regioesDaCidade) c[z.status]++;
      return c;
    },
    regioesFiltradas() {
      const termo = semAcento(this.busca.trim());
      return this.regioesDaCidade.filter(z =>
        (this.situacao === "todas" || z.status === this.situacao) &&
        (termo === "" || semAcento(z.nome).includes(termo)));
    }
  },

  methods: {
    receber(zonas) {
      if (!zonas) { if (!this.carregou) this.erro = true; return; }
      this.zonas = zonas;
      this.carregou = true;
      this.erro = false;
    },
    limparFiltros() {
      this.busca = "";
      this.situacao = "todas";
    }
  },

  // mounted(): roda quando o painel aparece na página
  mounted() {
    quandoChegaremRegioes.push(zonas => this.receber(zonas));
    if (zonasCarregadas) this.receber(ultimasZonas);

    // Veio da pesquisa do topo? (alagamentos.html?regiao=Jardim Zara)
    const regiao = new URLSearchParams(location.search).get("regiao");
    if (regiao) {
      this.busca = regiao;
      destacar(document.getElementById("app-regioes"));
    }
  }
};


// ===================================================================
// 3. Histórico de alertas (Vue)
// ===================================================================
const TIPOS_DE_ALERTA = { alagamento: "Alagamento", chuva: "Chuva", temporal: "Temporal" };
const formatoDataHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// "21:40" (se for hoje) ou "12/11 21:40"
function quando(dataIso) {
  const d = new Date(dataIso);
  return new Date().toDateString() === d.toDateString() ? formatoHora.format(d) : formatoDataHora.format(d);
}

// "12 min", "1 h 30 min"
function duracao(inicioIso, fimIso) {
  const minutos = Math.max(1, Math.round((new Date(fimIso ?? Date.now()) - new Date(inicioIso)) / 60000));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60), resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

// Componente: o cartão de UM alerta
const ItemAlerta = {
  props: {
    alerta: { type: Object, required: true }
  },
  computed: {
    tipo() { return TIPOS_DE_ALERTA[this.alerta.tipo] ?? this.alerta.tipo; },
    nivel() { return STATUS_LABEL[this.alerta.nivel] ?? this.alerta.nivel; },
    periodo() {
      const a = this.alerta;
      return a.ativo
        ? `Desde ${quando(a.inicio)} · há ${duracao(a.inicio)}`
        : `De ${quando(a.inicio)} até ${quando(a.fim)} · durou ${duracao(a.inicio, a.fim)}`;
    }
  },
  template: "#molde-item-alerta"
};

const PainelAlertas = {
  components: { ItemAlerta },

  data() {
    return {
      alertas: [],
      carregou: false,
      erro: false,
      local: "todos",     // filtro por local (select com v-model)
      soAtivos: false     // "só alertas ativos" (checkbox com v-model)
    };
  },

  computed: {
    locais() {
      return [...new Set(this.alertas.map(a => a.local))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
    quantidadeAtivos() {
      return this.alertas.filter(a => a.ativo).length;
    },
    alertasFiltrados() {
      return this.alertas.filter(a =>
        (this.local === "todos" || a.local === this.local) &&
        (!this.soAtivos || a.ativo));
    },
    nenhumAlerta() {
      return this.alertas.length === 0;
    }
  },

  methods: {
    // Busca o histórico na API: GET /api/alertas
    async buscar() {
      try {
        this.alertas = await api("/alertas");
        this.carregou = true;
        this.erro = false;
      } catch {
        if (!this.carregou) this.erro = true;
      }
    },
    limparFiltros() {
      this.local = "todos";
      this.soAtivos = false;
    }
  },

  // Tempo real: busca ao abrir e depois a cada 10 segundos
  mounted() {
    this.buscar();
    this.relogio = setInterval(this.buscar, 10000);
  },
  beforeUnmount() {
    clearInterval(this.relogio);
  }
};


// ===================================================================
// Liga os painéis Vue nas <div> do alagamentos.html
// ===================================================================
Vue.createApp(PainelRegioes).mount("#app-regioes");
Vue.createApp(PainelAlertas).mount("#app-alertas");
