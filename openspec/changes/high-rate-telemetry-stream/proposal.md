## Why

During dynamic flight events (boost, burnout, roll oscillations, and apogee deployment), a 1 Hz telemetry refresh rate is too coarse to track rocket trajectory and attitude changes. While environmental and GPS quantities update naturally at 1 Hz or slower, the BNO055 9-DOF IMU and MS5607 barometric altimeter can be sampled at 4 Hz (250 ms) to capture sharp altitude and orientation transients.

Transmitting a full 88-byte telemetry frame 4 times per second over LoRa at SF9 (Spreading Factor 9, 125 kHz) is physically impossible because each packet consumes 513 ms Time-on-Air (requiring >2000 ms per second). By decoupling transport rates into a Hybrid architecture—4 Hz on wired USB Serial and Flash logging, combined with a 2 Hz interleaved stream over LoRa (alternating one 88-byte full packet and one ultra-compact ~18-byte fast packet per second)—we achieve responsive 4 Hz ground and log data while preserving 100% of the SF9 maximum radio range.

## What Changes

- **Firmware Fast Sensor Sampling (`flight_firmware`)**:
  - Sample BNO055 (attitude, acceleration, angular rates) and MS5607 (barometric pressure, altitude, vertical speed) at 4 Hz (every 250 ms).
  - Cache and repeat slower environmental sensors (SCD40, SGP41, LTR-390) and GPS fixes at their natural 1 Hz cadence.
  - Stream 4 Hz JSON telemetry across USB Serial when active.
  - Log 4 Hz flight data points to onboard Flash storage (`/ffat/flight_XXXX.csv`).

- **Interleaved LoRa Radio Stream (`flight_firmware`)**:
  - Introduce an ultra-compact binary `FastTelemetryPacket` (~18 bytes: magic, sequence, roll/pitch/yaw, barometric altitude, vertical speed, acceleration, CRC16) with ~185 ms Time-on-Air at SF9.
  - Alternating radio transmission at 2 Hz: send one `TelemetryPacket` (Full, 88 bytes, 513 ms ToA) followed 500 ms later by one `FastTelemetryPacket` (Fast, 18 bytes, 185 ms ToA).
  - Total air-time per second: 698 ms ToA, leaving 302 ms quiet listening window for ground PING/commands while maintaining SF9 maximum link range.

- **Dashboard High-Rate Parser & Visualizer (`dashboard`)**:
  - Update `protocol.ts` and `link.ts` to decode `FastTelemetryPacket` frames.
  - Update `telemetry.ts` store to ingest high-rate attitude and altitude without overwriting 1 Hz environmental fields.
  - Render smooth 4 Hz attitude updates in the 3D rocket view and live barometric altitude sparklines.

## Capabilities

### New Capabilities
- `fast-telemetry-packet`: Lightweight binary protocol framing for high-rate IMU and barometric telemetry.
- `interleaved-lora-stream`: Alternating Full (1 Hz) and Fast (2 Hz) LoRa transmission scheduling preserving SF9 range.

### Modified Capabilities
- `dashboard-telemetry-ui`: Support fast partial frame ingestion, smoothing 3D rocket attitude and altitude charts at high refresh rates.

## Impact

- **Firmware**:
  - `flight_firmware/src/app_flight/main_flight.cpp`: Fast 250ms tick loop with interleaved LoRa transmission scheduler.
  - `flight_firmware/src/telemetry_packet.h`: Struct definition for `FastTelemetryPacket`.
  - `flight_firmware/src/telemetry_packet.cpp`: Encoding and decoding routines for fast packets.
  - `flight_firmware/src/flash_storage_mgr.cpp`: 4 Hz CSV logging.
- **Dashboard**:
  - `dashboard/src/lib/protocol.ts`: `MAGIC_F` framing and fast packet decoding.
  - `dashboard/src/store/telemetry.ts`: Partial frame state merge in `ingest()`.
  - `dashboard/src/components/attitude/Attitude.tsx`: High-frequency quaternion interpolation.
