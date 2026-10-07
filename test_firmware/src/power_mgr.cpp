#include "power_mgr.h"
#include <esp_system.h>

bool PowerManager::_ledState = false;
uint32_t PowerManager::_lastHeartbeatMs = 0;
uint32_t PowerManager::_btnPressStartMs = 0;

void PowerManager::initEarlyPowerHold() {
    pinMode(PIN_PWR_EN, OUTPUT);
    digitalWrite(PIN_PWR_EN, HIGH);
}

void PowerManager::initHousekeeping() {
    pinMode(PIN_PWR_BTN, INPUT);
    pinMode(PIN_LED, OUTPUT);
    digitalWrite(PIN_LED, LOW);
    
    // Set ADC resolution to 12 bits and configure attenuation for 3.3V range
    analogReadResolution(12);
    analogSetPinAttenuation(PIN_BAT_ADC, ADC_11db);
}

bool PowerManager::isButtonPressed() {
    // Assuming active high or pulled up; reading digital state directly
    return digitalRead(PIN_PWR_BTN) == HIGH;
}

uint32_t PowerManager::getButtonHoldDurationMs() {
    if (isButtonPressed()) {
        if (_btnPressStartMs == 0) {
            _btnPressStartMs = millis();
        }
        return millis() - _btnPressStartMs;
    } else {
        _btnPressStartMs = 0;
        return 0;
    }
}

float PowerManager::readBatteryVoltage() {
    // Read calibrated millivolts from ADC1_CH8
    uint32_t rawMv = analogReadMilliVolts(PIN_BAT_ADC);
    // Board has a 1/2 voltage divider
    float vBat = (rawMv * 2.0f) / 1000.0f;
    return vBat;
}

uint8_t PowerManager::getBatteryPercentage() {
    float vBat = readBatteryVoltage();
    if (vBat >= 4.20f) return 100;
    if (vBat <= 3.20f) return 0;

    // Piecewise approximation for 1S LiPo
    if (vBat > 3.90f) {
        return 75 + (uint8_t)((vBat - 3.90f) / 0.30f * 25.0f);
    } else if (vBat > 3.75f) {
        return 50 + (uint8_t)((vBat - 3.75f) / 0.15f * 25.0f);
    } else if (vBat > 3.60f) {
        return 20 + (uint8_t)((vBat - 3.60f) / 0.15f * 30.0f);
    } else {
        return (uint8_t)((vBat - 3.20f) / 0.40f * 20.0f);
    }
}

void PowerManager::updateHeartbeat(uint32_t intervalMs) {
    uint32_t now = millis();
    if (now - _lastHeartbeatMs >= intervalMs) {
        _lastHeartbeatMs = now;
        _ledState = !_ledState;
        digitalWrite(PIN_LED, _ledState ? HIGH : LOW);
    }
}

static const char* getResetReasonString(esp_reset_reason_t reason) {
    switch (reason) {
        case ESP_RST_POWERON:   return "Power-on reset";
        case ESP_RST_EXT:       return "External pin reset";
        case ESP_RST_SW:        return "Software reset";
        case ESP_RST_PANIC:     return "Software panic / crash";
        case ESP_RST_INT_WDT:   return "Interrupt watchdog reset";
        case ESP_RST_TASK_WDT:  return "Task watchdog reset";
        case ESP_RST_WDT:       return "Watchdog reset";
        case ESP_RST_DEEPSLEEP: return "Deep sleep wake-up";
        case ESP_RST_BROWNOUT:  return "Brownout reset";
        case ESP_RST_SDIO:      return "SDIO reset";
        default:                return "Unknown";
    }
}

ChipTelemetry PowerManager::getChipTelemetry() {
    ChipTelemetry t;
    t.internalTempC = temperatureRead();
    t.freeHeapBytes = esp_get_free_heap_size();
    t.minFreeHeapBytes = esp_get_minimum_free_heap_size();
    t.cpuFreqMhz = getCpuFrequencyMhz();
    t.resetReason = getResetReasonString(esp_reset_reason());
    return t;
}

void PowerManager::printPowerDiagnostics(Print& out) {
    ChipTelemetry chip = getChipTelemetry();
    float vBat = readBatteryVoltage();
    uint8_t pct = getBatteryPercentage();
    bool btn = isButtonPressed();

    out.println("==================================================");
    out.println("          POWER & SYSTEM TELEMETRY               ");
    out.println("==================================================");
    out.printf("  Power Hold (GPIO 40): HIGH [ACTIVE]\n");
    out.printf("  Power Button (GPIO 39): %s\n", btn ? "PRESSED" : "RELEASED");
    out.printf("  Battery Voltage:        %.2f V (%u%%)\n", vBat, pct);
    out.printf("  CPU Frequency:          %u MHz\n", chip.cpuFreqMhz);
    out.printf("  Internal Temperature:   %.1f C\n", chip.internalTempC);
    out.printf("  Free Heap:              %u bytes (Min: %u)\n", chip.freeHeapBytes, chip.minFreeHeapBytes);
    out.printf("  Reset Reason:           %s\n", chip.resetReason);
    out.println("--------------------------------------------------");
}
