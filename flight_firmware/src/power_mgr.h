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

    // Status LED pattern control
    enum class LedState { Disconnected, Connected };
    static void setLedState(LedState s);
    static void updateLed();

    // Power-off button hold countdown
    enum class HoldState { Idle, Hold, Off };
    static void updateButtonHold();                 // call each loop
    static bool wasButtonHoldTriggeredThisLoop(); // did the 5s hold reach this iteration?
    static void resetButtonHold();                 // used if driver calls from app

private:
    static bool _ledState;
    static uint32_t _lastHeartbeatMs;
    static uint32_t _btnPressStartMs;
    static LedState _ledPatternState;
    static uint32_t _ledCycleStartMs;

    static HoldState _holdState;
    static uint32_t _holdStartMs;
    static uint32_t _holdBlinkToggleMs;
    static bool _holdBlinkOn;
    static bool _holdTriggeredThisLoop;
};
