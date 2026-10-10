#pragma once

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BNO055.h>

struct IMUDiagnosticResults {
    bool detected;
    uint8_t address;
    uint8_t chipId;
    uint8_t accelId;
    uint8_t magId;
    uint8_t gyroId;
    uint8_t bootloaderRev;
    uint16_t swRev;

    // Self-test
    uint8_t sysStatus;
    uint8_t selfTestResult;
    uint8_t sysError;
    bool selfTestPassed;

    // Calibration (0-3 scale)
    uint8_t calSys;
    uint8_t calGyro;
    uint8_t calAccel;
    uint8_t calMag;

    // Fusion vectors
    float headingDeg;
    float rollDeg;
    float pitchDeg;
    imu::Quaternion quat;
    imu::Vector<3> accel;
    imu::Vector<3> linearAccel;
    imu::Vector<3> gyroDps;
    int8_t tempC;
};

class IMUSensorManager {
public:
    static bool initIMU(Print& out);
    static void runDiagnostics(Print& out);
    static void probeIMULines(Print& out);
    static void runEdgeCaseDiagnostics(Print& out);
    // Returns false when the latest sensor sample is unavailable.
    static bool readLiveData(IMUDiagnosticResults& res);
    static void printTelemetryRow(Print& out);
    static bool isInitialized() { return _initialized; }
    static uint8_t activeBus() { return _activeBus; }

private:
    static Adafruit_BNO055 _bno;
    static IMUDiagnosticResults _diagResults;
    static bool _initialized;
    static uint8_t _activeAddr;
    static uint8_t _activeBus;
};
