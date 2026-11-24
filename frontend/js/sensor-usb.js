// =============================================================================
// Sensor do Breno pelo cabo USB  (página Sensor)
// =============================================================================
// O Arduino do Breno escreve no cabo USB, duas vezes por segundo, linhas assim:
//
//     Distancia: 15.2 cm
//
// Este arquivo usa a "Web Serial" do Google Chrome / Microsoft Edge para ler
// essas linhas e, a cada 1 segundo, manda a distância para a nossa API:
//
//     POST /api/sensor-leitura   { zonaId, distanciaCm, alturaInstalacaoM }
//
// Daí pra frente é igual a qualquer leitura do sensor: a API calcula o nível
// (altura do sensor − distância) e o tanque, o gráfico, a barra vermelha e os
// emails de alerta reagem sozinhos.
//
// Código do Arduino: sensor/arduino/sensor_breno/sensor_breno.ino
// =============================================================================

const ZONA_DA_MAQUETE = "maquete-demo";   // a zona da maquete (Data/ZonasIniciais.cs)
const VELOCIDADES = [9600, 115200];       // 9600 = Serial.begin(9600) do Breno; se chegar
                                          // texto embaralhado, o site tenta 115200 sozinho
const ENVIAR_A_CADA_MS = 1000;            // manda 1 leitura por segundo para a API
const ALTURA_PADRAO_CM = 28;              // altura do sensor até o fundo, se ninguém mudar
const CHAVE_ALTURA = "bolinho-altura-sensor-cm";

// Chips USB das placas tipo Arduino. A lista do Chrome mostra SÓ portas com
// esses chips (assim não aparece Bluetooth nem a COM1 do computador).
const CHIPS_USB = {
  0x2341: "Arduino", 0x2A03: "Arduino", 0x1A86: "CH340", 0x10C4: "CP210x",
  0x0403: "FTDI", 0x067B: "PL2303", 0x303A: "ESP32", 0x239A: "Adafruit",
  0x1B4F: "SparkFun", 0x2E8A: "Raspberry Pi Pico", 0x16C0: "Teensy", 0x0483: "STM32"
};
const FILTROS_USB = Object.keys(CHIPS_USB).map(id => ({ usbVendorId: Number(id) }));

// Tudo o que a conexão precisa lembrar
const USB = {
  porta: null,          // a porta USB escolhida
  leitor: null,         // quem lê o texto que chega pelo cabo
  tubo: null,           // liga a porta ao leitor (precisa terminar antes de fechar a porta)
  fimDaLeitura: null,   // promessa que termina quando a leitura para
  relogio: null,        // setInterval que manda as leituras
  distancias: [],       // distâncias que chegaram desde o último envio
  ultimaDistancia: null,
  ultimaChegada: 0,     // quando chegou a última distância (ms)
  semEco: 0,            // quantas linhas "Sem eco" seguidas
  velocidade: VELOCIDADES[0],
  abertoEm: 0,          // quando a porta foi aberta (ms)
  bytes: 0,             // quanto texto chegou desde que abriu (para achar problemas)
  reconhecidas: 0,      // linhas que o site entendeu (distância ou "Sem eco")
  ultimaLinha: "",      // a última linha que chegou, do jeito que veio
  chip: null,           // nome do chip USB da porta (null = não é USB)
  enviando: false,
  saindo: false         // true quando NÓS mandamos desconectar
};

function usbEl(id) { return document.getElementById(id); }

// Luzinha + texto do cartão. estado: desligado | conectado | aviso | erro
function usbMostrar(estado, texto) {
  usbEl("usb-sensor").dataset.estado = estado;
  usbEl("usb-status").textContent = texto;
}

function usbBotoes(conectado) {
  usbEl("usb-conectar").hidden = conectado;
  usbEl("usb-todas").hidden = conectado;
  usbEl("usb-desconectar").hidden = !conectado;
  usbEl("usb-calibrar").disabled = !conectado || USB.ultimaDistancia === null;
}

// ---------- Altura do sensor (fica guardada neste navegador) ----------
function usbAlturaCm() {
  const valor = parseFloat(String(usbEl("usb-altura").value).replace(",", "."));
  return valor > 0 && valor <= 400 ? valor : null;
}

function usbGuardarAltura() {
  const altura = usbAlturaCm();
  if (altura === null) return;
  try { localStorage.setItem(CHAVE_ALTURA, String(altura)); } catch { /* tudo bem */ }
}

function usbCarregarAltura() {
  let altura = ALTURA_PADRAO_CM;
  try {
    const guardada = parseFloat(localStorage.getItem(CHAVE_ALTURA));
    if (guardada > 0) altura = guardada;
  } catch { /* tudo bem */ }
  usbEl("usb-altura").value = altura;
}

// Com a maquete VAZIA, a distância medida é a própria altura do sensor.
function usbCalibrar() {
  if (USB.ultimaDistancia === null) return;
  usbEl("usb-altura").value = Math.round(USB.ultimaDistancia * 2) / 2;   // de meio em meio cm
  usbGuardarAltura();
  usbMostrar("conectado", `Pronto! Altura do sensor: ${num(usbAlturaCm())} cm. Agora a água começa do zero.`);
}

// ---------- Conectar ----------
// todas = false: a lista mostra só placas USB tipo Arduino. true: mostra todas as portas.
async function usbConectar(todas = false) {
  try {
    const porta = await navigator.serial.requestPort(todas ? {} : { filters: FILTROS_USB });   // o Chrome mostra a lista
    await usbAbrir(porta);
  } catch (erro) {
    if (erro.name === "NotFoundError") {
      usbMostrar("desligado", todas
        ? "Nenhuma porta escolhida. Confira se o cabo USB está bem encaixado e clique em “Conectar sensor”."
        : "Nenhuma porta escolhida. Se o Arduino não apareceu na lista, clique em “Mostrar todas as portas”.");
    } else {
      usbMostrar("erro", usbMensagemDeErro(erro));
    }
  }
}

async function usbAbrir(porta, velocidade = VELOCIDADES[0]) {
  usbMostrar("aviso", "Conectando ao Arduino…");
  await porta.open({ baudRate: velocidade });
  // Liga os sinais DTR/RTS, como o Monitor Serial faz: algumas placas
  // (Leonardo, ESP32) só mandam texto ou só rodam o código com eles assim.
  try { await porta.setSignals({ dataTerminalReady: true, requestToSend: true }); } catch { /* tudo bem */ }
  USB.porta = porta;
  USB.velocidade = velocidade;
  USB.abertoEm = Date.now();
  USB.bytes = 0;
  USB.reconhecidas = 0;
  USB.ultimaLinha = "";
  USB.saindo = false;
  USB.distancias = [];
  USB.ultimaDistancia = null;
  USB.ultimaChegada = Date.now();
  USB.semEco = 0;
  usbBotoes(true);
  const info = typeof porta.getInfo === "function" ? porta.getInfo() : {};
  USB.chip = info.usbVendorId ? (CHIPS_USB[info.usbVendorId] || "USB") : null;
  usbMostrar("conectado", `Conectado${USB.chip ? " (" + USB.chip + ")" : ""}! Esperando a primeira medida do Arduino…`);
  USB.fimDaLeitura = usbLer();
  USB.relogio = setInterval(usbEnviar, ENVIAR_A_CADA_MS);
}

function usbMensagemDeErro(erro) {
  if (erro && (erro.name === "NetworkError" || erro.name === "InvalidStateError")) {
    return "Não consegui abrir a porta. Feche o Monitor Serial do Arduino IDE (ele prende a porta) e clique em “Conectar sensor” de novo.";
  }
  return "Não consegui conectar: " + (erro && erro.message ? erro.message : "erro desconhecido") + ".";
}

// ---------- Ler o que chega pelo cabo ----------
async function usbLer() {
  const decodificador = new TextDecoderStream();
  const tubo = USB.porta.readable.pipeTo(decodificador.writable).catch(() => {});
  USB.tubo = tubo;
  USB.leitor = decodificador.readable.getReader();
  let resto = "";
  try {
    while (true) {
      const { value, done } = await USB.leitor.read();
      if (done) break;
      USB.bytes += value.length;
      resto += value;
      const linhas = resto.split(/\r?\n/);
      resto = linhas.pop();                 // a última pode estar pela metade
      linhas.forEach(usbLinha);
      if (resto.length > 300) resto = "";   // lixo sem fim de linha
    }
  } catch {
    /* o cabo foi tirado: cai no "finally" */
  } finally {
    try { USB.leitor.releaseLock(); } catch { /* tudo bem */ }
    await tubo;
  }
  if (!USB.saindo) {
    await usbFechar();
    usbMostrar("erro", "O Arduino foi desconectado. Ligue o cabo de novo e clique em “Conectar sensor”.");
  }
}

// Uma linha do Arduino. Aceita "Distancia: 15.2 cm", "15.2 cm" ou só "15.2".
function usbLinha(linha) {
  const limpa = linha.replace(/[^\x20-\x7E\u00C0-\u00FF]/g, "?").trim();
  if (limpa) USB.ultimaLinha = limpa.slice(0, 60);
  if (/sem eco/i.test(linha)) {
    USB.semEco++;
    USB.reconhecidas++;
    return;
  }
  const achou = linha.match(/(-?\d+(?:[.,]\d+)?)\s*cm/i) || linha.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*$/);
  if (!achou) return;
  const distancia = parseFloat(achou[1].replace(",", "."));
  if (!(distancia > 0 && distancia <= 500)) return;
  USB.reconhecidas++;
  USB.distancias.push(distancia);
  USB.ultimaDistancia = distancia;
  USB.ultimaChegada = Date.now();
  USB.semEco = 0;
  usbEl("usb-calibrar").disabled = false;
}

// Chegou texto que o site não entende: tenta a próxima velocidade da lista.
async function usbTrocarVelocidade() {
  const proxima = VELOCIDADES[VELOCIDADES.indexOf(USB.velocidade) + 1];
  if (!proxima) {
    usbMostrar("aviso", `Chegou texto do Arduino, mas não é a distância: “${USB.ultimaLinha || "texto embaralhado"}”. Confira se o código do Breno está gravado na placa (ele escreve “Distancia: … cm”).`);
    return;
  }
  const porta = USB.porta;
  USB.saindo = true;
  await usbFechar();
  await USB.fimDaLeitura;
  try {
    await usbAbrir(porta, proxima);
    usbMostrar("aviso", `O texto chegou embaralhado. Tentando a velocidade ${proxima}…`);
  } catch (erro) {
    usbMostrar("erro", usbMensagemDeErro(erro));
  }
}

// A do meio (mediana): tira os "pulos" da água balançando
function usbMediana(valores) {
  const v = [...valores].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

// ---------- Mandar para a API (a cada 1 segundo) ----------
async function usbEnviar() {
  if (USB.enviando || !USB.porta) return;

  if (USB.distancias.length === 0) {
    const parado = (Date.now() - USB.ultimaChegada) / 1000;
    const desdeQueAbriu = (Date.now() - USB.abertoEm) / 1000;
    if (USB.reconhecidas === 0) {
      if (USB.bytes > 0 && desdeQueAbriu > 4) {
        await usbTrocarVelocidade();          // chegou texto, mas embaralhado
      } else if (USB.bytes === 0 && desdeQueAbriu > 6) {
        usbMostrar("aviso", USB.chip
          ? `A porta é de uma placa USB (${USB.chip}), mas não chegou nada por ela. Grave de novo o código do Breno na placa (Arduino IDE → Carregar) e veja no Monitor Serial, em 9600, se aparece “Distancia: … cm”. Depois feche o Monitor Serial e clique em “Desconectar” e “Conectar sensor”.`
          : "Essa porta não é a do Arduino (não é USB: deve ser Bluetooth ou a COM1 do computador). Clique em “Desconectar”, depois em “Conectar sensor”, e escolha a porta do Arduino.");
      }
      return;
    }
    if (USB.semEco >= 3) {
      usbMostrar("aviso", "O sensor está conectado, mas não ouve o eco. Aponte o sensor reto para a água (ou para o fundo da maquete).");
    } else if (parado > 5) {
      usbMostrar("aviso", "Conectado, mas o Arduino não está mandando a distância. Confira se o código do Breno está gravado na placa.");
    }
    return;
  }

  const altura = usbAlturaCm();
  if (altura === null) {
    usbMostrar("aviso", "Preencha a altura do sensor até o fundo da maquete (em cm).");
    return;
  }

  const distancia = Math.round(usbMediana(USB.distancias) * 10) / 10;
  USB.distancias = [];
  USB.enviando = true;
  try {
    const resposta = await fetch(API_BASE + "/sensor-leitura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zonaId: ZONA_DA_MAQUETE, distanciaCm: distancia, alturaInstalacaoM: altura / 100 })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || "a API respondeu " + resposta.status);

    const agua = Math.max(0, altura - distancia);
    usbMostrar("conectado", `Conectado · distância ${num(distancia)} cm · água ${num(agua)} cm`);
    // Avisa o painel (js/sensor.js) para atualizar o tanque e o gráfico na hora
    window.dispatchEvent(new CustomEvent("leitura-do-sensor"));
  } catch (erro) {
    usbMostrar("erro", "O Arduino está lendo, mas não consegui mandar para o site: " + erro.message + ". Confira a internet.");
  } finally {
    USB.enviando = false;
  }
}

// ---------- Desconectar ----------
async function usbFechar() {
  clearInterval(USB.relogio);
  USB.relogio = null;
  const porta = USB.porta;
  USB.porta = null;
  if (USB.leitor) {
    try { await USB.leitor.cancel(); } catch { /* tudo bem */ }
  }
  if (USB.tubo) await USB.tubo;   // espera a porta ficar livre
  if (porta) {
    try { await porta.close(); } catch { /* já estava fechada */ }
  }
  USB.leitor = null;
  usbBotoes(false);
}

async function usbDesconectar() {
  USB.saindo = true;
  await usbFechar();
  await USB.fimDaLeitura;
  usbMostrar("desligado", "Sensor desconectado. Clique em “Conectar sensor” para ligar de novo.");
}

// ---------- Quando a página abre ----------
document.addEventListener("DOMContentLoaded", () => {
  if (!usbEl("usb-sensor")) return;
  usbCarregarAltura();
  usbEl("usb-altura").addEventListener("change", usbGuardarAltura);
  usbEl("usb-calibrar").addEventListener("click", usbCalibrar);
  usbEl("usb-desconectar").addEventListener("click", usbDesconectar);

  if (!("serial" in navigator)) {
    usbEl("usb-conectar").disabled = true;
    usbEl("usb-todas").hidden = true;
    usbMostrar("erro", "Este navegador não conecta no cabo USB. Abra o site no Google Chrome ou no Microsoft Edge, no computador.");
    return;
  }

  usbEl("usb-conectar").addEventListener("click", () => usbConectar(false));
  usbEl("usb-todas").addEventListener("click", () => usbConectar(true));

  // Se este computador já deu permissão para o Arduino antes, conecta sozinho.
  navigator.serial.getPorts().then(portas => {
    if (portas.length === 1 && !USB.porta) {
      usbAbrir(portas[0]).catch(() =>
        usbMostrar("desligado", "Ligue o Arduino no cabo USB e clique em “Conectar sensor”."));
    }
  }).catch(() => { /* tudo bem: usa o botão */ });
});
