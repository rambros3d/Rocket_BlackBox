## Why

The ground-station telemetry dashboard currently displays `--` / `n/a` for downlink and uplink signal quality metrics (RSSI and SNR). While the connected Waveshare SX1262 USB dongle receives packets reliably, its GD32F103 MCU cannot be reflashed over USB and emits invalid zeroes (`0xF9 00 00`) in its per-packet metadata. However, the dongle's continuous RSSI query (`0x0D` / `0x8D`) and the payload's SX1262 uplink signal measurement work properly. By polling the dongle's continuous RSSI and establishing low-rate, frame-synchronized background pings from the dashboard, we can restore live bidirectional signal quality metrics without requiring hardware probe reflashing.

## What Changes

- **Continuous Downlink RSSI Polling**: `dashboard/src/lib/link.ts` actively polls the Waveshare dongle with KISS command `0x0D` (`REQ_GET_CURRENT_RSSI`) at 1 Hz, parsing the `0x8D` response and passing the measurement into the telemetry store.
- **Downlink SNR Display**: `dashboard/src/pages/DevicesPage.tsx` and link stats display `--` for Downlink SNR when connected to the custom KISS receiver until the dongle MCU is reflashed with valid packet-status SPI readouts.
- **Frame-Synchronized Background Ping**: `dashboard/src/lib/link.ts` schedules a background PING transmission over LoRa every 5–10 seconds immediately after ingesting a downlink telemetry packet, operating in full-duplex CSMA (`KISS_FULLDUPLEX = 1`).
- **Uplink Metric Ingestion**: `dashboard/src/lib/protocol.ts` and `dashboard/src/lib/link.ts` ingest the payload's measured uplink RSSI and SNR from both LoRa ACK frames and periodic telemetry status packets, updating the live Devices view.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `bidirectional-link-metrics`: Active polling of continuous RSSI via KISS command `0x0D` and frame-synchronized 5–10 s periodic background pings for uplink telemetry refreshes.
- `dashboard-telemetry-ui`: Live display of polled Downlink RSSI and payload-reported Uplink RSSI/SNR, with unmeasured Downlink SNR formatted as `--`.

## Impact

- **Website / Dashboard Subsystem**: `dashboard/src/lib/link.ts`, `dashboard/src/lib/protocol.ts`, `dashboard/src/pages/DevicesPage.tsx`, `dashboard/src/store/telemetry.ts`.
- **Modem Protocol**: Uses standard KISS `REQ_GET_CURRENT_RSSI` (0x0D) and existing binary `CommandPacket` (0x52, 0x43, ...) and `AckPacket` (0x52, 0x41, ...).
- **Firmware Subsystem**: No breaking wire format changes; payload firmware already supports ping command decoding and uplink signal measurement reporting.
