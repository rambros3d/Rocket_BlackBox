# ultraviolet-telemetry Specification

## Purpose
TBD - created by archiving change rocket-view-and-uv-sensor. Update Purpose after archive.
## Requirements
### Requirement: End-to-End UV Index Telemetry
The system SHALL sample Ultraviolet (UVS) counts from the onboard LTR-390UV sensor, compute the standardized UV Index (UVI), transmit it across flight telemetry channels (USB Serial JSON and binary LoRa packet), and display it on the dashboard.

#### Scenario: Firmware UV measurement and calculation
- **WHEN** `EnvSensorsManager::readAllSensors` executes on the flight payload with LTR-390 detected
- **THEN** it SHALL switch to UVS mode, acquire raw UVS counts, compute UV Index using formula `uvi = uvs / 383.33f`, and store the result in the telemetry frame.

#### Scenario: USB Serial JSON telemetry reporting
- **WHEN** the payload transmits a telemetry JSON frame over USB Serial
- **THEN** the JSON `env` object SHALL include the field `"uv": <float>` representing the measured UV Index.

#### Scenario: LoRa binary packet encoding
- **WHEN** the payload encodes a binary `TelemetryPacket` for transmission
- **THEN** it SHALL pack `uint16_t uviX100` representing UV Index scaled by 100 with CRC integrity check.

### Requirement: Dashboard UV Index Presentation
The dashboard SHALL display live UV Index metrics across environmental panels and historical charts, with standard WHO risk color coding.

#### Scenario: Snapshot dashboard UV card
- **WHEN** telemetry is received on the Snapshot dashboard
- **THEN** the Environmental Snapshot section SHALL include a UV Index card displaying the current UV Index and risk level badge (0-2 Low, 3-5 Moderate, 6-7 High, 8-10 Very High, 11+ Extreme).

#### Scenario: Overview dashboard UV sparkline
- **WHEN** telemetry is received on the Overview dashboard
- **THEN** the environmental metrics row SHALL display a UV Index spark card showing the current value and recent trend.

#### Scenario: Charts tab UV history
- **WHEN** user views the Charts tab
- **THEN** an Environmental UV Index chart SHALL plot historical UV Index values over time.

