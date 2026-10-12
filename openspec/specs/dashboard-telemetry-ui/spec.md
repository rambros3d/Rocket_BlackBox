# dashboard-telemetry-ui Specification

## Purpose
TBD - created by archiving change link-metrics-and-retire-bme680. Update Purpose after archive.
## Requirements
### Requirement: Display Live RSSI in Link Statistics
The dashboard Devices tab SHALL display the Received Signal Strength Indication (RSSI) in decibel-milliwatts (dBm) within the Link Statistics panel whenever a valid signal metric exists.

#### Scenario: Valid RSSI is received from the LoRa receiver
- **WHEN** the ground receiver dongle captures a telemetry frame with a valid negative RSSI value
- **THEN** the Devices tab Link Statistics panel displays the RSSI value formatted with unit (e.g., `-65 dBm`).

#### Scenario: No RSSI available or in USB mode
- **WHEN** the dashboard is connected via direct payload USB CDC or no packet has been received yet
- **THEN** the Devices tab Link Statistics panel displays `--` for the RSSI metric.

### Requirement: Display Live SNR in Link Statistics
The dashboard Devices tab SHALL display the Signal-to-Noise Ratio (SNR) in decibels (dB) with one decimal place within the Link Statistics panel whenever a valid signal metric exists.

#### Scenario: Valid SNR is received from the LoRa receiver
- **WHEN** the ground receiver dongle captures a telemetry frame with a valid SNR value
- **THEN** the Devices tab Link Statistics panel displays the SNR value formatted with sign and unit (e.g., `+10.8 dB` or `-2.5 dB`).

#### Scenario: No SNR available or in USB mode
- **WHEN** the dashboard is connected via direct payload USB CDC or no packet has been received yet
- **THEN** the Devices tab Link Statistics panel displays `--` for the SNR metric.

### Requirement: Complete Removal of BME680 Sensor from UI
The dashboard SHALL NOT list the Bosch BME680 in the Subsystems status table or rely on it in demo telemetry generation.

#### Scenario: Subsystems table rendering
- **WHEN** an operator views the Subsystems table on the Devices tab
- **THEN** only active flight payload sensors (MS5607, SCD40, SGP41, TSL2591, LTR-390, BNO055, BE-166 GPS, Flash, SDMMC) are displayed, and no BME680 row is present.

#### Scenario: Demo telemetry source attribution
- **WHEN** the dashboard runs in demo simulation mode
- **THEN** temperature and humidity sources are attributed to SCD40 (`tSrc: 'SCD40'`, `hSrc: 'SCD40'`), barometric pressure is attributed to MS5607 (`pSrc: 'MS5607'`), and `FLAG.BME680` is not asserted.

