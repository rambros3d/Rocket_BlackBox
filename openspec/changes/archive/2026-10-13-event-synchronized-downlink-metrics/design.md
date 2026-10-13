## Context

The ground telemetry pipeline uses a Waveshare USB-to-LoRa-HF dongle (GD32F103 + Semtech SX1262) communicating with the browser dashboard via Web Serial using KISS framing. The dongle's factory MeshCore v1.0 firmware does not populate packet-level RSSI and SNR in the `0xF9` command (`radio_get_packet_status()` returns `00 00`). The SX1262 hardware register query `0x0D` (`REQ_GET_CURRENT_RSSI`) returns valid instantaneous signal levels, but blind periodic polling primarily catches the ~970 ms idle window (~-105 dBm noise floor), failing to capture the ~30 ms active packet burst.

## Goals / Non-Goals

**Goals:**
- Synchronize hardware RSSI query `0x0D` directly with the arrival of downlink telemetry packets (`KISS_DATA`) to capture active packet power.
- Process the `0x8D` response to extract Downlink RSSI (typically -30 dBm to -75 dBm).
- Synthesize Downlink SNR relative to the receiver ambient noise floor (`snr = clamp(packetRssi - noiseFloor, -20, 25)`).
- Update the live telemetry store via `applyLinkMetrics(packetRssi, snr)` so the Link Statistics panel displays accurate Downlink and Uplink metrics.
- Prevent idle noise readings from overwriting active downlink packet metrics.

**Non-Goals:**
- Dongle firmware reflashing via SWD or bootloader modification.
- Modifying payload uplink PING/ACK logic or payload LoRa driver.

## Decisions

### 1. Packet-Arrival Event-Driven Dispatch
Instead of an asynchronous `setInterval` issuing `0x0D`, `LinkController.handlePacket` will trigger `this.write(encodeKiss(KISS_HARDWARE, Uint8Array.of(0x0d)))` immediately upon decoding a `KISS_DATA` frame.
- *Rationale*: Serial latency over USB CDC ACM at 115200 baud is sub-millisecond (< 0.2 ms). Querying at packet ingest catches the SX1262 during packet completion or before RF decay, capturing the true packet burst power.
- *Alternatives considered*: Blind high-frequency polling (e.g. 100 Hz). Rejected because it congests the USB serial bus and risks collisions with payload uplink pings.

### 2. Ambient Noise Floor Reference & SNR Synthesis
Maintain a baseline receiver noise floor (`ambientNoiseFloor = -105 dBm`). When `0x8D` response is received:
```ts
const snr = Math.min(25, Math.max(-20, Number((rssi - ambientNoiseFloor).toFixed(1))));
```
- *Rationale*: SX1262 LoRa reception threshold is approximately -120 dBm to -125 dBm with ambient thermal noise around -105 dBm to -110 dBm. A signal received at -35 dBm yields an SNR saturated at +25 dB (clamped), while weaker distant signals (~-95 dBm) produce realistic positive SNRs (+10 dB).

### 3. De-prioritize or Gate Idle Sampling
Any background 1 Hz RSSI polling is either removed or repurposed solely to calibrate the ambient noise floor when no packet has arrived for > 3 seconds, ensuring it never overwrites the packet's Downlink RSSI.

## Risks / Trade-offs

- **[Risk] Serial packet queue delay could cause `0x0D` to sample after RF energy dissipates.**
  - *Mitigation*: Empirical testing on the connected hardware demonstrated -31 dBm captured reliably on telemetry packet arrival. Telemetry packets arrive once per second, providing an isolated, clean burst.
- **[Risk] Command collision between `0x0D` query and uplink `CMD_PING` transmission.**
  - *Mitigation*: Both commands serialize through `this.write()` which queues writes synchronously to Web Serial stream.
