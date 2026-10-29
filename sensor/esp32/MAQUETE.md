# Montando o sensor na maquete

Guia rápido para instalar o ESP32 + sensor ultrassônico (HC-SR04) numa maquete
com nível de água de até uns 20 cm.

## 1. A ideia geral

O sensor fica **fixo, olhando para baixo**, acima do recipiente de água. Ele mede a
distância até a superfície. Quando a água sobe, essa distância diminui — é assim
que o sistema sabe o nível.

```
     [ sensor ]  ← fixo, parado, olhando para baixo
         |
         | ← distância medida
         |
   ~~~~~~~~~~~~  ← superfície da água (sobe e desce)
   |            |
   | recipiente |
   |____________|
```

A conta que a API faz: **nível da água = altura do sensor − distância medida**.

## 2. A que altura instalar o sensor

**Altura de instalação = nível máximo de água + uma margem de segurança.**

Como o nível máximo é uns 20 cm, instalem o sensor a uns **28–30 cm do fundo**.
Essa margem existe porque:
- o HC-SR04 não mede direito distâncias menores que uns 2–4 cm;
- sobra espaço para a água balançar sem dar leitura errada.

Depois de instalar, **meçam com uma régua** e atualizem `ALTURA_INSTALACAO_M` no
`bolinho_sensor.ino` (em metros: 28 cm = 0.28).

Os limites da maquete já estão configurados na API (zona `maquete-demo`):
**atenção a partir de 12 cm** e **perigo a partir de 18 cm** de água.

## 3. Ligando o sensor no ESP32

| Pino do sensor | Vai em |
|---|---|
| VCC | 5V (VIN) do ESP32 |
| GND | GND do ESP32 |
| Trig | GPIO 5 (no código) |
| Echo | GPIO 18 (no código) — **leia o aviso abaixo** |

### ⚠️ Aviso sobre o pino Echo

O HC-SR04 manda 5 V no pino Echo, mas os pinos do ESP32 só aguentam 3,3 V.
Ligar direto pode **danificar o ESP32**. Usem um **divisor de tensão**:

```
Echo do sensor ── resistor 1kΩ ──┬── GPIO 18 do ESP32
                                 │
                             resistor 2kΩ
                                 │
                                GND
```

Isso reduz o sinal para cerca de 3,3 V. Se tiverem um professor de eletrônica por
perto, vale pedir para conferir antes de ligar. (Existem também versões do sensor
que funcionam direto em 3,3 V, como o HC-SR04P; com elas, não precisa do divisor.)

## 4. Testando na bancada (antes de montar)

1. Ligue o ESP32 no computador pelo USB e abra o **Monitor Serial** (115200 baud).
2. Suba o `bolinho_sensor.ino` (na Arduino IDE, instale antes o suporte a placas
   ESP32 em *Ferramentas → Placa → Gerenciador de placas → "esp32"*).
3. Aproxime e afaste a mão do sensor: a distância no Monitor Serial deve mudar.
4. Só depois de ver a leitura estável, montem o sensor na maquete.

## 5. Testando com o site

1. Ligue o sistema com **`npm run rede`** (em vez de `npm start`).
   Na primeira vez, o Windows pode perguntar sobre o firewall: permita em
   **redes privadas**.
2. Descubra o IP do computador (`ipconfig` no cmd → "Endereço IPv4") e coloque
   em `API_URL` no `.ino`, por exemplo `http://192.168.0.10:5080/api/sensor-leitura`.
3. O ESP32 e o computador precisam estar na **mesma rede Wi-Fi**. Redes de escola
   às vezes bloqueiam um aparelho de falar com outro; nesse caso, usem o roteador
   do celular.
4. Abra a aba **Sensor** do site. Ela sai de "Aguardando o sensor" para
   "Sensor conectado" na primeira leitura.
5. Coloquem água aos poucos: o tanque da página muda de azul (tranquilo) para
   amarelo (atenção, 12 cm) e vermelho (perigo, 18 cm), e a barra de alerta aparece.

Se o Monitor Serial mostrar `Resposta da API: 400` ou `404`, a mensagem que vem
logo abaixo diz exatamente o que está errado no JSON.
