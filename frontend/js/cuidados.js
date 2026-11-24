// ===================================================================
// cuidados.js — página Cuidados (cuidados.html)
// -------------------------------------------------------------------
// Os botões "Antes", "Durante" e "Depois" mostram um grupo de dicas
// de cada vez. A pesquisa do topo pode abrir direto numa etapa:
// cuidados.html?etapa=depois
// ===================================================================

function mostrarEtapa(etapa) {
  document.querySelectorAll(".care-pill-btn").forEach(botao => {
    const ativo = botao.dataset.care === etapa;
    botao.classList.toggle("active", ativo);
    botao.setAttribute("aria-selected", String(ativo));
  });
  document.querySelectorAll(".care-panel").forEach(painel =>
    painel.classList.toggle("active", painel.id === `care-${etapa}`));
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".care-pill-btn").forEach(botao =>
    botao.addEventListener("click", () => mostrarEtapa(botao.dataset.care)));

  const etapa = new URLSearchParams(location.search).get("etapa");
  if (["antes", "durante", "depois"].includes(etapa)) mostrarEtapa(etapa);
});
