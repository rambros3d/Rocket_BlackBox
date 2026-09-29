## Why

Following the hardware isolation of the shorted BME680 sensor (via removal of series resistor R26), telemetry streaming (`[2]`) and flight logging displayed `0.0°C` and `0.0%` humidity because the output was hardcoded to read from the missing BME680. However, the payload PCB already houses two active, factory-calibrated environmental sensors:
1. **MS5607-02BA03:** Fast 24-bit barometric altimeter that measures temperature ($D_2$) with $\pm 0.8^\circ\text{C}$ accuracy and $0.01^\circ\text{C}$ resolution (currently measuring ~33.2°C).
2. **Sensirion SCD40:** Photoacoustic sensor with integrated CMOSens temperature ($\pm 0.8^\circ\text{C}$) and relative humidity ($\pm 6\%$ RH) measurement (currently measuring ~33.6°C and ~48% RH).

Furthermore, the Sensirion SGP41 VOC/NOx gas sensor was receiving hardcoded dummy constants (`25.0°C, 50.0% RH`) rather than live sensor readings.

This change remaps the primary atmospheric temperature and relative humidity telemetry and flight logging to MS5607 and SCD40, and feeds live environmental compensation into the SGP41 gas sensor.

## What Changes

- Remap primary ambient temperature source to MS5607 (`env.ms5607TemperatureC`) and secondary temperature / humidity to SCD40 (`env.scd40TemperatureC`, `env.scd40HumidityPct`).
- Update live telemetry streaming in `src/main.cpp` to display `MS_T` (altimeter temp), `SCD_T` (cabin temp), and `Hum` (SCD40 relative humidity) alongside barometric altitude, CO2, VOC, and Lux.
- Update `FlashStorageManager::logTelemetry()` in `src/flash_storage_mgr.cpp` to record MS5607 temperature and SCD40 humidity into the CSV flight log schema.
- Feed live temperature and humidity into `sgp41.measureRawSignals(temp, hum, rawVoc, rawNox)` in `src/env_sensors.cpp` for accurate gas compensation.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `sensor-diagnostics`: Update environmental telemetry requirements to designate MS5607 and SCD40 as the primary sources for ambient temperature and relative humidity, and require live environmental compensation for SGP41.

## Impact

- `src/main.cpp`: Update `streamTelemetry()` format to display live MS5607 and SCD40 temperature/humidity.
- `src/env_sensors.cpp`: Pass live `scd40TemperatureC` and `scd40HumidityPct` into `sgp41.measureRawSignals()`.
- `src/flash_storage_mgr.h` & `src/flash_storage_mgr.cpp`: Update CSV headers and `logTelemetry()` arguments to include temperature and humidity fields.
- `HARDWARE_DIAGNOSTICS.md`: Update documentation on environmental telemetry fallbacks.
