#include "lora_radio.h"
#include "pin_definitions.h"
#include <RadioLib.h>
#include <SPI.h>

static SPIClass s_loraSpi(HSPI);
static SX1262 s_radio(new Module(PIN_LORA_NSS, PIN_LORA_DIO1, PIN_LORA_RESET, PIN_LORA_BUSY, s_loraSpi));
static volatile bool s_dio1Flag = false;
static const uint8_t s_airPrefix[] = LORA_AIR_PREFIX;

static void IRAM_ATTR onDio1() {
    s_dio1Flag = true;
}

bool LoRaRadio::_ready = false;
bool LoRaRadio::_txBusy = false;
uint32_t LoRaRadio::_txStartMs = 0;

bool LoRaRadio::begin(Print& out) {
    out.println("Initializing SX1262 LoRa transceiver...");

    pinMode(PIN_LORA_ANT_SW, OUTPUT);
    digitalWrite(PIN_LORA_ANT_SW, HIGH);
    s_loraSpi.begin(PIN_LORA_SCK, PIN_LORA_MISO, PIN_LORA_MOSI, PIN_LORA_NSS);

    int16_t state = s_radio.begin(LORA_FREQUENCY_MHZ, LORA_BANDWIDTH_KHZ, LORA_SPREADING_FACTOR,
                                  LORA_CODING_RATE, LORA_SYNC_WORD, LORA_TX_POWER_DBM,
                                  LORA_PREAMBLE_LEN, LORA_TCXO_VOLTAGE, false);
    if (state != RADIOLIB_ERR_NONE) {
        out.printf("  [FAIL] SX1262 init error %d\n", state);
        _ready = false;
        return false;
    }

    s_radio.setDio2AsRfSwitch(true);
    s_radio.setCurrentLimit(140.0f);
    s_radio.setCRC(2);
    s_radio.setDio1Action(onDio1);

    _ready = true;
    out.print("  [OK] ");
    printConfig(out);
    startReceive();
    return true;
}

void LoRaRadio::printConfig(Print& out) {
    out.printf("SX1262 ch%d = %.3f MHz, BW %.1f kHz, SF%d, CR 4/%d, %d dBm, sync 0x%02X, prefix %u B\n",
               LORA_CHANNEL, LORA_FREQUENCY_MHZ, LORA_BANDWIDTH_KHZ, LORA_SPREADING_FACTOR,
               LORA_CODING_RATE, LORA_TX_POWER_DBM, LORA_SYNC_WORD, (unsigned)sizeof(s_airPrefix));
}

bool LoRaRadio::startReceive() {
    s_dio1Flag = false;
    return s_radio.startReceive() == RADIOLIB_ERR_NONE;
}

bool LoRaRadio::send(const uint8_t* data, size_t len, bool withPrefix) {
    if (!_ready) return false;
    service();
    if (_txBusy) return false;

    uint8_t buf[RADIOLIB_SX126X_MAX_PACKET_LENGTH];
    size_t prefixLen = withPrefix ? sizeof(s_airPrefix) : 0;
    if (prefixLen + len > sizeof(buf)) return false;
    memcpy(buf, s_airPrefix, prefixLen);
    memcpy(buf + prefixLen, data, len);

    s_dio1Flag = false;
    if (s_radio.startTransmit(buf, prefixLen + len) != RADIOLIB_ERR_NONE) {
        startReceive();
        return false;
    }
    _txBusy = true;
    _txStartMs = millis();
    return true;
}

bool LoRaRadio::isTransmitting() {
    service();
    return _txBusy;
}

void LoRaRadio::service() {
    if (!_txBusy) return;
    // 3 s guard covers the longest SF12 airtime for our frame size
    if (s_dio1Flag || (millis() - _txStartMs) > 3000) {
        s_radio.finishTransmit();
        _txBusy = false;
        startReceive();
    }
}

bool LoRaRadio::packetAvailable() {
    return _ready && !_txBusy && s_dio1Flag;
}

int LoRaRadio::readPacket(uint8_t* buf, size_t maxLen, float& rssiDbm, float& snrDb) {
    s_dio1Flag = false;
    size_t len = s_radio.getPacketLength();
    int result = -1;
    if (len > 0 && len <= maxLen) {
        int16_t state = s_radio.readData(buf, len);
        if (state == RADIOLIB_ERR_NONE) {
            result = (int)len;
        } else if (state == RADIOLIB_ERR_CRC_MISMATCH) {
            result = -2;
        }
    }
    rssiDbm = s_radio.getRSSI();
    snrDb = s_radio.getSNR();
    startReceive();
    return result;
}

void LoRaRadio::runSniffer(Stream& console) {
    if (!_ready) {
        console.println("# LoRa radio not initialised");
        return;
    }
    while (_txBusy) service();

    static const uint8_t candidates[] = {LORA_SYNC_WORD, 0x12, 0x34, 0x2B, 0x14, 0x24, 0x44};
    console.println("# ===== LoRa link sniffer (press any key to exit) =====");
    console.println("# Send text from the USB-TO-LoRa dongle; received frames are hex-dumped per sync word.");

    while (console.available()) console.read();
    bool exitRequested = false;
    while (!exitRequested) {
        for (size_t i = 0; i < sizeof(candidates) && !exitRequested; i++) {
            if (i > 0 && candidates[i] == LORA_SYNC_WORD) continue;
            s_radio.standby();
            s_radio.setSyncWord(candidates[i]);
            startReceive();
            console.printf("# listening: sync 0x%02X on %.3f MHz SF%d\n", candidates[i],
                           LORA_FREQUENCY_MHZ, LORA_SPREADING_FACTOR);

            uint32_t start = millis();
            while (millis() - start < 8000) {
                if (console.available()) {
                    exitRequested = true;
                    break;
                }
                if (!s_dio1Flag) {
                    delay(5);
                    continue;
                }
                uint8_t buf[RADIOLIB_SX126X_MAX_PACKET_LENGTH];
                float rssi = 0, snr = 0;
                int len = readPacket(buf, sizeof(buf), rssi, snr);
                console.printf("# RX sync=0x%02X len=%d rssi=%.1f snr=%.1f :", candidates[i], len, rssi, snr);
                for (int b = 0; b < len; b++) console.printf(" %02X", buf[b]);
                console.println();
            }
        }
    }

    while (console.available()) console.read();
    s_radio.standby();
    s_radio.setSyncWord(LORA_SYNC_WORD);
    startReceive();
    console.println("# Sniffer stopped, sync word restored");
}
