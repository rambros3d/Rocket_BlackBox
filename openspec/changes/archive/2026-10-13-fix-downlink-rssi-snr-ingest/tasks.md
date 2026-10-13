## 1. Dashboard Link Controller Refinement

- [x] 1.1 Remove periodic `0x0D` RSSI noise polling (`startRssiPolling`, `stopRssiPolling`, and `0x8D` handler) from `dashboard/src/lib/link.ts`.
- [x] 1.2 Refactor `0xF9` metadata handling in `dashboard/src/lib/link.ts` to decode signed `snr = snr_quarter_db / 4` (allowing 0.0 dB) and `rssi = rssi_dbm` (< 0 dBm).
- [x] 1.3 Update `dashboard/src/store/telemetry.ts` and `dashboard/src/lib/link.ts` to attach received `0xF9` Downlink metrics to the active telemetry frame and preserve them across frame ingest.

## 2. Validation & Build Verification

- [x] 2.1 Run dashboard TypeScript build (`npm run build` in `dashboard/`) to verify types and bundle compilation without errors.
- [x] 2.2 Rebuild static documentation HTML with `python3 docs/build_docs.py` and verify all targets.
