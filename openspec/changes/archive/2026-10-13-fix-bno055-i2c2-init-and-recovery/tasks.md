## 1. I2C Bus 2 Speed & Timeout Preservation

- [x] 1.1 Fix `I2CBusManager::restartBus(uint8_t busIndex)` in `flight_firmware/src/i2c_bus_manager.cpp` to preserve 50 kHz clock speed and 100 ms timeout when restarting Bus 2 (`PIN_I2C2_SDA = GPIO 2`, `PIN_I2C2_SCL = GPIO 1`).
- [x] 1.2 Update `flight_firmware/src/imu_sensor.cpp` electrical probe exit handlers to restore Bus 2 to 50 kHz with 100 ms timeout instead of 100 kHz.

## 2. Robust BNO055 Boot Initialization & Multi-Attempt Discovery

- [x] 2.1 Add a pre-probe bus-clearing sequence (9 pulses on SCL with a STOP condition) to `IMUSensorManager::initIMU()` in `flight_firmware/src/imu_sensor.cpp`.
- [x] 2.2 Implement up to 3 candidate probe retries with a 50 ms delay for address `0x28` on Bus 2 in `IMUSensorManager::initIMU()`.
- [x] 2.3 Configure internal oscillator (`_bno.setExtCrystalUse(false)`) with settled mode transition delays (25 ms in CONFIG mode, 50 ms in NDOF mode) in `IMUSensorManager::initIMU()`.

## 3. Background Re-Discovery & Telemetry Validation

- [x] 3.1 Implement non-blocking background re-discovery in `IMUSensorManager::readLiveData()` in `flight_firmware/src/imu_sensor.cpp` every 5 seconds when `_activeBus == 0`.
- [x] 3.2 Build and flash `flight_firmware` (`rocket_payload_telemetry`) to `/dev/ttyACM1` from working directory `flight_firmware/`.
- [x] 3.3 Verify live telemetry on `/dev/ttyACM1` confirms `flags` carries `TLM_BNO055` (bit 6) and streams valid Euler angles and acceleration data.
