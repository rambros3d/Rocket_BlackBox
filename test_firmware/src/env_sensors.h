#pragma once

#include <Arduino.h>
#include <Wire.h>

// Diagnostic results structure for Environmental suite
struct EnvDiagnosticResults {
    // MS5607
    bool ms5607Detected;
    uint8_t ms5607Address;
    uint16_t ms5607Prom[8];
    bool ms5607CrcValid;
    float ms5607PressureHpa;
    float ms5607TemperatureC;
    float ms5607AltitudeM;

    // BME680
    bool bme680Detected;
    uint8_t bme680Address;
    uint8_t bme680ChipId;
    float bme680TemperatureC;
    float bme680PressureHpa;
    float bme680HumidityPct;
    float bme680GasResistanceKOhms;
    bool bme680HeaterStable;

    // SCD40
    bool scd40Detected;
    uint64_t scd40Serial;
    bool scd40SelfTestPassed;
    uint16_t scd40Co2Ppm;
    float scd40TemperatureC;
    float scd40HumidityPct;

    // SGP41
    bool sgp41Detected;
    uint64_t sgp41Serial;
    bool sgp41SelfTestPassed;
    uint16_t sgp41RawVoc;
    uint16_t sgp41RawNox;

    // LTR-390UV
    bool ltr390Detected;
    uint8_t ltr390PartId;
    uint32_t ltr390RawAls;
    uint32_t ltr390RawUvs;
    float ltr390Lux;
    float ltr390Uvi;

    // TSL25911FN
    bool tsl2591Detected;
    uint8_t tsl2591Id;
    uint16_t tsl2591Ch0Full;
    uint16_t tsl2591Ch1Ir;
    float tsl2591Lux;
};

class EnvSensorsManager {
public:
    static void initSensors(Print& out);
    static void runAllDiagnostics(Print& out);
    static void readAllSensors(EnvDiagnosticResults& res);
    static void printTelemetryRow(Print& out);

private:
    static bool initMS5607(uint8_t addr);
    static bool initBME680(uint8_t addr);
    static bool initSCD40();
    static bool initSGP41();
    static bool initLTR390();
    static bool initTSL2591();

    static uint8_t calcMs5607Crc4(uint16_t n_prom[]);
};
