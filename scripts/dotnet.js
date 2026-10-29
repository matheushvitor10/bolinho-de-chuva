// ============================================================================
// Ajudante: encontra o .NET (o programa que roda o C#).
// Primeiro procura o .NET instalado neste projeto (pasta .dotnet, criada pelo
// "npm install"); se não tiver, procura um .NET já instalado no computador.
// ============================================================================

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const RAIZ = path.join(__dirname, "..");
const PASTA_DOTNET_LOCAL = path.join(RAIZ, ".dotnet");
const EH_WINDOWS = process.platform === "win32";
const VERSAO_MINIMA = 8;

function ambienteBase(extra = {}) {
  return {
    ...process.env,
    DOTNET_NOLOGO: "1",
    DOTNET_CLI_TELEMETRY_OPTOUT: "1",
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
    ...extra
  };
}

// Devolve a maior versão "principal" de SDK (8, 9...) que esse dotnet tem, ou 0.
function versaoDoSdk(comando, env) {
  const r = spawnSync(comando, ["--list-sdks"], { env, encoding: "utf8", shell: false });
  if (r.error || r.status !== 0 || !r.stdout) return 0;
  const versoes = r.stdout
    .split(/\r?\n/)
    .map(l => parseInt(l.trim().split(".")[0], 10))
    .filter(n => !Number.isNaN(n));
  return versoes.length ? Math.max(...versoes) : 0;
}

// Confere se esse dotnet consegue RODAR um site (ASP.NET Core 8 ou mais novo).
function temRuntimeWeb(comando, env) {
  const r = spawnSync(comando, ["--list-runtimes"], { env, encoding: "utf8", shell: false });
  if (r.error || r.status !== 0 || !r.stdout) return false;
  return r.stdout.split(/\r?\n/).some(l => {
    const m = l.match(/^Microsoft\.AspNetCore\.App (\d+)\./);
    return m && parseInt(m[1], 10) >= VERSAO_MINIMA;
  });
}

function serve(comando, env) {
  return versaoDoSdk(comando, env) >= VERSAO_MINIMA && temRuntimeWeb(comando, env);
}

function dotnetLocal() {
  const exe = path.join(PASTA_DOTNET_LOCAL, EH_WINDOWS ? "dotnet.exe" : "dotnet");
  if (!fs.existsSync(exe)) return null;
  const env = ambienteBase({ DOTNET_ROOT: PASTA_DOTNET_LOCAL, DOTNET_MULTILEVEL_LOOKUP: "0" });
  return serve(exe, env) ? { comando: exe, env, local: true } : null;
}

function dotnetDoComputador() {
  const env = ambienteBase();
  return serve("dotnet", env) ? { comando: "dotnet", env, local: false } : null;
}

function encontrarDotnet() {
  return dotnetLocal() || dotnetDoComputador();
}

module.exports = { encontrarDotnet, RAIZ, PASTA_DOTNET_LOCAL, EH_WINDOWS };
