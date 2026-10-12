## 1. Fast Telemetry Framing & Firmware Scheduling

- [x] 1.1 Define `FastTelemetryPacket` (20 bytes: magic `'R','F'`, seq, uptime, IMU, baro, CRC16) in `flight_firmware/src/telemetry_packet.h`.
- [x] 1.2 Implement encoding and CRC calculation for `FastTelemetryPacket` in `flight_firmware/src/telemetry_packet.cpp`.
- [x] 1.3 Refactor `main_flight.cpp` loop into a 250 ms (4 Hz) fast tick for BNO055 and MS5607, with 1000 ms slow sensor caching.
- [x] 1.4 Implement interleaved LoRa scheduler in `main_flight.cpp`: transmit one Full packet followed at least 550 ms later by one Fast packet (nominal 2 Hz over LoRa at SF9).
- [x] 1.5 Update USB JSON streaming to emit 4 Hz telemetry updates when active.
- [x] 1.6 Update Flash flight logging to record 4 Hz data rows in `/ffat/flight_XXXX.csv`.

## 2. Dashboard Protocol Parser & State Ingestion

- [x] 2.1 Update `dashboard/src/lib/protocol.ts` to decode `MAGIC_F` fast telemetry frames.
- [x] 2.2 Update `dashboard/src/store/telemetry.ts` to support partial frame merge without wiping cached environmental metrics.
- [x] 2.3 Verify high-rate smooth quaternion interpolation in `dashboard/src/components/attitude/Attitude.tsx`.

## 3. Verification & Build

- [x] 3.1 Run PlatformIO build in `flight_firmware/` and verify compilation.
- [x] 3.2 Run TypeScript check and build in `dashboard/` (`npm run typecheck && npm run build`).
- [x] 3.3 Validate OpenSpec change compliance (`openspec validate high-rate-telemetry-stream --strict --no-interactive`).
