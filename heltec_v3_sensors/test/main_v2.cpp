#include <Arduino.h>
#include <math.h>

#include <heltec.h>
#include "LoRaWan_APP.h"

// ============================================================
//                 SENSOR ENABLE / DISABLE SWITCH
// ============================================================
// 0 = LoRaWAN + battery only. BMP180 and SCD41 are skipped.
// 1 = Enable BMP180 and SCD41 code again later.
#define ENABLE_ENV_SENSORS 0

#if ENABLE_ENV_SENSORS
  #include <Wire.h>
  #include <Adafruit_BMP085.h>
  #include <SensirionI2cScd4x.h>
  #include <SensirionCore.h>
#endif

// ============================================================
//                        OTAA PARAMS
// ============================================================

// DevEUI from TTN
uint8_t devEui[] = {
  0x70, 0xB3, 0xD5, 0x7E,
  0xD0, 0x07, 0x6A, 0xDE
};

// JoinEUI / AppEUI from TTN
uint8_t appEui[] = {
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00
};

// AppKey from TTN Join settings.
// This key should be regenerated later since it appeared in logs/screenshots.
uint8_t appKey[] = {
  0xD0, 0xFC, 0xAA, 0x3C,
  0x10, 0xF3, 0x2C, 0x7B,
  0x0D, 0xFC, 0x2F, 0x1D,
  0xCC, 0xF6, 0xD2, 0xC1
};

// ============================================================
//                        ABP PARAMS
//                  Kept for library compatibility.
//                  Not used when OTAA is true.
// ============================================================

uint8_t nwkSKey[] = {
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00
};

uint8_t appSKey[] = {
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00
};

uint32_t devAddr = 0x00000000;

// ============================================================
//                     LORAWAN SETTINGS
// ============================================================

// US915 FSB2 / TTN channels 8-15
uint16_t userChannelsMask[6] = {
  0xFF00,
  0x0000,
  0x0000,
  0x0000,
  0x0000,
  0x0000
};

LoRaMacRegion_t loraWanRegion = ACTIVE_REGION;
DeviceClass_t loraWanClass = CLASS_A;

bool overTheAirActivation = true;
bool loraWanAdr = false;
bool isTxConfirmed = false;

uint8_t appPort = 1;
uint8_t confirmedNbTrials = 4;

// Send every 2 minutes.
uint32_t appTxDutyCycle = 60UL * 1000UL;

// Downlink command state
bool sendNowRequested = false;
bool debugEnabled = true;

// ============================================================
//                     BATTERY SETTINGS
// ============================================================

#define BATTERY_PIN 1
#define ADC_CTRL_PIN 37

#define BATTERY_LOW_VOLTAGE 3.10f
#define BATTERY_HIGH_VOLTAGE 4.20f

// This may need calibration later.
#define BATTERY_DIVIDER_RATIO 5.1f

// ============================================================
//                     SENSOR SETTINGS
// ============================================================

#if ENABLE_ENV_SENSORS

static const int SDA_PIN = 40;
static const int SCL_PIN = 39;
static const uint8_t SCD4X_ADDR = 0x62;

Adafruit_BMP085 bmp;
SensirionI2cScd4x scd4x;

bool bmpOk = false;
bool scdOk = false;

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

    if (!err) {
      return 0;
    }

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

      if (addr < 16) {
        Serial.print("0");
      }

      Serial.println(addr, HEX);
      found++;
    }
  }

  if (found == 0) {
    Serial.println("No I2C devices found.");
  }
}

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

  if (!scdOk) {
    return false;
  }

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

  Serial.print("SCD41 CO2: ");
  Serial.print(co2);
  Serial.println(" ppm");

  Serial.print("SCD41 humidity: ");
  Serial.print(humidity, 2);
  Serial.println(" %");

  return true;
}

static bool readBMP180(float& bmpTempC, float& pressurePa) {
  bmpTempC = NAN;
  pressurePa = NAN;

  if (!bmpOk) {
    return false;
  }

  bmpTempC = bmp.readTemperature();
  pressurePa = (float)bmp.readPressure();

  Serial.print("BMP180 temp C: ");
  Serial.print(bmpTempC, 2);
  Serial.println(" C");

  Serial.print("BMP180 pressure: ");
  Serial.print(pressurePa, 0);
  Serial.println(" Pa");

  return true;
}

#endif

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

  if (percent < 0.0f) {
    percent = 0.0f;
  }

  if (percent > 100.0f) {
    percent = 100.0f;
  }

  Serial.print("Battery raw: ");
  Serial.println(raw);

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
//                     LORAWAN PAYLOAD HOOK
// ============================================================

static void prepareTxFrame(uint8_t port) {
  (void)port;

  uint16_t co2 = 0;
  float humidity = 0.0f;
  float bmpTempC = 0.0f;
  float pressurePa = 0.0f;

#if ENABLE_ENV_SENSORS
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
#else
  Serial.println("Environmental sensors disabled. Sending zero fallback sensor values.");
#endif

  float batteryPercent = readBatteryPercent();

  appDataSize = 10;
  packPayload(appData, co2, batteryPercent, humidity, bmpTempC, pressurePa);

  Serial.print("Payload bytes: ");

  for (size_t i = 0; i < appDataSize; i++) {
    if (appData[i] < 16) {
      Serial.print("0");
    }

    Serial.print(appData[i], HEX);
    Serial.print(" ");
  }

  Serial.println();
}

// ============================================================
//                    REAL DOWNLINK HANDLER
// ============================================================
// Send downlinks from TTN on FPort 2.
//
// Commands:
// 01          = restart node
// 02 MM       = set uplink interval to MM minutes
// 03          = send another uplink soon
// 04 00       = disable debug prints
// 04 01       = enable debug prints

void downLinkDataHandle(McpsIndication_t *mcpsIndication) {
  if (mcpsIndication == nullptr) {
    return;
  }

  if (mcpsIndication->BufferSize == 0) {
    Serial.println("Downlink received, but payload is empty.");
    return;
  }

  Serial.print("Real downlink received on FPort ");
  Serial.print(mcpsIndication->Port);
  Serial.print(": ");

  for (uint8_t i = 0; i < mcpsIndication->BufferSize; i++) {
    if (mcpsIndication->Buffer[i] < 16) {
      Serial.print("0");
    }

    Serial.print(mcpsIndication->Buffer[i], HEX);
    Serial.print(" ");
  }

  Serial.println();

  if (mcpsIndication->Port != 2) {
    Serial.println("Ignoring downlink because command port is not FPort 2.");
    return;
  }

  uint8_t command = mcpsIndication->Buffer[0];

  switch (command) {
    case 0x01: {
      Serial.println("Command 0x01: Restarting node...");
      delay(1000);
      ESP.restart();
      break;
    }

    case 0x02: {
      if (mcpsIndication->BufferSize < 2) {
        Serial.println("Command 0x02 error: missing minutes byte.");
        break;
      }

      uint8_t minutes = mcpsIndication->Buffer[1];

      if (minutes < 1) {
        minutes = 1;
      }

      if (minutes > 60) {
        minutes = 60;
      }

      appTxDutyCycle = (uint32_t)minutes * 60UL * 1000UL;

      Serial.print("Command 0x02: New uplink interval = ");
      Serial.print(minutes);
      Serial.println(" minute(s)");

      break;
    }

    case 0x03: {
      Serial.println("Command 0x03: Send-another-uplink-soon requested.");
      sendNowRequested = true;
      break;
    }

    case 0x04: {
      if (mcpsIndication->BufferSize < 2) {
        Serial.println("Command 0x04 error: missing debug byte.");
        break;
      }

      debugEnabled = mcpsIndication->Buffer[1] != 0;

      Serial.print("Command 0x04: Debug prints ");
      Serial.println(debugEnabled ? "enabled" : "disabled");

      break;
    }

    default: {
      Serial.print("Unknown downlink command: 0x");

      if (command < 16) {
        Serial.print("0");
      }

      Serial.println(command, HEX);
      break;
    }
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
  Serial.println("====================================");
  Serial.println(" Heltec LoRaWAN test");
  Serial.println(" BMP180/SCD41 disabled for now");
  Serial.println(" Downlink commands enabled on FPort 2");
  Serial.println("====================================");

#if ENABLE_ENV_SENSORS
  Serial.println("Environmental sensors enabled.");
  initSensors();
#else
  Serial.println("Environmental sensors disabled. Skipping I2C scan, BMP180, and SCD41.");
#endif

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

      // DR0 is slower but better for range testing on US915.
      LoRaWAN.setDefaultDR(0);

      break;
    }

    case DEVICE_STATE_JOIN: {
      Serial.println("joining...");
      LoRaWAN.join();
      break;
    }

    case DEVICE_STATE_SEND: {
      Serial.println("Preparing uplink...");
      prepareTxFrame(appPort);
      LoRaWAN.send();

      // Do not manually call the downlink handler here.
      // The Heltec LoRaWAN library calls downLinkDataHandle()
      // only when a real downlink is received.

      deviceState = DEVICE_STATE_CYCLE;
      break;
    }

    case DEVICE_STATE_CYCLE: {
      if (sendNowRequested) {
        sendNowRequested = false;

        Serial.println("Send-now request queued. Scheduling next uplink soon.");
        txDutyCycleTime = 5000;
      } else {
        txDutyCycleTime = appTxDutyCycle;
      }

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