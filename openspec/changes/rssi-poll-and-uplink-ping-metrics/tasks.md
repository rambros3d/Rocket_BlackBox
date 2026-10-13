## 1. Dashboard Continuous RSSI Polling

- [x] 1.1 In `dashboard/src/lib/link.ts`, implement a 1 Hz polling loop that transmits KISS command `0x0D` (`REQ_GET_CURRENT_RSSI`) while connected in `lora` mode.
- [x] 1.2 Verify handling of response `0x8D` in `LinkController` to apply signed RSSI (e.g. -107 dBm) to `useTelemetry.getState().applyRssi(rssi)`.
- [x] 1.3 Ensure `0x8D` polling is paused while manual commands or pings are actively in flight to avoid serial race conditions.

## 2. Frame-Synchronized Background Ping & Uplink Reporting

- [x] 2.1 In `dashboard/src/lib/link.ts`, implement a frame-synchronized background ping timer that triggers a `CMD_PING` packet every 7 seconds upon receiving a downlink telemetry packet.
- [x] 2.2 Verify that `KISS_FULLDUPLEX = 1`, `KISS_TXDELAY = 0`, and `KISS_PERSISTENCE = 255` remain configured to guarantee immediate non-blocking transmission of background pings.
- [x] 2.3 Verify ingestion of payload-reported `uplink_rssi` and `uplink_snr` from both ACK frames and USB/LoRa telemetry updates.

## 3. UI Presentation & Formatting

- [x] 3.1 Update `dashboard/src/pages/DevicesPage.tsx` to display Downlink RSSI as `--` if unmeasured or invalid, and Downlink SNR cleanly as `--` when connected to the custom KISS dongle.
- [x] 3.2 Ensure Uplink RSSI and SNR render with proper units (`dBm` and `dB`) and update live when pings complete.

## 4. Verification & Validation

- [x] 4.1 Run TypeScript typecheck and build in `dashboard/` (`npm run typecheck && npm run build`).
- [x] 4.2 Validate OpenSpec change compliance (`openspec validate rssi-poll-and-uplink-ping-metrics --strict --no-interactive`).
