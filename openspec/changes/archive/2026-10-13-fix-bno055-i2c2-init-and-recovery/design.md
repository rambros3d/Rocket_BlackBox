## Context

The avionics payload features an external 7semi BNO055 9-DOF IMU module wired to dedicated I2C Bus 2 (`PIN_I2C2_SDA = GPIO 2`, `PIN_I2C2_SCL = GPIO 1`). Due to the BNO055's internal ARM Cortex-M0 processor and fusion calculation routines, the device relies on heavy I2C clock stretching and enforces specific mode-switching transition delays.

Currently in `flight_firmware/src/imu_sensor.cpp` and `flight_firmware/src/i2c_bus_manager.cpp`:
1. `initIMU()` probes candidate addresses with a single unretried `endTransmission()` ping without clearing the bus.
2. If the initial probe fails at boot, `_activeBus` remains `0`, and `readLiveData()` immediately returns `false` without ever attempting re-discovery or recovery.
3. `I2CBusManager::restartBus(2)` inadvertently re-initializes Bus 2 at 100 kHz with a 50 ms timeout instead of the required 50 kHz and 100 ms timeout.
4. `initIMU()` calls `_bno.setExtCrystalUse(true)`, which hangs or sets system error flags on breakout modules lacking an external 32.768 kHz RTC crystal.
5. Rapid mode switching occurs without observing the Bosch datasheet transition delays (19 ms from NDOF to CONFIG, 7 ms from CONFIG to NDOF).

## Goals / Non-Goals

**Goals:**
- Implement pre-probe 9-clock SCL pulse recovery on Bus 2 before address probing.
- Support a 3-attempt probe loop with 50 ms delays on Bus 2 (`0x28`).
- Add background re-discovery in `readLiveData()` every 5 seconds when `_activeBus == 0`.
- Fix `I2CBusManager::restartBus(2)` to preserve 50 kHz clock rate and 100 ms timeout.
- Configure the BNO055 to use the internal oscillator (`setExtCrystalUse(false)`) with appropriate settling delays (25 ms in CONFIG, 50 ms in NDOF).

**Non-Goals:**
- Modifying Bus 1 environmental sensor operations or pinouts.
- Reworking physical PCB hardware traces or modifying external sensor wiring.

## Decisions

### Decision 1: Pre-Probe Bus-Clearing Sequence
Before initiating I2C candidate scanning in `IMUSensorManager::initIMU()`, release SDA and pulse SCL 9 times followed by an explicit STOP condition.
*Rationale*: If an MCU reboot occurred while the BNO055 was transmitting a byte or stretching the clock, the slave could be holding SDA LOW. Pulsing SCL resets the slave I2C state machine to idle high.

### Decision 2: Multi-Attempt Candidate Probing
Allow up to 3 probe retries with a 50 ms pause for candidate addresses (`0x28` on Bus 2 first, then `0x29`).
*Rationale*: The BNO055 POST can take up to 650–800 ms from power-on. If the MCU boots slightly faster than the external board regulator, multiple retries ensure discovery without premature abort.

### Decision 3: Background Re-Discovery in `readLiveData()`
In `IMUSensorManager::readLiveData()`, if `_activeBus == 0`, check `millis()` against a 5-second interval (`s_nextDiscoveryMs`). If elapsed, invoke `initIMU()`.
*Rationale*: Prevents permanent lockout if the sensor experiences a cold-boot power delay or transient disconnection.

### Decision 4: Preserving 50 kHz Bus Speed in `restartBus()`
Update `I2CBusManager::restartBus(uint8_t busIndex)`:
```cpp
uint32_t freq = (busIndex == 2) ? 50000 : 100000;
uint16_t timeout = (busIndex == 2) ? 100 : 50;
bus.begin(sda, scl, freq);
bus.setTimeOut(timeout);
```
*Rationale*: Prevents regression to 100 kHz, which is prone to clock-stretching timeouts on the ESP32-S3 hardware peripheral.

### Decision 5: Internal Oscillator Fallback with Mode Transition Delays
Set `_bno.setExtCrystalUse(false)` and enforce explicit delays:
```cpp
_bno.setMode(OPERATION_MODE_CONFIG);
delay(25);
_bno.setExtCrystalUse(false);
delay(25);
_bno.setMode(OPERATION_MODE_NDOF);
delay(50);
```
*Rationale*: Matches the verified working configuration in `test_firmware` and avoids lockups on 7semi boards that omit or have unstable external crystals.

## Risks / Trade-offs

- **[Risk] Background re-discovery could block the telemetry loop during the attempt.**
  *Mitigation*: The re-discovery runs only once every 5 seconds, and early address pings abort in < 5 ms if the device is absent, preventing telemetry pipeline starvation.
- **[Risk] Internal oscillator frequency drift across temperature.**
  *Mitigation*: The BNO055 internal RC oscillator is factory-calibrated and fully supports NDOF sensor fusion for avionics without external crystal requirements.
