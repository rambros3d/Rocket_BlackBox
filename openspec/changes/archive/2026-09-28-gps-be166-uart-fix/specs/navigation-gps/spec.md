## MODIFIED Requirements

### Requirement: GPS UART Communication & Baud Probing
The system SHALL establish UART communication with the BE-166 GPS receiver using MCU RX on GPIO 42 (connected to BE-166 TXD) and MCU TX on GPIO 41 (connected to BE-166 RXD), with automatic multi-baud rate validation (testing 9600, 115200, 38400, and 57600 baud).

#### Scenario: Valid NMEA stream detection
- **WHEN** UART communication is opened with the GPS receiver
- **THEN** the system SHALL detect and count incoming NMEA characters without framing or parity errors.

## ADDED Requirements

### Requirement: Interactive Raw NMEA Stream Monitor
The system SHALL provide an interactive serial console monitor command (`[g]`) that displays raw NMEA sentences streamed directly from the BE-166 receiver to allow live signal diagnosis.

#### Scenario: Raw NMEA streaming
- **WHEN** the user triggers raw NMEA monitoring from the serial diagnostic menu
- **THEN** incoming ASCII bytes from the GPS UART SHALL be forwarded directly to the serial console until stopped by user input.
