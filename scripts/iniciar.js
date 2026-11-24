// ============================================================================
// "npm start" — liga o Bolinho de Chuva e abre o navegador.
//
//   npm start       → o sistema só no seu computador (uso normal)
//   npm run rede    → aberto na rede Wi-Fi (para o ESP32 conseguir mandar dados)
//
// É UM programa só (a pasta backend, em C#): ele entrega o site (a pasta
// frontend) e responde a API. Tudo em http://localhost:5080
// Para desligar: Ctrl + C no terminal.
// ============================================================================

const { spawn, spawnSync, exec } = require("child_process");
const path = require("path");
const readline = require("readline");
const { encontrarDotnet, RAIZ, EH_WINDOWS } = require("./dotnet");

const MODO_REDE = process.argv.includes("--rede");
const ENDERECO = "http://localhost:5080";

const dotnet = encontrarDotnet();
if (!dotnet) {
  console.error('\n[ERRO] Não achei o .NET 8. Rode "npm install" primeiro (ele instala o que falta).\n');
  process.exit(1);
}

console.log("\nLigando o Bolinho de Chuva (na primeira vez demora um pouco mais)…\n");

const perfil = MODO_REDE ? "API-rede" : "API-local";
const programa = spawn(dotnet.comando, ["run", "--project", "backend", "--launch-profile", perfil], {
  cwd: RAIZ,
  env: { ...dotnet.env, ASPNETCORE_ENVIRONMENT: "Development" },
  detached: !EH_WINDOWS // no Linux/Mac, permite desligar o grupo inteiro de processos
});

let encerrando = false;

for (const fluxo of [programa.stdout, programa.stderr]) {
  readline.createInterface({ input: fluxo }).on("line", linha => {
    console.log(linha);
    if (/Now listening on/i.test(linha)) avisarQueEstaNoAr();
    if (/address already in use|EADDRINUSE|10048/i.test(linha)) {
      console.log('A porta 5080 já está sendo usada. Talvez o sistema já esteja ligado em outro terminal — feche ele e rode "npm start" de novo.');
    }
  });
}

programa.on("exit", codigo => {
  if (!encerrando) {
    console.log(`O sistema parou (código ${codigo}).`);
    process.exit(1);
  }
});

let jaAvisou = false;
function avisarQueEstaNoAr() {
  if (jaAvisou) return;
  jaAvisou = true;
  console.log("\n" + "=".repeat(60));
  console.log("  Bolinho de Chuva está no ar!");
  console.log(`  Site:              ${ENDERECO}`);
  console.log(`  API:               ${ENDERECO}/api`);
  console.log(`  Configurar emails: ${ENDERECO}/configuracao.html`);
  if (MODO_REDE) console.log("  Modo rede: o ESP32 pode mandar dados para o IP deste computador, porta 5080.");
  console.log("  Para desligar: Ctrl + C");
  console.log("=".repeat(60) + "\n");
  const comando = EH_WINDOWS ? `start "" "${ENDERECO}"` : process.platform === "darwin" ? `open "${ENDERECO}"` : `xdg-open "${ENDERECO}"`;
  exec(comando, () => { /* se não conseguir abrir, a pessoa usa o link mostrado acima */ });
}

function desligar() {
  if (encerrando) return;
  encerrando = true;
  console.log("\nDesligando o Bolinho de Chuva…");
  try {
    // "dotnet run" abre outro processo por baixo; precisamos desligar os dois,
    // senão a porta 5080 continua ocupada.
    if (EH_WINDOWS) spawnSync("taskkill", ["/pid", String(programa.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-programa.pid, "SIGTERM");
  } catch { /* já tinha parado */ }
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", desligar);
process.on("SIGTERM", desligar);
