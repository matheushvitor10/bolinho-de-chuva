// ============================================================================
// "npm run teste-email"  — descobre por que o email não está chegando.
// "npm run teste-email -- alguem@gmail.com"  — manda o teste para outro email.
// O "npm start" precisa estar ligado (em outro terminal).
// ============================================================================

const para = process.argv[2] || "";
const url = `http://localhost:5080/api/emails/diagnostico${para ? `?para=${encodeURIComponent(para)}` : ""}`;

console.log("\nTestando o envio de emails do Bolinho de Chuva…\n");

fetch(url, { method: "POST" })
  .then(async r => {
    if (r.status === 404) throw new Error("rota não encontrada. O sistema foi ligado com \"npm start\"?");
    const dados = await r.json();
    for (const p of dados.passos) {
      console.log(`${p.ok ? "  ✔" : "  ✘"} ${p.passo}: ${p.detalhe}`);
    }
    const tudoOk = dados.passos.every(p => p.ok);
    console.log(tudoOk
      ? "\nTudo certo! O envio de emails está funcionando.\n"
      : "\nAlgo precisa ser arrumado: veja o item marcado com ✘ acima.\nDica: tudo isso também dá pra fazer sem terminal, em http://localhost:5500/config.html\n");
    if (!tudoOk) process.exitCode = 1;
  })
  .catch(erro => {
    console.error(`  ✘ Não consegui falar com a API. O "npm start" está ligado em outro terminal? (${erro.message})\n`);
    process.exit(1);
  });
