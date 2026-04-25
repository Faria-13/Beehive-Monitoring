#include <Arduino.h>
#include "LoRaWan_APP.h"

// ============================================================
//                  TTN / OTAA CREDENTIALS
// ============================================================
// IMPORTANT:
// Put your TTN values here.
// Use the same byte format you already had in your previous code.

// DevEUI from TTN
uint8_t devEui[] = {
  0x70, 0xB3, 0xD5, 0x7E,
  0xD0, 0x07, 0x6A, 0xDE
};

uint8_t appEui[] = {
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00
};

uint8_t appKey[] = {
  0xD0, 0xFC, 0xAA, 0x3C, 0x10, 0xF3, 0x2C, 0x7B,
  0x0D, 0xFC, 0x2F, 0x1D, 0xCC, 0xF6, 0xD2, 0xC1
};

// ============================================================
//              ABP VALUES REQUIRED BY HELTEC LIBRARY
//              Not used when OTAA is enabled.
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
//                    LORAWAN SETTINGS
// ============================================================

// For US915 TTN, FSB2 usually means channels 8-15.
// This is the common TTN US915 mask.
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

// Send every 60 seconds after joining.
uint32_t appTxDutyCycle = 60UL * 1000UL;

// ============================================================
//                    BASIC TEST PAYLOAD
// ============================================================

static uint32_t bootCounter = 0;

static void prepareTxFrame(uint8_t port) {
  (void)port;

  bootCounter++;

  // Simple 4-byte payload:
  // 0xBE 0xEF counter_low counter_high
  appDataSize = 4;
  appData[0] = 0xBE;
  appData[1] = 0xEF;
  appData[2] = bootCounter & 0xFF;
  appData[3] = (bootCounter >> 8) & 0xFF;

  Serial.print("Prepared test payload: ");
  for (uint8_t i = 0; i < appDataSize; i++) {
    if (appData[i] < 16) Serial.print("0");
    Serial.print(appData[i], HEX);
    Serial.print(" ");
  }
  Serial.println();
}

// ============================================================
//                            SETUP
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println();
  Serial.println("====================================");
  Serial.println(" Heltec V3 LoRaWAN-only OTAA test");
  Serial.println(" No sensors enabled");
  Serial.println("====================================");

  Mcu.begin(HELTEC_BOARD, SLOW_CLK_TPYE);
}

// ============================================================
//                             LOOP
// ============================================================

void loop() {
  switch (deviceState) {
    case DEVICE_STATE_INIT: {
      Serial.println("DEVICE_STATE_INIT");

#if (LORAWAN_DEVEUI_AUTO)
      LoRaWAN.generateDeveuiByChipID();
#endif

      LoRaWAN.init(loraWanClass, loraWanRegion);

      // DR0 is slow but gives better range on US915.
      LoRaWAN.setDefaultDR(0);

      break;
    }

    case DEVICE_STATE_JOIN: {
      Serial.println("DEVICE_STATE_JOIN: joining TTN...");
      LoRaWAN.join();
      break;
    }

    case DEVICE_STATE_SEND: {
      Serial.println("DEVICE_STATE_SEND: sending test uplink...");
      prepareTxFrame(appPort);
      LoRaWAN.send();
      deviceState = DEVICE_STATE_CYCLE;
      break;
    }

    case DEVICE_STATE_CYCLE: {
      Serial.println("DEVICE_STATE_CYCLE: waiting for next send...");
      txDutyCycleTime = appTxDutyCycle;
      LoRaWAN.cycle(txDutyCycleTime);
      deviceState = DEVICE_STATE_SLEEP;
      break;
    }

    case DEVICE_STATE_SLEEP: {
      LoRaWAN.sleep(loraWanClass);
      break;
    }

    default: {
      Serial.println("Unknown state. Resetting to INIT.");
      deviceState = DEVICE_STATE_INIT;
      break;
    }
  }
}