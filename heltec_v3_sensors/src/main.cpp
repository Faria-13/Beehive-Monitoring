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

// Set TRUE for one upload only to wipe bad saved nonce history.
// After one successful fresh join, set this back to false.
#define FORCE_CLEAR_NONCES_ONCE true

// Deep sleep in minutes
#define TIME_TO_SLEEP_MINUTES 3

// Battery calibration
#define BATTERY_PIN 1
#define ADC_CTRL_PIN 37
#define BATTERY_LOW_VOLTAGE 3.10f
#define BATTERY_HIGH_VOLTAGE 4.20f
#define BATTERY_DIVIDER_RATIO 5.1f   // keep your existing calibration for now

// I2C
static const int SDA_PIN = 39;
static const int SCL_PIN = 40;
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
static const uint8_t SUBBAND = 2;   // US915 FSB2
static const uint8_t FPORT   = 1;

// OTAA credentials
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
#define TIME_TO_SLEEP_SEC (TIME_TO_SLEEP_MINUTES * 60)

Preferences store;
Adafruit_BMP085 bmp;
SensirionI2cScd4x scd4x;

SX1262 radio = new Module(LORA_CS, LORA_DIO1, LORA_RST, LORA_BUSY);
LoRaWANNode* node = nullptr;

// RTC memory survives deep sleep, not full power loss
RTC_DATA_ATTR uint8_t lwSession[RADIOLIB_LORAWAN_SESSION_BUF_SIZE];
RTC_DATA_ATTR bool hasRtcSession = false;

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

bool isTimerWake() {
  return esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_TIMER;
}

// ============================================================
//                 LORAWAN SESSION / NONCE STORAGE
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

void saveSessionToRtc() {
  if (!node) return;

  memcpy(lwSession, node->getBufferSession(), RADIOLIB_LORAWAN_SESSION_BUF_SIZE);
  hasRtcSession = true;
  Serial.println("Saved LoRaWAN session to RTC memory.");
}

bool restoreSessionFromRtc() {
  if (!node) return false;

  if (!hasRtcSession) {
    Serial.println("No RTC session saved.");
    return false;
  }

  int16_t state = node->setBufferSession(lwSession);
  if (state == RADIOLIB_ERR_NONE) {
    Serial.println("Restored LoRaWAN session from RTC memory.");
    return true;
  }

  Serial.print("Failed to restore RTC session: ");
  Serial.println(state);
  return false;
}

void clearRtcSession() {
  hasRtcSession = false;
  memset(lwSession, 0, sizeof(lwSession));
  Serial.println("Cleared RTC session.");
}

// ============================================================
//                        PAYLOAD
// ============================================================

// NOTE:
// This keeps the same general payload size, but fixes pressure packing.
// Pressure is sent as hPa * 10.
// Make sure your TTN payload formatter matches this.
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

  radio.setDio2AsRfSwitch(true);
  radio.setTCXO(0.8);
  radio.setCurrentLimit(140.0);
  radio.setOutputPower(22);

  Serial.println("SX1262 configured.");
  return true;
}

// ============================================================
//                         SENSORS
// ============================================================

bool waitForScd41Data(uint32_t timeoutMs = 7000) {
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
//                  SESSION RESTORE / OTAA JOIN
// ============================================================

bool prepareLoRaWAN() {
  if (!node) {
    Serial.println("LoRaWAN node is null.");
    return false;
  }

  Serial.println("Preparing LoRaWAN state...");
  Serial.println("Starting OTAA/restore...");

  int16_t state = node->beginOTAA(joinEUI, devEUI, NULL, appKey);
  Serial.print("beginOTAA() = ");
  Serial.println(state);

  if (state != RADIOLIB_ERR_NONE) {
    return false;
  }

  node->setADR(false);
  node->setDatarate(0);
  node->setTxPower(20);

  if (isTimerWake()) {
    Serial.println("Timer wake detected. Trying RTC session restore first...");

    bool rtcOk = restoreSessionFromRtc();

    state = node->activateOTAA();
    Serial.print("activateOTAA() = ");
    Serial.println(state);

    bool activated = node->isActivated();
    Serial.print("node.isActivated() = ");
    Serial.println(activated ? "true" : "false");

    if (rtcOk && activated) {
      Serial.println("LoRaWAN session restored and verified.");
      saveSessionToRtc();
      return true;
    }

    Serial.println("RTC session restore path did not recover link. Falling back to fresh OTAA join.");
    clearRtcSession();
  } else {
    Serial.println("Cold boot detected.");
    clearRtcSession();
  }

  // Fresh OTAA join path
  restoreNoncesFromFlash();

  state = node->activateOTAA();
  Serial.print("activateOTAA() = ");
  Serial.println(state);

  bool activated = node->isActivated();
  Serial.print("node.isActivated() = ");
  Serial.println(activated ? "true" : "false");

  if (!activated) {
    Serial.println("Fresh OTAA join failed.");
    return false;
  }

  Serial.println("New LoRaWAN join successful.");
  saveNoncesToFlash();
  saveSessionToRtc();
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

  if (!waitForScd41Data()) {
    Serial.println("SCD41 data not ready.");
    return false;
  }

  uint16_t co2 = 0;
  float scdTemp = 0.0f;
  float humidity = 0.0f;

  uint16_t err = scd4x.readMeasurement(co2, scdTemp, humidity);
  if (err) {
    printScdError("readMeasurement", err);
    return false;
  }

  float bmpTemp = bmp.readTemperature();
  int32_t pressurePa = bmp.readPressure();
  float batteryPercent = readBatteryPercent();

  uint8_t payload[10];
  packPayload(payload, co2, batteryPercent, humidity, bmpTemp, (float)pressurePa);

  delay(300);

  Serial.println("Sending uplink...");
  int16_t state = node->sendReceive(payload, sizeof(payload), FPORT, false);
  printRadioLibState("sendReceive()", state);

  Serial.print("After uplink, node.isActivated() = ");
  Serial.println(node->isActivated() ? "true" : "false");

  // RadioLib may return positive values when a downlink/MAC event occurs,
  // so only treat negative values as failure.
  if (state < 0) {
    Serial.println("Uplink failed.");
    return false;
  }

  Serial.println("Uplink sent.");
  saveSessionToRtc();
  return true;
}

bool readAndSend() {
  // First attempt
  if (sendUplinkOnce()) {
    return true;
  }

  Serial.println("Reinitializing radio and restoring session once, without OTAA rejoin...");

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

  if (!restoreSessionFromRtc()) {
    Serial.println("Could not restore RTC session after radio reinit.");
    return false;
  }

  state = node->activateOTAA();
  Serial.print("activateOTAA() after radio reinit = ");
  Serial.println(state);

  Serial.print("node.isActivated() after radio reinit = ");
  Serial.println(node->isActivated() ? "true" : "false");

  if (!node->isActivated()) {
    Serial.println("Session not active after radio reinit.");
    return false;
  }

  // Retry send one time only, still without forcing a fresh join
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
    clearRtcSession();
  }

  bool sensorsOk = initSensors();
  bool radioOk = initRadio();

  rebuildLoRaWANNode();

  if (!sensorsOk) {
    Serial.println("Sensor init incomplete.");
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

  Serial.println("Entering deep sleep...");
  Serial.flush();

  digitalWrite(ADC_CTRL_PIN, LOW);

  esp_sleep_enable_timer_wakeup((uint64_t)TIME_TO_SLEEP_SEC * uS_TO_S_FACTOR);
  esp_deep_sleep_start();
}