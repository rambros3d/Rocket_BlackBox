#pragma once

#include <Arduino.h>
#include <TinyGPSPlus.h>

struct GPSDiagnosticResults {
    bool uartConnected;
    uint32_t activeBaudRate;
    uint32_t charsProcessed;
    uint32_t sentencesWithFix;
    uint32_t failedChecksums;

    // Navigation fix
    bool hasFix;
    uint32_t satellites;
    float hdop;
    double latitude;
    double longitude;
    double altitudeM;
    double speedKmh;
    double courseDeg;

    // Time & PPS
    uint8_t hour, minute, second;
    uint32_t ppsPulseCount;
    uint32_t lastPpsIntervalMs;
    bool ppsLocked;
};

class GPSDiagnosticsManager {
public:
    static bool initGPS(Print& out);
    static void update();
    static void runDiagnostics(Print& out);
    static void printTelemetryRow(Print& out);
    static void streamRawNMEA(Stream& console, uint32_t durationMs = 10000);
    static void testBidirectionalLink(Stream& console);
    static GPSDiagnosticResults getResults() { return _results; }

    // Interrupt service routine for 1PPS
    static void IRAM_ATTR onPpsInterrupt();

private:
    static HardwareSerial _gpsSerial;
    static TinyGPSPlus _gps;
    static GPSDiagnosticResults _results;
    static volatile uint32_t _ppsCount;
    static volatile uint32_t _lastPpsMs;
    static volatile uint32_t _ppsIntervalMs;
    static bool _initialized;
    
    static bool probeBaud(uint32_t baud);
};
