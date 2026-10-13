## Why

The external 7semi BNO055 9-DOF IMU connected to dedicated I2C Bus 2 (`GPIO 2` SDA, `GPIO 1` SCL at 50 kHz) intermittently fails boot initialization and telemetry reads on the RAK3112 / ESP32-S3 payload. When boot probing fails or the sensor encounters clock-stretching stalls during NDOF fusion calculation, the firmware locks out the sensor permanently without retrying, and bus recovery regressions in `I2CBusManager::restartBus` inadvertently boost Bus 2 to 100 kHz (cutting timeout to 50 ms). Reliable IMU initialization and autonomous recovery are critical for flight attitude and acceleration telemetry.

## What Changes

- **Pre-Probe Bus Recovery on Bus 2**: Clock 9 SCL pulses with a STOP condition before probing candidates in `IMUSensorManager::initIMU()`, releasing any slave holding SDA LOW from prior runs or interrupted transactions.
- **Multi-Attempt Discovery**: Provide 3 probe retries with a 50 ms settling delay for BNO055 candidate detection on Bus 2 at address `0x28` before giving up.
- **Background Auto-Recovery When Uninitialized**: Update `IMUSensorManager::readLiveData()` so that if `_activeBus == 0` (boot probe failed), the firmware periodically (every 5 seconds) attempts to re-discover and initialize the IMU in the background rather than permanently locking it out.
- **Enforce 50 kHz & 100 ms Timeout in Bus 2 Recovery**: Fix `I2CBusManager::restartBus(uint8_t busIndex)` and `IMUSensorManager` pin routines to strictly restore 50 kHz and 100 ms timeout for Bus 2 instead of hardcoding 100 kHz / 50 ms.
- **Internal Oscillator & Mode-Switching Delays**: Default to the internal 32 kHz oscillator (`setExtCrystalUse(false)`) with required datasheet transition settling delays (25 ms in CONFIG mode, 50 ms after entering NDOF) to eliminate lockups on modules lacking populated or slow crystals.

## Capabilities

### New Capabilities

*(None)*

### Modified Capabilities

- `sensor-diagnostics`: Update BNO055 initialization and runtime telemetry requirements to specify pre-probe 9-clock bus clearing, multi-attempt discovery, internal oscillator default with settling delays, strict 50 kHz bus speed preservation across recovery, and background re-discovery when uninitialized.

## Impact

- `flight_firmware/src/imu_sensor.cpp`: Pre-probe bus clearing, multi-attempt candidate probing, internal oscillator configuration, settling delays, and background re-discovery in `readLiveData()`.
- `flight_firmware/src/i2c_bus_manager.cpp`: Restore 50 kHz and 100 ms timeout on Bus 2 in `restartBus(2)`.
- Telemetry downstream: Restores live orientation Euler angles (`roll`, `pitch`, `yaw`) and acceleration (`ax`, `ay`, `az`) telemetry packets over USB CDC and LoRa.
