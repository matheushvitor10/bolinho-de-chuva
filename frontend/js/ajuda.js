// ===================================================================
// ajuda.js — página Ajuda (ajuda.html)
// -------------------------------------------------------------------
// Os telefones de emergência vêm da API (GET /api/contatos).
// No celular, tocar no número já liga (ou abre o SMS, no caso do 40199).
// ===================================================================

async function carregarContatos() {
  const grade = document.getElementById("contacts-grid");
  try {
    const contatos = await api("/contatos");
    grade.innerHTML = contatos.map(c => {
      const ehSms = c.id === "alerta-sms";
      const link = ehSms ? `sms:${c.numero}` : `tel:${c.numero.replace(/\D/g, "")}`;
      return `
        <div class="contact-card prioridade-${c.prioridade}" id="contato-${esc(c.id)}">
          <a class="numero" href="${link}" aria-label="${ehSms ? "Mandar SMS para" : "Ligar para"} ${esc(c.nome)}, ${esc(c.numero)}">${esc(c.numero)}</a>
          <div class="nome">${esc(c.nome)}</div>
          <p class="descricao">${esc(c.descricao)}</p>
        </div>`;
    }).join("");

    destacarPeloEndereco();   // veio da pesquisa? (ajuda.html#contato-defesa-civil)
  } catch {
    grade.innerHTML = `<p class="loading">Não foi possível carregar os contatos agora. Em emergência: Defesa Civil 199, Bombeiros 193, SAMU 192.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", carregarContatos);
