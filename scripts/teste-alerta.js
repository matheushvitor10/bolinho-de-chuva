// ============================================================================
// "npm run teste-temporal" e "npm run teste-alagamento"
// Mandam um alerta de TESTE para todo mundo que está inscrito.
// O "npm start" precisa estar ligado (em outro terminal).
// ============================================================================

const tipo = process.argv[2] === "zona" ? "zona" : "temporal";

fetch(`http://localhost:5080/api/emails/teste-alerta?tipo=${tipo}`, { method: "POST" })
  .then(async r => {
    if (r.status === 404) throw new Error("a rota de teste só existe com o sistema rodando pelo npm start.");
    const dados = await r.json();
    console.log(`\n${dados.mensagem}`);
    if (dados.modoTeste) console.log("(Modo de teste: os emails foram salvos em backend/emails-de-teste)");
    console.log();
  })
  .catch(erro => {
    console.error(`\n[ERRO] Não consegui falar com a API. O "npm start" está ligado em outro terminal? (${erro.message})\n`);
    process.exit(1);
  });
