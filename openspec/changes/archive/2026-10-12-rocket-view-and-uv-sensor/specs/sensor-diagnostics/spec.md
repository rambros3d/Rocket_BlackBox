## MODIFIED Requirements

### Requirement: Optical Sensor Diagnostics (LTR-390 and TSL2591)
The system SHALL verify the LTR-390UV (ambient light and UV index) and TSL25911FN (wide dynamic range lux) sensors on Bus 1, verifying part IDs and reporting optical measurements including active UV index sampling during periodic polling.

#### Scenario: LTR-390 ID and UV/ALS reading
- **WHEN** the LTR-390 diagnostic executes
- **THEN** it SHALL verify Part ID 0x0B and output raw ALS counts, UV index counts, and computed ambient lux.

#### Scenario: Periodic flight polling of UV index
- **WHEN** periodic telemetry collection executes
- **THEN** the system SHALL acquire both ambient light (ALS) and ultraviolet (UVS) readings from LTR-390, computing both backup lux and active UV Index.

#### Scenario: TSL2591 ID and dual-channel lux reading
- **WHEN** the TSL2591 diagnostic executes
- **THEN** it SHALL verify Device ID 0x50 and output Full Spectrum (CH0) and Infrared (CH1) raw counts and computed lux.
