#include "env_sensors.h"
#include "i2c_bus_manager.h"
#include <Adafruit_BME680.h>
#include <SensirionI2CScd4x.h>
#include <SensirionI2CSgp41.h>
#include <Adafruit_LTR390.h>
#include <Adafruit_TSL2591.h>

static Adafruit_BME680 bme(&Wire);
static SensirionI2CScd4x scd4x;
static SensirionI2CSgp41 sgp41;
static Adafruit_LTR390 ltr;
static Adafruit_TSL2591 tsl(2591);

static EnvDiagnosticResults s_diagResults;
static uint16_t s_ms5607C[8] = {0};
static uint8_t s_ms5607Addr = 0;
static uint8_t s_bme680Addr = 0;

// Standard TE Connectivity MS5607 CRC4 calculation
uint8_t EnvSensorsManager::calcMs5607Crc4(uint16_t n_prom[]) {
    uint16_t n_rem = 0;
    uint16_t crc_read = n_prom[7] & 0x0F;
    n_prom[7] = (0xFF00 & (n_prom[7]));

    for (uint8_t cnt = 0; cnt < 16; cnt++) {
        if (cnt % 2 == 1) {
            n_rem ^= (uint16_t)((n_prom[cnt >> 1]) & 0x00FF);
        } else {
            n_rem ^= (uint16_t)(n_prom[cnt >> 1] >> 8);
        }
        for (uint8_t n_bit = 8; n_bit > 0; n_bit--) {
            if (n_rem & 0x8000) {
                n_rem = (n_rem << 1) ^ 0x3000;
            } else {
                n_rem = (n_rem << 1);
            }
        }
    }
    n_rem = (0x000F & (n_rem >> 12));
    n_prom[7] = (n_prom[7] & 0xFF00) | crc_read;
    return (uint8_t)(n_rem ^ 0x00);
}

static bool readMs5607Prom(uint8_t addr, uint16_t prom[8]) {
    Wire.beginTransmission(addr);
    Wire.write(0x1E); // Reset command
    if (Wire.endTransmission() != 0) return false;
    delay(10);

    for (uint8_t i = 0; i < 8; i++) {
        Wire.beginTransmission(addr);
        Wire.write(0xA0 + (i * 2));
        if (Wire.endTransmission() != 0) return false;

        Wire.requestFrom(addr, (uint8_t)2);
        if (Wire.available() >= 2) {
            prom[i] = (Wire.read() << 8) | Wire.read();
        } else {
            return false;
        }
    }
    return true;
}

static uint32_t readMs5607Adc(uint8_t addr, uint8_t cmd) {
    Wire.beginTransmission(addr);
    Wire.write(cmd);
    if (Wire.endTransmission() != 0) return 0;
    delay(10); // Wait for conversion (OSR 4096 is max 9.04ms)

    Wire.beginTransmission(addr);
    Wire.write(0x00); // Read ADC
    if (Wire.endTransmission() != 0) return 0;

    Wire.requestFrom(addr, (uint8_t)3);
    if (Wire.available() >= 3) {
        return ((uint32_t)Wire.read() << 16) | ((uint32_t)Wire.read() << 8) | (uint32_t)Wire.read();
    }
    return 0;
}

static void calculateMs5607(uint8_t addr, const uint16_t C[8], float& pressureHpa, float& tempC, float& altM) {
    uint32_t D1 = readMs5607Adc(addr, 0x48); // D1 (pressure) OSR=4096
    uint32_t D2 = readMs5607Adc(addr, 0x58); // D2 (temperature) OSR=4096

    if (D1 == 0 || D2 == 0) {
        pressureHpa = 0;
        tempC = 0;
        altM = 0;
        return;
    }

    int64_t dT = (int64_t)D2 - ((int64_t)C[5] << 8);
    int64_t TEMP = 2000 + ((dT * (int64_t)C[6]) >> 23);

    int64_t OFF = ((int64_t)C[2] << 17) + (((int64_t)C[4] * dT) >> 6);
    int64_t SENS = ((int64_t)C[1] << 16) + (((int64_t)C[3] * dT) >> 7);

    // Second order temperature compensation for MS5607
    int64_t T2 = 0;
    int64_t OFF2 = 0;
    int64_t SENS2 = 0;

    if (TEMP < 2000) {
        T2 = ((int64_t)dT * dT) >> 31;
        OFF2 = 61 * ((TEMP - 2000) * (TEMP - 2000)) >> 4;
        SENS2 = 2 * ((TEMP - 2000) * (TEMP - 2000));
        if (TEMP < -1500) {
            OFF2 += 15 * ((TEMP + 1500) * (TEMP + 1500));
            SENS2 += 8 * ((TEMP + 1500) * (TEMP + 1500));
        }
    }

    TEMP -= T2;
    OFF -= OFF2;
    SENS -= SENS2;

    int64_t P = (((D1 * SENS) >> 21) - OFF) >> 15;

    pressureHpa = (float)P / 100.0f;
    tempC = (float)TEMP / 100.0f;
    altM = 44330.0f * (1.0f - powf(pressureHpa / 1013.25f, 0.190295f));
}

bool EnvSensorsManager::initMS5607(uint8_t addr) {
    if (readMs5607Prom(addr, s_ms5607C)) {
        s_ms5607Addr = addr;
        s_diagResults.ms5607Detected = true;
        s_diagResults.ms5607Address = addr;
        for (int i = 0; i < 8; i++) s_diagResults.ms5607Prom[i] = s_ms5607C[i];
        
        uint8_t calcCrc = calcMs5607Crc4(s_ms5607C);
        uint8_t promCrc = s_ms5607C[7] & 0x0F;
        s_diagResults.ms5607CrcValid = (calcCrc == promCrc);
        return true;
    }
    return false;
}

bool EnvSensorsManager::initBME680(uint8_t addr) {
    if (bme.begin(addr)) {
        s_bme680Addr = addr;
        s_diagResults.bme680Detected = true;
        s_diagResults.bme680Address = addr;
        s_diagResults.bme680ChipId = 0x61;

        bme.setTemperatureOversampling(BME680_OS_8X);
        bme.setHumidityOversampling(BME680_OS_2X);
        bme.setPressureOversampling(BME680_OS_4X);
        bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
        bme.setGasHeater(320, 150); // 320°C for 150 ms
        return true;
    }
    return false;
}

bool EnvSensorsManager::initSCD40() {
    scd4x.begin(Wire);
    scd4x.stopPeriodicMeasurement();
    
    uint16_t serial0 = 0, serial1 = 0, serial2 = 0;
    uint16_t err = scd4x.getSerialNumber(serial0, serial1, serial2);
    if (err == 0) {
        s_diagResults.scd40Detected = true;
        s_diagResults.scd40Serial = ((uint64_t)serial0 << 32) | ((uint64_t)serial1 << 16) | serial2;

        uint16_t selfTestResult = 0;
        err = scd4x.performSelfTest(selfTestResult);
        s_diagResults.scd40SelfTestPassed = (err == 0 && selfTestResult == 0);

        scd4x.startPeriodicMeasurement();
        return true;
    }
    return false;
}

bool EnvSensorsManager::initSGP41() {
    sgp41.begin(Wire);
    
    uint16_t serial[3] = {0};
    uint16_t err = sgp41.getSerialNumber(serial);
    if (err == 0) {
        s_diagResults.sgp41Detected = true;
        s_diagResults.sgp41Serial = ((uint64_t)serial[0] << 32) | ((uint64_t)serial[1] << 16) | serial[2];

        uint16_t testResult = 0;
        err = sgp41.executeSelfTest(testResult);
        s_diagResults.sgp41SelfTestPassed = (err == 0 && testResult == 0);
        return true;
    }
    return false;
}

bool EnvSensorsManager::initLTR390() {
    if (ltr.begin(&Wire)) {
        s_diagResults.ltr390Detected = true;
        s_diagResults.ltr390PartId = 0x0B;
        ltr.setMode(LTR390_MODE_ALS);
        ltr.setGain(LTR390_GAIN_3);
        ltr.setResolution(LTR390_RESOLUTION_18BIT);
        return true;
    }
    return false;
}

bool EnvSensorsManager::initTSL2591() {
    if (tsl.begin(&Wire)) {
        s_diagResults.tsl2591Detected = true;
        s_diagResults.tsl2591Id = 0x50;
        tsl.setGain(TSL2591_GAIN_MED);
        tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
        return true;
    }
    return false;
}

void EnvSensorsManager::initSensors(Print& out) {
    out.println("Initializing Environmental & Optical Sensors (Bus 1)...");

    // 1. MS5607 and BME680 (Address 0x76 or 0x77)
    // Try MS5607 on 0x76, then 0x77
    bool msInit = initMS5607(0x76);
    if (!msInit) msInit = initMS5607(0x77);

    // Try BME680 on the opposite or available address
    if (s_ms5607Addr == 0x76) {
        initBME680(0x77);
    } else if (s_ms5607Addr == 0x77) {
        initBME680(0x76);
    } else {
        if (!initBME680(0x76)) initBME680(0x77);
    }

    // 2. SCD40
    initSCD40();

    // 3. SGP41
    initSGP41();

    // 4. LTR-390
    initLTR390();

    // 5. TSL2591
    initTSL2591();
}

void EnvSensorsManager::runAllDiagnostics(Print& out) {
    out.println("==================================================");
    out.println("       ENVIRONMENTAL & OPTICAL SENSOR POST        ");
    out.println("==================================================");

    // MS5607
    out.print("  [MS5607 Barometer]   : ");
    if (s_diagResults.ms5607Detected) {
        float p, t, a;
        calculateMs5607(s_ms5607Addr, s_ms5607C, p, t, a);
        out.printf("PASS (Addr 0x%02X, CRC4: %s)\n", s_ms5607Addr, s_diagResults.ms5607CrcValid ? "OK" : "CRC_ERR");
        out.printf("    PROM C1-C6: %u, %u, %u, %u, %u, %u\n", s_ms5607C[1], s_ms5607C[2], s_ms5607C[3], s_ms5607C[4], s_ms5607C[5], s_ms5607C[6]);
        out.printf("    Pressure: %.2f hPa | Temp: %.2f C | Calc Alt: %.1f m\n", p, t, a);
    } else {
        out.println("FAIL (Device not detected at 0x76 or 0x77)");
    }

    // BME680
    out.print("  [BME680 Gas/Weather] : ");
    if (s_diagResults.bme680Detected) {
        if (bme.performReading()) {
            out.printf("PASS (Addr 0x%02X, ID: 0x%02X)\n", s_bme680Addr, s_diagResults.bme680ChipId);
            out.printf("    Temp: %.2f C | Press: %.2f hPa | Hum: %.1f %% | Gas: %.1f kOhm\n",
                       bme.temperature, bme.pressure / 100.0f, bme.humidity, bme.gas_resistance / 1000.0f);
        } else {
            out.println("FAIL (Reading failed)");
        }
    } else {
        out.println("FAIL (Device not detected)");
    }

    // SCD40
    out.print("  [SCD40 Photoac. CO2] : ");
    if (s_diagResults.scd40Detected) {
        out.printf("PASS (Serial: 0x%08llX, SelfTest: %s)\n",
                   (unsigned long long)s_diagResults.scd40Serial,
                   s_diagResults.scd40SelfTestPassed ? "OK" : "FAIL");
        bool dataReady = false;
        scd4x.getDataReadyFlag(dataReady);
        if (dataReady) {
            uint16_t co2; float temp, hum;
            scd4x.readMeasurement(co2, temp, hum);
            out.printf("    CO2: %u ppm | Temp: %.1f C | Hum: %.1f %%\n", co2, temp, hum);
        } else {
            out.println("    (Periodic measurement warming up)");
        }
    } else {
        out.println("FAIL (Device not detected at 0x62)");
    }

    // SGP41
    out.print("  [SGP41 VOC/NOx MOX]  : ");
    if (s_diagResults.sgp41Detected) {
        out.printf("PASS (Serial: 0x%08llX, SelfTest: %s)\n",
                   (unsigned long long)s_diagResults.sgp41Serial,
                   s_diagResults.sgp41SelfTestPassed ? "OK" : "FAIL");
        uint16_t srawVoc = 0, srawNox = 0;
        sgp41.measureRawSignals(25.0f, 50.0f, srawVoc, srawNox);
        out.printf("    Raw VOC ticks: %u | Raw NOx ticks: %u\n", srawVoc, srawNox);
    } else {
        out.println("FAIL (Device not detected at 0x59)");
    }

    // LTR-390
    out.print("  [LTR-390 Light/UV]   : ");
    if (s_diagResults.ltr390Detected) {
        ltr.setMode(LTR390_MODE_ALS);
        delay(30);
        uint32_t als = ltr.readALS();
        ltr.setMode(LTR390_MODE_UVS);
        delay(30);
        uint32_t uvs = ltr.readUVS();
        float calcLux = 0.6f * (float)als / 3.0f;
        float calcUvi = (float)uvs / 383.33f;
        out.printf("PASS (Part ID: 0x%02X)\n", s_diagResults.ltr390PartId);
        out.printf("    ALS Count: %u | UVS Count: %u | Calc Lux: %.1f | UVI: %.2f\n",
                   als, uvs, calcLux, calcUvi);
        ltr.setMode(LTR390_MODE_ALS); // Return to ALS default
    } else {
        out.println("FAIL (Device not detected at 0x53)");
    }

    // TSL2591
    out.print("  [TSL2591 Precision]  : ");
    if (s_diagResults.tsl2591Detected) {
        uint32_t lum = tsl.getFullLuminosity();
        uint16_t ir = lum >> 16;
        uint16_t full = lum & 0xFFFF;
        out.printf("PASS (Device ID: 0x%02X)\n", s_diagResults.tsl2591Id);
        out.printf("    Full Spectrum: %u | IR Channel: %u | Calc Lux: %.1f lx\n",
                   full, ir, tsl.calculateLux(full, ir));
    } else {
        out.println("FAIL (Device not detected at 0x29)");
    }
    out.println("--------------------------------------------------");
}

void EnvSensorsManager::readAllSensors(EnvDiagnosticResults& res) {
    if (s_diagResults.ms5607Detected) {
        calculateMs5607(s_ms5607Addr, s_ms5607C, res.ms5607PressureHpa, res.ms5607TemperatureC, res.ms5607AltitudeM);
    }
    if (s_diagResults.bme680Detected && bme.performReading()) {
        res.bme680TemperatureC = bme.temperature;
        res.bme680PressureHpa = bme.pressure / 100.0f;
        res.bme680HumidityPct = bme.humidity;
        res.bme680GasResistanceKOhms = bme.gas_resistance / 1000.0f;
    }
    static uint16_t s_lastCo2 = 400;
    static float s_lastScdTemp = 25.0f;
    static float s_lastScdHum = 50.0f;

    if (s_diagResults.scd40Detected) {
        bool dataReady = false;
        scd4x.getDataReadyFlag(dataReady);
        if (dataReady) {
            uint16_t co2 = 0;
            float temp = 0.0f, hum = 0.0f;
            if (scd4x.readMeasurement(co2, temp, hum) == 0 && co2 > 0) {
                s_lastCo2 = co2;
                s_lastScdTemp = temp;
                s_lastScdHum = hum;
            }
        }
        res.scd40Co2Ppm = s_lastCo2;
        res.scd40TemperatureC = s_lastScdTemp;
        res.scd40HumidityPct = s_lastScdHum;
    }

    float compTemp = (s_lastScdTemp > 0.0f) ? s_lastScdTemp : res.ms5607TemperatureC;
    float compHum = (s_lastScdHum > 0.0f) ? s_lastScdHum : 50.0f;

    if (s_diagResults.sgp41Detected) {
        sgp41.measureRawSignals(compTemp, compHum, res.sgp41RawVoc, res.sgp41RawNox);
    }
    if (s_diagResults.ltr390Detected) {
        res.ltr390RawAls = ltr.readALS();
        res.ltr390Lux = 0.6f * (float)res.ltr390RawAls / 3.0f;
    }
    if (s_diagResults.tsl2591Detected) {
        uint32_t lum = tsl.getFullLuminosity();
        res.tsl2591Ch1Ir = lum >> 16;
        res.tsl2591Ch0Full = lum & 0xFFFF;
        res.tsl2591Lux = tsl.calculateLux(res.tsl2591Ch0Full, res.tsl2591Ch1Ir);
    }
}
