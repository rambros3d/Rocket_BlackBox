## Context

The ground telemetry receiver is a Waveshare USB-TO-LoRa-HF module running MeshCore KISS TNC firmware. When a packet is received, the dongle transmits two back-to-back KISS messages to the host:
1. `KISS_CMD_DATA` (0x00): The raw radio packet payload.
2. `KISS_CMD_SETHARDWARE` with subcode `0xF9` (`HW_RESP_RX_META`): Two bytes carrying the measured packet SNR (signed 1/4 dB) and packet RSSI (signed dBm).

In the current dashboard implementation (`dashboard/src/lib/link.ts`), the telemetry frame is ingested immediately when `KISS_DATA` arrives with `link.rssi = null` and `link.snr = null`. When `0xF9` arrives, a guard condition `if (rssi < 0 && snr !== 0)` discards metrics when SNR is 0.0 dB. Additionally, `link.ts` runs a periodic 1-second `0x0D` polling loop that queries instantaneous receiver channel power. Because packets are short (~30ms), `0x0D` almost always measures the idle channel noise floor (~ -105 dBm) and calls `applyRssi`, constantly clobbering true packet RSSI and leaving SNR empty.

## Goals / Non-Goals

**Goals:**
- Eliminate periodic background `0x0D` polling that overwrites packet metrics with idle noise floor readings.
- Properly decode `0xF9` packet metadata in `link.ts`, recognizing negative RSSI (< 0 dBm) and any valid signed SNR value (`snr_q / 4`, including 0.0 dB and positive/negative values).
- Pair `0xF9` metadata directly with the incoming frame, or immediately update `latest.link` with both `rssi` and `snr` upon receipt of `0xF9`.
- Ensure Devices page and dashboard cards display true Downlink RSSI and SNR during live over-the-air reception.

**Non-Goals:**
- Modifying the Waveshare dongle C firmware (the firmware already sends `0xF9`).
- Modifying the rocket flight firmware (uplink metrics are already functional).

## Decisions

### 1. Remove `startRssiPolling()` and `0x0D` polling
- **Choice**: Remove the `rssiPollTimer` in `link.ts` that issues `0x0D` every 1000ms.
- **Rationale**: Packet RSSI and SNR should reflect actual received RF packets, not periodic ambient noise floor queries. Polling `0x0D` introduced serial bus contention and clobbered the packet metrics store.

### 2. Correct `0xF9` Metadata Parsing and Guard
- **Choice**: In `link.ts`:
  ```typescript
  } else if (body[0] === 0xf9 && body.length >= 3) {
    const snr = ((body[1] << 24) >> 24) / 4
    const rssi = (body[2] << 24) >> 24
    if (rssi < 0) {
      t.applyLinkMetrics(rssi, snr)
    }
  }
  ```
- **Rationale**: `body[1]` is `snr_quarter_db` (signed int8) and `body[2]` is `rssi_dbm` (signed int8). A valid LoRa signal can have an SNR of 0.0 dB (signal equal to noise power) or positive (signal stronger than noise) or negative (sub-noise despreading). Filtering out `snr === 0` was erroneous.

### 3. Store Persistence & Immediate Application
- **Choice**: Call `t.applyLinkMetrics(rssi, snr)` immediately when `0xF9` is processed, and ensure `ingest` in `telemetry.ts` retains `latest.link` metrics when successive frames arrive.

## Risks / Trade-offs

- **[Risk]**: If a packet is received but `0xF9` is dropped over UART.
  - **Mitigation**: `telemetry.ts` preserves `prevLink` metrics across incoming frames, so brief dropped meta frames do not reset the display to `--`.
