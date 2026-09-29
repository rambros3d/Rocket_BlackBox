## Context

The Rocket BlackBox payload PCB previously used a Bosch BME680 for ambient temperature, humidity, pressure, and gas sensing. Due to a physical short to GND on U5 Pin 3 (isolated via desoldering R26), the BME680 is inactive.

However, the board is populated with:
- **MS5607-02BA03:** Primary barometer and altimeter, which samples temperature ($D_2$) with 24-bit resolution and computes compensated temperature in °C.
- **Sensirion SCD40:** Photoacoustic NDIR CO2 sensor with an integrated high-accuracy CMOSens temperature and relative humidity transducer.
- **Sensirion SGP41:** Multi-pixel gas sensor that accepts temperature and relative humidity inputs for baseline calibration.

Currently, `streamTelemetry()` and `FlashStorageManager::logTelemetry()` are configured to display and log BME680 temperature/humidity (yielding 0.0°C and 0.0%), and `SGP41` is supplied with static 25°C / 50% RH dummy constants.

## Goals / Non-Goals

**Goals:**
- Replace BME680 references in live telemetry streaming (`streamTelemetry()`) with live temperature from MS5607 (`env.ms5607TemperatureC`), temperature from SCD40 (`env.scd40TemperatureC`), and relative humidity from SCD40 (`env.scd40HumidityPct`).
- Update CSV flight logging schema in `FlashStorageManager` to record MS5607 temperature and SCD40 humidity.
- Dynamically feed live SCD40 temperature and relative humidity into `SGP41::measureRawSignals()` (falling back to MS5607 temp or 25°C/50% if SCD40 is warming up).

**Non-Goals:**
- Removing the BME680 driver code completely (leave fallback detection intact if a replacement BME680 is installed on a future rev).

## Decisions

### 1. Dual-Temperature Display in Live Stream
- **Choice:** Display both `MS_T` (MS5607 fast atmospheric temperature) and `SCD_T` (SCD40 cabin/internal temperature) along with `Hum` (SCD40 relative humidity).
- **Rationale:** During flight, the barometric port sensor (MS5607) experiences rapid external lapse rates, while the cabin sensor (SCD40) tracks internal payload bay heating. Presenting both provides valuable thermal telemetry.

### 2. SGP41 Dynamic Environmental Compensation
- **Choice:** In `EnvSensorsManager::readAllSensors()`, read SCD40 first, then pass its measured temperature and humidity into `sgp41.measureRawSignals(compTemp, compHum, ...)`.
- **Rationale:** Sensirion SGP41 MOX metal-oxide sensor conductance shifts with ambient absolute humidity. Using live SCD40 readings improves VOC and NOx signal accuracy significantly.

### 3. Flash CSV Schema Enhancement
- **Choice:** Add `ms5607_temp_c` and `scd40_humidity_pct` to the CSV header and record row.
- **Rationale:** Preserves historical flight atmospheric data in `/ffat/flight_log_*.csv` without breaking existing CSV parsing tools.

## Risks / Trade-offs

- **[Risk] SCD40 Warm-Up Period:** SCD40 periodic measurement takes up to 5 seconds after boot to produce the first reading.
  - *Mitigation:* If `scd40TemperatureC == 0` or data is not ready, default compensation to `ms5607TemperatureC` (if valid) and 50% RH.
