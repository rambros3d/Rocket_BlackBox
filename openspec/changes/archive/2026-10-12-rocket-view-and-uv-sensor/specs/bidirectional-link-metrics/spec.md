## ADDED Requirements

### Requirement: Ground Dongle Downlink Signal Measurement
The dashboard SHALL query the Waveshare ground receiver for instantaneous SX1262 signal strength upon telemetry frame arrival (~1 Hz) using hardware command `0x0D` and compute Downlink RSSI (dBm) and SNR (dB).

#### Scenario: Downlink RSSI sampling on packet arrival
- **WHEN** a LoRa telemetry packet arrives through the Waveshare dongle
- **THEN** `LinkController` SHALL issue hardware command `0x0D`, decode the signed RSSI value (e.g. -35 dBm), calculate SNR relative to ambient noise floor, and update Downlink link metrics.

### Requirement: Periodic Uplink Signal Measurement
The ground station SHALL transmit a periodic PING command to the payload every 5 seconds over LoRa, and the payload SHALL measure the uplink RSSI and SNR on its SX1262 and report the metrics in its response.

#### Scenario: Periodic 5-second PING exchange
- **WHEN** the dashboard is connected in LoRa mode and 5 seconds elapse
- **THEN** it SHALL send an uplink `CMD_PING` packet to the payload.

#### Scenario: Payload uplink measurement and reporting
- **WHEN** the payload receives an uplink `CMD_PING` packet
- **THEN** it SHALL sample `s_radio.getRSSI()` and `s_radio.getSNR()`, return an acknowledgement packet carrying the measured uplink signal metrics, and the dashboard SHALL display them as Uplink RSSI and SNR.

### Requirement: Bidirectional Link Statistics Presentation
The dashboard Link Statistics card SHALL display both Downlink (Ground) and Uplink (Payload) metrics with live updates and persistence across packet arrivals.

#### Scenario: Devices page link metrics display
- **WHEN** user views the Link Statistics panel on the Devices tab
- **THEN** it SHALL display separate metric rows for Downlink RSSI/SNR and Uplink RSSI/SNR without resetting to `---` upon subsequent packet ingest.
