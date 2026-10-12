## ADDED Requirements

### Requirement: Fast Telemetry Packet Structure
The system SHALL define a packed binary `FastTelemetryPacket` containing 20 bytes: Magic (`'R','F'`), version, sequence, uptime, Euler orientation (roll, pitch, yaw), barometric altitude, vertical speed, and CRC16 checksum.

#### Scenario: Packet construction and verification
- **WHEN** high-rate telemetry is sampled
- **THEN** the firmware SHALL encode the `FastTelemetryPacket` with valid CCITT-FALSE CRC and a size not exceeding 20 bytes (23 bytes on-air with preamble/header).

#### Scenario: Air-time compliance
- **WHEN** the fast packet is transmitted at SF9 (125 kHz BW)
- **THEN** its Time-on-Air SHALL NOT exceed 190 ms.
