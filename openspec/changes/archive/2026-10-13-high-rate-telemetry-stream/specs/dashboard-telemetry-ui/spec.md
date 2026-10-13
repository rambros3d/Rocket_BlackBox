## ADDED Requirements

### Requirement: Fast Partial Frame Ingestion
The dashboard protocol parser and telemetry store SHALL decode `FastTelemetryPacket` (magic `'R','F'`) and merge high-rate IMU and barometric altitude values into the live telemetry state without clearing cached 1 Hz environmental or GPS values.

#### Scenario: Smooth high-frequency attitude update
- **WHEN** a fast telemetry packet is ingested by the dashboard
- **THEN** the orientation (BNO055 roll, pitch, yaw) and barometric altitude/vertical speed SHALL update immediately while preserving all other environmental cards and GPS coordinates.
