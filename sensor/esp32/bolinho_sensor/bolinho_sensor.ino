// ============================================================================
// Bolinho de Chuva — leitor do sensor ultrassônico (ESP32 + HC-SR04)
// ============================================================================
// CÓDIGO DE REFERÊNCIA. Se o Breno já tiver o código dele funcionando, não
// precisa trocar por este: o que importa é mandar o MESMO JSON para o MESMO
// endereço (veja "Contrato do sensor" no README.md da pasta principal):
//
//   POST http://<endereço-da-api>/api/sensor-leitura
//   Content-Type: application/json
//   { "zonaId": "maquete-demo", "distanciaCm": 15.2, "alturaInstalacaoM": 0.28 }
//
// Montagem física e calibração: veja MAQUETE.md, na pasta sensor/esp32.
// ============================================================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// ---------- Configure aqui ----------
const char* WIFI_SSID  = "NOME_DA_SUA_REDE_WIFI";
const char* WIFI_SENHA = "SENHA_DA_SUA_REDE_WIFI";

// Escolha UM dos dois endereços:
//
// A) Site hospedado no Render (funciona de qualquer Wi-Fi com internet):
//    "https://bolinho-de-chuva.onrender.com/api/sensor-leitura"
//    (troque pelo endereço que o Render deu para vocês)
//
// B) Sistema rodando no computador, na mesma rede Wi-Fi:
//    use o IP do computador (no Windows: abra o cmd e rode "ipconfig", procure
//    "Endereço IPv4"). NÃO use "localhost": para o ESP32, localhost é ele mesmo.
//    Ligue o sistema com "npm run rede" (e não "npm start").
const char* API_URL = "http://192.168.0.10:5080/api/sensor-leitura";

// Se a API exigir chave (Sensor:Chave no appsettings.json), coloque a mesma aqui.
// Deixe "" enquanto a chave estiver vazia na API.
const char* CHAVE_SENSOR = "";

// Qual zona este sensor representa. Para a maquete, use "maquete-demo".
const char* ZONA_ID = "maquete-demo";

// Altura do sensor, em METROS, medida do fundo do recipiente até o sensor.
const float ALTURA_INSTALACAO_M = 0.28;  // exemplo: 28 cm

// Pinos ligados no sensor (ajuste conforme a fiação)
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
  http.setTimeout(15000);  // o site gratuito pode demorar a "acordar"

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
