## 1. I2C Bus Timing & Timeout Configuration

- [x] 1.1 Update `test_firmware/src/i2c_bus_manager.cpp` to configure Bus 2 (`Wire1`) default clock rate to 50 kHz (`50000`) and set timeout to 100 ms.
- [x] 1.2 Verify Bus 1 remains at 100 kHz (`100000`) with 50 ms timeout for environmental sensors.

## 2. BNO055 Robust Initialization & Probe Recovery

- [x] 2.1 Update `IMUSensorManager::initIMU()` in `test_firmware/src/imu_sensor.cpp` with controlled external crystal activation, delay settling, transition to `OPERATION_MODE_NDOF`, and validation of `SYS_STATUS == 0x05`.
- [x] 2.2 Add automatic re-initialization of BNO055 into `OPERATION_MODE_NDOF` at the end of `IMUSensorManager::probeIMULines()` so electrical pin probing does not leave the sensor trapped in configuration mode.

## 3. Interactive Serial CLI Command

- [x] 3.1 Expose command `[i]` in `test_firmware/src/main.cpp` menu and command switch statement to trigger `IMUSensorManager::initIMU(Serial)` on demand.
- [x] 3.2 Update menu text in `printMenu()` and `test_firmware/README.md` to document command `[i]`.

## 4. Build, Flash & Bench Verification

- [x] 4.1 Run PlatformIO compilation (`pio run`) in `test_firmware/` and ensure clean build with zero errors.
- [x] 4.2 Upload firmware to target board (`/dev/ttyACM0`).
- [x] 4.3 Verify via serial console that POST (`[1]`), Bus 2 scan (`[4]`), and live telemetry stream (`[2]`) output valid non-zero orientation and acceleration data from the 7semi BNO055.
