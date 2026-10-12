## Context

The Rocket BlackBox Ground Station Dashboard is a client-side Vite/React/TypeScript application that interacts with telemetry streams via native Web Serial. The underlying modem parser in `dashboard/src/lib/link.ts` decodes incoming KISS frames and signal reports (`0xF9`), storing `rssi` and `snr` into the Zustand store's `latest.link`. However, `DevicesPage.tsx` does not render these values in the "Link Statistics" panel. Concurrently, the Bosch BME680 sensor is listed in the UI subsystems table despite having been physically removed from active service on the PCB (isolated via R26 desoldering), causing confusion and persistent offline warnings.

## Goals / Non-Goals

**Goals:**
- Expose real-time RSSI (dBm) and SNR (dB) in `DevicesPage.tsx` within the Link Statistics panel.
- Format signal values cleanly with sign, unit, and fallback (`--`) when null or when operating over USB CDC.
- Completely remove `BME680` from `SUBSYSTEMS` in `DevicesPage.tsx`.
- Update `demo.ts` to simulate environmental sources as `SCD40` (T/H) and `MS5607` (P), completely dropping `FLAG.BME680`.
- Maintain binary backwards compatibility for decoding historical/stored logs in `protocol.ts` and `types.ts`.

**Non-Goals:**
- Modifying payload microcontroller firmware in `flight_firmware/` or `test_firmware/`.
- Changing the KISS modem firmware in `meshcore-waveshare-usb-lora/`.
- Altering the wire layout of binary telemetry frames.

## Decisions

### 1. Rendering RSSI & SNR via `<KV>` in Link Statistics
- **Decision**: Add two `<KV>` rows to `Link Statistics` in `DevicesPage.tsx`:
  - `RSSI`: `${latest?.link.rssi !== null && latest?.link.rssi !== undefined ? `${latest.link.rssi} dBm` : '--'}`
  - `SNR`: `${latest?.link.snr !== null && latest?.link.snr !== undefined ? `${latest.link.snr > 0 ? '+' : ''}${latest.link.snr.toFixed(1)} dB` : '--'}`
- **Rationale**: Matches the existing dashboard typography and primitive design system, avoiding layout shifts and maintaining consistency with other numeric indicators.
- **Alternatives Considered**: Gauge/progress-bar widgets; rejected to maintain clean, dense information density consistent with the rest of the Devices panel.

### 2. Subsystems Table Cleanup vs Wire Compatibility
- **Decision**: Remove `{ flag: FLAG.BME680, ... }` from `SUBSYSTEMS` in `DevicesPage.tsx`, but preserve `FLAG.BME680 = 1 << 1` in `types.ts` as an unused/deprecated bit definition so bit offsets 2..12 remain intact.
- **Rationale**: The bit positions in `Frame.flags` are fixed by the packed C struct `TelemetryPacket::flags`. Keeping the bitmask constant ensures flags for SCD40, SGP41, LTR390, BNO055, etc. are not corrupted.

### 3. Demo Simulator Source Remapping
- **Decision**: In `demo.ts`, replace `tSrc: 'BME680', hSrc: 'BME680', pSrc: 'BME680'` with `tSrc: 'SCD40', hSrc: 'SCD40', pSrc: 'MS5607'`.
- **Rationale**: This precisely mirrors the physical hardware configuration and flight firmware behavior.

## Risks / Trade-offs

- **[Risk] Modem zero metadata bug (`\xf9\x00\x00`)**: Stock dongle firmware can emit `0 dBm, 0 dB`.
  → **Mitigation**: `link.ts` line 402 enforces `if (rssi < 0) t.applyLinkMetrics(rssi, snr)`, ensuring invalid zero signals are not ingested and the UI displays `--` until a valid negative RSSI arrives.
