## Why

During hardware bring-up of the Rocket BlackBox PCB (Rev 1.0), the BNO055 9-DOF IMU on Bus 2 (SDA: GPIO 2, SCL: GPIO 1) failed to acknowledge across all standard I2C speeds (10kHz to 100kHz). Schematic investigation confirmed that Pin 11 (`nRESET`) was left unconnected (floating) in the PCB layout. Before conducting irreversible hardware rework or bodge soldering, we must run all remaining software edge-case recovery techniques to determine whether the chip can be stimulated or unlocked via software.

## What Changes

- Implement a deep hardware edge-case diagnostic sequence for BNO055 on Bus 2 in `src/imu_sensor.cpp`:
  - **Parasitic Line Bleed & Extended Bus Clear**: Drive SDA and SCL actively LOW for 500 ms to discharge phantom capacitance, followed by a 72-clock recovery pulse train and triple STOP condition.
  - **I2C General Call Software Reset**: Broadcast address `0x00` with byte `0x06` to force any listening internal I2C slave engine into a software reset.
  - **Repeated-Start Direct Register Interrogation**: Attempt direct register reading on `0x28` and `0x29` using pure repeated start without STOP.
  - **Dual I2C Peripheral Cross-Check**: Re-route Bus 2 pins through the ESP32-S3 `Wire` (I2C0 controller) to eliminate any silicon errata between ESP32-S3 I2C0 and I2C1 peripherals.
- Add an interactive option in the diagnostic serial menu to trigger this edge-case diagnostic sweep.

## Capabilities

### New Capabilities
- `imu-edgecase-diagnostics`: Defines automated I2C bus recovery, general call reset broadcast, parasitic charge bleeding, and peripheral controller cross-checking for unresponsive I2C slave devices.

### Modified Capabilities
<!-- None -->

## Impact

- Updates `src/imu_sensor.h` and `src/imu_sensor.cpp` with edge-case recovery routines.
- Updates `src/main.cpp` console menu to expose the edge-case test suite.
- No impact on existing flight logging or environmental sensor telemetry.
