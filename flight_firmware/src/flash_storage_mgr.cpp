#include "flash_storage_mgr.h"
#include <esp_vfs_fat.h>
#include <wear_levelling.h>
#include <USB.h>
#include <USBMSC.h>
#include <USBCDC.h>
#include <dirent.h>
#include <sys/stat.h>
#include <stdio.h>

static USBMSC s_msc;
static wl_handle_t s_wlHandle = WL_INVALID_HANDLE;
static const uint32_t MSC_TOTAL_BLOCKS = 24576; // 12MB / 512 bytes
static const uint16_t MSC_BLOCK_SIZE = 512;

bool FlashStorageManager::_mounted = false;
bool FlashStorageManager::_loggingActive = false;
char FlashStorageManager::_currentFilename[32] = {0};
FILE* FlashStorageManager::_logFile = nullptr;
uint32_t FlashStorageManager::_lastFlushMs = 0;
uint32_t FlashStorageManager::_recordCount = 0;

static int32_t onMscRead(uint32_t lba, uint32_t offset, void *buffer, uint32_t bufsize) {
    if (s_wlHandle == WL_INVALID_HANDLE || !FlashStorageManager::isMounted()) return -1;
    size_t srcAddr = (size_t)lba * MSC_BLOCK_SIZE + offset;
    esp_err_t err = wl_read(s_wlHandle, srcAddr, buffer, bufsize);
    return (err == ESP_OK) ? (int32_t)bufsize : -1;
}

static int32_t onMscWrite(uint32_t lba, uint32_t offset, uint8_t *buffer, uint32_t bufsize) {
    // Write protection: reject host writes to protect filesystem integrity
    return 0;
}

static bool onMscStartStop(uint8_t power_condition, bool start, bool load_eject) {
    return true;
}

// Register USB MSC interface before app_main() calls USB.begin()
// Do NOT call FreeRTOS/VFS functions here; constructor runs before scheduler starts!
__attribute__((constructor)) static void pre_app_main_msc_init() {
    s_msc.vendorID("ROCKET");
    s_msc.productID("ROCKET_DATA");
    s_msc.productRevision("1.0");
    s_msc.mediaPresent(false); // Media will be marked present when mounted in setup()
    s_msc.isWritable(false);   // Host write protection
    s_msc.onRead(onMscRead);
    s_msc.onWrite(onMscWrite);
    s_msc.onStartStop(onMscStartStop);
    s_msc.begin(MSC_TOTAL_BLOCKS, MSC_BLOCK_SIZE);
}

bool FlashStorageManager::initFlash(Print* out) {
    if (s_wlHandle != WL_INVALID_HANDLE && _mounted) {
        if (out) {
            size_t totalBytes = wl_size(s_wlHandle);
            out->printf("  [OK] FFat already mounted: %.2f MB total at /ffat\n", (float)totalBytes / (1024.0f * 1024.0f));
            out->printf("  [OK] USB Composite: CDC Serial + MSC Read-Only Drive (\"ROCKET_DATA\")\n");
        }
        return true;
    }

    if (out) out->println("Initializing 12MB FFat Flash Storage & USB Composite...");

    const esp_partition_t *part = esp_partition_find_first(
        ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_DATA_FAT, "ffat"
    );
    if (!part) {
        if (out) out->println("  [FAIL] Partition 'ffat' not found in partition table!");
        return false;
    }

    esp_vfs_fat_mount_config_t conf = {
        .format_if_mount_failed = true,
        .max_files = 8,
        .allocation_unit_size = CONFIG_WL_SECTOR_SIZE,
        .disk_status_check_enable = false,
        .use_one_fat = false
    };

    esp_err_t err = esp_vfs_fat_spiflash_mount_rw_wl("/ffat", "ffat", &conf, &s_wlHandle);
    if (err != ESP_OK) {
        if (out) out->printf("  [WARN] Mount failed (err: 0x%X). Formatting 12MB partition...\n", err);
        err = esp_vfs_fat_spiflash_format_rw_wl("/ffat", "ffat");
        if (err == ESP_OK) {
            err = esp_vfs_fat_spiflash_mount_rw_wl("/ffat", "ffat", &conf, &s_wlHandle);
        }
    }

    if (err != ESP_OK || s_wlHandle == WL_INVALID_HANDLE) {
        if (out) out->printf("  [FAIL] Flash storage mount failed! Error: 0x%X\n", err);
        _mounted = false;
        s_msc.mediaPresent(false);
        return false;
    }

    _mounted = true;
    s_msc.mediaPresent(true);

    if (out) {
        size_t totalBytes = wl_size(s_wlHandle);
        out->printf("  [OK] FFat mounted: %.2f MB total at /ffat\n", (float)totalBytes / (1024.0f * 1024.0f));
        out->printf("  [OK] USB Composite: CDC Serial + MSC Read-Only Drive (\"ROCKET_DATA\", %u sectors)\n",
                   MSC_TOTAL_BLOCKS);
    }

    return true;
}




size_t FlashStorageManager::getTotalBytes() {
    if (!_mounted || s_wlHandle == WL_INVALID_HANDLE) return 0;
    return wl_size(s_wlHandle);
}

size_t FlashStorageManager::getUsedBytes() {
    if (!_mounted || s_wlHandle == WL_INVALID_HANDLE) return 0;
    FATFS *fs;
    DWORD fre_clust;
    // FAT drive letter for wl
    if (f_getfree("0:", &fre_clust, &fs) != FR_OK) return 0;
    DWORD tot_sect = (fs->n_fatent - 2) * fs->csize;
    DWORD fre_sect = fre_clust * fs->csize;
    size_t sectorSize = wl_sector_size(s_wlHandle);
    return (tot_sect - fre_sect) * sectorSize;
}

size_t FlashStorageManager::getFreeBytes() {
    if (!_mounted || s_wlHandle == WL_INVALID_HANDLE) return 0;
    FATFS *fs;
    DWORD fre_clust;
    if (f_getfree("0:", &fre_clust, &fs) != FR_OK) return 0;
    size_t sectorSize = wl_sector_size(s_wlHandle);
    return (size_t)fre_clust * fs->csize * sectorSize;
}

bool FlashStorageManager::isMounted() {
    return _mounted;
}

void FlashStorageManager::printDiagnostics(Print& out) {
    out.println("==================================================");
    out.println("       12MB FLASH & USB MSC STORAGE REPORT        ");
    out.println("==================================================");
    out.printf("  Filesystem Mount:   %s (/ffat)\n", _mounted ? "MOUNTED" : "UNMOUNTED");
    if (_mounted) {
        size_t total = getTotalBytes();
        size_t freeB = getFreeBytes();
        size_t used = (total > freeB) ? (total - freeB) : 0;
        float usedPct = (total > 0) ? ((float)used / (float)total * 100.0f) : 0.0f;
        out.printf("  Partition Capacity: %.2f MB (%u bytes)\n", (float)total / (1024.0f * 1024.0f), total);
        out.printf("  Used Space:         %.2f MB (%u bytes, %.1f%%)\n", (float)used / (1024.0f * 1024.0f), used, usedPct);
        out.printf("  Free Space:         %.2f MB (%u bytes)\n", (float)freeB / (1024.0f * 1024.0f), freeB);
        out.printf("  USB MSC Volume:     \"ROCKET_DATA\" (Read-Only SCSI LUN)\n");
        out.printf("  Active Flight Log:  %s (%s, %lu records)\n",
                   _currentFilename[0] ? _currentFilename : "None",
                   _loggingActive ? "LOGGING" : "IDLE", (unsigned long)_recordCount);
    }
    out.println("--------------------------------------------------");
}

void FlashStorageManager::listFiles(Print& out) {
    out.println("--- Listing /ffat directory contents ---");
    if (!_mounted) {
        out.println("  [ERROR] Flash storage not mounted.");
        return;
    }

    DIR *dir = opendir("/ffat");
    if (!dir) {
        out.println("  [ERROR] Failed to open /ffat directory.");
        return;
    }

    struct dirent *ent;
    int fileCount = 0;
    size_t totalFileBytes = 0;

    while ((ent = readdir(dir)) != NULL) {
        char fullPath[64];
        snprintf(fullPath, sizeof(fullPath), "/ffat/%s", ent->d_name);
        struct stat st;
        if (stat(fullPath, &st) == 0) {
            out.printf("  %-20s %8ld bytes\n", ent->d_name, (long)st.st_size);
            totalFileBytes += st.st_size;
            fileCount++;
        }
    }
    closedir(dir);

    if (fileCount == 0) {
        out.println("  (No files found on partition)");
    } else {
        out.printf("  Total: %d file(s), %lu bytes\n", fileCount, (unsigned long)totalFileBytes);
    }
}

bool FlashStorageManager::formatStorage(Print& out) {
    out.println("Formatting 12MB FFat Flash Storage Partition...");
    if (_loggingActive) stopFlightLogging();

    if (_mounted && s_wlHandle != WL_INVALID_HANDLE) {
        esp_vfs_fat_spiflash_unmount_rw_wl("/ffat", s_wlHandle);
        s_wlHandle = WL_INVALID_HANDLE;
        _mounted = false;
    }

    esp_err_t err = esp_vfs_fat_spiflash_format_rw_wl("/ffat", "ffat");
    if (err != ESP_OK) {
        out.printf("  [FAIL] Format failed! (Error 0x%X)\n", err);
        return false;
    }

    out.println("  [OK] Format successful. Remounting...");
    esp_vfs_fat_mount_config_t conf = {
        .format_if_mount_failed = true,
        .max_files = 8,
        .allocation_unit_size = CONFIG_WL_SECTOR_SIZE,
        .disk_status_check_enable = false,
        .use_one_fat = false
    };
    esp_err_t remountErr = esp_vfs_fat_spiflash_mount_rw_wl("/ffat", "ffat", &conf, &s_wlHandle);
    if (remountErr == ESP_OK) {
        _mounted = true;
        out.println("  [OK] Remount successful.");
        return true;
    } else {
        out.printf("  [FAIL] Remount failed! Error: 0x%X\n", remountErr);
        return false;
    }
}


bool FlashStorageManager::dumpFile(const char* filename, Print& out) {
    char fullPath[64];
    if (filename[0] == '/') {
        snprintf(fullPath, sizeof(fullPath), "%s", filename);
    } else {
        snprintf(fullPath, sizeof(fullPath), "/ffat/%s", filename);
    }

    FILE *f = fopen(fullPath, "r");
    if (!f) {
        out.printf("  [ERROR] Cannot open file '%s'\n", fullPath);
        return false;
    }

    out.printf("=== DUMPING %s ===\n", fullPath);
    char buf[128];
    while (fgets(buf, sizeof(buf), f)) {
        out.print(buf);
    }
    fclose(f);
    out.println("\n=== END OF FILE ===");
    return true;
}

void FlashStorageManager::findNextLogFilename(char* outPath, size_t maxLen) {
    for (int i = 1; i <= 9999; i++) {
        char testPath[64];
        snprintf(testPath, sizeof(testPath), "/ffat/flight_%04d.csv", i);
        struct stat st;
        if (stat(testPath, &st) != 0) {
            snprintf(outPath, maxLen, "%s", testPath);
            return;
        }
    }
    snprintf(outPath, maxLen, "/ffat/flight_9999.csv");
}

bool FlashStorageManager::startFlightLogging(Print& out) {
    if (!_mounted) {
        out.println("  [ERROR] Cannot start logging: Flash not mounted.");
        return false;
    }

    if (_loggingActive && _logFile) {
        out.printf("  [WARN] Logging already active on '%s'\n", _currentFilename);
        return true;
    }

    findNextLogFilename(_currentFilename, sizeof(_currentFilename));
    _logFile = fopen(_currentFilename, "w");
    if (!_logFile) {
        out.printf("  [FAIL] Failed to create log file '%s'\n", _currentFilename);
        _loggingActive = false;
        return false;
    }

    // Write CSV Header
    fputs("timestamp_ms,vbat_v,pressure_hpa,altitude_m,temp_c,humidity_pct,co2_ppm,voc_ticks,lat,lon,gps_alt_m,sats,fix,pps_count\n", _logFile);
    fflush(_logFile);

    _loggingActive = true;
    _recordCount = 0;
    _lastFlushMs = millis();
    out.printf("  [OK] Flight log opened: %s\n", _currentFilename);
    return true;
}

void FlashStorageManager::refreshUSB() {
    s_msc.mediaPresent(false);
    delay(200);
    s_msc.mediaPresent(true);
}

void FlashStorageManager::stopFlightLogging() {
    if (_logFile) {
        fflush(_logFile);
        fclose(_logFile);
        _logFile = nullptr;
    }
    _loggingActive = false;
    refreshUSB();
}

bool FlashStorageManager::isLogging() {
    return _loggingActive;
}

const char* FlashStorageManager::getCurrentLogFile() {
    return _currentFilename;
}

void FlashStorageManager::logTelemetry(uint32_t timestampMs, float vBat, float pressureHpa, float altM,
                                      float tempC, float humPct,
                                      uint16_t co2Ppm, uint16_t vocTicks, double lat, double lon,
                                      float gpsAltM, uint8_t sats, bool fix, uint32_t ppsCount) {
    if (!_loggingActive || !_logFile) return;

    fprintf(_logFile, "%lu,%.2f,%.2f,%.2f,%.2f,%.1f,%u,%u,%.6f,%.6f,%.1f,%u,%d,%lu\n",
            (unsigned long)timestampMs, vBat, pressureHpa, altM, tempC, humPct, co2Ppm, vocTicks,
            lat, lon, gpsAltM, sats, fix ? 1 : 0, (unsigned long)ppsCount);
    _recordCount++;

    // Periodic flush every 1 second to safeguard against power cutoff
    if (millis() - _lastFlushMs > 1000) {
        fflush(_logFile);
        _lastFlushMs = millis();
    }
}

void FlashStorageManager::updateLogger() {
    if (_loggingActive && _logFile && (millis() - _lastFlushMs > 1000)) {
        fflush(_logFile);
        _lastFlushMs = millis();
    }
}
