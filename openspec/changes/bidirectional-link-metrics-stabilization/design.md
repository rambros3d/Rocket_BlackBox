## Context

Live testing revealed two synchronization issues in the ground telemetry pipeline:
1. **Downlink Metric Flickering**: Instantaneous RSSI query `0x0D` after a 90-byte full telemetry packet frequently arrives at the SX1262 3–8 ms after packet completion due to USB packet buffering. In this post-packet gap, the SX1262 has already decayed to its ambient thermal noise floor (~-105 dBm). Treating this reading as packet signal caused the UI to alternate between real signal (-75 dBm / +25 dB) and idle silence (-105 dBm / 0.0 dB).
2. **Missing Uplink Metrics**: Over LoRa, the payload only transmits uplink RSSI and SNR in `AckPacket` responses to uplink commands (`CMD_PING`). The dashboard was scheduling background pings after full frames (~515 ms). At SF9 / 125 kHz, the ~120 ms ping transmission was actively transmitting when the payload switched to transmit its scheduled fast frame at 550 ms, causing mutual packet corruption.

## Goals / Non-Goals

**Goals:**
- Eliminate Downlink RSSI and SNR flickering by filtering out post-packet idle gap noise floor samples (`<= -100 dBm`).
- Synchronize background PING commands exclusively to the payload's post-fast-frame quiet RX window (735 ms to 1000 ms).
- Receive payload `AckPacket` frames cleanly over LoRa and display live Uplink RSSI and SNR in the dashboard.

**Non-Goals:**
- Modifying payload `flight_firmware/` packet formats or binary layout.
- Reflashing the GD32 MCU on the Waveshare dongle.

## Decisions

### 1. Noise-Floor Gating on Downlink Sampling
When `0x8D` response is received in `LinkController`:
```ts
const rawRssi = (body[1] << 24) >> 24
if (rawRssi < 0) {
  if (rawRssi <= -100) {
    // Post-packet silent gap; calibrate ambient noise floor but do not overwrite packet metrics
    this.ambientNoiseFloor = rawRssi
    return
  }
  const snr = Math.min(25, Math.max(-20, Number((rawRssi - this.ambientNoiseFloor).toFixed(1))))
  this.lastDownlinkLink = { rssi: rawRssi, snr }
  t.applyLinkMetrics(rawRssi, snr)
}
```
- *Rationale*: A true LoRa packet from the rocket produces an RSSI significantly above -100 dBm when within operational range. Any reading `<= -100 dBm` indicates the `0x0D` command arrived after the SX1262 analog filter settled back into the noise floor. Gating prevents noise readings from destroying persistent packet telemetry.

### 2. Fast-Frame Tail Ping Synchronization
In `LinkController.handleBytes`:
- Remove `maybeBackgroundPing(now)` from the `ev.kind === 'frame'` handler.
- Retain and trigger `maybeBackgroundPing(now)` **only** in the `ev.kind === 'fast-frame'` handler.
- *Rationale*: The payload's radio schedule at SF9:
  - `0 ms – 513 ms`: 90B full frame TX (SX1262 transmitting)
  - `513 ms – 550 ms`: 37 ms gap (too narrow for a 120 ms ping)
  - `550 ms – 735 ms`: 20B fast frame TX (SX1262 transmitting)
  - `735 ms – 1000 ms`: **265 ms quiet listening window** (SX1262 in RX continuous)
  Triggering at ~737 ms on fast-frame arrival places the ~120 ms ping transmission between ~740 ms and ~860 ms, completely clear of payload TX activity. The payload receives the ping and has 140 ms to return its `AckPacket`.

## Risks / Trade-offs

- **[Risk] Distant rockets at link margin (e.g. -102 dBm) might be filtered out by the -100 dBm threshold.**
  - *Mitigation*: Dynamically reference the gate to `this.ambientNoiseFloor + 3 dB` (e.g. if ambient noise is -108 dBm, gate is -105 dBm). Additionally, packets carry over last-known link status so display remains stable.
- **[Risk] Missing fast-frame drops ping opportunity for that second.**
  - *Mitigation*: Telemetry streams continuously at 1 Hz; missing one fast frame simply delays the next ping by 1 second until the next quiet window.
