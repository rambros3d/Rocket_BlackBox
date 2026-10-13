## Context

The ground station telemetry dashboard uses Web Serial to communicate with a Waveshare USB-to-LoRa-HF dongle running custom KISS modem firmware. While packet reception and demodulation operate reliably over LoRa at 866 MHz (SF9, BW 125 kHz), the dongle's GD32F103 MCU cannot be reflashed over USB because `BOOT0` and the CH343 modem-control lines (`DTR`/`RTS`) are physically unconnected. The currently flashed firmware emits invalid `0xF9 00 00` bytes for packet status.

Fortunately, the SX1262's continuous RSSI query (`0x0D` / `0x8D`) works and reports accurate ambient/signal power (e.g., -107 dBm), and the rocket payload's SX1262 measures true uplink signal quality (-48 dBm RSSI, +10.5 dB SNR) upon receiving ground commands.

## Goals / Non-Goals

**Goals:**
- Provide reliable, real-time Downlink RSSI on the dashboard Devices tab by polling KISS command `0x0D` (`REQ_GET_CURRENT_RSSI`) at ~1 Hz.
- Implement an automatic, frame-synchronized background PING mechanism (every 5–10 s) that triggers uplink measurements without disturbing the incoming high-rate receive stream.
- Seamlessly ingest and render payload-measured Uplink RSSI and SNR from telemetry and ACK frames.
- Treat Downlink SNR as unmeasured (`--`) without confusing zero readings or dashboard crashes.

**Non-Goals:**
- Hardware SWD flashing of the GD32F103 MCU.
- Altering the on-air packet binary structure or RadioLib RF parameters.

## Decisions

### 1. Active 1 Hz Polling of KISS Command `0x0D`
- *Decision*: In `LinkController`, maintain a 1 Hz polling loop that sends `encodeKiss(KISS_HARDWARE, Uint8Array.of(0x0D))` while connected in LoRa mode.
- *Rationale*: The dongle immediately answers with `0x8D <rssi>`, which `LinkController` already parses and feeds to `applyRssi(rssi)`.
- *Alternative Considered*: Waiting for per-packet metadata `0xF9`. Rejected because the currently flashed dongle image always returns zeroes.

### 2. Frame-Synchronized Background Ping
- *Decision*: When a valid downlink telemetry frame arrives, if at least 7 seconds have elapsed since the last ping and no command is in flight, fire a non-blocking `CMD_PING` packet over LoRa with `KISS_FULLDUPLEX = 1`.
- *Rationale*: Synchronizing to packet arrivals ensures the ping is dispatched during the inter-packet gap when the payload SX1262 is in continuous receive mode, avoiding on-air collisions. Full-duplex mode bypasses CSMA CAD delays.
- *Alternative Considered*: Random timer pinging. Rejected because transmissions often collide with the payload's 513 ms full telemetry airtime.

### 3. Displaying Downlink SNR as `--`
- *Decision*: In `dashboard/src/pages/DevicesPage.tsx`, if downlink SNR is 0 or unmeasured, format as `--`.
- *Rationale*: Prevents false "0.0 dB" readings which mislead operators into thinking the signal is at the demodulation threshold.

## Risks / Trade-offs

- **[Risk] Serial Command Contention**: Polling `0x0D` while sending a manual or background ping could interleave KISS bytes.
  - *Mitigation*: Ensure `LinkController.write()` is synchronized or sequentialized, and `0x0D` queries use existing non-blocking hardware request handlers.
- **[Risk] Background Ping Colliding with Fast Telemetry**: Fast packets arrive ~550 ms after full packets.
  - *Mitigation*: The 8-byte ping takes ~125 ms at SF9; dispatching immediately upon the arrival of the fast packet or within the 400 ms quiet window guarantees arrival during the payload's 300+ ms receive window.
