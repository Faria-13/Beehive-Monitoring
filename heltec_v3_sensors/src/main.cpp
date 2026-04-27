#include <Arduino.h>
#include <math.h>

#include <heltec.h>
#include "LoRaWan_APP.h"

// ============================================================
//                 SENSOR LIBRARIES - ENABLED FOR DEPLOYMENT
// ============================================================

#include <Wire.h>
#include <Adafruit_BMP085.h>
#include <SensirionI2cScd4x.h>
#include <SensirionCore.h>

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
// This has NOT been changed from the code you provided.
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

static const uint8_t SENSOR_UPLINK_PORT = 1;
static const uint8_t COMMAND_DOWNLINK_PORT = 2;
static const uint8_t ACK_UPLINK_PORT = 3;

// Normal sensor uplinks use FPort 1.
// Downlink ACK uplinks use FPort 3.
uint8_t appPort = SENSOR_UPLINK_PORT;

uint8_t confirmedNbTrials = 4;

// Testing interval: 60 seconds.
// Deployment interval: change this to 10UL * 60UL * 1000UL.
uint32_t appTxDutyCycle = 10UL * 60UL * 1000UL;

// Downlink command state
bool sendNowRequested = false;
bool debugEnabled = true;

// Application-level ACK state for downlinks.
bool downlinkAckPending = false;
bool restartAfterAck = false;
bool lastTxWasAck = false;

uint8_t lastDownlinkCommand = 0x00;
uint8_t lastDownlinkStatus = 0x00;
uint8_t downlinkAckCounter = 0;

// ============================================================
//                     BATTERY SETTINGS
// ============================================================

#define BATTERY_PIN 1
#define ADC_CTRL_PIN 37

#define BATTERY_LOW_VOLTAGE 3.10f
#define BATTERY_HIGH_VOLTAGE 4.20f

// This may need calibration with a multimeter.
#define BATTERY_DIVIDER_RATIO 5.1f

// ============================================================
//                     SENSOR SETTINGS
// ============================================================

static const int SDA_PIN = 40;
static const int SCL_PIN = 39;
static const uint8_t SCD4X_ADDR = 0x62;

Adafruit_BMP085 bmp;
SensirionI2cScd4x scd4x;

bool bmpOk = false;
bool scdOk = false;

// ============================================================
//                    SCD41 HELPER FUNCTIONS
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

    if (!err) {
      return 0;
    }

    delay(delayMs);
  }

  return err;
}

// ============================================================
//                         I2C SCAN
// ============================================================

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

// ============================================================
//                     SENSOR INITIALIZATION
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

// ============================================================
//                       SENSOR READS
// ============================================================

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

  // BMP180 library returns Celsius here.
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
//                           SENSOR PAYLOAD
// ============================================================
//
// Sensor payload format, 10 bytes total, sent on FPort 1:
//
// [0..1] CO2 ppm, uint16 little-endian
// [2..3] battery %, value * 100, int16 little-endian
// [4..5] humidity %, value * 100, uint16 little-endian
// [6..7] BMP180 temperature Celsius, value * 100, int16 little-endian
// [8..9] pressure hPa, value * 10, uint16 little-endian

static void packPayload(
  uint8_t* payload,
  uint16_t co2,
  float batteryPercent,
  float rh,
  float bmpTempC,
  float bmpPressurePa
) {
  int16_t battPct = (int16_t)lroundf(batteryPercent * 100.0f);
  uint16_t hum = (uint16_t)lroundf(rh * 100.0f);

  // Celsius packed as temp C * 100.
  // Example: 21.80 C -> 2180 -> 0x0884 -> bytes 84 08.
  int16_t bmpTempCPacked = (int16_t)lroundf(bmpTempC * 100.0f);

  float pressureHpa = bmpPressurePa / 100.0f;
  uint16_t bmpP = (uint16_t)lroundf(pressureHpa * 10.0f);

  payload[0] = co2 & 0xFF;
  payload[1] = (co2 >> 8) & 0xFF;

  payload[2] = battPct & 0xFF;
  payload[3] = (battPct >> 8) & 0xFF;

  payload[4] = hum & 0xFF;
  payload[5] = (hum >> 8) & 0xFF;

  payload[6] = bmpTempCPacked & 0xFF;
  payload[7] = (bmpTempCPacked >> 8) & 0xFF;

  payload[8] = bmpP & 0xFF;
  payload[9] = (bmpP >> 8) & 0xFF;

  Serial.println("Packed sensor payload values:");
  Serial.print("  CO2 ppm: ");
  Serial.println(co2);

  Serial.print("  Battery %: ");
  Serial.println(battPct / 100.0f, 2);

  Serial.print("  Humidity %: ");
  Serial.println(hum / 100.0f, 2);

  Serial.print("  BMP180 temp C: ");
  Serial.println(bmpTempCPacked / 100.0f, 2);

  Serial.print("  Pressure hPa: ");
  Serial.println(bmpP / 10.0f, 1);
}

// ============================================================
//                     DOWNLINK ACK PAYLOAD
// ============================================================
//
// ACK payload format, 4 bytes total, sent on FPort 3:
//
// [0] 0xAC = ACK marker
// [1] command received
// [2] status: 0x00 = OK, 0x01 = error
// [3] ACK counter

static void prepareDownlinkAckFrame() {
  appDataSize = 4;

  // ACK payload:
  // [0] 0xAC = ACK marker
  // [1] command received
  // [2] status: 0 = OK, 1 = error
  // [3] ACK counter

  appData[0] = 0xAC;
  appData[1] = lastDownlinkCommand;
  appData[2] = lastDownlinkStatus;
  appData[3] = downlinkAckCounter++;

  Serial.println("Preparing downlink ACK uplink...");
  Serial.print("ACK payload: ");

  for (uint8_t i = 0; i < appDataSize; i++) {
    if (appData[i] < 16) Serial.print("0");
    Serial.print(appData[i], HEX);
    Serial.print(" ");
  }

  Serial.println();
}

// ============================================================
//                     LORAWAN PAYLOAD HOOK
// ============================================================

static void prepareTxFrame(uint8_t port) {
  (void)port;

  if (downlinkAckPending) {
    downlinkAckPending = false;
    lastTxWasAck = true;
    prepareDownlinkAckFrame();
    return;
  }

  lastTxWasAck = false;

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

  packPayload(
    appData,
    co2,
    batteryPercent,
    humidity,
    bmpTempC,
    pressurePa
  );

  Serial.print("Sensor payload bytes: ");
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
//
// Send downlinks from TTN on FPort 2.
//
// Commands:
//
// 01          = restart node after ACK uplink
// 02 MM       = set uplink interval to MM minutes, then ACK
// 03          = send ACK/read-now uplink soon
// 04 00       = disable debug flag, then ACK
// 04 01       = enable debug flag, then ACK

static void queueDownlinkAck(uint8_t command, uint8_t status, bool restartAfterThisAck) {
  lastDownlinkCommand = command;
  lastDownlinkStatus = status;
  downlinkAckPending = true;
  restartAfterAck = restartAfterThisAck;
  sendNowRequested = true;

  Serial.println("Downlink ACK queued.");
  Serial.print("  command: 0x");
  if (command < 16) {
    Serial.print("0");
  }
  Serial.println(command, HEX);

  Serial.print("  status: ");
  Serial.println(status == 0x00 ? "OK" : "ERROR");

  if (restartAfterThisAck) {
    Serial.println("  restart will happen after ACK uplink is sent");
  }
}

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

  if (mcpsIndication->Port != COMMAND_DOWNLINK_PORT) {
    Serial.println("Ignoring downlink because command port is not FPort 2.");
    return;
  }

  uint8_t command = mcpsIndication->Buffer[0];

  switch (command) {
    case 0x01: {
      Serial.println("Command 0x01 received: restart requested.");
      Serial.println("Will send ACK uplink first, then restart.");

      queueDownlinkAck(0x01, 0x00, true);
      break;
    }

    case 0x02: {
      if (mcpsIndication->BufferSize < 2) {
        Serial.println("Command 0x02 error: missing minutes byte.");
        queueDownlinkAck(0x02, 0x01, false);
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

      queueDownlinkAck(0x02, 0x00, false);
      break;
    }

    case 0x03: {
      Serial.println("Command 0x03 received: read-now / ACK-now requested.");

      queueDownlinkAck(0x03, 0x00, false);
      break;
    }

    case 0x04: {
      if (mcpsIndication->BufferSize < 2) {
        Serial.println("Command 0x04 error: missing debug byte.");
        queueDownlinkAck(0x04, 0x01, false);
        break;
      }

      debugEnabled = mcpsIndication->Buffer[1] != 0;

      Serial.print("Command 0x04: Debug flag ");
      Serial.println(debugEnabled ? "enabled" : "disabled");

      queueDownlinkAck(0x04, 0x00, false);
      break;
    }

    default: {
      Serial.print("Unknown downlink command: 0x");

      if (command < 16) {
        Serial.print("0");
      }

      Serial.println(command, HEX);

      queueDownlinkAck(command, 0x01, false);
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
  Serial.println(" Heltec LoRaWAN deployment build");
  Serial.println(" BMP180 and SCD41 sensors enabled");
  Serial.println(" Temperature payload uses Celsius");
  Serial.println(" Downlink commands enabled on FPort 2");
  Serial.println(" Downlink ACK uplinks enabled on FPort 3");
  Serial.println("====================================");

  Serial.println("Environmental sensors enabled. Starting I2C scan, BMP180, and SCD41.");
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
      if (downlinkAckPending) {
        appPort = ACK_UPLINK_PORT;
      } else {
        appPort = SENSOR_UPLINK_PORT;
      }

      Serial.print("Preparing uplink on FPort ");
      Serial.println(appPort);

      prepareTxFrame(appPort);
      LoRaWAN.send();

      if (lastTxWasAck && restartAfterAck) {
        Serial.println("Downlink ACK uplink sent. Restarting module now...");
        delay(3000);
        ESP.restart();
      }

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
