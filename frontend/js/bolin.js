// ===================================================================
// bolin.js — página Conheça o Bolin (bolin.html)
// -------------------------------------------------------------------
// O quadro "Dica do Bolin": mostra uma dica e troca no botão "Outra dica".
// ===================================================================

const DICAS_DO_BOLIN = [
  "Nunca atravesse uma rua alagada, nem a pé nem de carro. A água engana: parece rasa e esconde buracos e correnteza.",
  "Mande seu CEP por SMS para 40199 e receba os alertas da Defesa Civil no celular. É de graça.",
  "Lixo na rua entope bueiro, e bueiro entupido vira alagamento. Lixo é no lixo!",
  "Guarde documentos dentro de um saco plástico bem fechado, num lugar alto da casa.",
  "Se a água começar a entrar em casa, desligue a chave geral de energia.",
  "Choveu forte? Evite passar perto de córregos e fundos de vale até a água baixar.",
  "Teve febre depois de pisar em água de enchente? Procure um posto de saúde e conte isso pro médico. Pode ser leptospirose.",
  "Seu cachorro e seu gato também precisam de um plano de saída. Pense neles antes da chuva chegar.",
  "Salve o 199 da Defesa Civil nos contatos do celular. Em emergência, cada segundo conta.",
  "Toque no sininho aqui do site e permita as notificações: eu aviso quando alguma região entrar em perigo."
];

let dicaAtual = Math.floor(Math.random() * DICAS_DO_BOLIN.length);

function mostrarDica() {
  document.getElementById("dica-texto").textContent = DICAS_DO_BOLIN[dicaAtual];
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarDica();
  document.getElementById("dica-proxima").addEventListener("click", () => {
    dicaAtual = (dicaAtual + 1) % DICAS_DO_BOLIN.length;
    mostrarDica();
  });
});
