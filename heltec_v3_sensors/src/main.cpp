#include <Arduino.h>
#include <Wire.h>
#include <math.h>

#include <heltec.h>
#include "LoRaWan_APP.h"

#include <Adafruit_BMP085.h>
#include <SensirionI2cScd4x.h>
#include <SensirionCore.h>

#define ENABLE_ENV_SENSORS 0 // skips all sensor data for testing connection.
// ============================================================
//                        OTAA PARAMS
// ============================================================

uint8_t devEui[] = { 0x70, 0xB3, 0xD5, 0x7E, 0xD0, 0x07, 0x6A, 0xDE };
uint8_t appEui[] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
uint8_t appKey[] = { 0xD0, 0xFC, 0xAA, 0x3C, 0x10, 0xF3, 0x2C, 0x7B, 0x0D, 0xFC, 0x2F, 0x1D, 0xCC, 0xF6, 0xD2, 0xC1 };

// ============================================================
//                        ABP PARAMS
//                  (kept for library compatibility)
// ============================================================

uint8_t nwkSKey[] = { 0x15, 0xB1, 0xD0, 0xEF, 0xA4, 0x63, 0xDF, 0xBE, 0x3D, 0x11, 0x18, 0x1E, 0x1E, 0xC7, 0xDA, 0x85 };

uint8_t appSKey[] = { 0xD7, 0x2C, 0x78, 0x75, 0x8C, 0xDC, 0xCA, 0xBF, 0x55, 0xEE, 0x4A, 0x77, 0x8D, 0x16, 0xEF, 0x67 };

uint32_t devAddr = (uint32_t)0x007E6AE1;

// ============================================================
//                     LORAWAN SETTINGS
// ============================================================

// US915 FSB2 / channels 8-15
uint16_t userChannelsMask[6] = { 0xFF00, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000 };

LoRaMacRegion_t loraWanRegion = ACTIVE_REGION;
DeviceClass_t loraWanClass = CLASS_A;

// Default interval: 2 minutes
uint32_t appTxDutyCycle = 2UL * 60UL * 1000UL;

bool overTheAirActivation = true;
bool loraWanAdr = false;
bool isTxConfirmed = false;
uint8_t appPort = 1;
uint8_t confirmedNbTrials = 4;

// ============================================================
//                     SENSOR / BATTERY SETTINGS
// ============================================================

static const int SDA_PIN = 40;
static const int SCL_PIN = 39;
static const uint8_t SCD4X_ADDR = 0x62;

#define BATTERY_PIN 1
#define ADC_CTRL_PIN 37
#define BATTERY_LOW_VOLTAGE 3.10f
#define BATTERY_HIGH_VOLTAGE 4.20f
#define BATTERY_DIVIDER_RATIO 5.1f

Adafruit_BMP085 bmp;
SensirionI2cScd4x scd4x;

bool bmpOk = false;
bool scdOk = false;

// Downlink-controlled settings
uint8_t g_sleepMinutes = 3;   // start at 10 minutes
bool g_debugEnabled = true;
bool g_forceImmediateSend = false;

// ============================================================
//                           HELPERS
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

static void scanI2C() {
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
//                         SENSORS
// ============================================================

static bool waitForScd41Data(uint32_t timeoutMs = 8000) {
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

static bool initBMP180() {
  Serial.print("BMP180 init: ");
  bool ok = bmp.begin();
  Serial.println(ok ? "OK" : "FAIL");
  return ok;
}

static bool initSCD41() {
  scd4x.begin(Wire, SCD4X_ADDR);
  delay(300);

  uint16_t stopErr = retrySensirion(
    [&]() { return scd4x.stopPeriodicMeasurement(); },
    3,
    300
  );

  if (stopErr) {
    printScdError("SCD41 stopPeriodicMeasurement", stopErr);
  }

  delay(600);

  uint64_t serialNumber = 0;
  uint16_t serialErr = retrySensirion(
    [&]() { return scd4x.getSerialNumber(serialNumber); },
    5,
    400
  );

  Serial.print("SCD41 serial read: ");
  Serial.println(serialErr ? "FAIL" : "OK");

  if (serialErr) {
    printScdError("SCD41 getSerialNumber", serialErr);
  }

  delay(100);

  uint16_t startErr = retrySensirion(
    [&]() { return scd4x.startPeriodicMeasurement(); },
    3,
    400
  );

  Serial.print("SCD41 periodic start: ");
  Serial.println(startErr ? "FAIL" : "OK");

  return (serialErr == 0) && (startErr == 0);
}

static bool initSensors() {
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

static bool readSCD41(float& humidity, uint16_t& co2) {
  humidity = 0.0f;
  co2 = 0;

  if (!scdOk) return false;

  if (!waitForScd41Data()) {
    Serial.println("SCD41 data not ready.");
    return false;
  }

  float scdTempC = 0.0f;
  uint16_t err = scd4x.readMeasurement(co2, scdTempC, humidity);
  if (err) {
    printScdError("readMeasurement", err);
    return false;
  }

  if (g_debugEnabled) {
    Serial.print("SCD41 CO2: ");
    Serial.print(co2);
    Serial.println(" ppm");

    Serial.print("SCD41 humidity: ");
    Serial.print(humidity, 2);
    Serial.println(" %");
  }

  return true;
}

static bool readBMP180(float& bmpTempC, float& pressurePa) {
  bmpTempC = NAN;
  pressurePa = NAN;

  if (!bmpOk) return false;

  bmpTempC = bmp.readTemperature();
  pressurePa = (float)bmp.readPressure();

  if (g_debugEnabled) {
    Serial.print("BMP180 temp C: ");
    Serial.print(bmpTempC, 2);
    Serial.println(" C");

    Serial.print("BMP180 pressure: ");
    Serial.print(pressurePa, 0);
    Serial.println(" Pa");
  }

  return true;
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

  if (g_debugEnabled) {
    Serial.print("Battery raw: ");
    Serial.println(raw);

    Serial.print("Battery voltage: ");
    Serial.print(batteryVoltage, 2);
    Serial.println(" V");

    Serial.print("Battery percent: ");
    Serial.print(percent, 1);
    Serial.println("%");
  }

  digitalWrite(ADC_CTRL_PIN, LOW);
  return percent;
}

// ============================================================
//                           PAYLOAD
// ============================================================
// [0..1] CO2 ppm, uint16 LE
// [2..3] battery %, value *100, int16 LE
// [4..5] humidity %, value *100, uint16 LE
// [6..7] BMP180 temp F, value *100, int16 LE
// [8..9] pressure hPa, value *10, uint16 LE

static void packPayload(
  uint8_t* payload,
  uint16_t co2,
  float batteryPercent,
  float rh,
  float bmpTempC,
  float bmpPressurePa
) {
  float tempF = (bmpTempC * 9.0f / 5.0f) + 32.0f;

  int16_t battPct = (int16_t)lroundf(batteryPercent * 100.0f);
  uint16_t hum = (uint16_t)lroundf(rh * 100.0f);
  int16_t bmpT = (int16_t)lroundf(tempF * 100.0f);

  float pressureHpa = bmpPressurePa / 100.0f;
  uint16_t bmpP = (uint16_t)lroundf(pressureHpa * 10.0f);

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
//                    DOWNLINK COMMANDS
// ============================================================

static void handleDownlink() {
  if (appDataSize <= 0) return;

  if (g_debugEnabled) {
    Serial.print("Downlink bytes: ");
    for (size_t i = 0; i < appDataSize; i++) {
      if (appData[i] < 16) Serial.print("0");
      Serial.print(appData[i], HEX);
      Serial.print(" ");
    }
    Serial.println();
  }

  switch (appData[0]) {
    case 0x01: { // restart
      Serial.println("Downlink command: restart");
      delay(200);
      ESP.restart();
      break;
    }

    case 0x02: { // set_sleep_minutes
      if (appDataSize > 1) {
        g_sleepMinutes = appData[1];
        Serial.print("Downlink command: set_sleep_minutes = ");
        Serial.println(g_sleepMinutes);
      } else {
        Serial.println("Downlink command 0x02 missing minutes byte");
      }
      break;
    }

    case 0x03: { // read_now
      Serial.println("Downlink command: read_now");
      g_forceImmediateSend = true;
      break;
    }

    case 0x04: { // set_debug
      if (appDataSize > 1) {
        g_debugEnabled = (appData[1] == 0x01);
        Serial.print("Downlink command: set_debug = ");
        Serial.println(g_debugEnabled ? "ON" : "OFF");
      } else {
        Serial.println("Downlink command 0x04 missing enable byte");
      }
      break;
    }

    default: {
      Serial.print("Unknown downlink command: 0x");
      Serial.println(appData[0], HEX);
      break;
    }
  }
}

// ============================================================
//                     LORAWAN PAYLOAD HOOK
// ============================================================

static void prepareTxFrame(uint8_t port) {
  (void)port;

  uint16_t co2 = 0;
  float humidity = 0.0f;
  float bmpTempC = 0.0f;
  float pressurePa = 0.0f;

  bool scdReadOk = readSCD41(humidity, co2);
  bool bmpReadOk = readBMP180(bmpTempC, pressurePa);

  if (!bmpReadOk) {
    Serial.println("BMP180 read failed. Sending zero fallback values.");
    bmpTempC = 0.0f;
    pressurePa = 0.0f;
  }

  if (!scdReadOk) {
    Serial.println("SCD41 read failed. Sending zero fallback values.");
    co2 = 0;
    humidity = 0.0f;
  }

  float batteryPercent = readBatteryPercent();

  appDataSize = 10;
  packPayload(appData, co2, batteryPercent, humidity, bmpTempC, pressurePa);

  if (g_debugEnabled) {
    Serial.print("Payload bytes: ");
    for (size_t i = 0; i < appDataSize; i++) {
      if (appData[i] < 16) Serial.print("0");
      Serial.print(appData[i], HEX);
      Serial.print(" ");
    }
    Serial.println();
  }
}

// ============================================================
//                            SETUP
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(ADC_CTRL_PIN, OUTPUT);
  digitalWrite(ADC_CTRL_PIN, LOW);

  analogReadResolution(12);
  analogSetPinAttenuation(BATTERY_PIN, ADC_11db);

  Serial.println();
  Serial.println("Booting Heltec LoRaWAN + BMP180 + SCD41");

  initSensors();

  Mcu.begin(HELTEC_BOARD, SLOW_CLK_TPYE);
}

// ============================================================
//                             LOOP
// ============================================================

void loop() {
  switch (deviceState) {
    case DEVICE_STATE_INIT: {
#if (LORAWAN_DEVEUI_AUTO)
      LoRaWAN.generateDeveuiByChipID();
#endif
      LoRaWAN.init(loraWanClass, loraWanRegion);
      LoRaWAN.setDefaultDR(0);
      break;
    }

    case DEVICE_STATE_JOIN: {
      Serial.println("joining...");
      LoRaWAN.join();
      break;
    }

    case DEVICE_STATE_SEND: {
      Serial.println("Preparing sensor uplink...");
      prepareTxFrame(appPort);
      LoRaWAN.send();
      handleDownlink();
      deviceState = DEVICE_STATE_CYCLE;
      break;
    }

    case DEVICE_STATE_CYCLE: {
      if (g_forceImmediateSend) {
        g_forceImmediateSend = false;
        deviceState = DEVICE_STATE_SEND;
        break;
      }

      uint32_t nextMs = appTxDutyCycle;

      if (g_sleepMinutes > 0) {
        nextMs = (uint32_t)g_sleepMinutes * 60UL * 1000UL;
      }

      txDutyCycleTime = nextMs;
      LoRaWAN.cycle(txDutyCycleTime);
      deviceState = DEVICE_STATE_SLEEP;
      break;
    }

    case DEVICE_STATE_SLEEP: {
      LoRaWAN.sleep(loraWanClass);
      break;
    }

    default: {
      deviceState = DEVICE_STATE_INIT;
      break;
    }
  }
}