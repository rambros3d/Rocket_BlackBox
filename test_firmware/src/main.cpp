#include <Arduino.h>
#include "pin_definitions.h"
#include "power_mgr.h"
#include "i2c_bus_manager.h"
#include "env_sensors.h"
#include "imu_sensor.h"
#include "sd_diagnostics.h"
#include "gps_diagnostics.h"
#include "flash_storage_mgr.h"
#include "lora_diagnostic.h"
#include "telemetry_collector.h"

static bool s_streamingMode = false;
static uint32_t s_lastStreamMs = 0;
static bool s_jsonStreamMode = false;
static uint32_t s_lastJsonMs = 0;

void printMenu() {
    Serial.println();
    Serial.println("==================================================");
    Serial.println("        ROCKET BLACKBOX DIAGNOSTIC CONSOLE        ");
    Serial.println("==================================================");
    Serial.println("Select a diagnostic command:");
    Serial.println("  [1] Run Full Subsystem POST (Power-On Self-Test)");
    Serial.println("  [2] Toggle Live Sensor Telemetry Stream (1 Hz)");
    Serial.println("  [j] Toggle Dashboard JSON Telemetry Stream (1 Hz)");
    Serial.println("  [3] Run SDMMC Storage Benchmark (1 MB R/W)");
    Serial.println("  [4] Re-scan Dual I2C Buses");
    Serial.println("  [5] Query GPS & 1PPS Timing Status");
    Serial.println("  [g] Stream Raw BE-166 NMEA Sentences");
    Serial.println("  [p] Probe GPS Bidirectional Command Link");
    Serial.println("  [6] Query Power & Battery Health");
    Serial.println("  [7] Probe BNO055 Electrical Lines & Ping");
    Serial.println("  [e] Run BNO055 Edge-Case Recovery Suite");
    Serial.println("  [8] Query 12MB Flash & USB MSC Storage");
    Serial.println("  [9] List Flash Files (/ffat)");
    Serial.println("  [d] Dump Latest Flight Log CSV");
    Serial.println("  [0] Toggle Flash CSV Flight Logging");
    Serial.println("  [r] Remount / Refresh USB MSC Drive");
    Serial.println("  [f] Format 12MB Flash Storage Partition");
    Serial.println("  [h] Show this menu");
    Serial.println("--------------------------------------------------");
    Serial.print("> ");
}

void runFullPost() {
    Serial.println();
    Serial.println("##################################################");
    Serial.println("         POWER-ON SELF-TEST (POST) REPORT         ");
    Serial.println("##################################################");

    PowerManager::printPowerDiagnostics(Serial);
    I2CBusManager::runDiagnosticScan(Serial);
    EnvSensorsManager::runAllDiagnostics(Serial);
    IMUSensorManager::runDiagnostics(Serial);
    SDDiagnosticsManager::runDiagnostics(Serial);
    GPSDiagnosticsManager::runDiagnostics(Serial);
    FlashStorageManager::printDiagnostics(Serial);

    Serial.println("##################################################");
    Serial.println("               END OF POST REPORT                 ");
    Serial.println("##################################################");
    Serial.println();
}


void streamTelemetry() {
    EnvDiagnosticResults env = {0};
    IMUDiagnosticResults imu = {0};

    EnvSensorsManager::readAllSensors(env);
    IMUSensorManager::readLiveData(imu);
    GPSDiagnosticResults gps = GPSDiagnosticsManager::getResults();

    float vBat = PowerManager::readBatteryVoltage();
    uint8_t batPct = PowerManager::getBatteryPercentage();

    Serial.printf("[T+%06lu s] Bat: %.2fV (%u%%) | P_Alt: %.1fm | Pres: %.2fhPa\n",
                  (unsigned long)TelemetryCollector::uptimeSeconds(), vBat, batPct,
                  env.ms5607AltitudeM, env.ms5607PressureHpa);
    Serial.printf("  IMU : Head=%.1f°, Roll=%.1f°, Pitch=%.1f° | Acc=[%.2f, %.2f, %.2f] m/s² | Cal:[S:%u G:%u A:%u M:%u]\n",
                  imu.headingDeg, imu.rollDeg, imu.pitchDeg,
                  imu.linearAccel.x(), imu.linearAccel.y(), imu.linearAccel.z(),
                  imu.calSys, imu.calGyro, imu.calAccel, imu.calMag);
    Serial.printf("  ENV : MS_T=%.1f°C | SCD_T=%.1f°C | Hum=%.1f%% | CO2=%uppm | VOC=%u | Lux=%.1flx\n",
                  env.ms5607TemperatureC, env.scd40TemperatureC, env.scd40HumidityPct,
                  env.scd40Co2Ppm, env.sgp41RawVoc, env.tsl2591Lux > 0 ? env.tsl2591Lux : env.ltr390Lux);
    Serial.printf("  GPS : Fix=%s (%u Sats, HDOP=%.1f) | Lat=%.5f, Lon=%.5f, Alt=%.1fm | PPS=%u\n",
                  gps.hasFix ? "3D" : "NO_FIX", gps.satellites, gps.hdop,
                  gps.latitude, gps.longitude, gps.altitudeM, gps.ppsPulseCount);
    Serial.println("--------------------------------------------------------------------------------");
}

void setup() {
    // 1. Immediately assert Power Latch (GPIO 40 HIGH) to keep DC-DC power alive
    PowerManager::initEarlyPowerHold();

    // 2. Early mount 12MB FFat Flash Storage so USB MSC SCSI is instantly ready
    FlashStorageManager::initFlash();

    // 3. Initialize native USB CDC / Serial port
    Serial.begin(115200);
    uint32_t waitStart = millis();
    while (!Serial && (millis() - waitStart < 2500)) {
        delay(10);
    }

    Serial.println("\n\n>>> Rocket BlackBox Diagnostic Firmware Starting <<<\n");

    // 4. Report 12MB FFat Flash Storage & USB Composite status
    FlashStorageManager::initFlash(Serial);

    // 5. Initialize housekeeping pins (Button, LED, Battery ADC)
    PowerManager::initHousekeeping();

    // 6. Initialize Dual I2C buses
    I2CBusManager::initBuses();

    // 7. Initialize Environmental & Optical sensors on Bus 1
    EnvSensorsManager::initSensors(Serial);

    // 8. Initialize BNO055 IMU on Bus 2 (polled mode)
    IMUSensorManager::initIMU(Serial);

    // 9. Initialize 4-bit SDMMC reader
    SDDiagnosticsManager::initSDMMC(Serial);

    // 10. Initialize BE-166 GPS UART and 1PPS interrupt
    GPSDiagnosticsManager::initGPS(Serial);

    Serial.println("\nAll subsystems initialized.");
    printMenu();
}

void loop() {
    // Service background tasks
    GPSDiagnosticsManager::update();
    PowerManager::updateHeartbeat(500);
    FlashStorageManager::updateLogger();

    // Handle serial console commands
    if (Serial.available()) {
        char cmd = (char)Serial.read();
        while (Serial.available() && (Serial.peek() == '\r' || Serial.peek() == '\n')) {
            Serial.read(); // flush trailing newline
        }

        switch (cmd) {
            case '1':
                runFullPost();
                printMenu();
                break;
            case '2':
                s_streamingMode = !s_streamingMode;
                Serial.printf("\n>>> Live Telemetry Stream %s <<<\n\n",
                              s_streamingMode ? "STARTED" : "STOPPED");
                if (!s_streamingMode) printMenu();
                break;
            case 'j':
            case 'J':
                s_jsonStreamMode = !s_jsonStreamMode;
                Serial.printf("\n# >>> Dashboard JSON Stream %s <<<\n\n",
                              s_jsonStreamMode ? "STARTED" : "STOPPED");
                if (!s_jsonStreamMode) printMenu();
                break;
            case '3':
                Serial.println();
                SDDiagnosticsManager::runSpeedBenchmark(Serial, 1024 * 1024);
                printMenu();
                break;
            case '4':
                Serial.println();
                I2CBusManager::runDiagnosticScan(Serial);
                printMenu();
                break;
            case '5':
                Serial.println();
                GPSDiagnosticsManager::runDiagnostics(Serial);
                printMenu();
                break;
            case 'g':
            case 'G':
                GPSDiagnosticsManager::streamRawNMEA(Serial, 15000);
                printMenu();
                break;
            case 'p':
            case 'P':
                Serial.println();
                GPSDiagnosticsManager::testBidirectionalLink(Serial);
                printMenu();
                break;
            case '6':
                Serial.println();
                PowerManager::printPowerDiagnostics(Serial);
                printMenu();
                break;
            case '7':
                Serial.println();
                IMUSensorManager::probeIMULines(Serial);
                printMenu();
                break;
            case 'e':
            case 'E':
                Serial.println();
                IMUSensorManager::runEdgeCaseDiagnostics(Serial);
                printMenu();
                break;
            case '8':
                Serial.println();
                FlashStorageManager::printDiagnostics(Serial);
                printMenu();
                break;
            case '9':
                Serial.println();
                FlashStorageManager::listFiles(Serial);
                printMenu();
                break;
            case 'd':
            case 'D':
                Serial.println();
                FlashStorageManager::dumpFile(FlashStorageManager::getCurrentLogFile(), Serial);
                printMenu();
                break;
            case '0':
                Serial.println();
                if (FlashStorageManager::isLogging()) {
                    FlashStorageManager::stopFlightLogging();
                    Serial.println("\n>>> Flash CSV Flight Logging STOPPED <<<");
                } else {
                    FlashStorageManager::startFlightLogging(Serial);
                    Serial.println("\n>>> Flash CSV Flight Logging STARTED <<<");
                }
                printMenu();
                break;
            case 'r':
            case 'R':
                Serial.println();
                Serial.println("Refreshing USB MSC Drive (notifying host OS)...");
                FlashStorageManager::refreshUSB();
                Serial.println("USB MSC re-asserted.");
                printMenu();
                break;
            case 'f':
            case 'F':
                Serial.println();
                FlashStorageManager::formatStorage(Serial);
                printMenu();
                break;
            case 'h':
            case '?':
                printMenu();
                break;
            default:
                break;
        }
    }

    // Background autonomous flight logging (1 Hz)
    static uint32_t s_lastLogMs = 0;
    if (FlashStorageManager::isLogging()) {
        uint32_t now = millis();
        if (now - s_lastLogMs >= 1000) {
            s_lastLogMs = now;
            EnvDiagnosticResults env = {0};
            EnvSensorsManager::readAllSensors(env);
            GPSDiagnosticResults gps = GPSDiagnosticsManager::getResults();
            float vBat = PowerManager::readBatteryVoltage();

            FlashStorageManager::logTelemetry(
                now, vBat, env.ms5607PressureHpa, env.ms5607AltitudeM,
                env.ms5607TemperatureC, env.scd40HumidityPct,
                env.scd40Co2Ppm, env.sgp41RawVoc,
                gps.latitude, gps.longitude, gps.altitudeM,
                gps.satellites, gps.hasFix, gps.ppsPulseCount
            );
        }
    }

    // Telemetry streaming interval (1 Hz)
    if (s_streamingMode) {
        uint32_t now = millis();
        if (now - s_lastStreamMs >= 1000) {
            s_lastStreamMs = now;
            streamTelemetry();
        }
    }

    if (s_jsonStreamMode) {
        uint32_t now = millis();
        if (now - s_lastJsonMs >= 1000) {
            s_lastJsonMs = now;
            TelemetryFrame frame;
            TelemetryCollector::collect(frame);
            Telemetry::writeJson(Serial, frame);
        }
    }
}
