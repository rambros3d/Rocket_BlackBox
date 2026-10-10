#pragma once

#include <Arduino.h>
#include <Wire.h>
#include <vector>
#include "pin_definitions.h"

struct I2CDeviceInfo {
    uint8_t address;
    const char* expectedDevice;
    bool found;
};

class I2CBusManager {
public:
    static void initBuses();
    // Recreate one I2C controller after repeated read failures.
    static void restartBus(uint8_t busIndex);
    
    // Scans the specified bus (Wire or Wire1) and returns found addresses
    static std::vector<uint8_t> scanBus(TwoWire& bus, const char* busName, Print& out);
    
    // Runs a full diagnostic report across both buses
    static void runDiagnosticScan(Print& out);

    // Checks whether an address acknowledges on a bus
    static bool isDevicePresent(TwoWire& bus, uint8_t address);

    // Translates I2C 7-bit address to sensor name
    static const char* lookupDeviceName(uint8_t address, uint8_t busIndex);
};
