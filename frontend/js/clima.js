// ===================================================================
// clima.js — página Clima (clima.html)
// -------------------------------------------------------------------
// O clima vem da API (GET /api/clima), que busca na Open-Meteo.
// O comum.js busca o clima a cada 5 minutos e avisa esta página.
// ===================================================================

function mostrarClima(clima) {
  const detalhe = document.getElementById("weather-detail");
  const dias = document.getElementById("weather-dias");

  if (!clima) {
    detalhe.innerHTML = `<p class="loading">Não foi possível carregar o clima agora. Tento de novo em 5 minutos.</p>`;
    dias.innerHTML = "";
    return;
  }

  const hoje = clima.previsaoHoje;

  // Os cartões do clima de agora
  detalhe.innerHTML = `
    <div class="weather-card destaque">
      <div class="value">${num(hoje.chuvaMm)} mm</div>
      <div class="label">Chuva prevista para hoje</div>
    </div>
    <div class="weather-card">
      <div class="value">${hoje.probabilidadeChuva ?? "—"}%</div>
      <div class="label">Chance de chuva hoje</div>
    </div>
    <div class="weather-card">
      <div class="value">${esc(clima.condicao)}</div>
      <div class="label">Agora${clima.precipitacaoMm > 0 ? `, ${num(clima.precipitacaoMm)} mm na última hora` : ""}</div>
    </div>
    <div class="weather-card">
      <div class="value">${num(clima.temperatura)}°C</div>
      <div class="label">Temperatura agora</div>
    </div>
    <div class="weather-card">
      <div class="value">${num(hoje.minima)}° / ${num(hoje.maxima)}°</div>
      <div class="label">Mínima e máxima hoje</div>
    </div>
    <div class="weather-card">
      <div class="value">${clima.umidade}%</div>
      <div class="label">Umidade do ar</div>
    </div>
    <div class="weather-card">
      <div class="value">${num(clima.ventoKmh)} km/h</div>
      <div class="label">Vento</div>
    </div>`;

  // Os próximos dias
  const formatoDia = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "short" });
  dias.innerHTML = (clima.proximosDias || []).map(d => {
    const [ano, mes, dia] = d.data.split("-").map(Number);
    const chance = d.probabilidadeChuva ?? 0;
    return `
      <div class="dia-card">
        <h3>${esc(formatoDia.format(new Date(ano, mes - 1, dia)))}</h3>
        <p>${esc(d.condicao)}, ${num(d.minima)}° a ${num(d.maxima)}°</p>
        <p>${num(d.chuvaMm)} mm de chuva previstos</p>
        <div class="dia-chuva" title="Chance de chuva">
          <div class="dia-barra"><i style="width:${Math.min(100, Math.max(0, chance))}%"></i></div>
          <span>${chance}%</span>
        </div>
      </div>`;
  }).join("");
}

quandoChegarClima.push(mostrarClima);
