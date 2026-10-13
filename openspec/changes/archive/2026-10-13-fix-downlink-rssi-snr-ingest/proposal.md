## Why

During live over-the-air testing with the Waveshare USB LoRa dongle, Downlink RSSI and SNR fail to display accurately or display as `--`. This occurs because the dashboard performs blind periodic polling using hardware command `0x0D`, which measures instantaneous channel noise floor (~ -105 dBm) instead of packet signal strength and provides no SNR. Furthermore, the dongle's real per-packet metadata (`0xF9`, carrying true packet RSSI and SNR) is improperly filtered in `link.ts` when SNR is 0.0 dB.

Transitioning the dashboard to capture packet-paired `0xF9` metadata and eliminating blind `0x0D` noise polling restores true live Downlink RSSI and SNR telemetry without requiring any dongle firmware reflashing.

## What Changes

- Modify `dashboard/src/lib/link.ts` to retire periodic background `0x0D` RSSI polling in LoRa mode.
- In `dashboard/src/lib/link.ts`, accurately decode `0xF9` (`HW_RESP_RX_META`) packet metadata (`snr = snr_quarter_db / 4`, `rssi = rssi_dbm`), accepting valid non-negative SNR values (e.g. `0.0 dB` or positive SNR).
- Pair incoming `KISS_DATA` telemetry packets with immediately adjacent `0xF9` hardware metadata frames, ingesting telemetry frames with their measured Downlink RSSI and SNR attached.

## Capabilities

### Modified Capabilities
- `bidirectional-link-metrics`: Update Downlink signal measurement requirement to decode packet-paired `0xF9` metadata instead of periodic `0x0D` polling, ensuring true packet RSSI and SNR are recorded.

## Impact

- Subsystem affected: `dashboard` (`dashboard/src/lib/link.ts`, `dashboard/src/store/telemetry.ts`).
- No firmware or hardware changes required.
