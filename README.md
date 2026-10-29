# Bolinho de Chuva — SPA (Sistema de Prevenção de Alagamentos)

**Para rodar:** `npm install` (só na primeira vez) e depois `npm start`.

Portal de acompanhamento de chuvas e alagamentos de Ribeirão Preto e região.
Sem login: qualquer pessoa que abre o site vê as mesmas informações.

- **Back-end:** C# (ASP.NET Core, .NET 8) — pasta `backend/`
- **Front-end:** HTML, CSS e JavaScript — pasta `frontend/`
- **Sensor:** ESP32 (C++/Arduino) e um simulador em C# — pasta `sensor/`

O mascote é o **Bolin**, que aparece na página inicial resumindo a situação e
tem uma aba própria ("Conheça o Bolin").

---

## Como rodar

Você precisa ter o [Node.js](https://nodejs.org) instalado (versão 18 ou mais nova) —
o mesmo de antes. **Não precisa instalar mais nada**: o `npm install` instala sozinho
o .NET (que roda o C#), se o computador ainda não tiver.

1. Descompacte o `.zip` (botão direito → **Extrair tudo…**).
2. Abra a pasta `bolinho-de-chuva` no VS Code (**Arquivo → Abrir Pasta…**).
3. Abra um terminal (`Ctrl + '`) e rode:
   ```
   npm install
   ```
   Na primeira vez ele baixa o .NET para dentro da pasta `.dotnet` do projeto e
   compila tudo. Pode levar alguns minutos. Termina com **"✔ Tudo pronto!"**.
4. Depois, pra ligar o sistema:
   ```
   npm start
   ```
5. O navegador abre sozinho em **http://localhost:5500**. Se não abrir, segure
   `Ctrl` e clique no endereço que aparece no terminal.

Pronto: a API (back-end em C#) e o site (front-end) sobem juntos com esse único
comando. No terminal, as mensagens da API aparecem com **[API]** e as do site com
**[SITE]**. Para desligar: **`Ctrl + C`**.

O `npm install` só precisa ser rodado de novo se você mudar o projeto de pasta ou
se der algum erro. No dia a dia, é só `npm start`.

### Outros comandos

| Comando | O que faz |
|---|---|
| `npm start` | Liga a API e o site |
| `npm run simulador` | Finge ser o sensor (rode em **outro** terminal, com o `npm start` ligado). Digite **1** para o modo maquete |
| `npm run rede` | Igual ao `npm start`, mas deixa a API aberta na rede Wi-Fi — use no dia de ligar o ESP32 |
| `npm run teste-email` | Confere o envio de emails e manda um email de teste (o mesmo da página http://localhost:5500/config.html) |
| `npm run teste-temporal` | Manda um email de alerta de temporal de teste para os inscritos (com o `npm start` ligado) |
| `npm run teste-alagamento` | Manda um email de alerta de alagamento de teste para os inscritos |

Para abrir outro terminal no VS Code, clique no **+** do painel do terminal.

### Ver o sensor funcionando sem o hardware

Com o `npm start` rodando, abra outro terminal, rode `npm run simulador`, digite **1**
e Enter, e abra a aba **Sensor** do site: a água sobe até o perigo e desce, com a barra
de alerta aparecendo e sumindo sozinha.

### Se der erro no `npm install`

- **"Não consegui baixar o instalador do .NET"**: confira a internet e rode de novo.
- **Rede da escola bloqueando o download**: instale o .NET 8 SDK manualmente em
  https://dotnet.microsoft.com/download/dotnet/8.0 (coluna **SDK**, **Windows x64**),
  feche e abra o VS Code, e rode `npm install` de novo.
- **"You must install or update .NET to run this application"** no `npm start`:
  isso acontecia em computadores com o .NET 10 (ou de 32 bits) e já foi corrigido —
  o sistema agora roda em qualquer .NET a partir do 8. Se ainda aparecer, apague a
  pasta do projeto, extraia o `.zip` de novo e rode `npm install` e `npm start`.
- **"A porta já está sendo usada"** no `npm start`: o sistema já está ligado em outro
  terminal. Feche aquele terminal (ou aperte `Ctrl + C` nele) e tente de novo.

---

## Alternativa: abrir no Visual Studio (ícone roxo)

Se um dia vocês usarem o **Visual Studio** (não o VS Code), dá pra abrir pelo `.sln`:

### 1. O que instalar (só na primeira vez)

- **Visual Studio 2022** (versão 17.8 ou mais nova; a Community é gratuita).
- No **Visual Studio Installer**, marque a carga de trabalho
  **"ASP.NET e desenvolvimento Web"**. Ela já instala o .NET 8.

Para conferir a versão: no Visual Studio, *Ajuda → Sobre o Microsoft Visual Studio*.
Se for mais antiga que 17.8, atualize pelo Visual Studio Installer.

### 2. Abrir o projeto

1. Descompacte a pasta `bolinho-de-chuva` em um lugar fácil (ex.: `Documentos`).
2. Dê dois cliques em **`BolinhoDeChuva.sln`**.
3. No **Gerenciador de Soluções** (lado direito) aparecem 3 projetos:
   - `BolinhoDeChuva.Api` — o back-end
   - `BolinhoDeChuva.Web` — o site
   - `SensorSimulator` — finge ser o sensor

### 3. Ligar API e site juntos

Como o back-end e o front-end agora são separados, os **dois** precisam estar rodando.

1. Na barra de cima, ao lado do botão verde ▶, abra a lista de inicialização e
   escolha **"Bolinho de Chuva (API + Site)"**.
2. Aperte **F5** (ou o botão ▶).
3. Abrem uma janela preta (a API, em `http://localhost:5080`) e o navegador com o
   site em **http://localhost:5500**.

> **Se essa opção não aparecer na lista**, configure uma vez à mão:
> clique com o botão direito na **Solução** (a primeira linha do Gerenciador de
> Soluções) → **Configurar Projetos de Inicialização** → **Vários projetos de
> inicialização** → em `BolinhoDeChuva.Api` e `BolinhoDeChuva.Web` escolha
> **Iniciar** → **OK**. Depois é só apertar F5.

Para parar tudo: **Shift + F5**.

### 4. Ver o sensor funcionando sem o hardware

Escolha **"Bolinho de Chuva (API + Site + Simulador)"** e aperte F5. Na janela do
simulador, digite **1** e Enter (modo maquete). No site, abra a aba **Sensor** e
veja a água subindo até o perigo e descendo, com a barra de alerta aparecendo
e sumindo sozinha.

Também dá pra testar sem o simulador: abra o arquivo
`backend/BolinhoDeChuva.Api/BolinhoDeChuva.Api.http` no Visual Studio e clique em
**Enviar solicitação** em cima de cada bloco.

---

## Estrutura do projeto

```
bolinho-de-chuva/
├── package.json                      → os comandos npm install / npm start
├── scripts/                          → o que o npm install e o npm start fazem
├── BolinhoDeChuva.sln                → abre tudo no Visual Studio (ícone roxo)
├── BolinhoDeChuva.slnLaunch          → os perfis "API + Site" do botão ▶
├── Dockerfile                        → receita para a hospedagem no Render
├── render.yaml                       → configuração da hospedagem no Render
│
├── backend/BolinhoDeChuva.Api/       → BACK-END (C#)
│   ├── Program.cs                    → configuração (CORS, serviços, porta)
│   ├── appsettings.json              → endereço do site liberado e chave do sensor
│   ├── BolinhoDeChuva.Api.http       → testes rápidos das rotas
│   ├── Controllers/                  → as rotas /api/...
│   ├── appsettings.Local.json        → senha do email (criado pelo npm install, não vai pro GitHub)
│   ├── Emails/                       → imagens do Bolin que vão dentro dos emails
│   ├── Google/BolinhoDeChuva.gs      → código do script do Google (a página de config entrega pronto)
│   ├── Services/
│   │   ├── EmailService.cs           → envia os emails (Google, senha de app ou modo de teste)
│   │   ├── GoogleScriptService.cs    → conversa com o script do Google (emails + planilha)
│   │   ├── EmailTemplates.cs         → o visual dos emails (boas-vindas e alertas)
│   │   ├── MonitorDeAlertasService.cs→ o "vigia" que decide quando mandar alerta
│   │   ├── NoticiasService.cs        → notícias só de chuva e alagamento
│   │   ├── ClimaService.cs           → clima ao vivo (Open-Meteo)
│   │   └── ZonasService.cs           → regiões monitoradas e leituras do sensor
│   ├── Models/                       → o formato de cada dado
│   └── Data/
│       ├── ZonasIniciais.cs          → as regiões (e a zona da maquete)
│       └── ContatosData.cs           → telefones de emergência
│
├── frontend/BolinhoDeChuva.Web/      → FRONT-END
│   ├── Program.cs                    → só entrega os arquivos da wwwroot
│   └── wwwroot/                      → o site de verdade (HTML, CSS, JS)
│       ├── index.html
│       ├── config.html               → página de configuração dos emails
│       ├── css/style.css
│       ├── js/config.js              → ONDE ESTÁ A API (único lugar pra trocar)
│       ├── js/app.js
│       └── img/                      → logo, emblema, Bolin e favicon
│
└── sensor/
    ├── esp32/bolinho_sensor/         → código de referência do ESP32 (.ino)
    ├── esp32/MAQUETE.md              → como montar e ligar o sensor
    └── SensorSimulator/              → simulador em C#
```

---

## O que cada rota da API faz

| Rota | O que faz |
|---|---|
| `GET /api/status` | Diz se a API está no ar |
| `GET /api/noticias?abrangencia=ribeirao-preto\|franca\|nacional\|todas` | Notícias **só de chuva e alagamento**, por cidade |
| `GET /api/clima` | Clima ao vivo de Ribeirão Preto e previsão de chuva para os próximos dias |
| `GET /api/enchentes` | Situação de todas as regiões monitoradas |
| `GET /api/enchentes/{id}` | Uma região específica |
| `GET /api/contatos` | Telefones de emergência |
| `GET /api/sensor/status?zonaId=maquete-demo` | Situação do sensor (conectado, última leitura, histórico) |
| `POST /api/sensor-leitura` | Onde o ESP32 manda as leituras |
| `POST /api/simulacao/maquete` | Simula o nível da água na maquete (`{"nivelCm": 15}` ou `{"variacaoCm": 2}`) |
| `POST /api/emails/inscrever` | Cadastra um email para receber alertas (e manda o email de boas-vindas) |
| `GET /api/emails/cancelar?token=...` | Página de cancelar inscrição (o link do rodapé dos emails) |
| `POST /api/emails/teste-alerta?tipo=temporal\|zona` | Manda um alerta de teste (só no seu computador) |
| `POST /api/emails/diagnostico` | Diagnóstico do envio de email, usado pelo `npm run teste-email` (só no seu computador) |
| `/api/config/...` | Rotas da página de configuração dos emails (só respondem no próprio computador) |

### Sobre as notícias

A API busca no Google Notícias (uma busca de Ribeirão Preto, uma de Franca e uma do Brasil), no G1
Ribeirão Preto e Franca, no G1 e na Agência Brasil. **Toda notícia passa por um
filtro**: só fica o que fala de chuva, temporal, tempestade, alagamento, enchente,
inundação, transbordamento, granizo, deslizamento ou desabrigados. Expressões como
"chuva de gols" ou "guarda-chuva" são ignoradas.

O resultado fica guardado por 10 minutos, pra não consultar as fontes a cada
visita. Se uma fonte falhar, as outras continuam funcionando e aparece um aviso
na janela da API, tipo `Não consegui buscar a fonte "G1"...`.

Para adicionar uma fonte, abra `Services/NoticiasService.cs` e acrescente uma
linha na lista `Fontes`. Para mudar as palavras do filtro, edite `PalavrasDeChuva`
no mesmo arquivo.

---

## Simulação da água (para apresentar sem o sensor)

Na aba **Sensor** tem o painel **"Simular a água na maquete"**:

- **Altura da água:** botões **−1 cm / +1 cm**, uma barra para arrastar e atalhos
  (**Seca**, **Normal**, **Atenção**, **Perigo**).
- **Água chegando:** escolha **Chuva fraca**, **Chuva forte** ou **Temporal**, e a água
  sobe sozinha a cada 2 segundos. **Escoar** faz ela baixar. **Parar** interrompe.

Cada clique funciona igual a uma leitura do sensor de verdade: o tanque, o gráfico, a
barra de alerta, o sininho e o resumo do Bolin mudam na hora, e quando a água passa de
**18 cm** quem está cadastrado recebe o **email de alerta**. No máximo um a cada 30
minutos; para testar de novo antes disso, reinicie o `npm start`.

Quando o sensor do Breno for ligado, as leituras dele passam a valer
automaticamente: a aba mostra "Sensor conectado" no lugar de "Modo simulação".

Para esconder o painel (por exemplo, depois de publicar com o sensor de verdade),
coloque `"Simulacao": { "Habilitada": false }` no `appsettings.json` da API.

## O Bolin assistente

Ao entrar no sistema, o Bolin aparece no canto da tela e conta como está o tempo: se
vai chover, a temperatura, o vento, a umidade e se tem alguma região em alerta. Depois
de **30 segundos** (a barrinha embaixo do balão), ele sai e fica **espiando na beirada
da tela, acenando**. Se a pessoa passar o mouse em cima do balão, o tempo pausa.

Clicando nele, ele volta com uma **caixinha de perguntas prontas** ("Onde você foi
criado, Bolin?", "Quantos anos você tem?", "Vai chover hoje?"...). As perguntas e
respostas ficam em `frontend/BolinhoDeChuva.Web/wwwroot/js/app.js`, na lista
`PERGUNTAS_DO_BOLIN`: é só editar o texto ou acrescentar mais.

## Notícias por cidade

Na página inicial, as notícias de chuva e alagamento podem ser filtradas por
**Ribeirão Preto**, **Franca** ou **Todo o Brasil**. A escolha fica salva no navegador:
na próxima visita, já abre na cidade da pessoa.

A API descobre a cidade de cada notícia pelo texto. Cidades vizinhas entram junto com a
cidade-polo (Sertãozinho e Cravinhos em Ribeirão Preto; Restinga e Patrocínio Paulista
em Franca), e notícias sobre a **França** (o país) não se misturam com **Franca**.

---

## O sensor (esperando o hardware do Breno)

A parte de software do sensor já está pronta e testada com o simulador. Quando o
hardware estiver pronto, **não precisa mexer no site nem na API**: basta o ESP32
mandar as leituras no formato abaixo.

### Contrato do sensor

```
POST http://<endereço-da-api>/api/sensor-leitura
Content-Type: application/json

{
  "zonaId": "maquete-demo",
  "distanciaCm": 15.2,
  "alturaInstalacaoM": 0.28
}
```

- `zonaId`: qual zona o sensor representa (`maquete-demo` para a maquete; os outros
  ids estão em `Data/ZonasIniciais.cs`)
- `distanciaCm`: o que o sensor mediu (distância até a água, em cm)
- `alturaInstalacaoM`: a altura do sensor em relação ao fundo, **em metros**

A API calcula `nível = alturaInstalacaoM − distanciaCm / 100` e decide o status.
Para a maquete: **atenção a partir de 12 cm** e **perigo a partir de 18 cm** de água.

Se algo vier errado, a API responde com uma mensagem clara em português (código
400 ou 404). O código de referência imprime essa mensagem no Monitor Serial.

### Checklist para conectar tudo

- [ ] Sensor montado e testado na bancada (ver `sensor/esp32/MAQUETE.md`)
- [ ] `WIFI_SSID` e `WIFI_SENHA` preenchidos no `.ino`
- [ ] `ALTURA_INSTALACAO_M` medido com régua e atualizado no `.ino`
- [ ] Sistema ligado com **`npm run rede`** (em vez de `npm start`)
- [ ] Firewall do Windows permitindo a API em **redes privadas**
- [ ] `API_URL` no `.ino` com o **IP do computador** (`ipconfig` → "Endereço IPv4"),
      nunca `localhost`
- [ ] ESP32 e computador na mesma rede Wi-Fi
- [ ] Aba **Sensor** do site saiu de "Aguardando o sensor" para "Sensor conectado"

Se o Breno já tiver o código dele, o `.ino` desta pasta serve só de referência:
o importante é o JSON e o endereço serem os do contrato acima.

---

## Emails: alertas e boas-vindas do Bolin

Na página inicial tem um campo **"Receba alertas de temporal no seu email"**.
Quando alguém se cadastra:

1. O sistema confere se o email é válido e corrige erros comuns de digitação
   (ex.: `gmial.com` ou `gmail.com.br` → sugere `gmail.com`).
2. Chega na hora um **email de boas-vindas do Bolin**, agradecendo o cadastro.
3. A partir daí, a pessoa recebe **alertas automáticos**:
   - **Temporal** — quando a previsão do tempo indicar trovoada agora, trovoada
     prevista para hoje, ou chuva forte (30 mm ou mais). No máximo um por dia.
   - **Alagamento** — quando uma região entrar em nível de **perigo**, inclusive a
     **maquete**: encheu a maquete na apresentação, o email chega. 😉 No máximo um
     a cada 30 minutos por região.
4. Todo email tem o link **"Cancelar inscrição"**.

Os cadastros ficam salvos em `backend/BolinhoDeChuva.Api/dados/inscritos.json`.

### Ligando o envio de verdade: página de configuração (sem terminal)

Com o sistema ligado (`npm start`), abra **http://localhost:5500/config.html**. Também
dá pra chegar lá pelo link **"Configurar emails"** no rodapé do site, que só aparece
no computador que está rodando o sistema.

A página mostra **como está o envio agora** e tem tudo com botões:

1. **Copiar código** — copia o código do Bolinho de Chuva, já com a chave secreta.
2. **Criar o projeto no Google** — logado em **bolinhodechuva2026@gmail.com**, abra
   https://script.new, renomeie o projeto para **Bolinho de Chuva**, apague o que tiver
   lá, cole o código e salve 💾.
3. **Implantar** — *Implantar → Nova implantação →* ⚙ *App da Web*, com
   *Executar como:* **Eu** e *Quem pode acessar:* **Qualquer pessoa** → *Implantar*.
4. **Autorizar** — *Autorizar acesso* → escolha a conta → aparece "O Google não
   verificou este app" → *Avançado → Acessar Bolinho de Chuva (não seguro) → Permitir*.
   (É normal: o script é de vocês e não passou por revisão do Google.)
5. **Colar o link** do App da Web (termina em `/exec`) e clicar em **Conectar e testar**.

Pronto: a situação muda para **"Enviando pelo Google ✔"**. Na mesma página dá pra
**enviar um email de teste** e **alertas de teste** com o visual de verdade.

**Por que pelo Google?** O sistema manda o pedido para o script por HTTPS, o mesmo
caminho de qualquer site. Por isso funciona **até na rede da escola**, que costuma
bloquear o envio de email comum. E não precisa de senha de app nem de verificação em
duas etapas.

**Planilha de inscritos (banco de dados no Google):** na primeira vez, o script cria
no Google Drive da conta a planilha **"Bolinho de Chuva — Inscritos"**. Todo cadastro
e cancelamento vai pra ela, e o botão **"Abrir planilha de inscritos"** abre ela direto.
Se trocarem de computador e conectarem o mesmo script, a lista volta sozinha. Não
apague a coluna "Token": ela é usada no link de cancelar inscrição.

**Limite:** a conta gratuita do Google envia até **100 emails por dia** por script. A
página mostra quantos ainda restam no dia.

**Se mudarem o código do script depois:** no Google, use *Implantar → Gerenciar
implantações → ✏ editar → Versão: Nova versão → Implantar*. Assim o link continua o mesmo.

**Se der ✘ ao conectar**, a mensagem ao lado diz o que fazer. As mais comuns:
- *"respondeu com uma página em vez de dados"* → em "Quem pode acessar", deixe
  **Qualquer pessoa** (não "Qualquer pessoa com Conta do Google").
- *"link de TESTE (termina em /dev)"* → use o link da implantação, que termina em `/exec`.
- *"ainda não tem permissão"* → no editor do script, escolha a função **autorizar** no
  menu de cima, clique em **Executar** e aceite as permissões.

Quem preferir o terminal ainda pode usar `npm run teste-email`: ele faz o mesmo teste.

### Modo de teste

Enquanto o Google não estiver conectado, **nenhum email é enviado de verdade**: cada
um é salvo na pasta `backend/BolinhoDeChuva.Api/emails-de-teste/`. Abra os arquivos
`.html` dessa pasta com dois cliques para ver o email no navegador.

### Outra opção: Gmail com senha de app

Na página de configuração, em **"Outra opção: senha de app do Gmail"**, dá pra colar
uma senha de app da conta bolinhodechuva2026@gmail.com (gerada em
https://myaccount.google.com/apppasswords, com a verificação em duas etapas ligada).
Só use se o Google acima não der certo: esse jeito costuma ser **bloqueado em rede de
escola**. Se o Google estiver conectado, ele tem prioridade.

> ⚠️ O `appsettings.Local.json` guarda o link do script, a chave secreta e a senha
> (se houver). **Não mande ele pra ninguém** e não suba pro GitHub (o `.gitignore`
> já impede isso).

### Testar os alertas sem esperar um temporal

Na página de configuração, use os botões **"Enviar alerta de alagamento"** e
**"Enviar alerta de temporal"**. Pelo terminal também dá: `npm run teste-temporal` e
`npm run teste-alagamento`.

Isso manda um alerta de teste para todos os inscritos. Essa rota só funciona no seu
computador — depois de publicado o site, ela deixa de existir.

Ou rode `npm run simulador`, escolha o modo **1** (maquete) e espere a água chegar
em 18 cm: o alerta de alagamento da maquete é enviado sozinho.

---

## Configurações que vocês podem precisar mudar

| O quê | Onde |
|---|---|
| Endereço da API usado pelo site | `frontend/BolinhoDeChuva.Web/wwwroot/js/config.js` |
| Endereços do site que podem usar a API (CORS) | `backend/BolinhoDeChuva.Api/appsettings.json` → `Cors:OrigensPermitidas` |
| Chave do sensor (opcional) | `appsettings.json` → `Sensor:Chave` (e a mesma no `.ino` e no simulador) |
| Tempo até o site considerar o sensor "sem sinal" | `appsettings.json` → `Sensor:SegundosSemSinal` |
| Limites de atenção/perigo de cada região | `backend/BolinhoDeChuva.Api/Data/ZonasIniciais.cs` |
| Ligar o envio de emails (Google) | página **http://localhost:5500/config.html** |
| Gmail usado na opção "senha de app" | `backend/BolinhoDeChuva.Api/appsettings.json` → `Email:Usuario` |
| Quando mandar alerta de temporal (mm de chuva, chance de trovoada) | `appsettings.json` → `Alertas` |
| Links que vão nos emails (endereço do site e da API) | `appsettings.json` → `Site` |

A **chave do sensor** fica vazia enquanto vocês testam. Quando o site for publicado,
preencham com uma senha qualquer: assim só quem tem a chave consegue mandar leituras.

---

## Notificações

- A **barra vermelha** no topo aparece quando alguma região está em perigo.
- O **sininho** mostra quantas regiões estão em atenção ou perigo.
- Se a pessoa permitir (clicando no sininho), o navegador manda uma **notificação**
  quando uma região entra em perigo, mesmo com a aba em segundo plano.
- O site atualiza as regiões a cada 30 segundos. Com a aba **Sensor** aberta, a cada 3 segundos.

## Se algo não carregar

- **Faixa amarela no topo dizendo que não conseguiu falar com a API:** a API não está
  rodando, ou o endereço em `js/config.js` está errado.
- **Notícias ou clima não aparecem:** essas partes dependem da internet e de serviços
  externos. O resto do site continua funcionando normalmente; olhe a janela da API
  para ver qual fonte falhou.
- **Mapa cinza:** o mapa precisa de internet para baixar as imagens das ruas.

## Dados de demonstração

As regiões da cidade (Fundo de vale, Vila Virgínia etc.) ainda usam **dados de
demonstração**, e o site deixa isso claro na aba Alagamentos. A zona da maquete é
a única ligada a um sensor de verdade. As informações ficam na memória da API: ao
reiniciar, tudo volta ao estado inicial.

---

## Hospedagem gratuita (Render)

O sistema pode ficar na internet de graça, num endereço como
**https://bolinho-de-chuva.onrender.com**, sem precisar deixar um computador ligado com
`npm start`. Na hospedagem, a API e o site ficam juntos num endereço só.

O projeto já vem pronto para o **Render** (plano gratuito, sem cartão de crédito): o
arquivo `Dockerfile` ensina o Render a montar o sistema, e o `render.yaml` já traz
toda a configuração.

### Passo 1 — Colocar o projeto no GitHub

1. Crie uma conta em https://github.com (é grátis).
2. No canto de cima, à direita, clique em **+** → **New repository**. Nome:
   `bolinho-de-chuva`. Escolha **Private**. Não marque nenhuma opção extra. Clique em
   **Create repository**.
3. Na página do repositório vazio, clique no link **uploading an existing file**.
4. **Extraia o .zip numa pasta nova**, separada da que vocês usam no dia a dia. Isso
   é importante: a pasta do dia a dia tem a chave do Google e arquivos gerados, que
   não podem ir para a internet.
5. Abra essa pasta nova `bolinho-de-chuva`, selecione **tudo o que está dentro dela**
   (Ctrl + A) e **arraste** para a página do GitHub. Espere carregar e clique em
   **Commit changes**.
6. Confira: na página do repositório, os arquivos `Dockerfile` e `render.yaml` devem
   aparecer direto na lista, e não dentro de outra pasta `bolinho-de-chuva`.

### Passo 2 — Criar o site no Render

1. Entre em https://render.com e clique em **Get Started** → entre com o **GitHub**.
2. Clique em **New +** → **Blueprint**.
3. Conecte o GitHub e dê acesso ao repositório `bolinho-de-chuva`. Escolha ele.
4. O Render lê o `render.yaml` e pede **dois valores do Google**. Eles estão no
   arquivo `backend/BolinhoDeChuva.Api/appsettings.Local.json` do computador onde
   vocês conectaram o Google, dentro de `"Google"`:
   - `Google__UrlScript` → copie o valor de **UrlScript** (o link que termina em `/exec`)
   - `Google__Chave` → copie o valor de **Chave**
5. Clique em **Apply** (ou **Deploy Blueprint**).
6. Na primeira vez, o Render leva uns **5 a 10 minutos** montando (dá pra acompanhar
   em **Logs**). Quando aparecer **Live**, clique no endereço do site, lá em cima.

Pronto! Para conferir: cadastre seu email (o de boas-vindas chega) e, na aba
**Sensor**, clique em **Perigo** na simulação (o alerta chega).

### Atualizar o site depois

Quando mudarem alguma coisa, envie os arquivos alterados de novo pelo GitHub
(**Add file → Upload files**). O Render percebe sozinho e atualiza o site em alguns
minutos.

### O que muda no site hospedado

- **Ele "dorme" depois de 15 minutos sem acesso** e leva cerca de **1 minuto** para
  acordar. Antes de apresentar, abra o site uns 2 minutos antes.
- **Os alertas de temporal só são verificados com o site acordado.** Se quiserem
  deixar sempre acordado, criem uma tarefa grátis em https://cron-job.org que acesse
  `https://SEU-SITE.onrender.com/api/status` a cada 10 minutos. (O plano gratuito
  tem 750 horas por mês, o suficiente para um site ligado o mês inteiro.)
- **A cada vez que acorda, o site recomeça do zero**: as regiões e o sensor voltam ao
  estado inicial. **Os inscritos não se perdem**: eles voltam sozinhos da planilha do
  Google.
- **A página de configuração (`config.html`) não funciona na hospedagem.** Lá, as
  configurações ficam no Render, em **Environment**.
- **A simulação fica aberta a qualquer visitante.** Depois da apresentação, se
  quiserem desligar: no Render, **Environment → Add Environment Variable** com
  `Simulacao__Habilitada` = `false`.
- **Sensor (ESP32):** no `bolinho_sensor.ino`, troque o `API_URL` para
  `https://SEU-SITE.onrender.com/api/sensor-leitura`. Assim o ESP32 funciona em
  qualquer Wi-Fi com internet, sem precisar do computador.

> No computador, tudo continua igual: `npm install` e `npm start`, como sempre.
