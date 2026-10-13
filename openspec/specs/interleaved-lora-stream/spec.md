# Interleaved LoRa Stream Specification

## Purpose
Defines the interleaved flight firmware scheduling that alternates between full and fast telemetry packets over LoRa while guaranteeing uplink receive windows.

## Requirements

### Requirement: Interleaved LoRa Transmission Scheduling
The payload firmware SHALL alternate LoRa transmission between a Full Telemetry Packet (`TelemetryPacket`) and a Fast Telemetry Packet (`FastTelemetryPacket`) at a combined rate of 2 Hz while maintaining SF9 modulation.

#### Scenario: Periodic alternation
- **WHEN** the transmission loop executes under SF9
- **THEN** it SHALL transmit one 90-byte Full packet at $t=0\text{ ms}$ (about 513 ms ToA including the 3-byte air prefix) and one 20-byte Fast packet no earlier than $t=550\text{ ms}$ (about 185 ms ToA), keeping nominal channel occupancy below 700 ms per second.

#### Scenario: Uplink window availability
- **WHEN** transmission is inactive between packets
- **THEN** the SX1262 SHALL enter continuous receive mode (`startReceive()`) for at least 300 ms per second to listen for ground station PING and uplink commands.
