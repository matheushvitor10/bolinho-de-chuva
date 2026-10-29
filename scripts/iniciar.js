// ============================================================================
// Roda no "npm start": liga a API (back-end, C#) e o site (front-end) juntos,
// e abre o navegador quando os dois estiverem prontos.
//
//   npm start       → API só no seu computador (uso normal)
//   npm run rede    → API aberta na rede Wi-Fi (para o ESP32 conseguir mandar dados)
//
// Para desligar: Ctrl + C no terminal.
// ============================================================================

const { spawn, spawnSync, exec } = require("child_process");
const path = require("path");
const readline = require("readline");
const { encontrarDotnet, RAIZ, EH_WINDOWS } = require("./dotnet");

const MODO_REDE = process.argv.includes("--rede");
const URL_SITE = "http://localhost:5500";
const URL_API = "http://localhost:5080";

const dotnet = encontrarDotnet();
if (!dotnet) {
  console.error('\n[ERRO] Não achei o .NET 8. Rode "npm install" primeiro (ele instala o que falta).\n');
  process.exit(1);
}

const cores = { API: "\x1b[36m", SITE: "\x1b[35m", fim: "\x1b[0m" };
const processos = [];
const prontos = new Set();
let encerrando = false;

function iniciar(nome, args) {
  const filho = spawn(dotnet.comando, args, {
    cwd: RAIZ,
    env: { ...dotnet.env, ASPNETCORE_ENVIRONMENT: "Development" },
    detached: !EH_WINDOWS // no Linux/Mac, permite desligar o grupo inteiro de processos
  });
  processos.push(filho);

  const prefixo = `${cores[nome]}[${nome}]${cores.fim}`;
  for (const fluxo of [filho.stdout, filho.stderr]) {
    readline.createInterface({ input: fluxo }).on("line", linha => {
      console.log(`${prefixo} ${linha}`);

      if (/Now listening on/i.test(linha)) {
        prontos.add(nome);
        if (prontos.size === 2) quandoTudoEstiverPronto();
      }
      if (/address already in use|EADDRINUSE|10048/i.test(linha)) {
        console.log(`${prefixo} A porta já está sendo usada. Talvez o sistema já esteja ligado em outro terminal — feche ele e rode "npm start" de novo.`);
      }
    });
  }

  filho.on("exit", codigo => {
    if (!encerrando) {
      console.log(`${prefixo} parou (código ${codigo}). Desligando o resto…`);
      desligar(1);
    }
  });
}

function quandoTudoEstiverPronto() {
  console.log("\n" + "=".repeat(60));
  console.log("  Bolinho de Chuva está no ar!");
  console.log(`  Site: ${URL_SITE}`);
  console.log(`  API:  ${URL_API}`);
  console.log(`  Configurar emails: ${URL_SITE}/config.html`);
  if (MODO_REDE) console.log("  Modo rede: o ESP32 pode mandar dados para o IP deste computador, porta 5080.");
  console.log("  Para desligar: Ctrl + C");
  console.log("=".repeat(60) + "\n");
  abrirNavegador(URL_SITE);
}

function abrirNavegador(url) {
  const comando = EH_WINDOWS ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(comando, () => { /* se não conseguir abrir, a pessoa usa o link mostrado acima */ });
}

function desligar(codigo = 0) {
  if (encerrando) return;
  encerrando = true;
  for (const filho of processos) {
    if (filho.exitCode !== null) continue;
    try {
      // "dotnet run" abre outro processo por baixo; precisamos desligar os dois,
      // senão as portas 5080/5500 continuam ocupadas.
      if (EH_WINDOWS) spawnSync("taskkill", ["/pid", String(filho.pid), "/T", "/F"], { stdio: "ignore" });
      else process.kill(-filho.pid, "SIGTERM");
    } catch { /* já tinha parado */ }
  }
  setTimeout(() => process.exit(codigo), 500);
}

process.on("SIGINT", () => { console.log("\nDesligando o Bolinho de Chuva…"); desligar(0); });
process.on("SIGTERM", () => desligar(0));

console.log("\nLigando o Bolinho de Chuva (na primeira vez demora um pouco mais)…\n");

const perfilApi = MODO_REDE ? "API-rede" : "API-local";
iniciar("API", ["run", "--project", path.join("backend", "BolinhoDeChuva.Api"), "--launch-profile", perfilApi]);
iniciar("SITE", ["run", "--project", path.join("frontend", "BolinhoDeChuva.Web")]);
