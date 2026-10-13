## MODIFIED Requirements

### Requirement: Ground Dongle Downlink Signal Measurement
The dashboard SHALL extract Downlink RSSI (dBm) and SNR (dB) directly from the Waveshare ground receiver's packet metadata frame `0xF9` (`HW_RESP_RX_META`) emitted immediately after each received LoRa packet, retiring blind periodic `0x0D` polling.

#### Scenario: Downlink packet metadata extraction
- **WHEN** a LoRa telemetry packet arrives through the Waveshare dongle followed by a `0xF9` metadata frame
- **THEN** `LinkController` SHALL decode the signed RSSI value (e.g. -35 dBm) and signed SNR value (`snr_quarter_db / 4`, accepting valid 0.0 dB and positive/negative values), attaching both to the active downlink telemetry frame without executing periodic noise-floor queries.
