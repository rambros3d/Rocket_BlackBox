## 1. 3D Rocket Model Asset Setup
 
- [x] 1.1 Copy glTF model and texture files from `dashboard/rocket-gltf/` to `dashboard/public/models/rocket/`.
- [x] 1.2 Verify static asset accessibility at `/models/rocket/scene.gltf` under Vite development server.

## 2. 3D Attitude Visualizer Implementation

- [x] 2.1 Implement `<AttitudeRocket>` in `dashboard/src/components/attitude/Attitude.tsx` using Three.js `GLTFLoader` with PBR lighting and orientation axis offset.
- [x] 2.2 Add attitude reference gimbal rings (Roll = Green, Pitch = Blue, Yaw = Orange) centered around the rocket.
- [x] 2.3 Integrate `<AttitudeRocket>` into `dashboard/src/pages/OverviewDashboard.tsx` replacing `<AttitudePlane>`.
- [x] 2.4 Integrate `<AttitudeRocket>` into `dashboard/src/pages/SnapshotDashboard.tsx` replacing `<AttitudeCube>`.

## 3. Flight Firmware UV Telemetry Implementation

- [x] 3.1 Update `flight_firmware/src/env_sensors.cpp` to sample UVS from LTR-390, calculate `calcUvi = uvs / 383.33f`, and populate diagnostic/periodic results.
- [x] 3.2 Update `flight_firmware/src/telemetry_packet.h` to add `uvi` to `TelemetryFrame` and `TelemetryPacket`.
- [x] 3.3 Update `flight_firmware/src/telemetry_packet.cpp` to serialize `"uv"` in USB JSON and pack/unpack binary packet `uviX100`.
- [x] 3.4 Update `flight_firmware/src/telemetry_collector.cpp` to assign UVI from environmental results to the telemetry frame.
- [x] 3.5 Build `flight_firmware` using PlatformIO in `flight_firmware/` and verify compilation.

## 4. Dashboard UV Telemetry Integration & UI

- [x] 4.1 Update `dashboard/src/lib/types.ts` and `dashboard/src/lib/protocol.ts` to decode `uvi` across JSON and binary parsers.
- [x] 4.2 Update `dashboard/src/lib/demo.ts` to include simulated UV Index data.
- [x] 4.3 Add UV Index snapshot card with WHO hazard badges to `dashboard/src/pages/SnapshotDashboard.tsx`.
- [x] 4.4 Add UV Index sparkline card to `dashboard/src/pages/OverviewDashboard.tsx`.
- [x] 4.5 Add UV Index chart series to `dashboard/src/pages/ChartsPage.tsx`.

## 5. Bidirectional Link Metrics (Ground & Payload)

- [x] 5.1 Implement ground dongle `0x0D` RSSI query upon packet arrival (~1 Hz) in `dashboard/src/lib/link.ts`.
- [x] 5.2 Fix `ingest()` in `dashboard/src/store/telemetry.ts` to preserve active link metrics across frame arrivals.
- [x] 5.3 Implement periodic 5-second PING uplink in `dashboard/src/lib/link.ts` and update `flight_firmware/src/app_flight/main_flight.cpp` to echo measured uplink RSSI/SNR in ACK.
- [x] 5.4 Update `Link Statistics` card in `dashboard/src/pages/DevicesPage.tsx` to render both Downlink (Ground) and Uplink (Payload) metrics.

## 6. Verification & Testing

- [x] 6.1 Run TypeScript type check and build verification in `dashboard/` (`npm run typecheck && npm run build`).
- [x] 6.2 Validate OpenSpec change compliance (`openspec validate rocket-view-and-uv-sensor`).
