// ===================================================================
// sensor.js — página Sensor (sensor.html)       → Vue.js (Options API)
// -------------------------------------------------------------------
// Mostra o nível da água da maquete EM TEMPO REAL: a cada 3 segundos
// pergunta à API como está o sensor e o Vue atualiza o tanque, os
// números e o gráfico sozinho, sem recarregar a página.
// Também tem a simulação (botões para mudar o nível da água).
//
// O HTML do painel fica no sensor.html, dentro de <div id="app-sensor">.
// ===================================================================

const PainelSensor = {

  // ---------- data(): os dados do painel ----------
  data() {
    return {
      status: null,          // resposta de GET /api/sensor/status
      semConexao: false,
      simulacao: {
        habilitada: false,
        maximoCm: 25,
        valor: 0,            // ligado à barra de arrastar (v-model)
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
      ]
    };
  },

  // ---------- computed: tudo o que a tela mostra, calculado do status ----------
  computed: {
    zona() { return this.status?.zona ?? null; },
    temLeitura() { return !!this.status?.jaRecebeuLeitura; },

    // A caixinha de cima: aguardando, simulação, conectado ou sem sinal
    estado() {
      const s = this.status;
      if (this.semConexao) return { chave: "sem-sinal", titulo: "Sem conexão com a API", texto: "Não consegui perguntar à API como está o sensor." };
      if (!s || !s.jaRecebeuLeitura) return { chave: "aguardando", titulo: "Aguardando o sensor", texto: "O sensor ainda não mandou nenhuma leitura. Assim que ele for ligado, esta página começa a se mexer sozinha." };
      if (s.ultimaLeitura?.origem === "simulacao") return { chave: "simulacao", titulo: "Modo simulação", texto: "O nível está vindo dos botões de simulação logo abaixo, não do sensor." };
      if (s.conectado) return { chave: "conectado", titulo: "Sensor conectado", texto: "Recebendo leituras ao vivo da maquete." };
      return { chave: "sem-sinal", titulo: "Sensor sem sinal", texto: `A última leitura chegou ${haQuantoTempo(s.ultimaLeituraEm)}. Confira se o ESP32 está ligado e conectado ao Wi-Fi.` };
    },

    // Limites da maquete (até chegar a primeira resposta: 12 e 18 cm)
    cotaAtencao() { return this.zona?.cotaAtencao ?? 0.12; },
    cotaAlerta() { return this.zona?.cotaAlerta ?? 0.18; },
    nivelCm() { return this.temLeitura ? this.zona.cotaAtual * 100 : 0; },
    nivelTexto() { return this.temLeitura ? `${num(this.nivelCm)} cm` : "— cm"; },

    // Tanque: altura da água e das linhas (a escala vai um pouco acima do perigo)
    pctAgua() { return this.pct(this.temLeitura ? this.zona.cotaAtual : 0); },
    pctAtencao() { return this.pct(this.cotaAtencao); },
    pctPerigo() { return this.pct(this.cotaAlerta); },
    situacaoTanque() { return this.temLeitura ? this.zona.status : "tranquilo"; },
    descricaoTanque() {
      return this.temLeitura
        ? `Nível da água na maquete: ${num(this.nivelCm)} centímetros, ${STATUS_LABEL[this.zona.status]}`
        : "Nível da água na maquete: aguardando o sensor";
    },
    rotuloAtencao() { return `Atenção, ${num(this.cotaAtencao * 100)} cm`; },
    rotuloPerigo() { return `Perigo, ${num(this.cotaAlerta * 100)} cm`; },

    distancia() { return this.status?.ultimaLeitura ? `${num(this.status.ultimaLeitura.distanciaCm)} cm` : "—"; },
    ultimaLeitura() { return this.status?.ultimaLeituraEm ? formatoHoraSeg.format(new Date(this.status.ultimaLeituraEm)) : "—"; },
    totalLeituras() { return this.status?.totalLeituras ?? 0; },

    // Gráfico (SVG de 640 x 180): o computed calcula os pontos, o HTML só desenha.
    grafico() {
      const historico = this.status?.historico ?? [];
      if (historico.length < 2) return null;
      const L = 640, A = 180, esq = 44, dir = 12, topo = 10, base = 26;
      const larg = L - esq - dir, alt = A - topo - base;
      const maxCm = this.cotaAlerta * 125;
      const x = (i) => esq + (i / (historico.length - 1)) * larg;
      const y = (cm) => topo + alt - (Math.min(cm, maxCm) / maxCm) * alt;
      const ultima = historico[historico.length - 1];
      return {
        esq, dir: L - dir, rodape: A - 6,
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
        descricao: `Gráfico do nível da água nas últimas ${historico.length} leituras`
      };
    },
    mensagemGrafico() {
      return (this.status?.historico?.length ?? 0) === 1
        ? "Primeira leitura recebida. O gráfico aparece a partir da segunda."
        : "O gráfico aparece quando chegarem as primeiras leituras.";
    }
  },

  // ---------- watch: quando chega leitura nova, a barra acompanha o nível ----------
  watch: {
    status(novo) {
      if (novo?.zona && !this.simulacao.arrastando) {
        this.simulacao.valor = Math.round(novo.zona.cotaAtual * 1000) / 10;
      }
    }
  },

  // ---------- methods: as funções do painel ----------
  methods: {
    num(n) { return num(n); },
    situacaoTexto(status) { return STATUS_LABEL[status] ?? status; },
    pct(metros) {
      const maximo = this.cotaAlerta * 1.25;
      return Math.max(0, Math.min(100, (metros / maximo) * 100));
    },

    // Tempo real: pergunta à API como está o sensor (GET /api/sensor/status)
    async buscar() {
      try {
        this.status = await api("/sensor/status?zonaId=maquete-demo");
        this.semConexao = false;
      } catch {
        this.semConexao = true;
      }
    },

    // Chegou leitura do cabo USB: busca o sensor e as regiões sem esperar os 3 segundos
    aoChegarLeitura() {
      this.buscar();
      carregarZonas();
    },

    // A simulação está ligada? (GET /api/simulacao)
    async verificarSimulacao() {
      try {
        const s = await api("/simulacao");
        this.simulacao.habilitada = s.habilitada;
        this.simulacao.maximoCm = s.nivelMaximoCm;
      } catch { /* sem API: o painel de simulação fica escondido */ }
    },

    // Manda um nível simulado (POST /api/simulacao/maquete)
    async simular(corpo) {
      try {
        const resposta = await fetch(API_BASE + "/simulacao/maquete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo)
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(dados.erro || `A API respondeu ${resposta.status}`);
        this.simulacao.erro = "";
        this.status = dados;      // o Vue atualiza tanque, gráfico e textos sozinho
        this.semConexao = false;
        carregarZonas();          // barra vermelha e sininho na hora (comum.js)
      } catch (erro) {
        this.simulacao.erro = `Não consegui simular: ${erro.message}`;
        this.pararChuva();
      }
    },

    mudarAltura(variacaoCm) { this.simular({ variacaoCm }); },
    irParaNivel(nivelCm) { this.pararChuva(); this.simular({ nivelCm }); },
    soltarBarra() {
      this.simulacao.arrastando = false;
      this.pararChuva();
      this.simular({ nivelCm: this.simulacao.valor });
    },

    // Chuva automática: a água sobe (ou desce) sozinha a cada 2 segundos
    comecarChuva(taxa) {
      this.pararChuva();
      this.simulacao.taxa = taxa;
      this.simular({ variacaoCm: taxa });
      this.chuva = setInterval(() => {
        const atual = this.simulacao.valor;
        if ((taxa > 0 && atual >= this.simulacao.maximoCm) || (taxa < 0 && atual <= 0)) return this.pararChuva();
        this.simular({ variacaoCm: taxa });
      }, 2000);
    },
    pararChuva() {
      clearInterval(this.chuva);
      this.simulacao.taxa = null;
    }
  },

  // ---------- mounted: liga o tempo real quando a página abre ----------
  mounted() {
    this.verificarSimulacao();
    this.buscar();
    this.relogio = setInterval(this.buscar, 3000);       // sensor: a cada 3 segundos
    this.relogioRegioes = setInterval(carregarZonas, 3000); // barra vermelha e sininho em dia
    // O Arduino do Breno (js/sensor-usb.js) avisa quando manda uma leitura: atualiza na hora
    window.addEventListener("leitura-do-sensor", this.aoChegarLeitura);
  },
  beforeUnmount() {
    window.removeEventListener("leitura-do-sensor", this.aoChegarLeitura);
    clearInterval(this.relogio);
    clearInterval(this.relogioRegioes);
    clearInterval(this.chuva);
  }
};

// Liga o painel na <div id="app-sensor"> do sensor.html
Vue.createApp(PainelSensor).mount("#app-sensor");
