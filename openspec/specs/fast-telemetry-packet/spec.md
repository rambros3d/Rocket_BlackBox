# Fast Telemetry Packet Specification

## Purpose
Defines the packed binary framing, checksum verification, and air-time constraints for high-rate partial avionics telemetry updates.

## Requirements

### Requirement: Fast Telemetry Packet Structure
The system SHALL define a packed binary `FastTelemetryPacket` containing 20 bytes: Magic (`'R','F'`), version, sequence, 16-bit wrapping uptime seconds, Euler orientation (roll, pitch, yaw), signed 24-bit barometric altitude centimetres, vertical speed, and CRC16 checksum.

#### Scenario: Packet construction and verification
- **WHEN** high-rate telemetry is sampled
- **THEN** the firmware SHALL encode the `FastTelemetryPacket` with valid CCITT-FALSE CRC and a size not exceeding 20 bytes (23 payload bytes on air including the 3-byte application prefix).

#### Scenario: Air-time compliance
- **WHEN** the fast packet is transmitted at SF9 (125 kHz BW)
- **THEN** its Time-on-Air SHALL NOT exceed 190 ms.
