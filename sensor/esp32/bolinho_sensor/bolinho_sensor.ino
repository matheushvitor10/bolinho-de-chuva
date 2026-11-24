// ============================================================================
// Bolinho de Chuva — sensor da maquete (ESP32 + HC-SR04)
// ============================================================================
// O que este código faz, a cada 3 segundos:
//   1. mede a distância do sensor até a água (5 medições, usa a do meio);
//   2. manda essa distância pela Wi-Fi para o site do Bolinho de Chuva:
//
//      POST https://bolinho-de-chuva.onrender.com/api/sensor-leitura
//      { "zonaId": "maquete-demo", "distanciaCm": 15.2, "alturaInstalacaoM": 0.28 }
//
//   3. o site calcula o nível da água (altura do sensor - distância) e cuida
//      do resto: tanque, gráfico, aviso vermelho e emails de alerta.
//
// Antes de gravar no ESP32, troque só as linhas marcadas com  <-- TROQUE.
// Para ver o que está acontecendo: Ferramentas > Monitor Serial, em 115200.
// ============================================================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// ---------- Configure aqui ----------
// Wi-Fi 2.4 GHz (o ESP32 não conecta em 5 GHz nem em rede que pede login numa
// página). O mais garantido é o roteador do celular.
const char* WIFI_SSID  = "NOME_DA_REDE_WIFI";     // <-- TROQUE
const char* WIFI_SENHA = "SENHA_DA_REDE_WIFI";    // <-- TROQUE

// Endereço do site no Render + /api/sensor-leitura.
// Confira o endereço no topo da página do serviço, no painel do Render.
const char* API_URL = "https://bolinho-de-chuva.onrender.com/api/sensor-leitura";

// (Plano B, sem internet: sistema rodando no computador com "npm run rede",
//  na mesma Wi-Fi. Use o IP do computador, que aparece no "ipconfig":
//  "http://192.168.0.10:5080/api/sensor-leitura". Nunca use "localhost".)

// Se a API exigir chave (Sensor:Chave no appsettings.json), coloque a mesma aqui.
// Deixe "" enquanto a chave estiver vazia na API.
const char* CHAVE_SENSOR = "";

// Qual zona este sensor representa. Para a maquete, use "maquete-demo".
const char* ZONA_ID = "maquete-demo";

// Altura do sensor, em METROS, medida do fundo da maquete até o sensor.
const float ALTURA_INSTALACAO_M = 0.28;  // <-- TROQUE pela altura medida (28 cm = 0.28)

// Pinos ligados no sensor. Se o Breno ligou em outros pinos, troque aqui.
// Atenção: o Echo do HC-SR04 sai 5 V; use o divisor de tensão (veja MAQUETE.md).
const int PINO_TRIG = 5;
const int PINO_ECHO = 18;

// De quanto em quanto tempo manda uma leitura (milissegundos)
const unsigned long INTERVALO_MS = 3000;

// ---------- Não precisa mexer daqui pra baixo ----------

void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Conectando ao Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_SENHA);

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 15000) {
    delay(400);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConectado! IP do ESP32: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nNao conectou ao Wi-Fi. Tento de novo na proxima leitura.");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PINO_TRIG, OUTPUT);
  pinMode(PINO_ECHO, INPUT);
  WiFi.mode(WIFI_STA);
  conectarWiFi();
}

// Uma medição do HC-SR04, em cm. Retorna -1 se não veio eco.
float medirUmaVez() {
  digitalWrite(PINO_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PINO_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PINO_TRIG, LOW);

  long duracao = pulseIn(PINO_ECHO, HIGH, 30000);  // timeout de 30 ms
  if (duracao == 0) return -1;

  return (duracao * 0.0343) / 2.0;  // velocidade do som; ida e volta
}

// Faz 5 medições e usa a do meio (mediana). Isso tira os "pulos" que a
// água balançando costuma causar na leitura.
float medirDistanciaCm() {
  float v[5];
  int n = 0;
  for (int i = 0; i < 5; i++) {
    float d = medirUmaVez();
    if (d > 0) v[n++] = d;
    delay(60);
  }
  if (n == 0) return -1;

  // ordena (são no máximo 5 valores, então um método simples basta)
  for (int i = 0; i < n - 1; i++)
    for (int j = i + 1; j < n; j++)
      if (v[j] < v[i]) { float t = v[i]; v[i] = v[j]; v[j] = t; }

  return v[n / 2];
}

void enviarLeitura(float distanciaCm) {
  conectarWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.setTimeout(20000);  // o site gratuito pode demorar a "acordar" (1ª vez ~1 min)

  // https (site hospedado) precisa de um cliente seguro; http (computador) não.
  // setInsecure() não confere o certificado do site: simples e suficiente pro projeto.
  static WiFiClientSecure clienteSeguro;
  static WiFiClient clienteSimples;
  if (String(API_URL).startsWith("https")) {
    clienteSeguro.setInsecure();
    http.begin(clienteSeguro, API_URL);
  } else {
    http.begin(clienteSimples, API_URL);
  }
  http.addHeader("Content-Type", "application/json");
  if (strlen(CHAVE_SENSOR) > 0) {
    http.addHeader("X-Chave-Sensor", CHAVE_SENSOR);
  }

  String corpo = String("{") +
    "\"zonaId\":\"" + ZONA_ID + "\"," +
    "\"distanciaCm\":" + String(distanciaCm, 1) + "," +
    "\"alturaInstalacaoM\":" + String(ALTURA_INSTALACAO_M, 3) +
  "}";

  int codigo = http.POST(corpo);
  if (codigo > 0) {
    Serial.printf("Enviado! Resposta da API: %d\n", codigo);
    if (codigo != 200) Serial.println(http.getString());  // mostra a mensagem de erro da API
  } else {
    Serial.printf("Erro ao enviar: %s\n", http.errorToString(codigo).c_str());
  }
  http.end();
}

void loop() {
  float distanciaCm = medirDistanciaCm();

  if (distanciaCm > 0) {
    float nivelCm = ALTURA_INSTALACAO_M * 100 - distanciaCm;
    Serial.printf("Distancia: %.1f cm  |  Nivel da agua: %.1f cm\n", distanciaCm, nivelCm);
    enviarLeitura(distanciaCm);
  } else {
    Serial.println("Leitura invalida (fora de alcance ou sensor com problema).");
  }

  delay(INTERVALO_MS);
}
