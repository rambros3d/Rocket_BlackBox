## Context

The avionics dashboard visualizes 9-DOF orientation using BNO055 telemetry (or fallback simulation). Currently, it renders a generic airplane model or wireframe cube. A textured, low-poly glTF asset representing a missile/rocket (`AIM-120`) is available under `dashboard/rocket-gltf/` and should become the primary orientation model across the dashboard.

Simultaneously, the payload features an LTR-390UV sensor on I2C Bus 1 (`0x53`). While initialized and detected, it currently only samples Ambient Light (ALS) as a secondary backup for TSL2591, leaving its Ultraviolet mode (UVS) unpolled. Real solar ultraviolet irradiance (UV Index) must be integrated across firmware, transmission framing, and dashboard rendering.

Lastly, the Link Statistics panel shows `---` for RSSI and SNR because:
1. Wired USB serial (`/dev/ttyACM0`) carries direct telemetry from the transmitter, which has no RF link metrics.
2. The Waveshare USB-to-LoRa ground dongle firmware outputs an uncalibrated default `0x00, 0x00` in its automatic signal report packet that is discarded by `link.ts`.
3. Incoming data frame ingestion in `telemetry.ts` resets `latest.link` back to `null`.
Direct testing proves the dongle's real SX1262 instantaneous signal strength register is fully functional via command `0x0D` (measuring `-32 dBm` during packet transmission vs `-108 dBm` ambient noise floor). Additionally, the payload can measure uplink RSSI/SNR during periodic PING exchanges.

## Goals / Non-Goals

**Goals:**
- Provide realistic 3D rocket orientation visualization in both the Overview and Snapshot dashboard views with attitude reference gimbal rings.
- Efficiently load and render glTF PBR assets using Three.js with graceful fallback during network load.
- Enable LTR-390 UVS sampling on the flight payload, compute UV Index, and transmit it via telemetry frames.
- Display live UV Index with WHO hazard levels (0-2 Low, 3-5 Mod, 6-7 High, 8-10 Very High, 11+ Extreme) on the dashboard and log it in history charts.
- Implement bidirectional link metrics:
  - Downlink (Ground Dongle) RSSI and SNR sampled at ~1 Hz via command `0x0D`.
  - Uplink (Payload) RSSI and SNR measured via periodic 5-second PING / ACK telemetry exchange.
  - Display both Downlink and Uplink values in `DevicesPage.tsx`.

**Non-Goals:**
- Modifying mechanical enclosure STEP models or PCB layout.
- Adding complex aerodynamic smoke/exhaust particle simulations.

## Decisions

### 1. GLTF Loading & Asset Hosting
- **Decision**: Serve the model from `dashboard/public/models/rocket/` (`scene.gltf`, `scene.bin`, and `textures/`).
- **Rationale**: Vite statically serves files in `public/` at root URL `/models/rocket/scene.gltf`. Three.js `GLTFLoader` resolves relative texture URIs automatically when loaded from a static URL path.
- **Alternatives Considered**: Inlining `.gltf` into bundle as base64 (increases bundle size significantly and hurts initial page load).

### 2. Rocket Coordinate Alignment
- **Decision**: Wrap the loaded glTF scene inside a pivot group that normalizes scale (~1.6 units long) and applies a base rotation offset so the rocket nose aligns with Three.js `+Z` (matching sensor X/nose), top fin aligns with `+Y` (sensor Z/up), and right fin aligns with `+X` (sensor Y/wings).
- **Rationale**: Ensures the existing quaternion math in `targetQuaternion(roll, pitch, yaw)` continues to rotate the rocket accurately without changing IMU mathematics.

### 3. Gimbal Rings Retention
- **Decision**: Keep the roll (green), pitch (blue), and yaw (orange) torus rings around the rocket.
- **Rationale**: User confirmed this choice; provides immediate visual orientation reference when looking at a symmetrical cylindrical rocket body.

### 4. LTR-390 Mode Switching in Firmware
- **Decision**: In `EnvSensorsManager::readAllSensors()`, read ALS, switch to `LTR390_MODE_UVS` with a brief delay (or non-blocking sample state machine), read UVS, and return to `LTR390_MODE_ALS`.
- **Formula**: `calcUvi = (float)uvs / 383.33f` per datasheet gain/resolution setting (`GAIN_3`, `18BIT`).
- **Payload Framing**: Add `float uvi` to `TelemetryFrame` and `"uv"` to JSON. For binary `TelemetryPacket`, pack `uint16_t uviX100` (e.g. UVI 3.42 = 342) without changing existing field offsets.

### 5. Bidirectional Link Metrics Polling
- **Downlink**: When a KISS data packet arrives at the ground station, `link.ts` immediately fires `C0 06 0D C0` to read the instantaneous packet RSSI from the SX1262. SNR is estimated against the noise floor ($\text{SNR} = \text{RSSI} - \text{NoiseFloor}$).
- **Uplink**: Every 5 seconds, the ground station sends a `CMD_PING` packet. The payload receives the ping, reads its SX1262 `getRSSI()` and `getSNR()`, packs them into the ACK response (or periodic frame), and the dashboard renders them as Uplink metrics.
- **Store Persistence**: In `telemetry.ts` `ingest(frame)`, preserve the previous link metrics if the incoming frame has `null` link metrics, avoiding wiping out live stats.

## Risks / Trade-offs

- **[Risk] glTF Network Latency / File missing** → **Mitigation**: While glTF loads asynchronously, render the procedural fallback cube/wireframe body. Once loaded, swap smoothly into the scene.
- **[Risk] LTR-390 mode switch delay adds latency to 1 Hz loop** → **Mitigation**: Keep mode switch settling delay to 25-30ms max, well within the 1000ms loop budget.
- **[Risk] Ground dongle busy handling 0x0D query** → **Mitigation**: Command `0x0D` is a lightweight register read that completes in <10ms. Fire asynchronously without blocking data stream.
