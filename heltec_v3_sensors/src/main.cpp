#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BMP085.h>
#include <SensirionI2CScd4x.h>
#include <SensirionCore.h>

#include <RadioLib.h>
#include <SPI.h>

// -------------------- I2C (your pins) --------------------
static const int SDA_PIN = 39;
static const int SCL_PIN = 40;
static const uint8_t SCD4X_ADDR = 0x62;

Adafruit_BMP085 bmp;
SensirionI2cScd4x scd4x;

// -------------------- Heltec WiFi LoRa 32 (V3) SX1262 pins --------------------
static const int LORA_CS = 8;
static const int LORA_SCK = 9;
static const int LORA_MOSI = 10;
static const int LORA_MISO = 11;
static const int LORA_RST = 12;
static const int LORA_BUSY = 13;
static const int LORA_DIO1 = 14;

SX1262 radio = new Module(LORA_CS, LORA_DIO1, LORA_RST, LORA_BUSY);

// TTN US915 FSB2 => Subband 2
static const uint8_t SUBBAND = 2;
static const uint8_t FPORT = 1;

// Your RadioLib expects LoRaWANNode(PhysicalLayer*, Band*, subBand)
LoRaWANNode node((PhysicalLayer *)&radio, &US915, SUBBAND);

// -------------------- LoRaWAN (OTAA) --------------------
uint64_t joinEUI = 0x0000000000000000ULL;
uint64_t devEUI = 0x70B3D57ED0076032ULL;

// LoRaWAN 1.0.2 (TTN): only AppKey is used.
// RadioLib API still wants 2 pointers, so pass AppKey twice in beginOTAA().
uint8_t appKey[16] = {
    0xD0, 0xFC, 0xAA, 0x3C, 0x10, 0xF3, 0x2C, 0x7B,
    0x0D, 0xFC, 0x2F, 0x1D, 0xCC, 0xF6, 0xD2, 0xC1};

// -------------------- Sensirion helpers --------------------
static void printScdError(const char *where, uint16_t error)
{
  if (!error)
    return;
  char msg[256];
  errorToString(error, msg, sizeof(msg));
  Serial.print("  ");
  Serial.print(where);
  Serial.print(": ");
  Serial.println(msg);
}

template <typename Func>
static uint16_t retrySensirion(Func f, int attempts, uint32_t delayMs)
{
  uint16_t err = 0;
  for (int i = 1; i <= attempts; i++)
  {
    err = f();
    if (!err)
      return 0;
    delay(delayMs);
  }
  return err;
}

// 12-byte payload packing (little-endian)
static void packPayload(uint8_t *p,
                        uint16_t co2, float scdTemp, float rh,
                        float bmpTemp, int32_t pressurePa)
{
  int16_t scdT = (int16_t)lroundf(scdTemp * 100.0f);
  uint16_t hum = (uint16_t)lroundf(rh * 100.0f);
  int16_t bmpT = (int16_t)lroundf(bmpTemp * 100.0f);
  uint32_t prs = (uint32_t)pressurePa;

  p[0] = co2 & 0xFF;
  p[1] = co2 >> 8;
  p[2] = scdT & 0xFF;
  p[3] = scdT >> 8;
  p[4] = hum & 0xFF;
  p[5] = hum >> 8;
  p[6] = bmpT & 0xFF;
  p[7] = bmpT >> 8;
  p[8] = prs & 0xFF;
  p[9] = (prs >> 8) & 0xFF;
  p[10] = (prs >> 16) & 0xFF;
  p[11] = (prs >> 24) & 0xFF;
}

static void joinTTN()
{
  // LoRaWAN 1.0.2: use AppKey for both (nwkKey, appKey) params in RadioLib API
  int16_t st = node.beginOTAA(joinEUI, devEUI, appKey, appKey);
  Serial.print("beginOTAA -> ");
  Serial.println(st);
  if (st != RADIOLIB_ERR_NONE)
  {
    Serial.println("beginOTAA failed (bad params).");
    while (true)
      delay(2000);
  }

  Serial.println("activateOTAA (joining)...");
  for (int attempt = 1; attempt <= 10; attempt++)
  {
    st = node.activateOTAA();
    if (st == RADIOLIB_ERR_NONE)
    {
      Serial.println("Joined!");
      return;
    }
    Serial.print("Join failed attempt ");
    Serial.print(attempt);
    Serial.print(" code=");
    Serial.println(st);
    delay(5000);
  }

  Serial.println("Join failed after retries.");
  while (true)
    delay(2000);
}

void setup()
{
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== BMP180 + SCD41 + LoRaWAN (Heltec V3 SX1262) ===");

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(50000);

  Serial.print("BMP180 init: ");
  Serial.println(bmp.begin() ? "OK" : "FAIL");

  scd4x.begin(Wire, SCD4X_ADDR);
  delay(1200);

  uint64_t serialNumber = 0;
  uint16_t err = retrySensirion([&]()
                                { return scd4x.getSerialNumber(serialNumber); }, 5, 300);
  Serial.print("SCD41 serial read: ");
  Serial.println(err ? "FAIL" : "OK");

  retrySensirion([&]()
                 { return scd4x.stopPeriodicMeasurement(); }, 3, 200);
  delay(300);
  retrySensirion([&]()
                 { return scd4x.reinit(); }, 3, 300);
  delay(500);
  err = retrySensirion([&]()
                       { return scd4x.startPeriodicMeasurement(); }, 3, 300);
  Serial.println(err ? "SCD41 periodic start: FAIL" : "SCD41 periodic start: OK");

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);

  int16_t st = radio.begin();
  if (st != RADIOLIB_ERR_NONE)
  {
    Serial.print("SX1262 radio.begin failed, code=");
    Serial.println(st);
    while (true)
      delay(1000);
  }

  radio.setDio2AsRfSwitch(true);
  radio.setTCXO(1.8); // if join/radio issues, try 1.6

  Serial.println("SX1262 init: OK");

  joinTTN();
}

void loop()
{
  bool dataReady = false;
  uint16_t err = scd4x.getDataReadyStatus(dataReady);
  if (err)
  {
    printScdError("getDataReadyStatus", err);
    delay(2000);
    return;
  }
  if (!dataReady)
  {
    delay(500);
    return;
  }

  uint16_t co2 = 0;
  float scdTemp = 0.0f, humidity = 0.0f;
  err = scd4x.readMeasurement(co2, scdTemp, humidity);
  if (err)
  {
    printScdError("readMeasurement", err);
    delay(2000);
    return;
  }

  float bmpTemp = bmp.readTemperature();
  int32_t pressure = bmp.readPressure();

  uint8_t payload[12];
  packPayload(payload, co2, scdTemp, humidity, bmpTemp, pressure);

  int16_t st = node.sendReceive(payload, sizeof(payload), FPORT);

  Serial.print("sendReceive (uplink) -> ");
  if (st > 0)
  {
    Serial.print("Downlink received in window ");
    Serial.println(st);
  }
  else if (st == 0)
  {
    Serial.println("OK (no downlink)");
  }
  else
  {
    Serial.print("FAIL code=");
    Serial.println(st);
  }

  delay(60000);
}