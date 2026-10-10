#pragma once

#include "telemetry_packet.h"

// Samples every payload subsystem into a TelemetryFrame. Call collect() at a fixed interval
// because the VOC/NOx gas-index algorithms assume a constant sampling period.
class TelemetryCollector {
public:
    static void begin(float samplingIntervalS = 1.0f);
    static void collect(TelemetryFrame& frame);
    static uint16_t deviceId();
    // Seconds elapsed since the ESP32 booted. This is the payload's uptime,
    // not the dashboard receive time or the telemetry sampling schedule.
    static uint32_t uptimeSeconds();
    static uint16_t lastVocRaw() { return _lastVocRaw; }

private:
    static uint16_t _seq;
    static uint16_t _lastVocRaw;
    static float _lastBaroAltM;
    static uint32_t _lastBaroMs;
    static float _vSpeedFiltered;
};
