// ============================================================================
// "npm run simulador" — finge ser o sensor (ESP32) enquanto o hardware não
// está pronto. Rode em OUTRO terminal, com o "npm start" já ligado.
// ============================================================================

const { spawn } = require("child_process");
const path = require("path");
const { encontrarDotnet, RAIZ } = require("./dotnet");

const dotnet = encontrarDotnet();
if (!dotnet) {
  console.error('\n[ERRO] Não achei o .NET 8. Rode "npm install" primeiro.\n');
  process.exit(1);
}

const filho = spawn(dotnet.comando,
  ["run", "--project", path.join("sensor", "SensorSimulator"), "--", ...process.argv.slice(2)],
  { cwd: RAIZ, env: dotnet.env, stdio: "inherit" });

filho.on("exit", codigo => process.exit(codigo ?? 0));
