## MODIFIED Requirements

### Requirement: Ground Dongle Downlink Signal Measurement
The dashboard SHALL query the Waveshare ground receiver for instantaneous SX1262 signal strength using KISS hardware command `0x0D` (`REQ_GET_CURRENT_RSSI`) immediately upon ingesting a downlink telemetry packet (`KISS_DATA`), parse response `0x8D` to capture active packet Downlink RSSI (dBm), derive Downlink SNR relative to receiver ambient noise floor, and gate out post-packet idle noise floor readings (`<= -100 dBm`) from clobbering valid packet measurements.

#### Scenario: Event-synchronized Downlink RSSI sampling with noise gating
- **WHEN** `LinkController` ingests an incoming downlink telemetry packet (`KISS_DATA`)
- **THEN** it SHALL immediately dispatch KISS command `0x0D` to the ground receiver, and if the response `0x8D` RSSI exceeds the noise threshold (`> -100 dBm`), update live downlink metrics without clobbering by idle silent-gap noise.

#### Scenario: Rejection of post-packet idle gap noise floor
- **WHEN** the ground receiver returns an instantaneous RSSI at or below the noise threshold (`<= -100 dBm` or `<= noiseFloor + 5 dB`)
- **THEN** the dashboard SHALL retain the last valid packet Downlink RSSI and SNR instead of overwriting live telemetry with the idle noise floor (-105 dBm / 0.0 dB).

#### Scenario: Downlink SNR derivation from receiver noise floor
- **WHEN** the dashboard receives an active packet `0x8D` RSSI response
- **THEN** it SHALL synthesize Downlink SNR by comparing the sampled packet RSSI against the ambient noise floor (default -105 dBm) clamped between -20 dB and +25 dB, and record both Downlink RSSI and SNR into the telemetry store.

#### Scenario: Rejection of invalid non-negative RSSI
- **WHEN** the ground receiver returns an uncalibrated non-negative RSSI (e.g., 0 dBm or positive)
- **THEN** the dashboard SHALL discard the invalid reading and retain the last valid RSSI or display `--`.

### Requirement: Periodic Uplink Signal Measurement
The ground station SHALL transmit frame-synchronized `CMD_PING` commands over LoRa every 5 to 10 seconds specifically synchronized to `fast-frame` arrivals landing within the payload's post-fast-frame quiet listening window, and parse incoming `AckPacket` responses to update live Uplink RSSI and SNR.

#### Scenario: Quiet-window background ping transmission
- **WHEN** the dashboard ingests a `fast-frame` packet and at least 5 seconds have elapsed since the prior ping
- **THEN** `LinkController` SHALL transmit `CMD_PING` over LoRa into the payload's quiet RX window, avoiding collisions with subsequent fast transmissions.

#### Scenario: Avoidance of full-frame ping collision
- **WHEN** the dashboard ingests a 90-byte full telemetry frame
- **THEN** it SHALL NOT trigger a background ping, reserving the air for the payload's subsequent 550 ms fast-frame slot.

#### Scenario: Payload uplink measurement and reporting via ACK
- **WHEN** the payload receives an uplink `CMD_PING` packet
- **THEN** it SHALL return an `AckPacket` reporting measured uplink RSSI and SNR, which the dashboard parses to update live Uplink metrics.
