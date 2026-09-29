## ADDED Requirements

### Requirement: Dual I2C Bus Discovery
The diagnostic firmware SHALL initialize two hardware I2C buses (Bus 1 on SDA GPIO 10, SCL GPIO 11; Bus 2 on SDA GPIO 2, SCL GPIO 1) and scan all 7-bit addresses (0x08 to 0x77) reporting detected devices.

#### Scenario: All onboard devices detected
- **WHEN** the I2C bus scanner executes during boot
- **THEN** it SHALL report detections on Bus 1 (0x29 for TSL2591, 0x53 for LTR-390, 0x59 for SGP41, 0x62 for SCD40, and 0x76/0x77 for BME680/MS5607) and Bus 2 (0x28 for BNO055).

#### Scenario: Bus timeout or unresponsive device
- **WHEN** an address does not acknowledge within the timeout period
- **THEN** the firmware SHALL skip that address and proceed without locking up the MCU.

### Requirement: BNO055 Polled IMU Diagnostics
The system SHALL initialize the BNO055 9-DOF IMU on Bus 2 in polled mode, query internal chip identifiers, execute the hardware self-test register, and read 9-axis fusion data.

#### Scenario: Self-test and ID verification
- **WHEN** the BNO055 diagnostic routine runs
- **THEN** it SHALL verify Chip ID 0xA0, read accelerometer/gyroscope/magnetometer self-test status, and report calibration ratings (0-3 scale).

#### Scenario: Live orientation readout
- **WHEN** continuous telemetry streaming is active
- **THEN** the system SHALL stream Euler angles (heading, roll, pitch), linear acceleration vectors, and angular rates.

### Requirement: MS5607 Barometric Altimeter Diagnostics
The system SHALL communicate with the MS5607 sensor on Bus 1, read all 8 PROM calibration coefficients (C0-C7), verify mathematical PROM integrity via CRC4, and compute temperature-compensated pressure and barometric altitude.

#### Scenario: PROM integrity check
- **WHEN** the MS5607 initialization routine executes
- **THEN** it SHALL calculate the CRC4 checksum of the PROM words and confirm match against the factory CRC.

#### Scenario: Barometric pressure calculation
- **WHEN** the sensor completes D1 and D2 conversions
- **THEN** it SHALL output barometric pressure in hPa and calculated altitude above mean sea level in meters.

### Requirement: BME680 Environmental & Gas Diagnostics
The system SHALL initialize the BME680 sensor on Bus 1, verify chip ID (0x61), activate the gas sensor heater profile, and read temperature, humidity, pressure, and gas resistance.

#### Scenario: Gas sensor heater cycle
- **WHEN** a gas measurement is triggered
- **THEN** the sensor SHALL configure the heater (320°C for 150ms) and confirm heater stability before reporting gas resistance in ohms.

### Requirement: SCD40 CO2 Sensor Diagnostics
The system SHALL communicate with the SCD40 photoacoustic sensor on Bus 1, query its 48-bit serial number, run the built-in sensor self-test, and output CO2 concentration in ppm, temperature, and relative humidity.

#### Scenario: CO2 self-test verification
- **WHEN** the SCD40 diagnostic test runs
- **THEN** the firmware SHALL query the 48-bit serial number and verify that `perform_self_test` returns a pass status (zero error code).

### Requirement: SGP41 VOC & NOx Diagnostics
The system SHALL communicate with the SGP41 sensor on Bus 1, query its serial number, execute the silicon self-test, and measure raw VOC and NOx sensor signals.

#### Scenario: Silicon self-test execution
- **WHEN** the SGP41 diagnostic routine runs
- **THEN** it SHALL execute the self-test command and report pixel operational status.

### Requirement: Optical Sensor Diagnostics (LTR-390 and TSL2591)
The system SHALL verify the LTR-390UV (ambient light and UV index) and TSL25911FN (wide dynamic range lux) sensors on Bus 1, verifying part IDs and reporting optical measurements.

#### Scenario: LTR-390 ID and UV/ALS reading
- **WHEN** the LTR-390 diagnostic executes
- **THEN** it SHALL verify Part ID 0x0B and output raw ALS counts, UV index counts, and computed ambient lux.

#### Scenario: TSL2591 ID and dual-channel lux reading
- **WHEN** the TSL2591 diagnostic executes
- **THEN** it SHALL verify Device ID 0x50 and output Full Spectrum (CH0) and Infrared (CH1) raw counts and computed lux.
