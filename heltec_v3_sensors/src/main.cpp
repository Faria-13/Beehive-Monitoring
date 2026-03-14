#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <math.h>

#include <Adafruit_BMP085.h>
#include <SensirionI2CScd4x.h>
#include <SensirionCore.h>
#include <RadioLib.h>

// -------------------- I2C / Sensors --------------------
static const int SDA_PIN = 39;
static const int SCL_PIN = 40;
static const uint8_t SCD4X_ADDR = 0x62;

Adafruit_BMP085 bmp;
SensirionI2cScd4x scd4x;

// -------------------- Heltec WiFi LoRa 32 V3 SX1262 --------------------
static const int LORA_CS   = 8;
static const int LORA_SCK  = 9;
static const int LORA_MOSI = 10;
static const int LORA_MISO = 11;
static const int LORA_RST  = 12;
static const int LORA_BUSY = 13;
static const int LORA_DIO1 = 14;

SX1262 radio = new Module(LORA_CS, LORA_DIO1, LORA_RST, LORA_BUSY);

// US915, sub-band 2
static const uint8_t SUBBAND = 2;
static const uint8_t FPORT = 1;

LoRaWANNode node(&radio, &US915, SUBBAND);

// -------------------- OTAA Credentials --------------------
// These are the values from your earlier code.
// Change them here if you updated them in TTN/TTS.
uint64_t joinEUI = 0x0000000000000000ULL;
uint64_t devEUI  = 0x70B3D57ED0076032ULL;

uint8_t appKey[16] = {
  0xD0, 0xFC, 0xAA, 0x3C,
  0x10, 0xF3, 0x2C, 0x7B,
  0x0D, 0xFC, 0x2F, 0x1D,
  0xCC, 0xF6, 0xD2, 0xC1
};

// -------------------- Helpers --------------------
static void printScdError(const char *where, uint16_t error) {
  if (!error) return;

  char msg[256];
  errorToString(error, msg, sizeof(msg));

  Serial.print(where);
  Serial.print(": ");
  Serial.println(msg);
}

template <typename Func>
static uint16_t retrySensirion(Func f, int attempts, uint32_t delayMs) {
  uint16_t err = 0;

  for (int i = 0; i < attempts; i++) {
    err = f();
    if (!err) return 0;
    delay(delayMs);
  }

  return err;
}

static void packPayload(
  uint8_t *payload,
  uint16_t co2,
  float scdTemp,
  float rh,
  float bmpTemp,
  int32_t pressurePa
) {
  int16_t scdT = (int16_t)lroundf(scdTemp * 100.0f);
  uint16_t hum = (uint16_t)lroundf(rh * 100.0f);
  int16_t bmpT = (int16_t)lroundf(bmpTemp * 100.0f);
  uint32_t prs = (uint32_t)pressurePa;

  payload[0]  = co2 & 0xFF;
  payload[1]  = (co2 >> 8) & 0xFF;

  payload[2]  = scdT & 0xFF;
  payload[3]  = (scdT >> 8) & 0xFF;

  payload[4]  = hum & 0xFF;
  payload[5]  = (hum >> 8) & 0xFF;

  payload[6]  = bmpT & 0xFF;
  payload[7]  = (bmpT >> 8) & 0xFF;

}

bool initSensors() {
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(50000);

  Serial.print("BMP180 init: ");
  bool bmpOk = bmp.begin();
  Serial.println(bmpOk ? "OK" : "FAIL");

  scd4x.begin(Wire, SCD4X_ADDR);
  delay(1200);

  uint64_t serialNumber = 0;
  uint16_t err = retrySensirion(
    [&]() { return scd4x.getSerialNumber(serialNumber); },
    5,
    300
  );

  Serial.print("SCD41 serial read: ");
  Serial.println(err ? "FAIL" : "OK");

  retrySensirion([&]() { return scd4x.stopPeriodicMeasurement(); }, 3, 200);
  delay(300);
  retrySensirion([&]() { return scd4x.reinit(); }, 3, 300);
  delay(500);

  err = retrySensirion(
    [&]() { return scd4x.startPeriodicMeasurement(); },
    3,
    300
  );

  Serial.println(err ? "SCD41 periodic start: FAIL" : "SCD41 periodic start: OK");

  return bmpOk && (err == 0);
}

bool initRadio() {
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);

  int16_t state = radio.begin();
  Serial.print("radio.begin() = ");
  Serial.println(state);

  if (state != RADIOLIB_ERR_NONE) {
    return false;
  }

  // Heltec V3 SX1262 board helpers
  radio.setDio2AsRfSwitch(true);
  radio.setTCXO(1.8);

  Serial.println("SX1262 configured.");
  return true;
}

bool joinNetwork() {
  Serial.println("Starting OTAA join...");

  int16_t state = node.beginOTAA(joinEUI, devEUI, NULL, appKey);
  Serial.print("beginOTAA() = ");
  Serial.println(state);

  if (state != RADIOLIB_ERR_NONE) {
    return false;
  }

  for (int attempt = 1; attempt <= 10; attempt++) {
    Serial.print("activateOTAA attempt ");
    Serial.println(attempt);

    state = node.activateOTAA();
    Serial.print("activateOTAA() = ");
    Serial.println(state);

    if (state == RADIOLIB_ERR_NONE) {
      Serial.println("Join successful.");
      return true;
    }

    delay(5000);
  }

  Serial.println("Join failed.");
  return false;
}

bool readAndSend() {
  bool dataReady = false;
  uint16_t err = scd4x.getDataReadyStatus(dataReady);

  if (err) {
    printScdError("getDataReadyStatus", err);
    return false;
  }

  if (!dataReady) {
    Serial.println("SCD41 data not ready yet.");
    return false;
  }

  uint16_t co2 = 0;
  float scdTemp = 0.0f;
  float humidity = 0.0f;

  err = scd4x.readMeasurement(co2, scdTemp, humidity);
  if (err) {
    printScdError("readMeasurement", err);
    return false;
  }

  float bmpTemp = bmp.readTemperature();
  int32_t pressure = bmp.readPressure();

  uint8_t payload[11];
  packPayload(payload, co2, scdTemp, humidity, bmpTemp, pressure);

  Serial.println("Sending uplink...");
  int16_t state = node.sendReceive(payload, sizeof(payload), FPORT);
  Serial.print("sendReceive() = ");
  Serial.println(state);

  if (state < 0) {
    Serial.println("Uplink failed.");
    return false;
  }

  Serial.println("Uplink sent.");
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println();
  Serial.println("Booting Heltec V3 sensor node...");

  bool sensorsOk = initSensors();
  bool radioOk = initRadio();

  if (!sensorsOk) {
    Serial.println("Sensor init incomplete.");
  }

  if (!radioOk) {
    Serial.println("Radio init failed. Halting.");
    while (true) {
      delay(1000);
    }
  }

  if (!joinNetwork()) {
    Serial.println("Network join failed. Halting.");
    while (true) {
      delay(2000);
    }
  }
}

void loop() {
  readAndSend();
  delay(60000);
}
