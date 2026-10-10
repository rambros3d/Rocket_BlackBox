#pragma once

#include <Arduino.h>
#include <FS.h>
#include <SD_MMC.h>

struct SDDiagnosticResults {
    bool mounted;
    bool is4BitMode;
    const char* cardTypeStr;
    uint64_t totalBytes;
    uint64_t usedBytes;
    uint64_t freeBytes;
    uint32_t sectorSize;

    // Benchmark
    bool benchmarkPassed;
    float writeSpeedMBs;
    float readSpeedMBs;
    size_t benchmarkSizeBytes;
};

class SDDiagnosticsManager {
public:
    static bool initSDMMC(Print& out);
    static void runDiagnostics(Print& out);
    static bool runSpeedBenchmark(Print& out, size_t testSizeBytes = (1024 * 1024));

    static SDDiagnosticResults getResults() { return _results; }

private:
    static SDDiagnosticResults _results;
    static bool _initialized;
    static const char* getCardTypeString(uint8_t type);
};
