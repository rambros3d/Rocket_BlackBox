## 1. Dashboard Downlink Noise-Floor Gating

- [ ] 1.1 In `dashboard/src/lib/link.ts`, gate `0x8D` RSSI responses so readings at or below the ambient noise threshold (`<= -100 dBm` or `<= this.ambientNoiseFloor + 3`) calibrate the noise floor without overwriting active packet RSSI and SNR in `lastDownlinkLink` or `telemetry.applyLinkMetrics`.

## 2. Collision-Free Quiet-Window Uplink Ping Synchronization

- [ ] 2.1 In `dashboard/src/lib/link.ts`, remove `maybeBackgroundPing` from the `ev.kind === 'frame'` handler.
- [ ] 2.2 In `dashboard/src/lib/link.ts`, ensure `maybeBackgroundPing` fires exclusively on `ev.kind === 'fast-frame'` packet arrivals, targeting the payload's 265 ms quiet listening window.

## 3. Verification & Build

- [ ] 3.1 Run `npm run build` in `dashboard/` to verify TypeScript compilation and bundle integrity.
- [ ] 3.2 Test hardware data exchange on `/dev/ttyACM0` and `/dev/ttyACM1` to confirm stable Downlink RSSI/SNR and receipt of live Uplink RSSI/SNR via `AckPacket`.
