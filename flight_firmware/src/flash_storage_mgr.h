#ifndef FLASH_STORAGE_MGR_H
#define FLASH_STORAGE_MGR_H

#include <Arduino.h>
#include <stdint.h>
#include <stdbool.h>

class FlashStorageManager {
public:
    // Initializes the 12MB FFat partition
    static bool initFlash(Print* out = nullptr);
    static bool initFlash(Print& out) { return initFlash(&out); }

    // Storage capacity metrics
    static size_t getTotalBytes();
    static size_t getUsedBytes();
    static size_t getFreeBytes();
    static bool isMounted();

    // Diagnostics & filesystem operations
    static void printDiagnostics(Print& out);
    static void listFiles(Print& out);
    static bool formatStorage(Print& out);
    static bool dumpFile(const char* filename, Print& out);
    static void refreshUSB();

    // CSV Flight Logging
    static bool startFlightLogging(Print& out);
    static void stopFlightLogging();
    static bool isLogging();
    static const char* getCurrentLogFile();
    static void logTelemetry(uint32_t timestampMs, float vBat, float pressureHpa, float altM,
                             float tempC, float humPct,
                             uint16_t co2Ppm, uint16_t vocTicks, double lat, double lon,
                             float gpsAltM, uint8_t sats, bool fix, uint32_t ppsCount,
                             float rollDeg = 0, float pitchDeg = 0, float yawDeg = 0,
                             float verticalSpeedMs = 0,
                             float accX = 0, float accY = 0, float accZ = 0,
                             float gyrX = 0, float gyrY = 0, float gyrZ = 0);
    static void updateLogger();

private:
    static bool _mounted;
    static bool _loggingActive;
    static char _currentFilename[32];
    static FILE* _logFile;
    static uint32_t _lastFlushMs;
    static uint32_t _recordCount;

    static void findNextLogFilename(char* outPath, size_t maxLen);
};

#endif // FLASH_STORAGE_MGR_H
