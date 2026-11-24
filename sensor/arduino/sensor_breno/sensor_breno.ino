// ============================================================================
// Bolinho de Chuva — código do sensor feito pelo Breno (Arduino + HC-SR04)
// ============================================================================
// Mede a distância do sensor até a água e escreve no cabo USB, 2 vezes por
// segundo, uma linha assim:
//
//     Distancia: 15.2 cm
//
// Como chega no site: o Arduino fica ligado no computador pelo cabo USB. Na
// página Sensor do site (no Chrome ou no Edge), clique em "Conectar sensor":
// o site lê essas linhas e manda a distância para a API (POST /api/sensor-leitura).
// O código do site que faz isso está em frontend/js/sensor-usb.js.
//
// Fiação: VCC -> 5V · GND -> GND · Trig -> pino 2 · Echo -> pino 3
// Importante: o site lê a 9600 (igual ao Serial.begin abaixo). Se mudar aqui,
// mude também VELOCIDADES em frontend/js/sensor-usb.js (o site tenta 9600 e 115200).
// ============================================================================

const int TRIG = 2;
const int ECHO = 3;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT);
  digitalWrite(TRIG, LOW);
  pinMode(ECHO, INPUT);
}

void loop() {
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  unsigned long duracao = pulseIn(ECHO, HIGH, 30000UL);

  if (duracao == 0) {
    Serial.println("Sem eco");
  } else {
    float distanciaCm = duracao * 0.0343f / 2.0f;
    Serial.print("Distancia: ");
    Serial.print(distanciaCm, 1);
    Serial.println(" cm");
  }

  delay(500);
}
