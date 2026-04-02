
#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <math.h>

#include <Adafruit_BMP085.h>
#include <SensirionI2CScd4x.h>
#include <SensirionCore.h>
#include <RadioLib.h>
#define BATTERY_PIN 1
#define ADC_CTRL_PIN 37
#define BATTERY_LOW_VOLTAGE 3.1
#define BATTERY_HIGH_VOLTAGE 4.2

// -------------------- I2C / Sensors --------------------
static const int SDA_PIN = 39;
static const int SCL_PIN = 40;
static const uint8_t SCD4X_ADDR = 0x62;

#include <Preferences.h>
Preferences store;

Adafruit_BMP085 bmp;
SensirionI2cScd4x scd4x;

// Define the sleep time in microseconds
#define uS_TO_S_FACTOR 1000000ULL  /* Conversion factor for micro seconds to seconds */
#define TIME_TO_SLEEP  3  
#define TIME_TO_SLEEP_IN_SEC  (TIME_TO_SLEEP * 60)     

//RTC data is retained during deep sleep, so we can use it to store the session parameters and avoid rejoining after every wakeup
RTC_DATA_ATTR uint8_t lwSession[RADIOLIB_LORAWAN_SESSION_BUF_SIZE];
RTC_DATA_ATTR bool hasRtcSession = false;

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
uint64_t devEUI  = 0x70B3D57ED0076ADEULL;

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
  float batteryPercent,
  float rh,
  float bmpTemp
) {
  int16_t battPct = (int16_t)lroundf(batteryPercent * 100.0f);
  uint16_t hum = (uint16_t)lroundf(rh * 100.0f);
  int16_t bmpT = (int16_t)lroundf(bmpTemp * 100.0f);

  payload[0] = co2 & 0xFF;
  payload[1] = (co2 >> 8) & 0xFF;

  payload[2] = battPct & 0xFF;
  payload[3] = (battPct >> 8) & 0xFF;

  payload[4] = hum & 0xFF;
  payload[5] = (hum >> 8) & 0xFF;

  payload[6] = bmpT & 0xFF;
  payload[7] = (bmpT >> 8) & 0xFF;
}


void saveNoncesToFlash() {
  uint8_t nonceBuf[RADIOLIB_LORAWAN_NONCES_BUF_SIZE];
  memcpy(nonceBuf, node.getBufferNonces(), RADIOLIB_LORAWAN_NONCES_BUF_SIZE);

  store.begin("radiolib", false);
  store.putBytes("nonces", nonceBuf, RADIOLIB_LORAWAN_NONCES_BUF_SIZE);
  store.end();

  Serial.println("Saved LoRaWAN nonces to flash.");
}

bool restoreNoncesFromFlash() {
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

  int16_t state = node.setBufferNonces(nonceBuf);
  if (state == RADIOLIB_ERR_NONE) {
    Serial.println("Restored LoRaWAN nonces from flash.");
    return true;
  }

  Serial.print("Failed to restore nonces: ");
  Serial.println(state);
  return false;
}

bool restoreSessionFromRtc() {
  if (!hasRtcSession) {
    Serial.println("No RTC session saved.");
    return false;
  }

  int16_t state = node.setBufferSession(lwSession);
  if (state == RADIOLIB_ERR_NONE) {
    Serial.println("Restored LoRaWAN session from RTC memory.");
    return true;
  }

  Serial.print("Failed to restore RTC session: ");
  Serial.println(state);
  return false;
}

void saveSessionToRtc() {
  memcpy(lwSession, node.getBufferSession(), RADIOLIB_LORAWAN_SESSION_BUF_SIZE);
  hasRtcSession = true;
  Serial.println("Saved LoRaWAN session to RTC memory.");
}

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

bool initRadio() {
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);

  int16_t state = radio.begin();
  radio.setCurrentLimit(140.0);
  radio.setOutputPower(26);

  radio.setSpreadingFactor(12);
  radio.setBandwidth(125.0);
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
  Serial.println("Preparing LoRaWAN state...");
  Serial.println("Starting OTAA/restore...");

  int16_t state = node.beginOTAA(joinEUI, devEUI, NULL, appKey);
  Serial.print("beginOTAA() = ");
  Serial.println(state);

  if (state != RADIOLIB_ERR_NONE) {
    return false;
  }

  restoreNoncesFromFlash();
  restoreSessionFromRtc();

  state = node.activateOTAA();
  Serial.print("activateOTAA() = ");
  Serial.println(state);

  if (state == RADIOLIB_LORAWAN_SESSION_RESTORED) {
    Serial.println("LoRaWAN session restored.");
    return true;
  }

  if (state == RADIOLIB_LORAWAN_NEW_SESSION || state == RADIOLIB_ERR_NONE) {
    Serial.println("New LoRaWAN join successful.");
    saveNoncesToFlash();
    saveSessionToRtc();
    return true;
  }

  Serial.println("Join/restore failed.");
  return false;
}

static float readBatteryPercent() {
  digitalWrite(ADC_CTRL_PIN, HIGH);
  delay(10);

  int raw = analogRead(BATTERY_PIN);

  float voltage = (raw / 4095.0f) * 3.3f;
  float batteryVoltage = voltage * 5.1f;

  float percent =
    ((batteryVoltage - BATTERY_LOW_VOLTAGE) /
    (BATTERY_HIGH_VOLTAGE - BATTERY_LOW_VOLTAGE)) * 100.0f;

  Serial.print("Battery percent: ");
  Serial.print(percent, 1);
  Serial.println("%");

  digitalWrite(ADC_CTRL_PIN, LOW);

  return percent;
}

bool readAndSend() {
  bool dataReady = false;
  uint16_t err = scd4x.getDataReadyStatus(dataReady);



  // if (!dataReady) {
  //   Serial.println("SCD41 data not ready yet.");
    
  //   return false;
  // }

  if (!waitForScd41Data()) {
  return false;
  }

  if (err) {
    printScdError("getDataReadyStatus", err);
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
  float batteryPercent = readBatteryPercent();

  uint8_t payload[8];
  packPayload(payload, co2, batteryPercent, humidity, bmpTemp);

  Serial.println("Sending uplink...");
  int16_t state = node.sendReceive(payload, sizeof(payload), FPORT);
  Serial.print("sendReceive() = ");
  Serial.println(state);

  if (state < 0) {
    Serial.println("Uplink failed.");
    return false;
  }

  Serial.println("Uplink sent.");

  // Save active session so deep sleep wake can restore it
  saveSessionToRtc();
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

  pinMode(ADC_CTRL_PIN, OUTPUT);
  digitalWrite(ADC_CTRL_PIN, HIGH);

  analogReadResolution(12);
  analogSetPinAttenuation(BATTERY_PIN, ADC_11db);
}

void loop() {
  readAndSend();

  // delay(60000);

  // 3. Prepare for Deep Sleep
  Serial.println("Entering deep sleep for 10 minutes...");
  Serial.flush(); // Ensure all serial data is printed before CPU stops

  // Power down high-current pins if necessary
  digitalWrite(ADC_CTRL_PIN, LOW); 

  // Set the timer and go to sleep
  esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP_IN_SEC * uS_TO_S_FACTOR);
  esp_deep_sleep_start();

  // deep sleep implementation 
}
