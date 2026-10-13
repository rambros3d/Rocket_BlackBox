## Why

During live testing with the Waveshare LoRa ground dongle, two critical telemetry display issues occur:
1. **Downlink Metric Flickering**: Instantaneous SX1262 signal queries (`0x0D`) following 90-byte full telemetry packets frequently catch the post-packet silent gap (~-105 dBm) due to multi-packet USB latency, causing the dashboard to alternate erratically between active packet bursts (-75 dBm / +25 dB) and idle thermal noise floor readings (-105 dBm / 0.0 dB).
2. **Missing Uplink Metrics**: Uplink RSSI and SNR remain stuck at `--` because the rocket payload's binary `TelemetryPacket` does not carry uplink metrics over LoRa (they are only carried in `AckPacket` responses to uplink commands). The dashboard's background ping scheduler was firing after full frames (~515 ms), causing a direct mid-air collision with the rocket's 550 ms fast-frame transmission and preventing the payload from ever receiving the ping or returning an ACK.

## What Changes

- **Gated Downlink Noise-Floor Rejection**: Downlink `0x8D` RSSI responses that measure at or near the ambient noise floor (`<= -100 dBm` or `<= noiseFloor + 5 dB`) are treated as idle noise calibrations rather than valid packet bursts, preventing them from overwriting active packet RSSI and SNR in `lastDownlinkLink` and `applyLinkMetrics`.
- **Quiet-Window Fast-Frame Ping Synchronization**: Restructure `maybeBackgroundPing` in `LinkController` to trigger exclusively upon receiving a `fast-frame` (at ~737 ms). This places the ~120 ms uplink ping squarely inside the rocket's 265 ms quiet listening window (735 ms to 1000 ms), eliminating RF packet collisions and ensuring deterministic delivery of `CMD_PING`.
- **Uplink Metric Reception via ACK**: Ensure `AckPacket` replies from the payload reliably update `latest.link.uplinkRssi` and `latest.link.uplinkSnr` on the Devices page and throughout the dashboard.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `bidirectional-link-metrics`: Update Downlink Signal Measurement to gate out idle noise floor readings (`<= -100 dBm`) and update Periodic Uplink Signal Measurement to synchronize pings to the post-fast-frame quiet RX window to prevent transmission collisions.

## Impact

- **Subsystems Affected**: `dashboard/` (website telemetry interface).
- **Files Modified**:
  - `dashboard/src/lib/link.ts`: Filter out noise-floor samples from Downlink metrics; synchronize `maybeBackgroundPing` to `fast-frame` arrival events.
- **Hardware/Firmware Impact**: Zero changes required for payload `flight_firmware/` or Waveshare dongle GD32 firmware; works seamlessly with existing over-the-air packet contracts.
