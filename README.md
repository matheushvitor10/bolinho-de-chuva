# Bolinho de Chuva — SPA (Sistema de Prevenção de Alagamentos)

Site de acompanhamento de chuvas e alagamentos de **Ribeirão Preto e Franca**, com
sensor de nível da água, alertas por email e o mascote **Bolin**.

**Linguagens:** HTML, CSS e JavaScript (o site) · C# (o programa que entrega o site e
responde a API) · Vue.js nas partes que atualizam sozinhas.

---

## Como ligar

Precisa do [Node.js](https://nodejs.org) instalado. Na pasta do projeto, no terminal:

```
npm install      ← só na primeira vez (instala o .NET sozinho, se faltar)
npm start        ← liga o sistema e abre o navegador
```

Tudo fica em **http://localhost:5080**. Para desligar: **Ctrl + C**.

---

## Onde está cada coisa (mapa rápido)

| Se pedirem… | Abra |
|---|---|
| **A página inicial** | `frontend/index.html` · `css/inicio.css` · `js/inicio.js` |
| **A página de alagamentos** (mapa, regiões, histórico) | `frontend/alagamentos.html` · `css/alagamentos.css` · `js/alagamentos.js` |
| **A página do sensor** (nível da água, simulação) | `frontend/sensor.html` · `css/sensor.css` · `js/sensor.js` |
| **Como o site lê o Arduino do Breno (cabo USB)** | `frontend/js/sensor-usb.js` |
| **A página do clima** | `frontend/clima.html` · `css/clima.css` · `js/clima.js` |
| **As páginas Riscos, Cuidados, Ajuda e Conheça o Bolin** | `riscos.html`, `cuidados.html`, `ajuda.html`, `bolin.html` (cada uma com seu `.css` e `.js`) |
| **O cabeçalho, a barra vermelha e o sininho** | `frontend/js/comum.js` · `css/comum.css` |
| **A barra de pesquisa** | `frontend/js/busca.js` · `css/busca.css` |
| **O Bolin do canto da tela** (fala e perguntas) | `frontend/js/bolin-assistente.js` · `css/bolin-assistente.css` |
| **Onde está o Vue.js** | `js/sensor.js`, `js/alagamentos.js` e `js/busca.js` (veja a seção "Vue.js") |
| **O programa em C# / o back-end** | `backend/Program.cs` (o começo de tudo) |
| **As rotas da API** | `backend/Controllers/` (um arquivo por assunto) |
| **Como o clima é buscado** | `backend/Services/Clima/ClimaService.cs` |
| **Como as notícias são filtradas** | `backend/Services/Noticias/NoticiasService.cs` |
| **Como o nível do sensor é calculado** | `backend/Services/Regioes/ZonasService.cs` |
| **Quando os alertas são enviados** | `backend/Services/Alertas/MonitorDeAlertasService.cs` |
| **Como os emails são montados e enviados** | `backend/Services/Email/EmailTemplates.cs` e `EmailService.cs` |
| **As regiões e os telefones** | `backend/Data/ZonasIniciais.cs` e `backend/Data/ContatosData.cs` |
| **O código do Arduino do Breno** | `sensor/arduino/sensor_breno/sensor_breno.ino` |
| **O código do ESP32 (opção com Wi-Fi)** | `sensor/esp32/bolinho_sensor/bolinho_sensor.ino` |

Cada página tem um **HTML, um CSS e um JS com o mesmo nome**. Todo arquivo começa
com um comentário dizendo o que ele faz.

---

## As pastas

```
bolinho-de-chuva/
├── frontend/                   O SITE (HTML, CSS e JavaScript)
│   ├── index.html              Início
│   ├── alagamentos.html        Alagamentos
│   ├── sensor.html             Sensor
│   ├── clima.html              Clima
│   ├── riscos.html             Riscos
│   ├── cuidados.html           Cuidados
│   ├── ajuda.html              Ajuda (telefones)
│   ├── bolin.html              Conheça o Bolin
│   ├── configuracao.html       Configuração dos emails (só no computador)
│   ├── css/                    um .css por página + comum.css, busca.css, bolin-assistente.css
│   ├── js/                     um .js por página  + comum.js,  busca.js,  bolin-assistente.js
│   │   └── biblioteca/vue.js   a biblioteca do Vue.js
│   └── img/                    logo e imagens do Bolin
│
├── backend/                    O PROGRAMA EM C# (entrega o site e responde a API)
│   ├── Program.cs              o começo de tudo (configurações e serviços)
│   ├── Controllers/            as rotas da API (/api/...)
│   ├── Services/               quem faz o trabalho, separado por assunto:
│   │   ├── Clima/              busca o clima na Open-Meteo
│   │   ├── Noticias/           busca e filtra as notícias
│   │   ├── Regioes/            regiões, sensor e simulação
│   │   ├── Alertas/            histórico e o "vigia" que manda os alertas
│   │   ├── Email/              monta e envia os emails
│   │   └── Sistema/            configurações e hospedagem
│   ├── Models/                 o formato de cada dado
│   ├── Data/                   regiões e telefones
│   ├── Recursos/               imagens dos emails e o script do Google
│   └── appsettings.json        configurações (o appsettings.Local.json guarda a chave do Google)
│
├── sensor/                     o código do Arduino do Breno, do ESP32 e o simulador do sensor (C#)
├── scripts/                    o que os comandos npm fazem
└── Dockerfile, render.yaml     receita da hospedagem no Render (não precisa mexer)
```

---

## As rotas da API

Cada rota fica num arquivo da pasta `backend/Controllers/`:

| Rota | O que faz | Arquivo |
|---|---|---|
| `GET /api/clima` | Clima de agora e dos próximos dias | `ClimaController.cs` |
| `GET /api/noticias` | Notícias só de chuva e alagamento, por cidade | `NoticiasController.cs` |
| `GET /api/enchentes` | Situação de cada região | `EnchentesController.cs` |
| `GET /api/alertas` | Histórico de alertas | `AlertasController.cs` |
| `GET /api/contatos` | Telefones de emergência | `ContatosController.cs` |
| `GET /api/sensor/status` | Última leitura e histórico do sensor | `SensorController.cs` |
| `POST /api/sensor-leitura` | Recebe a medida do sensor (Arduino pelo USB ou ESP32) | `SensorController.cs` |
| `POST /api/simulacao/maquete` | Simula o nível da água (botões) | `SimulacaoController.cs` |
| `POST /api/emails/inscrever` | Cadastra o email e manda as boas-vindas | `EmailsController.cs` |
| `GET /api/emails/cancelar` | Página de cancelar inscrição | `EmailsController.cs` |
| `/api/config/...` | Página de configuração (só no computador) | `ConfigController.cs` |
| `GET /api` | Lista todas as rotas | `Program.cs` |

**APIs de fora que usamos:** Open-Meteo (clima), Google Notícias, G1 e Agência Brasil
(notícias), Google Apps Script (envia os emails e guarda os inscritos numa planilha),
OpenStreetMap + Leaflet (mapa).

---

## Vue.js

O Vue é usado em **três arquivos**, sempre com a **Options API** (`data`, `computed`,
`methods`, `mounted`). O HTML de cada painel Vue fica **no próprio .html**, dentro de uma
`<div id="app-...">`; o JavaScript fica no `.js` da página.

| Onde | O que faz | HTML | JavaScript |
|---|---|---|---|
| Página Sensor | Nível da água **em tempo real** (busca a cada 3 segundos) e simulação | `sensor.html` → `<div id="app-sensor">` | `js/sensor.js` |
| Página Alagamentos | Lista de regiões com **busca e filtro** | `alagamentos.html` → `<div id="app-regioes">` | `js/alagamentos.js` (PainelRegioes) |
| Página Alagamentos | **Histórico de alertas** com filtro por local e "só ativos" | `alagamentos.html` → `<div id="app-alertas">` | `js/alagamentos.js` (PainelAlertas) |
| Todas as páginas | **Barra de pesquisa** (resultados enquanto digita) | cabeçalho → `<div id="app-busca">` | `js/busca.js` |

**Componentes reutilizáveis:** o cartão de região e o cartão de alerta. O HTML deles
fica no fim do `alagamentos.html` (`<template id="molde-cartao-regiao">` e
`<template id="molde-item-alerta">`) e eles recebem os dados por `props`.

**Em uma frase:** os dados ficam em `data()`, os filtros em `computed`, as buscas na API
em `methods`, o tempo real em `mounted` + `setInterval`, e quando um dado muda o Vue
atualiza a tela sozinho.

---

## Emails

Quem se cadastra na página inicial recebe o **email de boas-vindas do Bolin** e, depois,
os alertas:
- **Alagamento:** quando uma região entra em perigo (no máximo 1 a cada 30 minutos por região);
- **Chuva:** quando começa a chover de verdade (no máximo 1 a cada 6 horas);
- **Temporal:** trovoada ou chuva forte prevista (no máximo 1 por dia).

Os emails saem pela conta **bolinhodechuva2026@gmail.com**, por um script do Google. Para
ligar ou testar, abra **http://localhost:5080/configuracao.html** (só funciona no
computador que roda o sistema). Lá estão os passos para conectar o Google e os botões de
teste. Os inscritos ficam na planilha "Bolinho de Chuva — Inscritos", no Google Drive.

Sem o Google conectado, os emails **não são enviados**: ficam salvos em
`backend/emails-de-teste/` para vocês verem como ficaram.

---

## Sensor

O sensor do Breno é um **Arduino com o HC-SR04** (código em
`sensor/arduino/sensor_breno/sensor_breno.ino`). Ele escreve no cabo USB, 2 vezes por
segundo: `Distancia: 15.2 cm`.

**Para ligar na apresentação:**
1. Grave o código do Breno no Arduino e ligue o Arduino no computador pelo cabo USB.
2. **Feche o Monitor Serial do Arduino IDE** (ele prende a porta).
3. Abra o site no **Google Chrome ou no Microsoft Edge** (no Render ou com `npm start`)
   e vá na página **Sensor**.
4. Clique em **Conectar sensor** e escolha a porta do Arduino (ex.: `COM3`).
5. Com a maquete **vazia**, clique em **Usar a distância de agora**: isso grava a altura do
   sensor até o fundo. Pronto: ao pôr água, o tanque, o gráfico e os alertas reagem.

Como funciona por dentro: o `js/sensor-usb.js` lê as linhas pelo cabo (Web Serial do
navegador) e, a cada 1 segundo, manda a distância para a API:

```
POST /api/sensor-leitura
{ "zonaId": "maquete-demo", "distanciaCm": 15.2, "alturaInstalacaoM": 0.25 }
```

A API calcula **nível da água = altura do sensor − distância medida**. Na maquete:
**atenção a partir de 12 cm**, **perigo a partir de 18 cm** (os limites ficam em
`backend/Data/ZonasIniciais.cs`, zona `maquete-demo`).

Com uma placa com Wi-Fi (ESP32), dá para mandar direto pela internet, sem o computador:
`sensor/esp32/bolinho_sensor/bolinho_sensor.ino` e `sensor/esp32/MAQUETE.md`.

Sem o sensor, use os botões de **simulação** na página Sensor: funciona igual.

---

## Comandos

| Comando | O que faz |
|---|---|
| `npm install` | Prepara tudo (só na primeira vez) |
| `npm start` | Liga o sistema em http://localhost:5080 |
| `npm run rede` | Igual, mas aberto na rede Wi-Fi (para o ESP32) |
| `npm run simulador` | Finge ser o sensor (em outro terminal) |
| `npm run teste-email` | Testa o envio de emails |

---

## Hospedagem (Render)

O site está publicado no **Render** (gratuito). Ele monta o sistema sozinho a partir do
GitHub, usando o `Dockerfile` e o `render.yaml`.

**Para atualizar o site:** mande os arquivos novos para o GitHub (**Add file → Upload
files**, ou pelo GitHub Desktop). Em uns 5 minutos o Render atualiza sozinho.
**Nunca envie** o `backend/appsettings.Local.json` (tem a chave do Google).

**Plano gratuito:** o site dorme depois de 15 minutos sem acesso e leva cerca de
1 minuto para acordar. Antes de apresentar, abra o site uns 2 minutos antes.

---

## Se algo der errado

- **Faixa amarela "Não consegui falar com o sistema":** ele não está ligado. Rode `npm start`.
- **"A porta 5080 já está sendo usada":** o sistema já está ligado em outro terminal. Feche aquele.
- **Clima "sem atualização":** a Open-Meteo não respondeu; o site mostra o último dado.
- **Emails não chegam:** abra http://localhost:5080/configuracao.html e veja os ✔ e ✘.
