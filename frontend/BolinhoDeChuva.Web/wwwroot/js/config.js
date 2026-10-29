// ============================================================================
// Configuração do front-end: onde está a API (o back-end)?
// ============================================================================
// Não precisa mexer aqui. O site descobre sozinho:
//
// - No seu computador (site na porta 5500): a API está na porta 5080.
//   Funciona também pelo IP da rede, ex.: http://192.168.0.10:5500
// - Hospedado (Render): site e API ficam no MESMO endereço, então é só "/api".
// ============================================================================

window.BOLINHO_CONFIG = {
  API_URL: location.port === "5500"
    ? `${location.protocol}//${location.hostname}:5080/api`
    : "/api"
};
