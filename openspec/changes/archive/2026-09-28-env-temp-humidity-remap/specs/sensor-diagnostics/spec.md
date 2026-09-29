## MODIFIED Requirements

### Requirement: MS5607 Barometric Altimeter Diagnostics
The system SHALL communicate with the MS5607 sensor on Bus 1, read all 8 PROM calibration coefficients (C0-C7), verify mathematical PROM integrity via CRC4, and compute temperature-compensated pressure, barometric altitude, and calibrated temperature in degrees Celsius.

#### Scenario: PROM integrity check
- **WHEN** the MS5607 initialization routine executes
- **THEN** it SHALL calculate the CRC4 checksum of the PROM words and confirm match against the factory CRC.

#### Scenario: Barometric pressure and temperature calculation
- **WHEN** the sensor completes D1 and D2 conversions
- **THEN** it SHALL output barometric pressure in hPa, calibrated temperature in °C, and calculated altitude above mean sea level in meters.

### Requirement: SGP41 VOC & NOx Diagnostics
The system SHALL communicate with the SGP41 sensor on Bus 1, query its serial number, execute the silicon self-test, and measure raw VOC and NOx sensor signals using dynamic temperature and relative humidity compensation from available onboard sensors.

#### Scenario: Silicon self-test execution
- **WHEN** the SGP41 diagnostic routine runs
- **THEN** it SHALL execute the self-test command and report pixel operational status.

#### Scenario: Environmental compensation
- **WHEN** raw VOC and NOx signals are measured
- **THEN** the system SHALL pass live temperature and relative humidity (from SCD40 or MS5607) into the measurement routine.

## ADDED Requirements

### Requirement: Integrated Environmental Telemetry Remapping
The system SHALL map ambient temperature and relative humidity telemetry to the MS5607 and SCD40 sensors when BME680 is unavailable, displaying both sensors in the live stream and recording them in CSV flight logs.

#### Scenario: Ambient temperature and humidity fallback
- **WHEN** telemetry streaming or flight logging executes without a functioning BME680
- **THEN** the system SHALL stream temperature from MS5607 and temperature/humidity from SCD40 without reporting zeroed or null fields.
