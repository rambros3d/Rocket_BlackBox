## ADDED Requirements

### Requirement: Interleaved LoRa Transmission Scheduling
The payload firmware SHALL alternate LoRa transmission between a Full Telemetry Packet (`TelemetryPacket`) and a Fast Telemetry Packet (`FastTelemetryPacket`) at a combined rate of 2 Hz while maintaining SF9 modulation.

#### Scenario: Periodic alternation
- **WHEN** the transmission loop executes under SF9
- **THEN** it SHALL transmit one 88-byte Full packet at $t=0\text{ ms}$ (513 ms ToA) and one 20-byte Fast packet at $t=500\text{ ms}$ (185 ms ToA), keeping total channel occupancy below 700 ms per second.

#### Scenario: Uplink window availability
- **WHEN** transmission is inactive between packets
- **THEN** the SX1262 SHALL enter continuous receive mode (`startReceive()`) for at least 300 ms per second to listen for ground station PING and uplink commands.
