#include "telemetry_collector.h"
#include "env_sensors.h"
#include "imu_sensor.h"
#include "gps_diagnostics.h"
#include "power_mgr.h"
#include "flash_storage_mgr.h"
#include "sd_diagnostics.h"
#include <esp_timer.h>
#include <VOCGasIndexAlgorithm.h>
#include <NOxGasIndexAlgorithm.h>

static VOCGasIndexAlgorithm* s_vocAlgorithm = nullptr;
static NOxGasIndexAlgorithm* s_noxAlgorithm = nullptr;

uint16_t TelemetryCollector::_seq = 0;
uint16_t TelemetryCollector::_lastVocRaw = 0;
float TelemetryCollector::_lastBaroAltM = NAN;
uint32_t TelemetryCollector::_lastBaroMs = 0;
float TelemetryCollector::_vSpeedFiltered = 0.0f;

void TelemetryCollector::begin(float samplingIntervalS) {
    if (!s_vocAlgorithm) s_vocAlgorithm = new VOCGasIndexAlgorithm(samplingIntervalS);
    // The Arduino NOx wrapper only supports its default 1 s sampling interval
    if (!s_noxAlgorithm) s_noxAlgorithm = new NOxGasIndexAlgorithm();
}

uint16_t TelemetryCollector::deviceId() {
    // Last two bytes of the factory MAC give a stable, human-friendly ID.
    uint64_t mac = ESP.getEfuseMac();
    return (uint16_t)((mac >> 32) & 0xFFFF);
}

uint32_t TelemetryCollector::uptimeSeconds() {
    // esp_timer_get_time() is a 64-bit boot-relative clock on ESP32. Unlike
    // millis(), it does not wrap after roughly 49 days, and it is independent
    // of how long the telemetry loop took to initialize or sample sensors.
    return static_cast<uint32_t>(esp_timer_get_time() / 1000000ULL);
}

void TelemetryCollector::collect(TelemetryFrame& f) {
    begin();
    memset(&f, 0, sizeof(f));

    EnvDiagnosticResults env{};
    EnvSensorsManager::readAllSensors(env);
    IMUDiagnosticResults imu{};
    const bool imuOk = IMUSensorManager::readLiveData(imu);
    const GPSDiagnosticResults gps = GPSDiagnosticsManager::getResults();

    const uint32_t now = millis();
    f.deviceId = deviceId();
    f.seq = _seq++;
    f.uptimeS = uptimeSeconds();

    uint16_t flags = 0;
    if (env.ms5607Detected) flags |= TLM_MS5607;
    if (env.bme680Detected) flags |= TLM_BME680;
    if (env.scd40Detected) flags |= TLM_SCD40;
    if (env.sgp41Detected) flags |= TLM_SGP41;
    if (env.ltr390Detected) flags |= TLM_LTR390;
    if (env.tsl2591Detected) flags |= TLM_TSL2591;
    if (imuOk) flags |= TLM_BNO055;
    if (gps.uartConnected) flags |= TLM_GPS_UART;
    if (FlashStorageManager::isMounted()) flags |= TLM_FLASH;
    if (SDDiagnosticsManager::getResults().mounted) flags |= TLM_SDCARD;
    if (FlashStorageManager::isLogging()) flags |= TLM_LOGGING;
    if (gps.ppsLocked) flags |= TLM_PPS_LOCK;
    if (gps.hasFix || gps.hour || gps.minute || gps.second) flags |= TLM_GPS_TIME;
    f.flags = flags;

    // GNSS (TinyGPS++ has no GSA fix type, so infer 3D from satellite count)
    f.satellites = (uint8_t)min<uint32_t>(gps.satellites, 255);
    f.gpsFix = gps.hasFix ? (f.satellites >= 4 ? 3 : 2) : 0;
    f.hdop = gps.hdop;
    f.latitude = gps.latitude;
    f.longitude = gps.longitude;
    f.gpsAltM = (float)gps.altitudeM;
    f.speedKmh = (float)gps.speedKmh;
    f.headingDeg = (float)gps.courseDeg;
    f.utcHour = gps.hour;
    f.utcMinute = gps.minute;
    f.utcSecond = gps.second;

    // Barometric altitude and filtered vertical speed (MS5607 is the flight altimeter)
    if (env.ms5607Detected && env.ms5607PressureHpa > 0.0f) {
        f.baroAltM = env.ms5607AltitudeM;
        if (!isnan(_lastBaroAltM) && now > _lastBaroMs) {
            float dt = (now - _lastBaroMs) / 1000.0f;
            float rawVs = (env.ms5607AltitudeM - _lastBaroAltM) / dt;
            _vSpeedFiltered = 0.6f * _vSpeedFiltered + 0.4f * rawVs;
        }
        _lastBaroAltM = env.ms5607AltitudeM;
        _lastBaroMs = now;
    }
    f.verticalSpeedMs = _vSpeedFiltered;

    // Pick the best available source per quantity; BME680 when fitted, else SCD40/MS5607
    const bool bmeValid = env.bme680Detected && env.bme680HumidityPct > 0.0f;
    if (bmeValid) {
        f.temperatureC = env.bme680TemperatureC;
        f.tempSrc = SRC_BME680;
        f.humidityPct = env.bme680HumidityPct;
        f.humSrc = SRC_BME680;
    } else {
        if (env.scd40Detected) {
            f.temperatureC = env.scd40TemperatureC;
            f.tempSrc = SRC_SCD40;
            f.humidityPct = env.scd40HumidityPct;
            f.humSrc = SRC_SCD40;
        } else if (env.ms5607Detected) {
            f.temperatureC = env.ms5607TemperatureC;
            f.tempSrc = SRC_MS5607;
        }
    }
    if (bmeValid && env.bme680PressureHpa > 0.0f) {
        f.pressureHpa = env.bme680PressureHpa;
        f.presSrc = SRC_BME680;
    } else if (env.ms5607Detected) {
        f.pressureHpa = env.ms5607PressureHpa;
        f.presSrc = SRC_MS5607;
    }

    f.co2Ppm = env.scd40Detected ? env.scd40Co2Ppm : 0;
    if (env.sgp41Detected) {
        _lastVocRaw = env.sgp41RawVoc;
        f.vocIndex = (uint16_t)max<int32_t>(0, s_vocAlgorithm->process(env.sgp41RawVoc));
        f.noxIndex = (uint16_t)max<int32_t>(0, s_noxAlgorithm->process(env.sgp41RawNox));
    }

    if (env.tsl2591Detected && env.tsl2591Lux >= 0.0f) {
        f.lux = env.tsl2591Lux;
        f.irRaw = env.tsl2591Ch1Ir;
    } else if (env.ltr390Detected) {
        f.lux = env.ltr390Lux;
    }

    if (imuOk) {
        f.rollDeg = imu.rollDeg;
        f.pitchDeg = imu.pitchDeg;
        f.yawDeg = imu.headingDeg;
        f.accX = imu.accel.x();
        f.accY = imu.accel.y();
        f.accZ = imu.accel.z();
        f.gyrX = imu.gyroDps.x();
        f.gyrY = imu.gyroDps.y();
        f.gyrZ = imu.gyroDps.z();
        f.calSys = imu.calSys;
        f.calGyro = imu.calGyro;
        f.calAccel = imu.calAccel;
        f.calMag = imu.calMag;
    }

    f.batteryV = PowerManager::readBatteryVoltage();
    f.batteryPct = PowerManager::getBatteryPercentage();
    f.mcuTempC = (int8_t)constrain(temperatureRead(), -128.0f, 127.0f);
}
