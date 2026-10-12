## Context

The avionics firmware currently uses a single global timer `TELEMETRY_INTERVAL_MS = 1000` (1 Hz). At 1 Hz, rapid flight events such as motor burnout, apogee detection, and rocket rotation cannot be cleanly resolved. The user specifically requires a 4 Hz sampling and transmission rate for the BNO055 IMU and MS5607 barometric altimeter, while keeping slow quantities (GPS, gas, air quality, battery) at 1 Hz.

Because the user requires **SF9 (Spreading Factor 9, 125 kHz)**, the LoRa Time-on-Air (ToA) for the full 90-byte packet plus 3-byte air prefix is about 513 ms. Sending four such packets per second requires >2000 ms, which exceeds the channel capacity. An interleaved stream uses a compact fast packet between full packets.

## Goals / Non-Goals

**Goals:**
- Sample BNO055 (attitude, acceleration, gyro) and MS5607 (pressure, altitude, vertical speed) at 4 Hz (every 250 ms).
- Output 4 Hz JSON telemetry over USB Serial for ground bench testing and rapid agentic debugging.
- Log 4 Hz flight data points to onboard Flash storage (`/ffat/flight_XXXX.csv`).
- Implement an interleaved LoRa stream at SF9: one 90-byte Full Packet (about 513 ms ToA with air prefix) alternating with one 20-byte Fast Packet (about 185 ms ToA with air prefix) per second, achieving a nominal 2 Hz over-the-air update rate with about 698 ms total ToA.
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
- **Decision**: Define a packed struct of exactly 20 bytes. The original field widths added up to 23 bytes, so uptime is reduced to a wrapping 16-bit seconds counter and altitude is encoded as signed 24-bit centimetres:
  ```cpp
  struct __attribute__((packed)) FastTelemetryPacket {
      uint8_t magic[2];      // 'R', 'F' (0x52, 0x46)
      uint8_t version;       // 1
      uint16_t seq;          // Packet sequence
      uint16_t uptimeS;      // Boot uptime modulo 65536 seconds
      int16_t rollX10;       // Roll * 10
      int16_t pitchX10;      // Pitch * 10
      uint16_t yawX10;       // Yaw * 10
      uint8_t baroAltCm[3];  // Signed 24-bit baro altitude in cm
      int16_t vSpeedDms;     // Vertical speed in dm/s
      uint16_t crc;          // CRC-16/CCITT-FALSE
  };
  ```
- **Air-Time**: 20 bytes + 3 prefix bytes = 23 bytes on air. At SF9 / 125 kHz, ToA is **185.3 ms**.

### 3. Interleaved Transmission Scheduler
- **Decision**: Over LoRa, alternate:
  - $t = 0.0\text{ s}$: Send `TelemetryPacket` (Full, 90 bytes, about 513 ms ToA with air prefix).
  - $t \approx 0.55\text{ s}$: Send `FastTelemetryPacket` (Fast, 20 bytes, 185 ms ToA).
- **Rationale**: The 90-byte full payload plus 3-byte air prefix requires about 513 ms, so a 500 ms fast start would collide with it. Total air time per second is $513 + 185 = 698\text{ ms}$, leaving about $302\text{ ms}$ for RX listening when the scheduler is not delayed by commands or flash writes.

### 4. Dashboard Partial Frame Ingestion
- **Decision**: When `FastTelemetryPacket` arrives (`MAGIC_F`), `protocol.ts` emits `{ kind: 'fast-frame', imu, baro, seq, t }`. In `telemetry.ts`, merge into `latest` by updating only `imu`, `baro`, `seq`, and `t`, while preserving `env`, `gps`, `sys`, and `link`.
- **Rationale**: Eliminates UI flickering and ensures gauges for CO2 and VOC do not clear or show `--`.

## Risks / Trade-offs

- **[Risk] High CPU load during simultaneous 4 Hz Flash logging** → **Mitigation**: FFat append writes ~50 bytes per record. ESP32-S3 Flash write buffering handles this with <2ms latency per write.
- **[Risk] LoRa receiver confusion between Full and Fast packets** → **Mitigation**: Distinct packet magic: `'R','B'` for Full, `'R','F'` for Fast, and `'R','A'` for ACK. Checked via CRC before processing.
