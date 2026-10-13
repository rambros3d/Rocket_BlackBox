# bidirectional-link-metrics Specification

## Purpose
TBD - created by archiving change rocket-view-and-uv-sensor. Update Purpose after archive.
## Requirements
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

### Requirement: Periodic Uplink Signal Measurement
The ground station SHALL transmit a frame-synchronized PING command over LoRa every 5 to 10 seconds immediately after receiving a downlink telemetry packet, operating under full-duplex CSMA (`KISS_FULLDUPLEX = 1`), and the payload SHALL measure uplink RSSI and SNR on its SX1262 and report them in telemetry.

#### Scenario: Frame-synchronized background ping transmission
- **WHEN** the dashboard ingests a telemetry packet and at least 5 seconds have elapsed since the prior ping
- **THEN** `LinkController` SHALL transmit `CMD_PING` over LoRa without delaying or blocking the incoming receive pipeline.

#### Scenario: Payload uplink measurement and reporting
- **WHEN** the payload receives an uplink `CMD_PING` packet
- **THEN** it SHALL sample `s_radio.getRSSI()` and `s_radio.getSNR()`, record them into `TelemetryCollector`, and stream them in subsequent telemetry frames.

### Requirement: Bidirectional Link Statistics Presentation
The dashboard Link Statistics card SHALL display both Downlink (Ground) and Uplink (Payload) metrics with live updates and persistence across packet arrivals.

#### Scenario: Devices page link metrics display
- **WHEN** user views the Link Statistics panel on the Devices tab
- **THEN** it SHALL display separate metric rows for Downlink RSSI/SNR and Uplink RSSI/SNR without resetting to `---` upon subsequent packet ingest.

