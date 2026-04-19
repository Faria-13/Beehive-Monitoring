#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <math.h>
#include <Preferences.h>
#include <esp_sleep.h>
#include <esp_system.h>

#include <Adafruit_BMP085.h>
#include <SensirionI2CScd4x.h>
#include <SensirionCore.h>
#include <RadioLib.h>

// ============================================================
//                        USER SETTINGS
// ============================================================

// Set TRUE for one upload only if you want to wipe saved nonce history.
// After one fresh test, set it back to false.
#define FORCE_CLEAR_NONCES_ONCE false

// Default deep sleep in minutes
#define DEFAULT_SLEEP_MINUTES 3

// Battery calibration
#define BATTERY_PIN 1
#define ADC_CTRL_PIN 37
#define BATTERY_LOW_VOLTAGE 3.10f
#define BATTERY_HIGH_VOLTAGE 4.20f
#define BATTERY_DIVIDER_RATIO 5.1f

// I2C pins
static const int SDA_PIN = 40;
static const int SCL_PIN = 39;

// SCD41 default I2C address
static const uint8_t SCD4X_ADDR = 0x62;

// Heltec WiFi LoRa 32 V3 SX1262
static const int LORA_CS   = 8;
static const int LORA_SCK  = 9;
static const int LORA_MOSI = 10;
static const int LORA_MISO = 11;
static const int LORA_RST  = 12;
static const int LORA_BUSY = 13;
static const int LORA_DIO1 = 14;

// LoRaWAN
static const uint8_t SUBBAND = 2;      // US915 FSB2
static const uint8_t UPLINK_FPORT = 1;

// ============================================================
//                 OTAA CREDENTIALS - KEEP YOUR VALUES
// ============================================================

uint64_t joinEUI = 0x0000000000000000ULL;
uint64_t devEUI  = 0x70B3D57ED0076ADEULL;

uint8_t appKey[16] = {
  0xD0, 0xFC, 0xAA, 0x3C,
  0x10, 0xF3, 0x2C, 0x7B,
  0x0D, 0xFC, 0x2F, 0x1D,
  0xCC, 0xF6, 0xD2, 0xC1
};

// ============================================================
//                        GLOBALS
// ============================================================

#define uS_TO_S_FACTOR 1000000ULL

Preferences store;
Adafruit_BMP085 bmp;
SensirionI2cScd4x scd4x;

SX1262 radio = new Module(LORA_CS, LORA_DIO1, LORA_RST, LORA_BUSY);
LoRaWANNode* node = nullptr;

bool bmpOk = false;
bool scdOk = false;
uint8_t g_sleepMinutes = DEFAULT_SLEEP_MINUTES;

// ============================================================
//                        HELPERS
// ============================================================

static void printScdError(const char* where, uint16_t error) {
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

void printWakeReason() {
  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();

  Serial.print("Wake reason: ");
  switch (wakeup_reason) {
    case ESP_SLEEP_WAKEUP_TIMER:
      Serial.println("TIMER");
      break;
    case ESP_SLEEP_WAKEUP_UNDEFINED:
      Serial.println("UNDEFINED / COLD BOOT");
      break;
    default:
      Serial.printf("OTHER (%d)\n", wakeup_reason);
      break;
  }
}

void printResetReason() {
  Serial.print("Reset reason CPU0: ");
  Serial.println((int)esp_reset_reason());
}

void printRadioLibState(const char* label, int16_t state) {
  Serial.print(label);
  Serial.print(" = ");
  Serial.println(state);
}

void scanI2C() {
  Serial.println("Scanning I2C bus...");
  int found = 0;

  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    uint8_t err = Wire.endTransmission();

    if (err == 0) {
      Serial.print("I2C device found at 0x");
      if (addr < 16) Serial.print("0");
      Serial.println(addr, HEX);
      found++;
    }
  }

  if (found == 0) {
    Serial.println("No I2C devices found.");
  }
}

// ============================================================
//                 LORAWAN NONCE STORAGE ONLY
// ============================================================

void saveNoncesToFlash() {
  if (!node) return;

  uint8_t nonceBuf[RADIOLIB_LORAWAN_NONCES_BUF_SIZE];
  memcpy(nonceBuf, node->getBufferNonces(), RADIOLIB_LORAWAN_NONCES_BUF_SIZE);

  store.begin("radiolib", false);
  store.putBytes("nonces", nonceBuf, RADIOLIB_LORAWAN_NONCES_BUF_SIZE);
  store.end();

  Serial.println("Saved LoRaWAN nonces to flash.");
}

bool restoreNoncesFromFlash() {
  if (!node) return false;

  store.begin("radiolib", true);

  size_t len = store.getBytesLength("nonces");
  if (len != RADIOLIB_LORAWAN_NONCES_BUF_SIZE) {
    store.end();
    Serial.println("No valid saved nonces in flash.");
    return false;
  }

  uint8_t nonceBuf[RADIOLIB_LORAWAN_NONCES_BUF_SIZE];
  store.getBytes("nonces", nonceBuf, RADIOLIB_LORAWAN_NONCES_BUF_SIZE);
  store.end();

  int16_t state = node->setBufferNonces(nonceBuf);
  if (state == RADIOLIB_ERR_NONE) {
    Serial.println("Restored LoRaWAN nonces from flash.");
    return true;
  }

  Serial.print("Failed to restore nonces: ");
  Serial.println(state);
  return false;
}

void clearNoncesInFlash() {
  store.begin("radiolib", false);
  store.remove("nonces");
  store.end();
  Serial.println("Cleared LoRaWAN nonces from flash.");
}

// ============================================================
//                        PAYLOAD
// ============================================================
// Payload layout (10 bytes total):
// [0..1]  CO2 ppm, uint16 little-endian
// [2..3]  battery %, value * 100, int16 little-endian
// [4..5]  humidity %, value * 100, uint16 little-endian
// [6..7]  BMP180 temp C, value * 100, int16 little-endian
// [8..9]  pressure hPa, value * 10, uint16 little-endian

static void packPayload(
  uint8_t* payload,
  uint16_t co2,
  float batteryPercent,
  float rh,
  float bmpTemp,
  float bmpPressurePa
) {
  int16_t battPct = (int16_t)lroundf(batteryPercent * 100.0f);
  uint16_t hum    = (uint16_t)lroundf(rh * 100.0f);
  int16_t bmpT    = (int16_t)lroundf(bmpTemp * 100.0f);

  float pressureHpa = bmpPressurePa / 100.0f;
  uint16_t bmpP     = (uint16_t)lroundf(pressureHpa * 10.0f);

  payload[0] = co2 & 0xFF;
  payload[1] = (co2 >> 8) & 0xFF;

  payload[2] = battPct & 0xFF;
  payload[3] = (battPct >> 8) & 0xFF;

  payload[4] = hum & 0xFF;
  payload[5] = (hum >> 8) & 0xFF;

  payload[6] = bmpT & 0xFF;
  payload[7] = (bmpT >> 8) & 0xFF;

  payload[8] = bmpP & 0xFF;
  payload[9] = (bmpP >> 8) & 0xFF;
}

// ============================================================
//                     RADIO / NODE SETUP
// ============================================================

void rebuildLoRaWANNode() {
  if (node != nullptr) {
    delete node;
    node = nullptr;
  }

  node = new LoRaWANNode(&radio, &US915, SUBBAND);
  node->scanGuard = 50;
  Serial.println("LoRaWAN node rebuilt.");
}

bool initRadio() {
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);

  int16_t state = radio.begin(915.0);
  Serial.print("radio.begin() = ");
  Serial.println(state);

  if (state != RADIOLIB_ERR_NONE) {
    return false;
  }

  delay(50);

  int16_t s = radio.setDio2AsRfSwitch(true);
  printRadioLibState("setDio2AsRfSwitch()", s);

  s = radio.setTCXO(1.8);
  printRadioLibState("setTCXO()", s);

  s = radio.setCurrentLimit(140.0);
  printRadioLibState("setCurrentLimit()", s);

  s = radio.setOutputPower(22);
  printRadioLibState("setOutputPower()", s);

  Serial.println("SX1262 configured.");
  return true;
}

// ============================================================
//                         SENSORS
// ============================================================

bool waitForScd41Data(uint32_t timeoutMs = 8000) {
  uint32_t start = millis();

  while (millis() - start < timeoutMs) {
    bool dataReady = false;
    uint16_t err = scd4x.getDataReadyStatus(dataReady);

    if (err) {
      printScdError("getDataReadyStatus", err);
      return false;
    }

    if (dataReady) {
      return true;
    }

    delay(500);
  }

  Serial.println("SCD41 timed out waiting for data.");
  return false;
}

bool initBMP180() {
  Serial.print("BMP180 init: ");
  bool ok = bmp.begin();
  Serial.println(ok ? "OK" : "FAIL");
  return ok;
}

bool initSCD41() {
  scd4x.begin(Wire, SCD4X_ADDR);
  delay(300);

  uint16_t err = retrySensirion(
    [&]() { return scd4x.stopPeriodicMeasurement(); },
    3,
    300
  );

  if (err) {
    printScdError("SCD41 stopPeriodicMeasurement", err);
  }

  delay(600);

  uint64_t serialNumber = 0;
  uint16_t serialErr = retrySensirion(
    [&]() { return scd4x.getSerialNumber(serialNumber); },
    5,
    400
  );

  if (serialErr) {
    printScdError("SCD41 getSerialNumber", serialErr);
  }

  Serial.print("SCD41 serial read: ");
  Serial.println(serialErr ? "FAIL" : "OK");

  if (!serialErr) {
    Serial.print("SCD41 serial: 0x");
    Serial.println((unsigned long)(serialNumber >> 32), HEX);
    Serial.println((unsigned long)(serialNumber & 0xFFFFFFFF), HEX);
  }

  delay(100);

  uint16_t startErr = retrySensirion(
    [&]() { return scd4x.startPeriodicMeasurement(); },
    3,
    400
  );

  if (startErr) {
    printScdError("SCD41 startPeriodicMeasurement", startErr);
  }

  Serial.print("SCD41 periodic start: ");
  Serial.println(startErr ? "FAIL" : "OK");

  return (serialErr == 0) && (startErr == 0);
}

bool initSensors() {
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);
  delay(150);

  scanI2C();

  bmpOk = initBMP180();
  scdOk = initSCD41();

  Serial.print("BMP180 overall: ");
  Serial.println(bmpOk ? "OK" : "FAIL");

  Serial.print("SCD41 overall: ");
  Serial.println(scdOk ? "OK" : "FAIL");

  return bmpOk || scdOk;
}

// ============================================================
//                    BATTERY MEASUREMENT
// ============================================================

static float readBatteryPercent() {
  digitalWrite(ADC_CTRL_PIN, HIGH);
  delay(10);

  int raw = analogRead(BATTERY_PIN);

  float voltage = (raw / 4095.0f) * 3.3f;
  float batteryVoltage = voltage * BATTERY_DIVIDER_RATIO;

  float percent =
    ((batteryVoltage - BATTERY_LOW_VOLTAGE) /
     (BATTERY_HIGH_VOLTAGE - BATTERY_LOW_VOLTAGE)) * 100.0f;

  if (percent < 0.0f) percent = 0.0f;
  if (percent > 100.0f) percent = 100.0f;

  Serial.print("Battery voltage: ");
  Serial.print(batteryVoltage, 2);
  Serial.println(" V");

  Serial.print("Battery percent: ");
  Serial.print(percent, 1);
  Serial.println("%");

  digitalWrite(ADC_CTRL_PIN, LOW);
  return percent;
}

// ============================================================
//                  LORAWAN PREPARE / JOIN
// ============================================================

bool prepareLoRaWAN() {
  if (!node) {
    Serial.println("LoRaWAN node is null.");
    return false;
  }

  Serial.println("Preparing LoRaWAN state...");
  Serial.println("Starting OTAA...");

  int16_t state = node->beginOTAA(joinEUI, devEUI, NULL, appKey);
  Serial.print("beginOTAA() = ");
  Serial.println(state);

  if (state != RADIOLIB_ERR_NONE) {
    return false;
  }

  node->setADR(false);
  node->setDatarate(0);
  node->setTxPower(20);

  restoreNoncesFromFlash();
  delay(1000);

  state = node->activateOTAA();
  Serial.print("activateOTAA() = ");
  Serial.println(state);

  bool activated = node->isActivated();
  Serial.print("node.isActivated() = ");
  Serial.println(activated ? "true" : "false");

  if (!activated) {
    Serial.println("OTAA failed.");
    return false;
  }

  Serial.println("LoRaWAN active.");
  saveNoncesToFlash();
  return true;
}

// ============================================================
//                    SENSOR READ HELPERS
// ============================================================

bool readSCD41(float &humidity, uint16_t &co2) {
  if (!scdOk) {
    humidity = NAN;
    co2 = 0;
    return false;
  }

  if (!waitForScd41Data()) {
    Serial.println("SCD41 data not ready.");
    return false;
  }

  float scdTemp = 0.0f;
  uint16_t err = scd4x.readMeasurement(co2, scdTemp, humidity);
  if (err) {
    printScdError("readMeasurement", err);
    return false;
  }

  Serial.print("SCD41 CO2: ");
  Serial.print(co2);
  Serial.println(" ppm");

  Serial.print("SCD41 humidity: ");
  Serial.print(humidity, 2);
  Serial.println(" %");

  return true;
}

bool readBMP180(float &bmpTemp, float &pressurePa) {
  if (!bmpOk) {
    bmpTemp = NAN;
    pressurePa = NAN;
    return false;
  }

  bmpTemp = bmp.readTemperature();
  pressurePa = (float)bmp.readPressure();

  Serial.print("BMP180 temp: ");
  Serial.print(bmpTemp, 2);
  Serial.println(" C");

  Serial.print("BMP180 pressure: ");
  Serial.print(pressurePa, 0);
  Serial.println(" Pa");

  return true;
}

// ============================================================
//                        UPLINK
// ============================================================

bool sendUplinkOnce() {
  if (!node) {
    Serial.println("LoRaWAN node is null.");
    return false;
  }

  Serial.println("---- readAndSend() ----");
  Serial.print("Before uplink, node.isActivated() = ");
  Serial.println(node->isActivated() ? "true" : "false");

  if (!node->isActivated()) {
    Serial.println("Node is not activated before uplink.");
    return false;
  }

  uint16_t co2 = 0;
  float humidity = 0.0f;
  float bmpTemp = 0.0f;
  float pressurePa = 0.0f;

  bool scdReadOk = readSCD41(humidity, co2);
  bool bmpReadOk = readBMP180(bmpTemp, pressurePa);

  if (!bmpReadOk) {
    Serial.println("BMP180 read failed. Cannot build payload.");
    return false;
  }

  if (!scdReadOk) {
    Serial.println("SCD41 read failed. Sending fallback values for CO2/humidity.");
    co2 = 0;
    humidity = 0.0f;
  }

  float batteryPercent = readBatteryPercent();

  uint8_t payload[10];
  packPayload(payload, co2, batteryPercent, humidity, bmpTemp, pressurePa);

  Serial.print("Payload bytes: ");
  for (size_t i = 0; i < sizeof(payload); i++) {
    if (payload[i] < 16) Serial.print("0");
    Serial.print(payload[i], HEX);
    Serial.print(" ");
  }
  Serial.println();

  delay(300);
  Serial.println("Sending uplink...");

  int16_t state = node->sendReceive(payload, sizeof(payload), UPLINK_FPORT, false);
  printRadioLibState("sendReceive()", state);

  Serial.print("After uplink, node.isActivated() = ");
  Serial.println(node->isActivated() ? "true" : "false");

  if (state < 0) {
    Serial.println("Uplink failed.");
    return false;
  }

  Serial.println("Uplink sent.");
  return true;
}

bool readAndSend() {
  if (sendUplinkOnce()) {
    return true;
  }

  Serial.println("Reinitializing radio and node once...");

  if (!initRadio()) {
    Serial.println("Radio reinit failed.");
    return false;
  }

  rebuildLoRaWANNode();

  int16_t state = node->beginOTAA(joinEUI, devEUI, NULL, appKey);
  Serial.print("beginOTAA() after radio reinit = ");
  Serial.println(state);

  if (state != RADIOLIB_ERR_NONE) {
    return false;
  }

  node->setADR(false);
  node->setDatarate(0);
  node->setTxPower(20);

  restoreNoncesFromFlash();

  Serial.println("Calling activateOTAA() now...");
  state = node->activateOTAA();
  Serial.println("Returned from activateOTAA()");
  Serial.print("activateOTAA() = ");
  Serial.println(state);

  Serial.print("node.isActivated() after radio reinit = ");
  Serial.println(node->isActivated() ? "true" : "false");

  if (!node->isActivated()) {
    Serial.println("Node not active after radio reinit.");
    return false;
  }

  saveNoncesToFlash();
  return sendUplinkOnce();
}

// ============================================================
//                          SETUP
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println();
  Serial.println("Booting Heltec V3 sensor node...");
  printResetReason();
  printWakeReason();

  pinMode(ADC_CTRL_PIN, OUTPUT);
  digitalWrite(ADC_CTRL_PIN, LOW);

  analogReadResolution(12);
  analogSetPinAttenuation(BATTERY_PIN, ADC_11db);

  if (FORCE_CLEAR_NONCES_ONCE) {
    Serial.println("FORCE_CLEAR_NONCES_ONCE enabled.");
    clearNoncesInFlash();
  }

  bool sensorsAnyOk = initSensors();
  bool radioOk = initRadio();

  rebuildLoRaWANNode();

  if (!sensorsAnyOk) {
    Serial.println("No sensors initialized successfully.");
  }

  if (!radioOk) {
    Serial.println("Radio init failed. Halting.");
    while (true) {
      delay(1000);
    }
  }

  if (!prepareLoRaWAN()) {
    Serial.println("Network prepare/join failed. Halting.");
    while (true) {
      delay(2000);
    }
  }
}

// ============================================================
//                           LOOP
// ============================================================

void loop() {
  bool ok = readAndSend();

  if (!ok) {
    Serial.println("Cycle ended with uplink failure.");
  }

  Serial.print("Entering deep sleep for ");
  Serial.print(g_sleepMinutes);
  Serial.println(" minute(s)...");
  Serial.flush();

  digitalWrite(ADC_CTRL_PIN, LOW);

  uint64_t sleepSeconds = (uint64_t)g_sleepMinutes * 60ULL;
  esp_sleep_enable_timer_wakeup(sleepSeconds * uS_TO_S_FACTOR);
  esp_deep_sleep_start();
}