## Context

The avionics firmware currently uses a single global timer `TELEMETRY_INTERVAL_MS = 1000` (1 Hz). At 1 Hz, rapid flight events such as motor burnout, apogee detection, and rocket rotation cannot be cleanly resolved. The user specifically requires a 4 Hz sampling and transmission rate for the BNO055 IMU and MS5607 barometric altimeter, while keeping slow quantities (GPS, gas, air quality, battery) at 1 Hz.

Because the user requires maximizing LoRa link range using **SF9 (Spreading Factor 9, 125 kHz)**, the LoRa Time-on-Air (ToA) for the full 88-byte packet is 513 ms. Sending four 88-byte packets per second requires >2000 ms, which exceeds the channel capacity. To overcome this physical constraint, a Hybrid Interleaved architecture is designed.

## Goals / Non-Goals

**Goals:**
- Sample BNO055 (attitude, acceleration, gyro) and MS5607 (pressure, altitude, vertical speed) at 4 Hz (every 250 ms).
- Output 4 Hz JSON telemetry over USB Serial for ground bench testing and rapid agentic debugging.
- Log 4 Hz flight data points to onboard Flash storage (`/ffat/flight_XXXX.csv`).
- Implement an interleaved dual-packet LoRa stream at SF9: 1x Full Packet (88 bytes, 513 ms ToA) alternating with 1x Fast Packet (~18 bytes, 185 ms ToA) per second, achieving a 2 Hz over-the-air update rate with 698 ms total ToA (70% duty cycle, 302 ms quiet listening window for ground commands) without sacrificing SF9 range.
- Update dashboard store and UI to seamlessly ingest high-frequency fast packets without resetting existing environmental state.

**Non-Goals:**
- Forcing slow environmental sensors (SCD40 with a 5s measurement cycle, SGP41 with a 1s VOC index step) to run at 4 Hz.
- Switching to lower spreading factors (SF7/SF8), as the user explicitly chose SF9 for maximum range.

## Decisions

### 1. Dual-Rate Sensor Scheduling
- **Decision**: In `main_flight.cpp`, execute the fast loop at 250 ms (4 Hz).
  - Fast loop samples `BNO055` (I2C2 @ 50 kHz, ~6 ms) and `MS5607` (I2C1 @ 100 kHz, ~18 ms).
  - Slow sensors (`SCD40`, `SGP41`, `LTR390`, `GPS`) are sampled only on 1000 ms tick boundaries. The latest slow sensor values are cached in memory.
- **Rationale**: Total fast sensor execution takes ~24 ms, consuming less than 10% of the 250 ms CPU budget.

### 2. Fast Packet Binary Layout (`FastTelemetryPacket`)
- **Decision**: Define a packed struct of exactly 20 bytes:
  ```cpp
  struct __attribute__((packed)) FastTelemetryPacket {
      uint8_t magic[2];      // 'R', 'F' (0x52, 0x46)
      uint8_t version;       // 1
      uint16_t seq;          // Packet sequence
      uint32_t uptimeS;      // Boot uptime
      int16_t rollX10;       // Roll * 10
      int16_t pitchX10;      // Pitch * 10
      uint16_t yawX10;       // Yaw * 10
      int32_t baroAltCm;     // Baro Altitude in cm
      int16_t vSpeedDms;     // Vertical speed in dm/s
      uint16_t crc;          // CRC-16/CCITT-FALSE
  };
  ```
- **Air-Time**: 20 bytes + 3 prefix bytes = 23 bytes on air. At SF9 / 125 kHz, ToA is **185.3 ms**.

### 3. Interleaved Transmission Scheduler
- **Decision**: Over LoRa, alternate:
  - $t = 0.0\text{ s}$: Send `TelemetryPacket` (Full, 88 bytes, 513 ms ToA).
  - $t = 0.5\text{ s}$: Send `FastTelemetryPacket` (Fast, 20 bytes, 185 ms ToA).
- **Rationale**: Total air time per second is $513 + 185 = 698\text{ ms}$, leaving $302\text{ ms}$ for RX listening and preventing radio queue lockup.

### 4. Dashboard Partial Frame Ingestion
- **Decision**: When `FastTelemetryPacket` arrives (`MAGIC_F`), `protocol.ts` emits `{ kind: 'fast-frame', imu, baro, seq, t }`. In `telemetry.ts`, merge into `latest` by updating only `imu`, `baro`, `seq`, and `t`, while preserving `env`, `gps`, `sys`, and `link`.
- **Rationale**: Eliminates UI flickering and ensures gauges for CO2 and VOC do not clear or show `--`.

## Risks / Trade-offs

- **[Risk] High CPU load during simultaneous 4 Hz Flash logging** → **Mitigation**: FFat append writes ~50 bytes per record. ESP32-S3 Flash write buffering handles this with <2ms latency per write.
- **[Risk] LoRa receiver confusion between Full and Fast packets** → **Mitigation**: Distinct packet magic: `'R','B'` for Full, `'R','F'` for Fast, and `'R','A'` for ACK. Checked via CRC before processing.
