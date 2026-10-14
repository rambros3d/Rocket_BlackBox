## ADDED Requirements

### Requirement: Status LED Reflects LoRa Link State
The payload status LED (GPIO 45) SHALL indicate bidirectional LoRa link health using blink patterns.

#### Scenario: No LoRa link
- WHEN no valid uplink command has been received within the last 3 seconds
- THEN the LED SHALL blink at 1 Hz (500 ms ON / 500 ms OFF).

#### Scenario: LoRa link active
- WHEN a valid uplink command has been received within the last 3 seconds
- THEN the LED SHALL emit a double-flash heartbeat: two short pulses (~70 ms ON / 70 ms OFF / 70 ms ON) followed by ~800 ms OFF.

#### Scenario: Link state timing
- GIVEN the dashboard transmits periodic commands/pings
- WHEN an uplink command is received
- THEN the "connected" state SHALL be set immediately and maintained for 3 s from that time.
