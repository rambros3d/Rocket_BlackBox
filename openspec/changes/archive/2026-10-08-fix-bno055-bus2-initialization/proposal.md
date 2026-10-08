## Why

The BNO055 9-DOF IMU on I2C Bus 2 (SDA: GPIO 2, SCL: GPIO 1) currently fails during regular bootup and power-on self-test (POST) because Bus 2 is clocked at 100 kHz, exceeding the reliable timing envelope of the BNO055's clock-stretching Cortex-M0 coprocessor across external wiring. Furthermore, electrical probe routines reset the sensor into idle configuration mode without re-entering fusion mode (`OPERATION_MODE_NDOF`), leaving live orientation angles zeroed out. Operating Bus 2 at 50 kHz with a 100 ms stretch timeout and adding a clean re-initialization routine restores full 100 Hz fusion telemetry from the connected 7semi external BNO055.

## What Changes

- Configure I2C Bus 2 (`Wire1`) default clock frequency to 50 kHz with a 100 ms clock-stretching timeout in `test_firmware/src/i2c_bus_manager.cpp`.
- Update `test_firmware/src/imu_sensor.cpp` initialization to support robust external crystal switching for 7semi modules (settling delay, switching to `OPERATION_MODE_NDOF`, and verifying `SYS_STATUS` transitions to active fusion).
- Re-initialize BNO055 into `OPERATION_MODE_NDOF` automatically following electrical pin probe routines (`probeIMULines`) so subsequent telemetry calls read live data instead of remaining in configuration mode.
- Add an interactive console menu option `[i]` to trigger live re-initialization of the BNO055 on demand without requiring a full MCU power cycle.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `sensor-diagnostics`: Update Dual I2C Bus 2 timing to 50 kHz clock rate with clock-stretching tolerance, and add interactive runtime BNO055 re-initialization support.

## Impact

- Affected Subsystem: `test_firmware/`
- Files modified:
  - `test_firmware/src/i2c_bus_manager.cpp`: Bus 2 initialization clock speed set to 50 kHz, timeout set to 100 ms.
  - `test_firmware/src/imu_sensor.cpp`: BNO055 init routine robustness, crystal mode settling, post-probe re-entry to NDOF.
  - `test_firmware/src/imu_sensor.h`: Expose re-init / recovery methods if needed.
  - `test_firmware/src/main.cpp`: Add CLI command `[i]` for runtime IMU re-init.
- No breaking changes to existing flight log format or environmental sensors on Bus 1.
