## MODIFIED Requirements

### Requirement: BNO055 Polled IMU Diagnostics
The system SHALL initialize the BNO055 9-DOF IMU on Bus 2 in polled mode at 50 kHz, pulse SCL 9 times with a STOP condition before probing to clear stuck bus lines, execute up to 3 candidate discovery attempts on address 0x28, configure the internal oscillator (`setExtCrystalUse(false)`) with settled mode transition delays, enter `OPERATION_MODE_NDOF` (sensor fusion mode), verify system status, and stream 9-axis orientation and acceleration telemetry. If the IMU is uninitialized during runtime telemetry collection, the system SHALL periodically attempt non-blocking background re-discovery every 5 seconds.

#### Scenario: Self-test and ID verification
- **WHEN** the BNO055 initialization routine runs
- **THEN** it SHALL verify Chip ID 0xA0, configure internal oscillator mode, confirm `OPERATION_MODE_NDOF`, and verify system status.

#### Scenario: Live orientation readout
- **WHEN** continuous telemetry streaming is active
- **THEN** the system SHALL stream non-zero Euler angles (heading, roll, pitch), linear acceleration vectors, and angular rates while the sensor is in fusion mode.

#### Scenario: Recovery after electrical pin probing
- **WHEN** electrical line probing (`probeIMULines`) completes
- **THEN** the firmware SHALL automatically re-initialize the BNO055 back into `OPERATION_MODE_NDOF` at 50 kHz with 100 ms timeout.

#### Scenario: Background re-discovery on boot failure
- **WHEN** initial boot probing fails and `_activeBus` is 0
- **THEN** `readLiveData` SHALL periodically attempt to re-discover the BNO055 every 5 seconds until initialized.

## ADDED Requirements

### Requirement: Bus 2 Recovery Speed and Timeout Preservation
The I2C bus manager SHALL preserve a bus frequency of 50 kHz and a timeout of 100 ms whenever recovering or restarting Bus 2 (`PIN_I2C2_SDA = GPIO 2`, `PIN_I2C2_SCL = GPIO 1`), preventing frequency regressions to 100 kHz.

#### Scenario: Bus 2 restart execution
- **WHEN** `I2CBusManager::restartBus(2)` is invoked
- **THEN** `Wire1` SHALL be re-initialized strictly at 50000 Hz with a timeout of 100 ms.
