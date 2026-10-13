## MODIFIED Requirements

### Requirement: Display Live SNR in Link Statistics
The dashboard Devices tab SHALL display the Signal-to-Noise Ratio (SNR) in decibels (dB) with one decimal place within the Link Statistics panel whenever a valid signal metric exists, and display `--` when unmeasured or invalid.

#### Scenario: Valid SNR is received from the LoRa receiver
- **WHEN** the ground receiver dongle captures a telemetry frame with a valid non-zero SNR value
- **THEN** the Devices tab Link Statistics panel displays the SNR value formatted with sign and unit (e.g., `+10.8 dB` or `-2.5 dB`).

#### Scenario: No SNR available, unmeasured, or in USB mode
- **WHEN** the dashboard is connected via direct payload USB CDC or the receiver emits unmeasured metadata (such as 0.0 dB from uncalibrated firmware)
- **THEN** the Devices tab Link Statistics panel displays `--` for the Downlink SNR metric.
