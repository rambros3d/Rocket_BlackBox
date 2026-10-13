## MODIFIED Requirements

### Requirement: Ground Dongle Downlink Signal Measurement
The dashboard SHALL query the Waveshare ground receiver for instantaneous SX1262 signal strength using KISS hardware command `0x0D` (`REQ_GET_CURRENT_RSSI`) immediately upon ingesting a downlink telemetry packet (`KISS_DATA`), parse response `0x8D` to capture active packet Downlink RSSI (dBm), and derive Downlink SNR relative to receiver ambient noise floor.

#### Scenario: Event-synchronized Downlink RSSI sampling
- **WHEN** `LinkController` ingests an incoming downlink telemetry packet (`KISS_DATA`)
- **THEN** it SHALL immediately dispatch KISS command `0x0D` to the ground receiver, decode the signed RSSI value (e.g. -35 dBm) from response `0x8D`, and update live downlink metrics without clobbering by idle silent-gap noise.

#### Scenario: Downlink SNR derivation from receiver noise floor
- **WHEN** the dashboard receives the event-synchronized `0x8D` RSSI response
- **THEN** it SHALL synthesize Downlink SNR by comparing the sampled packet RSSI against the ambient noise floor (default -105 dBm) clamped between -20 dB and +25 dB, and record both Downlink RSSI and SNR into the telemetry store.

#### Scenario: Rejection of invalid non-negative RSSI
- **WHEN** the ground receiver returns an uncalibrated non-negative RSSI (e.g., 0 dBm or positive)
- **THEN** the dashboard SHALL discard the invalid reading and retain the last valid RSSI or display `--`.
