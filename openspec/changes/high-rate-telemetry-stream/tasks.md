## 1. Fast Telemetry Framing & Firmware Scheduling

- [ ] 1.1 Define `FastTelemetryPacket` (20 bytes: magic `'R','F'`, seq, uptime, IMU, baro, CRC16) in `flight_firmware/src/telemetry_packet.h`.
- [ ] 1.2 Implement encoding and CRC calculation for `FastTelemetryPacket` in `flight_firmware/src/telemetry_packet.cpp`.
- [ ] 1.3 Refactor `main_flight.cpp` loop into a 250 ms (4 Hz) fast tick for BNO055 and MS5607, with 1000 ms slow sensor caching.
- [ ] 1.4 Implement interleaved LoRa scheduler in `main_flight.cpp`: transmit 1x Full packet followed 500 ms later by 1x Fast packet (2 Hz over LoRa at SF9).
- [ ] 1.5 Update USB JSON streaming to emit 4 Hz telemetry updates when active.
- [ ] 1.6 Update Flash flight logging to record 4 Hz data rows in `/ffat/flight_XXXX.csv`.

## 2. Dashboard Protocol Parser & State Ingestion

- [ ] 2.1 Update `dashboard/src/lib/protocol.ts` to decode `MAGIC_F` fast telemetry frames.
- [ ] 2.2 Update `dashboard/src/store/telemetry.ts` `ingest()` to support partial frame merge without wiping cached environmental metrics.
- [ ] 2.3 Verify high-rate smooth quaternion interpolation in `dashboard/src/components/attitude/Attitude.tsx`.

## 3. Verification & Build

- [ ] 3.1 Run PlatformIO build in `flight_firmware/` and verify compilation.
- [ ] 3.2 Run TypeScript check and build in `dashboard/` (`npm run typecheck && npm run build`).
- [ ] 3.3 Validate OpenSpec change compliance (`openspec validate high-rate-telemetry-stream`).
