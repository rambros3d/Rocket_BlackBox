## 1. Sensor Driver & Compensation Updates

- [x] 1.1 In `src/env_sensors.cpp`, reorder reads in `EnvSensorsManager::readAllSensors()` so SCD40 temperature/humidity are acquired before SGP41.
- [x] 1.2 Feed live temperature and humidity into `sgp41.measureRawSignals()` (using SCD40 with fallback to MS5607 or default constants).

## 2. Telemetry Streaming & Flight Logging Remap

- [x] 2.1 Update `streamTelemetry()` in `src/main.cpp` to format and display `MS_T` (MS5607 temperature), `SCD_T` (SCD40 temperature), and `Hum` (SCD40 relative humidity).
- [x] 2.2 Update `FlashStorageManager::logTelemetry()` in `src/flash_storage_mgr.h` and `src/flash_storage_mgr.cpp` to accept and log `ms5607TempC` and `scd40HumPct`.
- [x] 2.3 Update flight log call site in `src/main.cpp` loop to pass the new temperature and humidity values.

## 3. Build, Flash, and Bench Verification

- [x] 3.1 Build firmware and upload to ESP32-S3 via `/dev/ttyACM0`.
- [x] 3.2 Verify live telemetry stream (`[2]`) displays non-zero MS5607 and SCD40 temperature and humidity values.
- [x] 3.3 Verify Flash CSV flight logging creates records containing valid temperature and humidity data.
