// ===================================================================
// Bolinho de Chuva — partes do site feitas em Vue.js (Options API)
// -------------------------------------------------------------------
// O Vue é "reativo": a gente guarda os dados em data(), diz no template
// onde cada dado aparece, e quando um dado muda a tela muda sozinha.
// Não precisa procurar elemento por elemento para trocar o texto.
//
// Este arquivo tem:
//   1. CartaoRegiao  → um COMPONENTE: o cartão de uma região. É escrito uma
//                      vez e reutilizado para cada região da lista (props).
//   2. PainelRegioes → aba Alagamentos: lista de regiões com busca por nome
//                      e filtro por situação, feitos NO NAVEGADOR (computed).
//   3. PainelSensor  → aba Sensor: busca a leitura na API a cada 3 segundos
//                      (methods + mounted + setInterval) e atualiza o tanque,
//                      o gráfico e a simulação SEM recarregar a página.
//   4. PainelAlertas → aba Alagamentos: histórico de alertas, com filtro por
//                      local e "só ativos", atualizado a cada 10 segundos.
//   5. PainelBusca   → barra de pesquisa do topo: mostra os resultados
//                      ENQUANTO a pessoa digita (abas, regiões, notícias,
//                      riscos, cuidados, telefones e perguntas do Bolin).
//
// Ele usa algumas coisas do app.js (carregado antes): api(), num(),
// STATUS_LABEL, STATUS_COR, formatoHora, formatoHoraSeg, haQuantoTempo,
// recebeLeituras e carregarZonas.
// ===================================================================

// Texto sem acento e em minúsculas, pra busca achar "ribeirao" em "Ribeirão".
function semAcento(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ===================================================================
// 1. Componente: o cartão de uma região
// ===================================================================
const CartaoRegiao = {
  name: "CartaoRegiao",

  // props = os dados que quem usa o componente passa para ele.
  // Uso: <cartao-regiao :zona="umaZona"></cartao-regiao>
  props: {
    zona: { type: Object, required: true }
  },

  computed: {
    situacao() {
      return STATUS_LABEL[this.zona.status] ?? this.zona.status;
    },
    nivel() {
      return num(this.zona.cotaAtual);
    },
    deLeitura() {
      return recebeLeituras(this.zona);
    },
    origem() {
      if (this.zona.fonte === "sensor") return "sensor";
      if (this.zona.fonte === "simulacao") return "simulação";
      return "dado de demonstração";
    },
    hora() {
      return formatoHora.format(new Date(this.zona.atualizadoEm));
    }
  },

  // O mesmo HTML de antes: o visual não muda.
  template: `
    <div class="zone-card" :class="zona.status">
      <div>
        <h3>{{ zona.nome }}</h3>
        <p>{{ zona.observacao }}</p>
      </div>
      <div class="zone-lado">
        <span class="status-pill" :class="zona.status">{{ situacao }}, {{ nivel }} m</span>
        <span class="zone-fonte" :class="{ sensor: deLeitura }">{{ origem }}, às {{ hora }}</span>
      </div>
    </div>
  `
};

// ===================================================================
// 2. Aba Alagamentos: lista de regiões com busca e filtro
// ===================================================================
const PainelRegioes = {
  components: { CartaoRegiao },

  // data(): os dados que, quando mudam, mudam a tela.
  data() {
    return {
      zonas: [],          // chegam do app.js (que já busca na API a cada 30 s)
      carregou: false,
      erro: false,
      busca: "",          // ligado ao campo de busca (v-model)
      situacao: "todas",  // ligado aos botões de filtro
      opcoes: [
        { valor: "todas", rotulo: "Todas" },
        { valor: "perigo", rotulo: "Perigo" },
        { valor: "atencao", rotulo: "Atenção" },
        { valor: "tranquilo", rotulo: "Tranquilo" }
      ]
    };
  },

  // computed: valores calculados a partir de data(). O Vue recalcula
  // sozinho quando a busca, o filtro ou a lista mudam. Nada vai pra API.
  computed: {
    regioesDaCidade() {
      // A maquete não é um lugar da cidade: ela aparece na aba "Sensor".
      const ordem = { perigo: 0, atencao: 1, tranquilo: 2 };
      return this.zonas
        .filter(z => !z.ehMaquete)
        .sort((a, b) => ordem[a.status] - ordem[b.status]);
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

  // methods: funções do painel. O app.js chama receber() e falhou().
  methods: {
    receber(zonas) {
      this.zonas = zonas;
      this.carregou = true;
      this.erro = false;
    },
    falhou() {
      if (!this.carregou) this.erro = true;
    },
    limparFiltros() {
      this.busca = "";
      this.situacao = "todas";
    }
  },

  // mounted(): roda quando o painel aparece na tela. Se o app.js já tinha
  // carregado as regiões antes, usamos elas na hora.
  mounted() {
    if (zonasCarregadas) this.receber(ultimasZonas);
  },

  template: `
    <div class="filtro-regioes">
      <label class="busca-regiao">
        <span class="visualmente-oculto">Buscar região pelo nome</span>
        <input v-model="busca" type="search" placeholder="Buscar região pelo nome" autocomplete="off">
      </label>
      <div class="filtro-noticias" role="group" aria-label="Filtrar por situação">
        <button v-for="op in opcoes" :key="op.valor" type="button" class="filtro-btn"
                :class="{ active: situacao === op.valor }" :aria-pressed="String(situacao === op.valor)"
                @click="situacao = op.valor">
          {{ op.rotulo }} <span class="filtro-n">({{ contagem[op.valor] }})</span>
        </button>
      </div>
    </div>

    <p v-if="erro" class="loading">Não foi possível carregar as regiões agora.</p>
    <p v-else-if="!carregou" class="loading">Carregando regiões…</p>
    <div v-else class="zones-list">
      <cartao-regiao v-for="z in regioesFiltradas" :key="z.id" :zona="z"></cartao-regiao>
      <p v-if="regioesFiltradas.length === 0" class="loading">
        Nenhuma região encontrada com esse filtro.
        <button type="button" class="botao-link" @click="limparFiltros">Limpar filtros</button>
      </p>
    </div>
  `
};

// ===================================================================
// 3. Aba Sensor: nível da água em tempo real + simulação
// ===================================================================

// Tamanho do gráfico (em pontos do SVG)
const G = { largura: 640, altura: 180, esq: 44, dir: 12, topo: 10, base: 26 };

const PainelSensor = {
  data() {
    return {
      status: null,          // resposta de GET /api/sensor/status
      semConexao: false,
      ativo: false,          // a aba Sensor está aberta?
      simulacao: {
        habilitada: false,
        maximoCm: 25,
        valor: 0,            // ligado à barra (v-model)
        arrastando: false,
        taxa: null,          // chuva automática ligada (cm a cada 2 s)
        erro: ""
      },
      opcoesChuva: [
        { taxa: 0.5, nome: "Chuva fraca", rotulo: "+0,5 cm" },
        { taxa: 1.5, nome: "Chuva forte", rotulo: "+1,5 cm" },
        { taxa: 3, nome: "Temporal", rotulo: "+3 cm" },
        { taxa: -1.5, nome: "Escoar", rotulo: "−1,5 cm" }
      ],
      atalhos: [
        { nivel: 0, nome: "Seca", classe: "" },
        { nivel: 6, nome: "Normal", classe: "" },
        { nivel: 14, nome: "Atenção", classe: "atencao" },
        { nivel: 20, nome: "Perigo", classe: "perigo" }
      ],
      G
    };
  },

  computed: {
    zona() {
      return this.status?.zona ?? null;
    },
    temLeitura() {
      return !!this.status?.jaRecebeuLeitura;
    },
    // A caixinha de cima: aguardando, simulação, conectado ou sem sinal.
    estado() {
      const s = this.status;
      if (this.semConexao) return { chave: "sem-sinal", titulo: "Sem conexão com a API", texto: "Não consegui perguntar à API como está o sensor." };
      if (!s || !s.jaRecebeuLeitura) return { chave: "aguardando", titulo: "Aguardando o sensor", texto: "O sensor ainda não mandou nenhuma leitura. Assim que ele for ligado, esta página começa a se mexer sozinha." };
      if (s.ultimaLeitura?.origem === "simulacao") return { chave: "simulacao", titulo: "Modo simulação", texto: "O nível está vindo dos botões de simulação logo abaixo, não do sensor." };
      if (s.conectado) return { chave: "conectado", titulo: "Sensor conectado", texto: "Recebendo leituras ao vivo da maquete." };
      return { chave: "sem-sinal", titulo: "Sensor sem sinal", texto: `A última leitura chegou ${haQuantoTempo(s.ultimaLeituraEm)}. Confira se o ESP32 está ligado e conectado ao Wi-Fi.` };
    },
    // Limites (até a primeira resposta, usamos os da maquete: 12 e 18 cm)
    cotaAtencao() { return this.zona?.cotaAtencao ?? 0.12; },
    cotaAlerta() { return this.zona?.cotaAlerta ?? 0.18; },
    nivelCm() { return this.temLeitura ? this.zona.cotaAtual * 100 : 0; },
    // Tanque: a escala vai até um pouco acima do limite de perigo.
    pctAgua() { return this.pct(this.temLeitura ? this.zona.cotaAtual : 0); },
    pctAtencao() { return this.pct(this.cotaAtencao); },
    pctPerigo() { return this.pct(this.cotaAlerta); },
    situacaoTanque() { return this.temLeitura ? this.zona.status : "tranquilo"; },
    descricaoTanque() {
      return this.temLeitura
        ? `Nível da água na maquete: ${num(this.nivelCm)} centímetros, ${STATUS_LABEL[this.zona.status]}`
        : "Nível da água na maquete: aguardando o sensor";
    },
    distancia() {
      return this.status?.ultimaLeitura ? `${num(this.status.ultimaLeitura.distanciaCm)} cm` : "—";
    },
    ultimaLeitura() {
      return this.status?.ultimaLeituraEm ? formatoHoraSeg.format(new Date(this.status.ultimaLeituraEm)) : "—";
    },
    // Gráfico em SVG, calculado a partir do histórico. O template só desenha.
    grafico() {
      const historico = this.status?.historico ?? [];
      if (historico.length < 2) return null;
      const larg = G.largura - G.esq - G.dir;
      const alt = G.altura - G.topo - G.base;
      const maxCm = this.cotaAlerta * 125;
      const x = (i) => G.esq + (i / (historico.length - 1)) * larg;
      const y = (cm) => G.topo + alt - (Math.min(cm, maxCm) / maxCm) * alt;
      const ultima = historico[historico.length - 1];
      return {
        pontos: historico.map((l, i) => `${x(i).toFixed(1)},${y(l.nivelM * 100).toFixed(1)}`).join(" "),
        y0: y(0),
        referencias: [
          { cm: this.cotaAtencao * 100, cor: "#B97C0C" },
          { cm: this.cotaAlerta * 100, cor: "#C0392B" }
        ].map(r => ({ ...r, y: y(r.cm), rotulo: num(r.cm) })),
        ultimoX: x(historico.length - 1),
        ultimoY: y(ultima.nivelM * 100),
        ultimaCor: STATUS_COR[ultima.status],
        inicio: formatoHoraSeg.format(new Date(historico[0].recebidaEm)),
        fim: formatoHoraSeg.format(new Date(ultima.recebidaEm)),
        quantidade: historico.length
      };
    },
    mensagemGrafico() {
      return (this.status?.historico?.length ?? 0) === 1
        ? "Primeira leitura recebida. O gráfico aparece a partir da segunda."
        : "O gráfico aparece quando chegarem as primeiras leituras.";
    }
  },

  // watch: "fique de olho neste dado". Quando chega leitura nova, a barra
  // da simulação acompanha o nível (menos quando alguém está arrastando).
  watch: {
    status(novo) {
      if (novo?.zona && !this.simulacao.arrastando) {
        this.simulacao.valor = Math.round(novo.zona.cotaAtual * 1000) / 10;
      }
    }
  },

  methods: {
    num(n) {
      return num(n);
    },
    situacaoTexto(status) {
      return STATUS_LABEL[status] ?? status;
    },
    pct(metros) {
      const maximo = this.cotaAlerta * 1.25;
      return Math.max(0, Math.min(100, (metros / maximo) * 100));
    },

    // ---------- Tempo real: pergunta à API como está o sensor ----------
    async buscar() {
      try {
        this.status = await api("/sensor/status?zonaId=maquete-demo");
        this.semConexao = false;
      } catch {
        this.semConexao = true;
      }
    },

    // O app.js chama isto quando a pessoa entra ou sai da aba Sensor.
    definirAtivo(ativo) {
      if (ativo === this.ativo) return;
      this.ativo = ativo;
      clearInterval(this.relogio);
      if (ativo) {
        this.buscar();
        this.relogio = setInterval(this.buscar, 3000); // a cada 3 segundos
      }
    },

    // ---------- Simulação ----------
    async verificarSimulacao() {
      try {
        const s = await api("/simulacao");
        this.simulacao.habilitada = s.habilitada;
        this.simulacao.maximoCm = s.nivelMaximoCm;
      } catch { /* sem API: o painel de simulação fica escondido */ }
    },

    async simular(corpo) {
      try {
        const resposta = await fetch(`${API_BASE}/simulacao/maquete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo)
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(dados.erro || `A API respondeu ${resposta.status}`);
        this.simulacao.erro = "";
        this.status = dados;      // o Vue atualiza tanque, gráfico e textos sozinho
        this.semConexao = false;
        carregarZonas();          // barra de alerta, sininho e resumo do Bolin na hora
      } catch (erro) {
        this.simulacao.erro = `Não consegui simular: ${erro.message}`;
        this.pararChuva();
      }
    },

    mudarAltura(variacaoCm) {
      this.simular({ variacaoCm });
    },
    irParaNivel(nivelCm) {
      this.pararChuva();
      this.simular({ nivelCm });
    },
    soltarBarra() {
      this.simulacao.arrastando = false;
      this.pararChuva();
      this.simular({ nivelCm: this.simulacao.valor });
    },

    comecarChuva(taxa) {
      this.pararChuva();
      this.simulacao.taxa = taxa;
      this.simular({ variacaoCm: taxa });
      this.chuva = setInterval(() => {
        const atual = this.simulacao.valor;
        // para sozinho quando a maquete enche ou seca
        if ((taxa > 0 && atual >= this.simulacao.maximoCm) || (taxa < 0 && atual <= 0)) return this.pararChuva();
        this.simular({ variacaoCm: taxa });
      }, 2000);
    },
    pararChuva() {
      clearInterval(this.chuva);
      this.simulacao.taxa = null;
    }
  },

  mounted() {
    this.verificarSimulacao();
    // Se a página já abriu direto na aba Sensor (ex.: link .../#sensor), liga o
    // tempo real; senão, busca uma vez só, pra aba já abrir com os dados.
    const abaAberta = document.getElementById("tab-sensor").classList.contains("active");
    if (abaAberta) this.definirAtivo(true);
    else this.buscar();
  },

  beforeUnmount() {
    clearInterval(this.relogio);
    clearInterval(this.chuva);
  },

  // O mesmo HTML de antes, agora com as "ligações" do Vue:
  //   {{ }}  mostra um dado       :atributo  liga um atributo a um dado
  //   @click chama um método      v-if / v-for  mostra ou repete partes
  template: `
    <div class="sensor-layout">
      <div class="tanque-card">
        <div class="tanque" :data-status="situacaoTanque" role="img" :aria-label="descricaoTanque">
          <div class="tanque-agua" :style="{ height: pctAgua + '%' }"></div>
          <div class="tanque-linha perigo" :style="{ bottom: pctPerigo + '%' }"><span>Perigo, {{ num(cotaAlerta * 100) }} cm</span></div>
          <div class="tanque-linha atencao" :style="{ bottom: pctAtencao + '%' }"><span>Atenção, {{ num(cotaAtencao * 100) }} cm</span></div>
        </div>
        <div class="tanque-nivel"><span>{{ temLeitura ? num(nivelCm) + ' cm' : '— cm' }}</span> de água</div>
      </div>

      <div class="sensor-info">
        <div class="sensor-estado" :data-estado="estado.chave">
          <span class="sensor-luz" aria-hidden="true"></span>
          <div>
            <strong>{{ estado.titulo }}</strong>
            <p>{{ estado.texto }}</p>
          </div>
        </div>

        <dl class="sensor-dados">
          <div><dt>Situação</dt><dd>
            <span v-if="temLeitura" class="status-pill" :class="zona.status">{{ situacaoTexto(zona.status) }}</span>
            <template v-else>—</template>
          </dd></div>
          <div><dt>Distância medida</dt><dd>{{ distancia }}</dd></div>
          <div><dt>Última leitura</dt><dd>{{ ultimaLeitura }}</dd></div>
          <div><dt>Leituras recebidas</dt><dd>{{ status?.totalLeituras ?? 0 }}</dd></div>
        </dl>

        <div class="grafico-card">
          <h3>Nível nas últimas leituras</h3>
          <div class="sensor-grafico">
            <svg v-if="grafico" :viewBox="'0 0 ' + G.largura + ' ' + G.altura" role="img"
                 :aria-label="'Gráfico do nível da água nas últimas ' + grafico.quantidade + ' leituras'">
              <line :x1="G.esq" :x2="G.largura - G.dir" :y1="grafico.y0" :y2="grafico.y0" stroke="#DCE6EE"/>
              <text :x="G.esq - 6" :y="grafico.y0 + 4" text-anchor="end" font-size="11" fill="#56697A">0 cm</text>
              <template v-for="r in grafico.referencias" :key="r.cor">
                <line :x1="G.esq" :x2="G.largura - G.dir" :y1="r.y" :y2="r.y" :stroke="r.cor" stroke-dasharray="5 5" stroke-width="1.5"/>
                <text :x="G.esq - 6" :y="r.y + 4" text-anchor="end" font-size="11" :fill="r.cor">{{ r.rotulo }}</text>
              </template>
              <polyline :points="grafico.pontos" fill="none" stroke="#1D5A8E" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
              <circle :cx="grafico.ultimoX" :cy="grafico.ultimoY" r="5" :fill="grafico.ultimaCor" stroke="#fff" stroke-width="2"/>
              <text :x="G.esq" :y="G.altura - 6" font-size="11" fill="#56697A">{{ grafico.inicio }}</text>
              <text :x="G.largura - G.dir" :y="G.altura - 6" font-size="11" fill="#56697A" text-anchor="end">{{ grafico.fim }}</text>
            </svg>
            <p v-else class="loading">{{ mensagemGrafico }}</p>
          </div>
        </div>
      </div>
    </div>

    <section v-if="simulacao.habilitada" class="simulacao" aria-labelledby="titulo-simulacao">
      <div class="simulacao-topo">
        <div>
          <h2 id="titulo-simulacao">Simular a água na maquete</h2>
          <p>Enquanto o sensor não está ligado, use os botões para mudar o nível da água. Funciona igual ao sensor de verdade: o tanque, o gráfico, os alertas e os emails reagem na hora.</p>
        </div>
      </div>

      <div class="simulacao-grupos">
        <div class="sim-grupo">
          <h3>Altura da água</h3>
          <div class="sim-altura">
            <button type="button" class="sim-btn" aria-label="Baixar 1 centímetro" @click="mudarAltura(-1)">−1 cm</button>
            <output class="sim-valor">{{ num(simulacao.valor) }} cm</output>
            <button type="button" class="sim-btn" aria-label="Subir 1 centímetro" @click="mudarAltura(1)">+1 cm</button>
          </div>
          <input type="range" class="sim-slider" min="0" :max="simulacao.maximoCm" step="0.5"
                 v-model.number="simulacao.valor" aria-label="Altura da água em centímetros"
                 @input="simulacao.arrastando = true" @change="soltarBarra">
          <div class="sim-atalhos">
            <button v-for="a in atalhos" :key="a.nivel" type="button" class="sim-atalho" :class="a.classe"
                    @click="irParaNivel(a.nivel)">{{ a.nome }}</button>
          </div>
        </div>

        <div class="sim-grupo">
          <h3>Água chegando</h3>
          <p class="sim-ajuda">Escolha quanta chuva está caindo: a água sobe sozinha a cada 2 segundos.</p>
          <div class="sim-chuva" role="group" aria-label="Intensidade da chuva">
            <button v-for="c in opcoesChuva" :key="c.taxa" type="button" class="sim-chuva-btn"
                    :class="{ escoar: c.taxa < 0 }" :aria-pressed="String(simulacao.taxa === c.taxa)"
                    @click="comecarChuva(c.taxa)">{{ c.nome }}<span>{{ c.rotulo }}</span></button>
          </div>
          <button type="button" class="sim-parar" :disabled="simulacao.taxa === null" @click="pararChuva">Parar</button>
        </div>
      </div>
      <p v-if="simulacao.erro" class="sim-erro" role="alert">{{ simulacao.erro }}</p>
    </section>
  `
};

// ===================================================================
// 4. Aba Alagamentos: histórico de alertas
// ===================================================================
const TIPOS_DE_ALERTA = { alagamento: "Alagamento", chuva: "Chuva", temporal: "Temporal" };
const formatoDataHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function quando(dataIso) {
  const d = new Date(dataIso);
  const hoje = new Date().toDateString() === d.toDateString();
  return hoje ? formatoHora.format(d) : formatoDataHora.format(d);
}

function duracao(inicioIso, fimIso) {
  const minutos = Math.max(1, Math.round((new Date(fimIso ?? Date.now()) - new Date(inicioIso)) / 60000));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60), resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

// Componente: um alerta da lista
const ItemAlerta = {
  name: "ItemAlerta",
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
  template: `
    <div class="zone-card alerta-item" :class="[alerta.nivel, { encerrado: !alerta.ativo }]">
      <div>
        <p class="alerta-tipo">{{ tipo }} · {{ alerta.local }}</p>
        <p>{{ alerta.detalhe }}</p>
        <p class="alerta-periodo">{{ periodo }}</p>
      </div>
      <div class="zone-lado">
        <span class="status-pill" :class="alerta.nivel">{{ nivel }}</span>
        <span class="alerta-estado" :class="{ ativo: alerta.ativo }">{{ alerta.ativo ? "Ativo" : "Encerrado" }}</span>
      </div>
    </div>
  `
};

const PainelAlertas = {
  components: { ItemAlerta },

  data() {
    return {
      alertas: [],
      carregou: false,
      erro: false,
      local: "todos",     // filtro por local (select com v-model)
      soAtivos: false,    // "só alertas ativos" (checkbox com v-model)
      ativo: false
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
    }
  },

  methods: {
    async buscar() {
      try {
        this.alertas = await api("/alertas");
        this.carregou = true;
        this.erro = false;
      } catch {
        if (!this.carregou) this.erro = true;
      }
    },
    definirAtivo(ativo) {
      if (ativo === this.ativo) return;
      this.ativo = ativo;
      clearInterval(this.relogio);
      if (ativo) {
        this.buscar();
        this.relogio = setInterval(this.buscar, 10000); // a cada 10 segundos
      }
    },
    limparFiltros() {
      this.local = "todos";
      this.soAtivos = false;
    }
  },

  mounted() {
    this.buscar();
    if (document.getElementById("tab-alagamentos").classList.contains("active")) this.definirAtivo(true);
  },

  beforeUnmount() {
    clearInterval(this.relogio);
  },

  template: `
    <div class="filtro-regioes">
      <label class="filtro-local">
        <span>Local</span>
        <select v-model="local">
          <option value="todos">Todos os locais</option>
          <option v-for="l in locais" :key="l" :value="l">{{ l }}</option>
        </select>
      </label>
      <label class="filtro-ativos">
        <input type="checkbox" v-model="soAtivos">
        Só alertas ativos ({{ quantidadeAtivos }})
      </label>
    </div>

    <p v-if="erro" class="loading">Não foi possível carregar o histórico agora.</p>
    <p v-else-if="!carregou" class="loading">Carregando alertas…</p>
    <div v-else class="zones-list">
      <item-alerta v-for="a in alertasFiltrados" :key="a.id" :alerta="a"></item-alerta>
      <p v-if="alertasFiltrados.length === 0" class="loading">
        <template v-if="alertas.length === 0">Nenhum alerta até agora. Melhor assim!</template>
        <template v-else>Nenhum alerta com esse filtro.
          <button type="button" class="botao-link" @click="limparFiltros">Limpar filtros</button>
        </template>
      </p>
    </div>
  `
};

// ===================================================================
// 5. Barra de pesquisa do topo
// ===================================================================
// Abas e atalhos que a busca conhece (as palavras ajudam a achar por assunto).
const ABAS_DA_BUSCA = [
  { aba: "inicio", titulo: "Início", texto: "Resumo do tempo, notícias de chuva e alagamento por cidade.", palavras: "inicio pagina inicial resumo noticias" },
  { aba: "alagamentos", titulo: "Alagamentos", texto: "Mapa das regiões monitoradas e histórico de alertas.", palavras: "mapa regioes enchente alagamento historico alertas pendentes ativos" },
  { aba: "sensor", titulo: "Sensor", texto: "Nível da água na maquete, em tempo real, e simulação.", palavras: "sensor nivel agua maquete esp32 ultrassonico simulacao tempo real tanque grafico" },
  { aba: "clima", titulo: "Clima", texto: "Temperatura, chuva prevista e previsão dos próximos dias.", palavras: "clima tempo temperatura chuva previsao vento umidade graus" },
  { aba: "riscos", titulo: "Riscos", texto: "Por que é perigoso sair durante um alagamento.", palavras: "riscos perigo perigoso" },
  { aba: "cuidados", titulo: "Cuidados", texto: "O que fazer antes, durante e depois de um alagamento.", palavras: "cuidados dicas prevencao o que fazer" },
  { aba: "ajuda", titulo: "Ajuda e telefones", texto: "Telefones de emergência: Defesa Civil, Bombeiros, SAMU.", palavras: "ajuda telefone telefones emergencia contato ligar" },
  { aba: "bolin", titulo: "Conheça o Bolin", texto: "O mascote do Bolinho de Chuva.", palavras: "bolin mascote bolinho personagem" },
  { aba: "email", titulo: "Receber alertas por email", texto: "Cadastre seu email para receber avisos de chuva, temporal e alagamento.", palavras: "email e-mail alerta alertas aviso notificacao cadastro cadastrar inscrever receber gmail" }
];

const ROTULOS_DA_BUSCA = {
  aba: "Página", regiao: "Região", noticia: "Notícia", risco: "Risco",
  cuidado: "Cuidado", contato: "Telefone", pergunta: "Pergunta ao Bolin"
};

function encurtar(texto, limite = 90) {
  texto = String(texto ?? "");
  return texto.length > limite ? texto.slice(0, texto.lastIndexOf(" ", limite)) + "…" : texto;
}

// Leva a pessoa até um elemento da página e dá um destaque nele por uns segundos.
function destacar(elemento) {
  if (!elemento) return;
  setTimeout(() => {
    elemento.scrollIntoView({ behavior: "smooth", block: "center" });
    elemento.classList.remove("destaque-busca");
    void elemento.offsetWidth;
    elemento.classList.add("destaque-busca");
    setTimeout(() => elemento.classList.remove("destaque-busca"), 2600);
  }, 80);
}

const PainelBusca = {
  data() {
    return {
      termo: "",       // ligado ao campo de busca (v-model)
      aberto: false,
      selecionado: 0,  // resultado marcado pelas setas do teclado
      versao: 0        // muda quando chegam dados novos (notícias, regiões, telefones)
    };
  },

  computed: {
    // Tudo o que dá pra achar. Recalcula quando "versao" muda.
    indice() {
      this.versao; // dependência: dados novos → índice novo
      const itens = [];

      for (const a of ABAS_DA_BUSCA)
        itens.push({ tipo: "aba", titulo: a.titulo, texto: a.texto, palavras: a.palavras, aba: a.aba });

      for (const z of ultimasZonas.filter(z => !z.ehMaquete))
        itens.push({ tipo: "regiao", titulo: z.nome, texto: `${STATUS_LABEL[z.status]} · ${z.observacao}`, palavras: "regiao bairro alagamento", zona: z });

      for (const n of todasAsNoticias)
        itens.push({ tipo: "noticia", titulo: n.titulo, texto: `${n.fonte} · ${haQuantoTempo(n.publicadoEm)}`,
                     palavras: `noticia ${(n.cidades || []).join(" ").replace("ribeirao-preto", "ribeirao preto")}`, link: n.link });

      document.querySelectorAll("#tab-riscos .risk-card").forEach((card, i) =>
        itens.push({ tipo: "risco", titulo: card.querySelector("h3")?.textContent ?? "", texto: card.querySelector("p")?.textContent ?? "", palavras: "risco perigo", indice: i }));

      for (const etapa of ["antes", "durante", "depois"])
        document.querySelectorAll(`#care-${etapa} .tip-card`).forEach((card, i) =>
          itens.push({ tipo: "cuidado", titulo: card.querySelector("strong")?.textContent ?? "", texto: card.querySelector("p")?.textContent ?? "",
                       palavras: `cuidado dica ${etapa}`, etapa, indice: i }));

      ultimosContatos.forEach((c, i) =>
        itens.push({ tipo: "contato", titulo: `${c.nome} — ${c.numero}`, texto: c.descricao, palavras: `telefone ligar emergencia ${c.numero.replace(/\D/g, "")}`, indice: i }));

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

    // Os resultados, recalculados a cada letra digitada. Nada vai pra API.
    resultados() {
      const palavras = semAcento(this.termo).split(/\s+/).filter(p => p.length >= 2);
      if (palavras.length === 0) return [];
      return this.indice
        .filter(item => palavras.every(p => item.busca.includes(p)))
        .map(item => ({ item, pontos: palavras.reduce((t, p) => t + (item.buscaTitulo.includes(p) ? 3 : 1), 0) }))
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, 8)
        .map(r => r.item);
    },

    mostrarLista() {
      return this.aberto && semAcento(this.termo).trim().length >= 2;
    }
  },

  watch: {
    termo() {
      this.aberto = true;
      this.selecionado = 0;
    }
  },

  methods: {
    atualizar() {
      this.versao++;
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
      bolinEstado(document.getElementById("bolin-assistente").dataset.estado === "escondido" ? "escondido" : "espiando");

      switch (item.tipo) {
        case "aba":
          if (item.aba === "email") {
            abrirAba("inicio");
            destacar(document.getElementById("alerta-email"));
            setTimeout(() => document.getElementById("campo-email").focus({ preventScroll: true }), 600);
          } else {
            abrirAba(item.aba);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          break;
        case "regiao":
          abrirAba("alagamentos");
          window.painelRegioes.situacao = "todas";
          window.painelRegioes.busca = item.zona.nome;
          destacar(document.getElementById("app-regioes"));
          break;
        case "noticia":
          window.open(item.link, "_blank", "noopener");
          break;
        case "risco":
          abrirAba("riscos");
          destacar(document.querySelectorAll("#tab-riscos .risk-card")[item.indice]);
          break;
        case "cuidado":
          abrirAba("cuidados");
          document.querySelector(`.care-pill-btn[data-care="${item.etapa}"]`)?.click();
          destacar(document.querySelectorAll(`#care-${item.etapa} .tip-card`)[item.indice]);
          break;
        case "contato":
          abrirAba("ajuda");
          destacar(document.querySelectorAll("#contacts-grid .contact-card")[item.indice]);
          break;
        case "pergunta":
          bolinMostrarPerguntas();
          bolinResponder(item.indice);
          break;
      }
    },

    // Clicou fora da busca: fecha a lista
    cliqueFora(evento) {
      if (!document.getElementById("app-busca").contains(evento.target)) this.aberto = false;
    },
    // Atalho: tecla "/" vai direto pra busca
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
  },

  beforeUnmount() {
    document.removeEventListener("click", this.cliqueFora);
    document.removeEventListener("keydown", this.atalho);
  },

  template: `
    <div class="busca-campo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input ref="campo" v-model="termo" type="search" placeholder="Pesquisar no site (ex.: sensor, 199, Franca)"
             role="combobox" aria-label="Pesquisar no site" aria-autocomplete="list" autocomplete="off"
             :aria-expanded="String(mostrarLista)" aria-controls="busca-resultados"
             :aria-activedescendant="mostrarLista && resultados.length ? 'busca-item-' + selecionado : null"
             @focus="aberto = true" @keydown.down.prevent="mover(1)" @keydown.up.prevent="mover(-1)"
             @keydown.enter.prevent="escolherSelecionado" @keydown.esc="fechar">
    </div>
    <div v-if="mostrarLista" class="busca-resultados">
      <ul v-if="resultados.length" id="busca-resultados" role="listbox" aria-label="Resultados da pesquisa">
        <li v-for="(item, i) in resultados" :key="item.id" :id="'busca-item-' + i" role="option"
            :aria-selected="String(i === selecionado)" :class="{ selecionado: i === selecionado }"
            @mousedown.prevent="abrir(item)" @mouseenter="selecionado = i">
          <span class="busca-rotulo">{{ item.rotulo }}</span>
          <strong>{{ item.titulo }}</strong>
          <span class="busca-resumo">{{ item.resumo }}</span>
        </li>
      </ul>
      <p v-else class="busca-vazio">Nada encontrado para “{{ termo.trim() }}”. Tente: chuva, sensor, 199, leptospirose ou Franca.</p>
    </div>
  `
};

// ===================================================================
// Liga os painéis nos lugares deles da página (index.html)
// ===================================================================
window.painelRegioes = Vue.createApp(PainelRegioes).mount("#app-regioes");
window.painelSensor = Vue.createApp(PainelSensor).mount("#app-sensor");
window.painelAlertas = Vue.createApp(PainelAlertas).mount("#app-alertas");
window.painelBusca = Vue.createApp(PainelBusca).mount("#app-busca");
