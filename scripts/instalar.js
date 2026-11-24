// ============================================================================
// Roda sozinho no "npm install".
// 1. Confere se tem o .NET 8 (precisa dele pro back-end em C#).
//    Se não tiver, baixa e instala DENTRO desta pasta (.dotnet), sem precisar
//    ser administrador e sem mexer no resto do computador.
// 2. Baixa o que o C# precisa e compila tudo, pro "npm start" já sair rodando.
// ============================================================================

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { encontrarDotnet, RAIZ, PASTA_DOTNET_LOCAL, EH_WINDOWS } = require("./dotnet");

// Os dois programas em C#: o sistema (backend) e o simulador do sensor
const PROJETOS = [
  path.join(RAIZ, "backend", "BolinhoDeChuva.Api.csproj"),
  path.join(RAIZ, "sensor", "SensorSimulator", "SensorSimulator.csproj")
];

function titulo(texto) {
  console.log(`\n=== ${texto} ===`);
}

function falhar(mensagem) {
  console.error(`\n[ERRO] ${mensagem}\n`);
  process.exit(1);
}

async function baixarInstaladorDoDotnet() {
  const nome = EH_WINDOWS ? "dotnet-install.ps1" : "dotnet-install.sh";
  const url = `https://dot.net/v1/${nome}`;
  const destino = path.join(PASTA_DOTNET_LOCAL, nome);

  fs.mkdirSync(PASTA_DOTNET_LOCAL, { recursive: true });
  console.log(`Baixando o instalador oficial da Microsoft (${url})…`);

  let resposta;
  try {
    resposta = await fetch(url, { redirect: "follow" });
  } catch (erro) {
    falhar(`Não consegui baixar o instalador do .NET. Confira a internet e rode "npm install" de novo.\n(${erro.message})`);
  }
  if (!resposta.ok) falhar(`O site da Microsoft respondeu ${resposta.status} ao baixar o instalador do .NET.`);

  fs.writeFileSync(destino, Buffer.from(await resposta.arrayBuffer()));
  return destino;
}

async function instalarDotnetLocal() {
  titulo("Instalando o .NET 8 dentro do projeto (só na primeira vez, pode levar alguns minutos)");
  const instalador = await baixarInstaladorDoDotnet();

  const resultado = EH_WINDOWS
    ? spawnSync("powershell.exe", [
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", instalador,
        "-Channel", "8.0", "-InstallDir", PASTA_DOTNET_LOCAL, "-NoPath"
      ], { stdio: "inherit" })
    : spawnSync("bash", [instalador, "--channel", "8.0", "--install-dir", PASTA_DOTNET_LOCAL, "--no-path"], { stdio: "inherit" });

  if (resultado.error || resultado.status !== 0) {
    falhar("A instalação do .NET não terminou. Rode \"npm install\" de novo; se continuar, instale o .NET 8 SDK\n" +
           "manualmente em https://dotnet.microsoft.com/download/dotnet/8.0 e rode \"npm install\" outra vez.");
  }
}

function rodarDotnet(dotnet, args, mensagemDeErro) {
  const r = spawnSync(dotnet.comando, args, { stdio: "inherit", env: dotnet.env, cwd: RAIZ });
  if (r.error || r.status !== 0) falhar(mensagemDeErro);
}

async function main() {
  console.log("\nBolinho de Chuva — preparando o sistema");

  titulo("1/3  Procurando o .NET 8");
  let dotnet = encontrarDotnet();

  if (dotnet) {
    console.log(dotnet.local ? "Achei o .NET instalado nesta pasta." : "Achei o .NET instalado no computador.");
    const versao = require("child_process").spawnSync(dotnet.comando, ["--version"], { env: dotnet.env, encoding: "utf8" });
    if (versao.stdout) console.log(`Versão: ${versao.stdout.trim()}`);
  } else {
    console.log("Não achei o .NET 8 no computador.");
    await instalarDotnetLocal();
    dotnet = encontrarDotnet();
    if (!dotnet) falhar("Instalei o .NET, mas não consegui usá-lo. Feche o terminal, abra de novo e rode \"npm install\".");
    console.log("Pronto, .NET instalado na pasta .dotnet do projeto.");
  }

  titulo("2/3  Baixando as dependências do C#");
  for (const projeto of PROJETOS)
    rodarDotnet(dotnet, ["restore", projeto],
      "Não consegui baixar as dependências do C#. Confira a internet e rode \"npm install\" de novo.");

  titulo("3/3  Compilando (o sistema e o simulador do sensor)");
  for (const projeto of PROJETOS)
    rodarDotnet(dotnet, ["build", projeto, "--no-restore", "-v", "q", "-nologo"],
      "A compilação falhou. A mensagem acima mostra o arquivo e a linha com problema.");

  // Cria o arquivo de configurações pessoais (senha do email), se ainda não existir.
  const pastaApi = path.join(RAIZ, "backend");
  const configLocal = path.join(pastaApi, "appsettings.Local.json");
  if (!fs.existsSync(configLocal)) {
    fs.copyFileSync(path.join(pastaApi, "appsettings.Local.exemplo.json"), configLocal);
    console.log("\nCriei o arquivo backend/appsettings.Local.json (é nele que vai a senha do email).");
  }

  console.log("\n✔ Tudo pronto! Agora rode:  npm start\n");
}

main();
