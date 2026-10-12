## Why

During dynamic flight events (boost, burnout, roll oscillations, and apogee deployment), a 1 Hz telemetry refresh rate is too coarse to track rocket trajectory and attitude changes. While environmental and GPS quantities update naturally at 1 Hz or slower, the BNO055 9-DOF IMU and MS5607 barometric altimeter can be sampled at 4 Hz (250 ms) to capture sharp altitude and orientation transients.

Transmitting a full 90-byte telemetry frame 4 times per second over LoRa at SF9 (Spreading Factor 9, 125 kHz) is physically impossible because each packet plus its 3-byte air prefix consumes about 513 ms Time-on-Air. By decoupling transport rates into 4 Hz wired USB Serial and Flash logging, and an interleaved LoRa stream of one 90-byte full packet and one 20-byte fast packet per second, we improve responsiveness while retaining SF9 modulation.

## What Changes

- **Firmware Fast Sensor Sampling (`flight_firmware`)**:
  - Sample BNO055 (attitude, acceleration, angular rates) and MS5607 (barometric pressure, altitude, vertical speed) at 4 Hz (every 250 ms).
  - Cache and repeat slower environmental sensors (SCD40, SGP41, LTR-390) and GPS fixes at their natural 1 Hz cadence.
  - Stream 4 Hz JSON telemetry across USB Serial when active.
  - Log 4 Hz flight data points to onboard Flash storage (`/ffat/flight_XXXX.csv`).

- **Interleaved LoRa Radio Stream (`flight_firmware`)**:
  - Introduce a 20-byte binary `FastTelemetryPacket` with magic, sequence, wrapping uptime, roll/pitch/yaw, barometric altitude, vertical speed, and CRC16; with the air prefix it uses about 185 ms at SF9.
  - Alternate one `TelemetryPacket` (Full, 90 bytes, about 513 ms ToA) and one `FastTelemetryPacket` (Fast, 20 bytes, about 185 ms ToA), starting the fast transmission at least 550 ms after the full transmission.
  - Nominal air-time is about 698 ms per second, leaving about 302 ms for ground PING/commands when neither transmission is delayed.

- **Dashboard High-Rate Parser & Visualizer (`dashboard`)**:
  - Update `protocol.ts` and `link.ts` to decode `FastTelemetryPacket` frames.
  - Update `telemetry.ts` store to ingest high-rate attitude and altitude without overwriting 1 Hz environmental fields.
  - Render smooth 4 Hz attitude updates in the 3D rocket view and live barometric altitude sparklines.

## Capabilities

### New Capabilities
- `fast-telemetry-packet`: Lightweight binary protocol framing for high-rate IMU and barometric telemetry.
- `interleaved-lora-stream`: Alternating Full (1 Hz) and Fast (1 Hz) packets for a combined 2 Hz LoRa stream at SF9.

### Modified Capabilities
- `dashboard-telemetry-ui`: Support fast partial frame ingestion, smoothing 3D rocket attitude and altitude charts at high refresh rates.

## Impact

- **Firmware**:
  - `flight_firmware/src/app_flight/main_flight.cpp`: Fast 250ms tick loop with interleaved LoRa transmission scheduler.
  - `flight_firmware/src/telemetry_packet.h`: Struct definition for `FastTelemetryPacket`.
  - `flight_firmware/src/telemetry_packet.cpp`: Encoding and CRC for fast packets.
  - `flight_firmware/src/flash_storage_mgr.cpp`: 4 Hz CSV logging.
- **Dashboard**:
  - `dashboard/src/lib/protocol.ts`: `MAGIC_F` framing and fast packet decoding.
  - `dashboard/src/store/telemetry.ts`: Partial frame state merge in `ingest()`.
  - `dashboard/src/components/attitude/Attitude.tsx`: High-frequency quaternion interpolation.
