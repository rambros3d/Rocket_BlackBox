#include "lora_diagnostic.h"
#include "pin_definitions.h"
#include <RadioLib.h>
#include <SPI.h>

namespace LoRaDiagnostic {

// Dedicated SPI instance for the SX1262 bus
static SPIClass loraSPI(FSPI);

// RadioLib SX1262 Module instance
static Module* loraModule = nullptr;
static SX1262* radio = nullptr;
static bool initialized = false;
static volatile bool s_packetReceivedFlag = false;

#if defined(ESP8266) || defined(ESP32)
ICACHE_RAM_ATTR
#endif
static void onPacketReceived() {
    s_packetReceivedFlag = true;
}

// Standard RF parameters
constexpr float LORA_FREQ_MHZ    = 868.0f;
constexpr float LORA_BW_KHZ      = 125.0f;
constexpr uint8_t LORA_SF        = 7;
constexpr uint8_t LORA_CR        = 5;      // 4/5
constexpr uint8_t LORA_SYNC_WORD = 0x12;   // Private network sync word (matching Waveshare dongle)
constexpr int8_t LORA_TX_POWER   = 14;     // dBm
constexpr uint16_t LORA_PREAMBLE = 16;     // Preamble symbols
constexpr float LORA_TCXO_VOLT   = 1.6f;   // 1.6V TCXO reference on RAK3112

bool init() {
    if (initialized) {
        return true;
    }

    Serial.println("\n[LORA] Initializing Semtech SX1262 on RAK3112...");

    // 1. Assert RF antenna switch power
    pinMode(PIN_LORA_ANT_SW, OUTPUT);
    digitalWrite(PIN_LORA_ANT_SW, HIGH);
    delay(10);

    // 2. Initialize dedicated SPI bus for RAK3112 internal connections
    loraSPI.begin(PIN_LORA_SCK, PIN_LORA_MISO, PIN_LORA_MOSI, PIN_LORA_NSS);

    // 3. Create RadioLib Module and SX1262 instances
    loraModule = new Module(PIN_LORA_NSS, PIN_LORA_DIO1, PIN_LORA_RST, PIN_LORA_BUSY, loraSPI);
    radio = new SX1262(loraModule);

    // 4. Initialize the transceiver
    // begin(freq, bw, sf, cr, syncWord, power, preambleLength, tcxoVoltage, useRegulatorLDO)
    int16_t state = radio->begin(
        LORA_FREQ_MHZ,
        LORA_BW_KHZ,
        LORA_SF,
        LORA_CR,
        LORA_SYNC_WORD,
        LORA_TX_POWER,
        LORA_PREAMBLE,
        LORA_TCXO_VOLT,
        false
    );

    if (state != RADIOLIB_ERR_NONE) {
        Serial.printf("[LORA] ERROR: Initialization failed (code %d)\n", state);
        return false;
    }

    // 5. Enable internal DIO2 RF switch control
    state = radio->setDio2AsRfSwitch(true);
    if (state != RADIOLIB_ERR_NONE) {
        Serial.printf("[LORA] WARNING: Failed to enable DIO2 RF switch (code %d)\n", state);
    }

    // 6. Enable hardware CRC
    radio->setCRC(true);

    // 7. Attach interrupt callback for packet reception
    radio->setPacketReceivedAction(onPacketReceived);

    Serial.printf("[LORA] Hardware initialized successfully!\n");
    Serial.printf("       Freq: %.3f MHz | BW: %.1f kHz | SF: %d | CR: 4/%d | Sync: 0x%02X | Power: %d dBm\n",
                  LORA_FREQ_MHZ, LORA_BW_KHZ, LORA_SF, LORA_CR, LORA_SYNC_WORD, LORA_TX_POWER);

    initialized = true;
    return true;
}

void runHardwareCheck() {
    if (!init()) {
        Serial.println("[LORA] Cannot perform hardware check: radio failed to initialize.");
        return;
    }

    Serial.println("\n========================================");
    Serial.println("   RAK3112 SX1262 HARDWARE STATUS CHECK");
    Serial.println("========================================");
    Serial.printf("Carrier Frequency   : %.3f MHz\n", LORA_FREQ_MHZ);
    Serial.printf("Bandwidth           : %.1f kHz\n", LORA_BW_KHZ);
    Serial.printf("Spreading Factor    : SF%d\n", LORA_SF);
    Serial.printf("Coding Rate         : 4/%d\n", LORA_CR);
    Serial.printf("Sync Word           : 0x%02X (Private LoRa)\n", LORA_SYNC_WORD);
    Serial.printf("Preamble Length     : %d symbols\n", LORA_PREAMBLE);
    Serial.printf("TCXO Reference      : %.1f V (DIO3)\n", LORA_TCXO_VOLT);
    Serial.printf("Antenna Switch      : GPIO %d HIGH, DIO2 Auto-Switch\n", PIN_LORA_ANT_SW);
    Serial.println("Status              : READY FOR OPERATION\n");
}

void runPingPongTest(uint16_t count, uint32_t timeoutMs) {
    if (!init()) {
        Serial.println("[LORA] Aborting ping-pong test: radio not initialized.");
        return;
    }

    Serial.println("\n=======================================================");
    Serial.printf("   BIDIRECTIONAL PING-PONG TEST (%d PACKETS)\n", count);
    Serial.println("=======================================================");
    Serial.println("Ensure ground station responder is listening on /dev/ttyACM0.\n");

    uint16_t sent = 0;
    uint16_t received = 0;
    uint32_t totalRtt = 0;

    for (uint16_t seq = 1; seq <= count; seq++) {
        uint32_t txStart = millis();
        char pingMsg[32];
        snprintf(pingMsg, sizeof(pingMsg), "PING:%03u:%lu", seq, txStart);

        Serial.printf("[TX #%03u] Sending \"%s\"... ", seq, pingMsg);

        // Transmit ping packet
        int16_t state = radio->transmit((uint8_t*)pingMsg, strlen(pingMsg));
        if (state != RADIOLIB_ERR_NONE) {
            Serial.printf("TX FAIL (%d)\n", state);
            delay(500);
            continue;
        }
        sent++;

        // Switch to non-blocking receive mode with timeout
        s_packetReceivedFlag = false;
        radio->startReceive();

        uint32_t waitStart = millis();
        bool gotPong = false;

        while (millis() - waitStart < timeoutMs) {
            if (s_packetReceivedFlag) {
                s_packetReceivedFlag = false;
                char rxBuf[64] = {0};
                int16_t state = radio->readData((uint8_t*)rxBuf, sizeof(rxBuf) - 1);
                if (state == RADIOLIB_ERR_NONE) {
                    uint32_t rtt = millis() - txStart;
                    float rssi = radio->getRSSI();
                    float snr = radio->getSNR();

                    rxBuf[sizeof(rxBuf) - 1] = '\0';
                    if (strncmp(rxBuf, "PONG", 4) == 0) {
                        Serial.printf("PONG received! RTT: %lu ms | RSSI: %.1f dBm | SNR: %.1f dB\n",
                                      rtt, rssi, snr);
                        received++;
                        totalRtt += rtt;
                        gotPong = true;
                        break;
                    }
                }
            }
            delay(5);
        }

        radio->standby();

        if (!gotPong) {
            Serial.println("TIMEOUT (No Pong)");
        }

        delay(300); // Inter-packet guard time
    }

    Serial.println("\n-------------------------------------------------------");
    Serial.println("PING-PONG TEST RESULTS:");
    Serial.printf("  Packets Sent     : %u\n", sent);
    Serial.printf("  Packets Received : %u\n", received);
    float lossRate = (sent > 0) ? ((float)(sent - received) / sent * 100.0f) : 100.0f;
    Serial.printf("  Packet Loss      : %.1f%%\n", lossRate);
    if (received > 0) {
        Serial.printf("  Average RTT      : %.1f ms\n", (float)totalRtt / received);
    }
    Serial.println("-------------------------------------------------------\n");
}

void runBeaconMode() {
    if (!init()) {
        return;
    }

    Serial.println("\n[LORA] Starting continuous telemetry beacon (500ms interval).");
    Serial.println("Press any key to stop...\n");

    uint32_t seq = 0;
    while (!Serial.available()) {
        seq++;
        char beaconMsg[64];
        snprintf(beaconMsg, sizeof(beaconMsg), "BB_TELEM:%05lu:ALT=4982.5:BAT=4.12:TEMP=24.5", seq);

        digitalWrite(PIN_LED, HIGH);
        int16_t state = radio->transmit((uint8_t*)beaconMsg, strlen(beaconMsg));
        digitalWrite(PIN_LED, LOW);

        if (state == RADIOLIB_ERR_NONE) {
            Serial.printf("[BEACON #%05lu] Sent: %s\n", seq, beaconMsg);
        } else {
            Serial.printf("[BEACON #%05lu] TX FAIL (%d)\n", seq, state);
        }

        delay(500);
    }

    while (Serial.available()) {
        Serial.read();
    }
    Serial.println("[LORA] Telemetry beacon stopped.\n");
}

void runPacketSniffer() {
    if (!init()) {
        return;
    }

    Serial.println("\n[LORA] Entering packet sniffer mode.");
    Serial.println("Listening for incoming LoRa transmissions (Press any key to exit)...\n");

    s_packetReceivedFlag = false;
    radio->startReceive();

    while (!Serial.available()) {
        if (s_packetReceivedFlag) {
            s_packetReceivedFlag = false;
            char rxBuf[256] = {0};
            int16_t state = radio->readData((uint8_t*)rxBuf, sizeof(rxBuf) - 1);

            if (state == RADIOLIB_ERR_NONE) {
                size_t len = radio->getPacketLength();
                float rssi = radio->getRSSI();
                float snr = radio->getSNR();

                Serial.printf("[%lu ms] RX %u bytes | RSSI: %.1f dBm | SNR: %.1f dB\n",
                              millis(), (unsigned int)len, rssi, snr);
                Serial.print("  HEX: ");
                for (size_t i = 0; i < len; i++) {
                    Serial.printf("%02X ", (uint8_t)rxBuf[i]);
                }
                Serial.println();
                Serial.print("  ASC: ");
                for (size_t i = 0; i < len; i++) {
                    char c = rxBuf[i];
                    Serial.print((c >= 32 && c <= 126) ? c : '.');
                }
                Serial.println("\n");
            }
            // Resume listening
            radio->startReceive();
        }
        delay(10);
    }

    radio->standby();

    while (Serial.available()) {
        Serial.read();
    }
    Serial.println("[LORA] Packet sniffer stopped.\n");
}

void showMenu() {
    if (!init()) {
        Serial.println("[LORA] Initialization failed. Check hardware.");
        return;
    }

    while (true) {
        Serial.println("\n========================================");
        Serial.println("      RAK3112 LORA DIAGNOSTIC MENU      ");
        Serial.println("========================================");
        Serial.println(" [1] Hardware Status & Parameter Check  ");
        Serial.println(" [2] Bidirectional Ping-Pong Test (10)  ");
        Serial.println(" [3] Continuous Telemetry Beacon        ");
        Serial.println(" [4] Packet Sniffer / Receiver Mode     ");
        Serial.println(" [x] Return to Main Diagnostic Menu     ");
        Serial.print("Select option > ");

        while (!Serial.available()) {
            delay(20);
        }

        char choice = Serial.read();
        Serial.println(choice);

        while (Serial.available()) {
            Serial.read();
        }

        switch (choice) {
            case '1':
                runHardwareCheck();
                break;
            case '2':
                runPingPongTest(10, 1500);
                break;
            case '3':
                runBeaconMode();
                break;
            case '4':
                runPacketSniffer();
                break;
            case 'x':
            case 'X':
                Serial.println("Exiting LoRa Diagnostic Menu.");
                return;
            default:
                Serial.println("Invalid option. Try again.");
                break;
        }
    }
}

} // namespace LoRaDiagnostic
