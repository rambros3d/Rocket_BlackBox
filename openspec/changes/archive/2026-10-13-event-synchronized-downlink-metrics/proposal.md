## Why

The Waveshare USB-to-LoRa-HF ground receiver dongle runs pre-flashed MeshCore v1.0 firmware whose packet status response (`0xF9`) reports zeros (`00 00`) for packet RSSI and SNR. While the hardware diagnostic query `0x0D` (`REQ_GET_CURRENT_RSSI`) returns valid SX1262 instantaneous signal strength, querying it on a blind 1-second interval predominantly hits the ~970 ms inter-packet silent gap, sampling the thermal noise floor (~-105 dBm) instead of the ~30 ms active packet transmission. Synchronizing the `0x0D` hardware query directly to the incoming telemetry packet arrival event captures the active transmission power (-30 dBm to -70 dBm), allowing accurate Downlink RSSI measurement and noise-floor-referenced SNR derivation without requiring hardware modifications or SWD firmware reflashing.

## What Changes

- **Event-Synchronized RSSI Sampling**: When `LinkController` ingests a downlink telemetry frame (`KISS_DATA`), it immediately dispatches KISS hardware command `0x0D` to query the instantaneous SX1262 RSSI during or immediately following packet reception.
- **Ambient Noise Floor Tracking & Downlink SNR Synthesis**: The dashboard tracks the baseline receiver noise floor (defaulting to -105 dBm) and derives Downlink SNR as `snr = clamp(packetRssi - noiseFloor, -20 dB, +25 dB)`.
- **Telemetry Store Metric Ingestion**: Ingests Downlink RSSI and derived Downlink SNR into the telemetry store upon receiving the `0x8D` response, updating the UI metrics without clobbering by idle noise measurements.
- **Elimination of Blind Polling**: Removes or de-prioritizes blind 1 Hz idle RSSI queries that previously corrupted live Downlink packet signal strength with noise floor readings.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `bidirectional-link-metrics`: Update Ground Dongle Downlink Signal Measurement requirement to mandate event-synchronized instantaneous RSSI querying upon packet arrival and synthesized Downlink SNR relative to receiver noise floor, replacing blind 1 Hz periodic sampling.

## Impact

- **Subsystems Affected**: `dashboard/` (ground station web application).
- **Files Modified**:
  - `dashboard/src/lib/link.ts`: Ingest logic in `handlePacket` for `KISS_DATA` and `0x8D` hardware command response handling.
  - `dashboard/src/lib/telemetry.ts`: Link metrics handling and persistence.
- **Hardware/Firmware Impact**: Zero changes required for payload `flight_firmware/` or Waveshare dongle GD32 firmware.
