## MODIFIED Requirements

### Requirement: Dual I2C Bus Discovery
The diagnostic firmware SHALL initialize two hardware I2C buses: Bus 1 (environmental sensors on SDA GPIO 10, SCL GPIO 11 at 100 kHz) and Bus 2 (dedicated IMU on SDA GPIO 2, SCL GPIO 1 at 50 kHz with a 100 ms clock-stretching timeout), and scan all 7-bit addresses (0x08 to 0x77) reporting detected devices.

#### Scenario: All onboard devices detected
- **WHEN** the I2C bus scanner executes during boot or diagnostic scan
- **THEN** it SHALL report detections on Bus 1 (0x29 for TSL2591, 0x53 for LTR-390, 0x59 for SGP41, 0x62 for SCD40, and 0x76/0x77 for BME680/MS5607) and Bus 2 (0x28 for BNO055 at 50 kHz).

#### Scenario: Bus timeout or unresponsive device
- **WHEN** an address does not acknowledge within the timeout period
- **THEN** the firmware SHALL skip that address and proceed without locking up the MCU.

### Requirement: BNO055 Polled IMU Diagnostics
The system SHALL initialize the BNO055 9-DOF IMU on Bus 2 in polled mode at 50 kHz, configure external crystal mode for supported modules (with internal oscillator fallback), enter `OPERATION_MODE_NDOF` (sensor fusion mode), verify system status, and read 9-axis orientation and acceleration telemetry.

#### Scenario: Self-test and ID verification
- **WHEN** the BNO055 diagnostic routine runs
- **THEN** it SHALL verify Chip ID 0xA0, read accelerometer/gyroscope/magnetometer self-test status, and report calibration ratings (0-3 scale).

#### Scenario: Live orientation readout
- **WHEN** continuous telemetry streaming is active
- **THEN** the system SHALL stream non-zero Euler angles (heading, roll, pitch), linear acceleration vectors, and angular rates while the sensor is in fusion mode.

#### Scenario: Recovery after electrical pin probing
- **WHEN** electrical line probing (`probeIMULines`) completes
- **THEN** the firmware SHALL automatically re-initialize the BNO055 back into `OPERATION_MODE_NDOF` so live telemetry does not remain zeroed in configuration mode.

## ADDED Requirements

### Requirement: Interactive BNO055 Re-initialization Command
The diagnostic serial console SHALL expose command `[i]` to re-initialize the BNO055 driver, apply crystal and NDOF mode configuration, and print real-time sensor status without requiring an MCU restart.

#### Scenario: User triggers runtime IMU re-initialization
- **WHEN** the user sends `i` or `I` to the serial console
- **THEN** the firmware SHALL re-execute `IMUSensorManager::initIMU(Serial)` and display initialization success or diagnostic errors immediately.
