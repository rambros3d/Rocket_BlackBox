## Context

The Rocket BlackBox payload board uses dual hardware I2C buses on an ESP32-S3 (RAK3112):
- Bus 1: Environmental sensors (MS5607, SCD40, SGP41, TSL2591) on GPIO 10 (SDA) and GPIO 11 (SCL).
- Bus 2: Dedicated IMU bus on GPIO 2 (SDA) and GPIO 1 (SCL) connected to a 7semi external BNO055 breakout board.

In bench testing, Bus 2 was configured at 100 kHz. While an active probe at 50 kHz reliably verifies BNO055 presence (7-bit address `0x28`, CHIP_ID `0xA0`), standard boot and POST operations at 100 kHz suffer timeouts due to the BNO055 Cortex-M0 coprocessor's ~300 µs clock-stretching characteristics. Additionally, when electrical line probe routine `probeIMULines` (menu command `[7]`) executes, it leaves the sensor in `OPERATION_MODE_CONFIG` (idle) without re-transitioning into sensor fusion mode (`OPERATION_MODE_NDOF`), zeroing out subsequent telemetry readouts.

## Goals / Non-Goals

**Goals:**
- Configure I2C Bus 2 (`Wire1`) default clock rate to 50 kHz with a 100 ms timeout to ensure stable transactions with the BNO055 across external wiring.
- Standardize BNO055 initialization to ensure external crystal selection (present on 7semi) respects Bosch settling times and enters `OPERATION_MODE_NDOF`.
- Automatically re-initialize the BNO055 driver and fusion mode following electrical probe routines.
- Expose a serial console command `[i]` to trigger runtime IMU re-initialization on demand.

**Non-Goals:**
- Modifying Bus 1 clock rate (Bus 1 remains at 100 kHz for environmental sensors).
- Modifying the PCB hardware layout or trace routing (handled in Rev 2.0 design notes).
- Implementing interrupt-driven IMU FIFO reads (polled read mode meets flight data logging requirements at 100 Hz).

## Decisions

### Decision 1: Set Bus 2 Clock Frequency to 50 kHz
- **Choice**: Lower `Wire1` from 100 kHz to 50 kHz.
- **Rationale**: 
  - A 24-byte telemetry read (Euler + Accel + Gyro + Calib) takes ~4.5 ms at 50 kHz.
  - At 50 kHz, the maximum polling rate is ~200 Hz, providing ample headroom above the BNO055 internal fusion engine's 100 Hz maximum update rate.
  - 50 kHz eliminates ESP32 hardware I2C timeout errors caused by BNO055 clock-stretching.
- **Alternatives Considered**:
  - *25 kHz*: Saturated bus utilization (~95%) when reading at 100 Hz.
  - *100 kHz with software bit-banging*: Adds unnecessary CPU overhead when hardware I2C at 50 kHz is completely stable.

### Decision 2: Controlled Crystal Switching Sequence
- **Choice**: In `IMUSensorManager::initIMU()`, switch to external crystal with explicit state transitions:
  1. Initialize with `_bno.begin(OPERATION_MODE_CONFIG)`.
  2. Write `SYS_TRIGGER` register bit 7 (`0x80`) to select external 32.768 kHz crystal oscillator.
  3. Wait 25 ms for crystal stabilization.
  4. Transition to `OPERATION_MODE_NDOF`.
  5. Wait 20 ms for fusion engine startup.
  6. Read `SYS_STATUS` to confirm value `0x05` (*Sensor fusion algorithm running*). If status indicates clock failure, fall back to internal oscillator (`SYS_TRIGGER = 0x00`).
- **Rationale**: Guarantees reliability across both crystal-equipped boards (7semi, Adafruit) and generic crystal-less clones.

### Decision 3: Post-Probe Auto-Recovery
- **Choice**: Call `IMUSensorManager::initIMU(out)` at the conclusion of `IMUSensorManager::probeIMULines(out)`.
- **Rationale**: Command `[7]` tests pull-ups and line drivers by toggling GPIOs and pulsing SCL, which resets the slave. Automatically re-initializing puts the sensor back into `OPERATION_MODE_NDOF` immediately so subsequent streaming (`[2]`) or POST (`[1]`) operates seamlessly.

## Risks / Trade-offs

- **[Risk] Slower I2C bus scan across 0x08-0x77 on Bus 2**  
  → *Mitigation*: 112 address pings at 50 kHz take ~45 ms total, which is imperceptible during boot and diagnostics.
- **[Risk] Long power-up settling delay**  
  → *Mitigation*: BNO055 requires > 650 ms after POR to boot its internal ARM core. `initIMU()` enforces an 800 ms uptime check before issuing commands.
