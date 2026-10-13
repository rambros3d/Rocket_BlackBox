## 1. Dashboard LinkController Event Synchronization

- [x] 1.1 In `dashboard/src/lib/link.ts`, trigger immediate `0x0D` (`REQ_GET_CURRENT_RSSI`) KISS hardware query upon decoding a `KISS_DATA` frame.
- [x] 1.2 In `dashboard/src/lib/link.ts`, handle the `0x8D` response by calculating synthesized Downlink SNR against ambient noise floor and updating `telemetry.applyLinkMetrics(rssi, snr)`.
- [x] 1.3 In `dashboard/src/lib/link.ts`, eliminate or decouple blind periodic 1 Hz RSSI polling from overwriting active packet metrics.

## 2. Telemetry Persistence & Presentation

- [x] 2.1 In `dashboard/src/lib/telemetry.ts`, verify Downlink RSSI and Downlink SNR fields retain their values across subsequent packet ingest and render accurately on the Devices page.

## 3. Verification & Build

- [x] 3.1 Run `npm run build` in `dashboard/` to verify TypeScript compilation and bundle integrity.
- [x] 3.2 Test hardware data exchange on `/dev/ttyACM0` and `/dev/ttyACM1` to confirm valid Downlink signal strength capture.
