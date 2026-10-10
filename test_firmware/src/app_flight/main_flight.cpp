// Rocket BlackBox flight telemetry firmware (v2): samples all payload sensors at a fixed rate,
// downlinks each frame over LoRa to the Waveshare USB-TO-LoRa-HF dongle on the dashboard PC,
// accepts uplink commands from the dashboard, streams JSON over USB CDC and logs CSV to flash.
#include <Arduino.h>
#include "pin_definitions.h"
#include "power_mgr.h"
#include "i2c_bus_manager.h"
#include "env_sensors.h"
#include "imu_sensor.h"
#include "sd_diagnostics.h"
#include "gps_diagnostics.h"
#include "flash_storage_mgr.h"
#include "lora_radio.h"
#include "telemetry_packet.h"
#include "telemetry_collector.h"
#include "comment_print.h"

#ifndef TELEMETRY_INTERVAL_MS
#define TELEMETRY_INTERVAL_MS 1000
#endif
#ifndef FLIGHT_AUTOLOG
#define FLIGHT_AUTOLOG 1
#endif

static bool s_usbStream = true;
static uint32_t s_lastFrameMs = 0;
static uint32_t s_txOk = 0;
static uint32_t s_txSkipped = 0;
static uint32_t s_cmdRx = 0;
static bool s_ackPending = false;
static AckPacket s_ack;

static void printHelp() {
    Serial.println("# ---------------- ROCKET BLACKBOX FLIGHT TELEMETRY ----------------");
    Serial.println("# [i] Device info (JSON)     [s] Toggle USB JSON stream");
    Serial.println("# [l] Toggle flash CSV log   [t] Send LoRa text test packet");
    Serial.println("# [x] LoRa link sniffer      [h] Help");
    Serial.println("# ------------------------------------------------------------------");
}

static void printInfo() {
    char dev[12];
    Telemetry::formatDeviceId(TelemetryCollector::deviceId(), dev, sizeof(dev));
    Serial.printf("{\"type\":\"info\",\"role\":\"payload\",\"dev\":\"%s\",\"fw\":\"%s\",\"interval_ms\":%u,"
                  "\"lora\":{\"ok\":%s,\"ch\":%d,\"freq\":%.3f,\"bw\":%.1f,\"sf\":%d,\"cr\":%d,\"pwr\":%d,"
                  "\"sync\":%d,\"tx\":%lu,\"skipped\":%lu,\"cmd_rx\":%lu},"
                  "\"log\":{\"active\":%s,\"file\":\"%s\",\"used\":%u,\"total\":%u}}\n",
                  dev, TELEMETRY_FW_VERSION, (unsigned)TELEMETRY_INTERVAL_MS,
                  LoRaRadio::isReady() ? "true" : "false", LORA_CHANNEL, LORA_FREQUENCY_MHZ,
                  LORA_BANDWIDTH_KHZ, LORA_SPREADING_FACTOR, LORA_CODING_RATE, LORA_TX_POWER_DBM,
                  LORA_SYNC_WORD, (unsigned long)s_txOk, (unsigned long)s_txSkipped, (unsigned long)s_cmdRx,
                  FlashStorageManager::isLogging() ? "true" : "false",
                  FlashStorageManager::isLogging() ? FlashStorageManager::getCurrentLogFile() : "",
                  (unsigned)FlashStorageManager::getUsedBytes(), (unsigned)FlashStorageManager::getTotalBytes());
}

static void setLogging(bool enable) {
    CommentPrint log(Serial);
    if (enable && !FlashStorageManager::isLogging()) {
        FlashStorageManager::startFlightLogging(log);
    } else if (!enable && FlashStorageManager::isLogging()) {
        FlashStorageManager::stopFlightLogging();
        log.println("Flash CSV logging STOPPED");
    }
}

static void handleUplink() {
    uint8_t buf[256];
    float rssi = 0, snr = 0;
    int len = LoRaRadio::readPacket(buf, sizeof(buf), rssi, snr);
    CommandPacket cmd;
    if (len <= 0 || !Telemetry::findCommand(buf, (size_t)len, cmd)) return;

    s_cmdRx++;
    uint8_t status = 0;
    switch (cmd.cmd) {
        case CMD_PING:      break;
        case CMD_LOG_START: setLogging(true); break;
        case CMD_LOG_STOP:  setLogging(false); break;
        default:            status = 1; break;
    }
    Serial.printf("# Uplink command 0x%02X (rssi %.1f dBm, snr %.1f dB) -> %s\n",
                  cmd.cmd, rssi, snr, status == 0 ? "OK" : "UNKNOWN");
    Telemetry::encodeAck(cmd.cmd, status, TelemetryCollector::deviceId(), s_ack);
    s_ackPending = true;
}

static void sendTestPacket() {
    static uint32_t n = 0;
    char text[48];
    int len = snprintf(text, sizeof(text), "RBB TEST %lu\r\n", (unsigned long)++n);
    bool ok = LoRaRadio::send(reinterpret_cast<const uint8_t*>(text), (size_t)len);
    Serial.printf("# LoRa test packet #%lu %s\n", (unsigned long)n, ok ? "sent" : "FAILED (radio busy/not ready)");
}

void setup() {
    PowerManager::initEarlyPowerHold();
    FlashStorageManager::initFlash();

    Serial.begin(115200);
    uint32_t waitStart = millis();
    while (!Serial && (millis() - waitStart < 2500)) {
        delay(10);
    }

    CommentPrint log(Serial);
    log.println(">>> Rocket BlackBox Flight Telemetry Firmware v" TELEMETRY_FW_VERSION " <<<");

    FlashStorageManager::initFlash(log);
    PowerManager::initHousekeeping();
    I2CBusManager::initBuses();
    EnvSensorsManager::initSensors(log);
    IMUSensorManager::initIMU(log);
    SDDiagnosticsManager::initSDMMC(log);
    GPSDiagnosticsManager::initGPS(log);
    LoRaRadio::begin(log);
    TelemetryCollector::begin(TELEMETRY_INTERVAL_MS / 1000.0f);

    if (FLIGHT_AUTOLOG && FlashStorageManager::isMounted()) {
        FlashStorageManager::startFlightLogging(log);
    }

    log.println("All subsystems initialized. Streaming telemetry.");
    printHelp();
    printInfo();
}

static void handleSerialCommand(char cmd) {
    switch (cmd) {
        case 'i': case 'I':
            printInfo();
            break;
        case 's': case 'S':
            s_usbStream = !s_usbStream;
            Serial.printf("# USB JSON stream %s\n", s_usbStream ? "ON" : "OFF");
            break;
        case 'l': case 'L':
            setLogging(!FlashStorageManager::isLogging());
            printInfo();
            break;
        case 't': case 'T':
            sendTestPacket();
            break;
        case 'x': case 'X':
            LoRaRadio::runSniffer(Serial);
            break;
        case 'h': case '?':
            printHelp();
            break;
        default:
            break;
    }
}

void loop() {
    GPSDiagnosticsManager::update();
    PowerManager::updateHeartbeat(500);
    FlashStorageManager::updateLogger();
    LoRaRadio::service();

    while (Serial.available()) {
        char c = (char)Serial.read();
        if (c != '\r' && c != '\n') handleSerialCommand(c);
    }

    if (LoRaRadio::packetAvailable()) handleUplink();
    if (s_ackPending && LoRaRadio::send(reinterpret_cast<const uint8_t*>(&s_ack), sizeof(s_ack))) {
        s_ackPending = false;
    }

    uint32_t now = millis();
    if (now - s_lastFrameMs < TELEMETRY_INTERVAL_MS) return;
    s_lastFrameMs = now;

    TelemetryFrame frame;
    TelemetryCollector::collect(frame);

    if (LoRaRadio::isReady()) {
        TelemetryPacket packet;
        size_t len = Telemetry::encode(frame, packet);
        if (LoRaRadio::send(reinterpret_cast<const uint8_t*>(&packet), len)) {
            s_txOk++;
        } else {
            s_txSkipped++;
        }
    }

    if (s_usbStream) {
        Telemetry::writeJson(Serial, frame);
    }

    if (FlashStorageManager::isLogging()) {
        FlashStorageManager::logTelemetry(
            now, frame.batteryV, frame.pressureHpa, frame.baroAltM,
            frame.temperatureC, frame.humidityPct,
            frame.co2Ppm, TelemetryCollector::lastVocRaw(),
            frame.latitude, frame.longitude, frame.gpsAltM,
            frame.satellites, frame.gpsFix > 0, GPSDiagnosticsManager::getResults().ppsPulseCount);
    }
}
