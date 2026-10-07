#pragma once

#include <Arduino.h>
#include "pin_definitions.h"

struct ChipTelemetry {
    float internalTempC;
    uint32_t freeHeapBytes;
    uint32_t minFreeHeapBytes;
    uint32_t cpuFreqMhz;
    const char* resetReason;
};

class PowerManager {
public:
    static void initEarlyPowerHold();
    static void initHousekeeping();

    static bool isButtonPressed();
    static uint32_t getButtonHoldDurationMs();

    static float readBatteryVoltage();
    static uint8_t getBatteryPercentage();

    static void updateHeartbeat(uint32_t intervalMs = 500);
    static ChipTelemetry getChipTelemetry();
    static void printPowerDiagnostics(Print& out);

private:
    static bool _ledState;
    static uint32_t _lastHeartbeatMs;
    static uint32_t _btnPressStartMs;
};
