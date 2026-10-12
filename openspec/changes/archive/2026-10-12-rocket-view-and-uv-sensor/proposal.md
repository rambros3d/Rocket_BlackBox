## Why

The Rocket BlackBox payload telemetry currently uses generic 3D geometries (a procedural passenger plane in the Overview tab and a wireframe cube in the Snapshot tab) that do not represent an authentic rocket body. Incorporating the dedicated textured 3D rocket model (`AIM-120` aerodynamic airframe in `dashboard/rocket-gltf`) provides mission-accurate attitude visualization.

Additionally, while the onboard Vishay/Lite-On LTR-390UV-01 sensor is physically present on I2C Bus 1 (`0x53`) and detected by firmware, its UV index (UVI) measurement mode is unpolled in the active flight sampling loop and missing from telemetry frames and the dashboard UI. Enabling UV Index across the entire firmware and dashboard pipeline allows real-time solar irradiance tracking.

Furthermore, Link Statistics (RSSI and SNR) currently display `---` because direct payload USB connections lack radio metadata, and the stock Waveshare USB-to-LoRa dongle firmware emits unpopulated `0` values in its automatic signal report packet that get discarded. By actively polling the dongle's real SX1262 instantaneous signal strength (`0x0D` command) on each packet arrival (~1 Hz) and supporting periodic 5-second PING uplinks for payload-side RSSI measurement, the dashboard can present comprehensive bidirectional (Downlink and Uplink) link statistics.

## What Changes

- **Dashboard 3D Attitude Visualizer**:
  - Migrate glTF 2.0 rocket assets from `dashboard/rocket-gltf/` into `dashboard/public/models/rocket/`.
  - Replace `<AttitudePlane>` (Overview tab) and `<AttitudeCube>` (Snapshot tab) with a unified `<AttitudeRocket>` component using Three.js `GLTFLoader`.
  - Retain color-coded attitude reference gimbal rings (Roll = Green, Pitch = Blue, Yaw = Orange) centered around the rocket.
  - Implement PBR 3-point scene illumination with appropriate model axis remapping so the rocket nose aligns with payload nose vector (`+Z`).

- **Full-Stack UV Sensor (LTR-390UV) Enablement**:
  - **Firmware (`flight_firmware`)**:
    - Update `EnvSensorsManager::readAllSensors()` to sample both ALS (ambient light) and UVS (ultraviolet) from the LTR-390UV-01.
    - Calculate UV Index (`calcUvi = (float)uvs / 383.33f`).
    - Add `float uvi` to `TelemetryFrame`, serialize `"uv"` in USB JSON, and encode `uint16_t uviX100` into `TelemetryPacket`.
  - **Dashboard (`dashboard`)**:
    - Parse `uvi` across Web Serial JSON and binary LoRa telemetry decoders.
    - Add a **UV Index** snapshot card and sparkline card with WHO standard UV risk color coding (Low, Moderate, High, Very High, Extreme).
    - Add a UV Index time-series chart to `ChartsPage.tsx`.

- **Live Bidirectional Link Statistics (Ground & Payload)**:
  - Query ground station SX1262 real RSSI (`0x0D` command) on incoming packet arrivals (~1 Hz) to populate Downlink RSSI and SNR.
  - Fix telemetry store frame ingestion so incoming telemetry packets do not wipe out active link metrics.
  - Implement periodic 5-second PING uplink in the dashboard with payload ACK echo to measure and display Uplink RSSI and SNR.
  - Update Link Statistics UI on `DevicesPage.tsx` to display both Downlink (Ground) and Uplink (Payload) metrics.

## Capabilities

### New Capabilities
- `dashboard-rocket-orientation`: 3D glTF-based rocket orientation visualizer component with attitude gimbal rings and PBR lighting.
- `ultraviolet-telemetry`: End-to-end UV Index measurement, telemetry packet transmission, and dashboard presentation.
- `bidirectional-link-metrics`: Real-time Downlink (Ground Dongle) and Uplink (Payload) RSSI and SNR monitoring.

### Modified Capabilities
- `sensor-diagnostics`: Extend periodic environmental sensing to include LTR-390UV ultraviolet mode sampling and health reporting.

## Impact

- **Firmware**:
  - `flight_firmware/src/env_sensors.cpp`: Periodic sampling of UVS registers via `Adafruit_LTR390`.
  - `flight_firmware/src/telemetry_packet.h`: Struct field additions for UVI in `TelemetryFrame` and `TelemetryPacket`.
  - `flight_firmware/src/telemetry_packet.cpp`: Packing, unpacking, and JSON serialization.
  - `flight_firmware/src/telemetry_collector.cpp`: Propagating UVI from environmental results to telemetry frame.
  - `flight_firmware/src/app_flight/main_flight.cpp`: Echo uplink RSSI/SNR in PING ACK packet.
- **Dashboard**:
  - `dashboard/public/models/rocket/`: Static 3D asset hosting.
  - `dashboard/src/components/attitude/Attitude.tsx`: New `AttitudeRocket` visualizer and glTF loading pipeline.
  - `dashboard/src/pages/OverviewDashboard.tsx` & `dashboard/src/pages/SnapshotDashboard.tsx`: Rocket view and UV Index metric cards.
  - `dashboard/src/pages/ChartsPage.tsx`: UV Index chart.
  - `dashboard/src/pages/DevicesPage.tsx`: Dual-link (Downlink / Uplink) metrics cards.
  - `dashboard/src/lib/link.ts`: Ground dongle 0x0D querying and periodic 5s PING uplink loop.
  - `dashboard/src/store/telemetry.ts`: Preserve and manage bidirectional link stats.
