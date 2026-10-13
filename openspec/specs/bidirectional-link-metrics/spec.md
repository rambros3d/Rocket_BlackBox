# bidirectional-link-metrics Specification

## Purpose
TBD - created by archiving change rocket-view-and-uv-sensor. Update Purpose after archive.
## Requirements
### Requirement: Ground Dongle Downlink Signal Measurement
The dashboard SHALL actively query the Waveshare ground receiver for instantaneous SX1262 signal strength at 1 Hz using KISS hardware command `0x0D` (`REQ_GET_CURRENT_RSSI`) and parse response `0x8D` to maintain live Downlink RSSI (dBm).

#### Scenario: Downlink RSSI periodic sampling
- **WHEN** the dashboard is connected to the Waveshare LoRa receiver
- **THEN** `LinkController` SHALL issue KISS command `0x0D` at approximately 1 Hz, decode the signed RSSI value (e.g. -107 dBm), and update the live telemetry state via `applyRssi()`.

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

