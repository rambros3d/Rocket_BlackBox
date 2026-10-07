#include "sd_diagnostics.h"
#include "pin_definitions.h"

SDDiagnosticResults SDDiagnosticsManager::_results = {0};
bool SDDiagnosticsManager::_initialized = false;

const char* SDDiagnosticsManager::getCardTypeString(uint8_t type) {
    switch (type) {
        case CARD_MMC:     return "MMC";
        case CARD_SD:      return "SDSC";
        case CARD_SDHC:    return "SDHC/SDXC";
        case CARD_NONE:    return "No Card Inserted";
        default:           return "UNKNOWN";
    }
}

bool SDDiagnosticsManager::initSDMMC(Print& out) {
    out.println("Initializing 4-Bit SDMMC Card Reader...");
    out.printf("  Pins: CLK=%d, CMD=%d, D0=%d, D1=%d, D2=%d, D3=%d\n",
               PIN_SD_CLK, PIN_SD_CMD, PIN_SD_DAT0, PIN_SD_DAT1, PIN_SD_DAT2, PIN_SD_DAT3);

    // Route SDMMC signals to dedicated GPIOs
    if (!SD_MMC.setPins(PIN_SD_CLK, PIN_SD_CMD, PIN_SD_DAT0, PIN_SD_DAT1, PIN_SD_DAT2, PIN_SD_DAT3)) {
        out.println("  [FAIL] Failed to configure SDMMC GPIO matrix pins.");
        _results.mounted = false;
        return false;
    }

    // Mount in 4-bit bus mode (mode1bit = false)
    if (!SD_MMC.begin("/sdcard", false, false)) {
        out.println("  [FAIL] SD Card Mount Failed! Check card insertion and 10k pull-ups.");
        _results.mounted = false;
        return false;
    }

    uint8_t cardType = SD_MMC.cardType();
    _results.mounted = true;
    _results.is4BitMode = true;
    _results.cardTypeStr = getCardTypeString(cardType);
    _results.totalBytes = SD_MMC.totalBytes();
    _results.usedBytes = SD_MMC.usedBytes();
    _results.freeBytes = (_results.totalBytes > _results.usedBytes) ? (_results.totalBytes - _results.usedBytes) : 0;
    _results.sectorSize = 512; // Standard SD block size
    _initialized = true;

    out.printf("  [OK] SD Card Mounted successfully (%s, 4-Bit Bus)\n", _results.cardTypeStr);
    return true;
}

void SDDiagnosticsManager::runDiagnostics(Print& out) {
    out.println("==================================================");
    out.println("             SDMMC STORAGE DIAGNOSTICS            ");
    out.println("==================================================");

    if (!_initialized) {
        out.println("  [FAIL] SD Card is not mounted.");
        out.println("--------------------------------------------------");
        return;
    }

    float totalMb = (float)_results.totalBytes / (1024.0f * 1024.0f);
    float usedMb = (float)_results.usedBytes / (1024.0f * 1024.0f);
    float freeMb = (float)_results.freeBytes / (1024.0f * 1024.0f);

    out.printf("  Card Type:       %s\n", _results.cardTypeStr);
    out.printf("  Bus Mode:        4-Bit High-Speed SDMMC\n");
    out.printf("  Total Capacity:  %.1f MB (%.2f GB)\n", totalMb, totalMb / 1024.0f);
    out.printf("  Used Space:      %.1f MB\n", usedMb);
    out.printf("  Free Space:      %.1f MB\n", freeMb);
    out.println("--------------------------------------------------");
}

bool SDDiagnosticsManager::runSpeedBenchmark(Print& out, size_t testSizeBytes) {
    if (!_initialized) {
        out.println("  [FAIL] Cannot benchmark unmounted SD card.");
        return false;
    }

    out.printf("Running SDMMC Read/Write Benchmark (%u KB)...\n", (uint32_t)(testSizeBytes / 1024));
    const char* testPath = "/diag_test.bin";
    const size_t chunkSize = 4096;
    uint8_t buffer[chunkSize];

    // Fill buffer with pseudo-random test pattern
    for (size_t i = 0; i < chunkSize; ++i) {
        buffer[i] = (uint8_t)(i ^ 0x5A);
    }

    // --- WRITE TEST ---
    File file = SD_MMC.open(testPath, FILE_WRITE);
    if (!file) {
        out.println("  [FAIL] Failed to open file for write benchmark.");
        return false;
    }

    size_t bytesRemaining = testSizeBytes;
    uint32_t writeStartUs = micros();

    while (bytesRemaining > 0) {
        size_t toWrite = (bytesRemaining < chunkSize) ? bytesRemaining : chunkSize;
        size_t written = file.write(buffer, toWrite);
        if (written != toWrite) {
            out.println("  [FAIL] Write error during benchmark.");
            file.close();
            SD_MMC.remove(testPath);
            return false;
        }
        bytesRemaining -= written;
    }
    file.flush();
    file.close();
    uint32_t writeElapsedUs = micros() - writeStartUs;

    float writeTimeSec = (float)writeElapsedUs / 1000000.0f;
    float writeSpeedMBs = ((float)testSizeBytes / (1024.0f * 1024.0f)) / writeTimeSec;

    // --- READ TEST & VERIFY ---
    file = SD_MMC.open(testPath, FILE_READ);
    if (!file) {
        out.println("  [FAIL] Failed to open file for read benchmark.");
        SD_MMC.remove(testPath);
        return false;
    }

    bytesRemaining = testSizeBytes;
    uint8_t readBuf[chunkSize];
    bool dataMatch = true;
    uint32_t readStartUs = micros();

    while (bytesRemaining > 0) {
        size_t toRead = (bytesRemaining < chunkSize) ? bytesRemaining : chunkSize;
        size_t bytesRead = file.read(readBuf, toRead);
        if (bytesRead != toRead) {
            out.println("  [FAIL] Read size mismatch during benchmark.");
            dataMatch = false;
            break;
        }
        // Validate pattern
        for (size_t i = 0; i < toRead; ++i) {
            if (readBuf[i] != buffer[i]) {
                dataMatch = false;
                break;
            }
        }
        if (!dataMatch) break;
        bytesRemaining -= bytesRead;
    }
    file.close();
    uint32_t readElapsedUs = micros() - readStartUs;

    // Cleanup benchmark file
    SD_MMC.remove(testPath);

    float readTimeSec = (float)readElapsedUs / 1000000.0f;
    float readSpeedMBs = ((float)testSizeBytes / (1024.0f * 1024.0f)) / readTimeSec;

    _results.benchmarkPassed = dataMatch;
    _results.writeSpeedMBs = writeSpeedMBs;
    _results.readSpeedMBs = readSpeedMBs;
    _results.benchmarkSizeBytes = testSizeBytes;

    out.printf("  Benchmark Results:\n");
    out.printf("    - Write Speed: %.2f MB/s (%.3f s)\n", writeSpeedMBs, writeTimeSec);
    out.printf("    - Read Speed:  %.2f MB/s (%.3f s)\n", readSpeedMBs, readTimeSec);
    out.printf("    - Data Integrity: %s\n", dataMatch ? "VERIFIED (100% Match)" : "CORRUPTED");
    out.println("--------------------------------------------------");

    return dataMatch;
}
