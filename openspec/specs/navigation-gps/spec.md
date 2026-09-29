# Navigation GPS Specification

## Purpose
Covers BE-166 GPS receiver UART stream acquisition, standard NMEA sentence decoding, constellation tracking, position telemetry, 1PPS time synchronization, and interactive stream monitoring.
## Requirements
### Requirement: GPS UART Communication & Baud Probing
The system SHALL establish UART communication with the BE-166 GPS receiver using MCU RX on GPIO 42 (connected to BE-166 TXD) and MCU TX on GPIO 41 (connected to BE-166 RXD), with automatic multi-baud rate validation (testing 9600, 115200, 38400, and 57600 baud).

#### Scenario: Valid NMEA stream detection
- **WHEN** UART communication is opened with the GPS receiver
- **THEN** the system SHALL detect and count incoming NMEA characters without framing or parity errors.

### Requirement: Interactive Raw NMEA Stream Monitor
The system SHALL provide an interactive serial console monitor command (`[g]`) that displays raw NMEA sentences streamed directly from the BE-166 receiver to allow live signal diagnosis.

#### Scenario: Raw NMEA streaming
- **WHEN** the user triggers raw NMEA monitoring from the serial diagnostic menu
- **THEN** incoming ASCII bytes from the GPS UART SHALL be forwarded directly to the serial console until stopped by user input.

### Requirement: NMEA Sentence Parsing & Fix Quality
The system SHALL parse standard NMEA sentences (RMC, GGA, GSA, GSV) to extract fix status, latitude, longitude, altitude, velocity, and dilution of precision (HDOP, VDOP, PDOP).

#### Scenario: Fix acquisition and telemetry
- **WHEN** the GPS receiver achieves a 2D or 3D navigation fix
- **THEN** the system SHALL report latitude, longitude, altitude above sea level, speed over ground, satellites used, and HDOP value.

#### Scenario: Satellite constellation tracking
- **WHEN** the GPS diagnostic displays constellation data
- **THEN** it SHALL report satellites in view and individual satellite signal-to-noise ratios (SNR in dB-Hz).

### Requirement: 1PPS Pulse Time Sync Verification
The system SHALL monitor the 1PPS signal connected to GPIO 38 via a hardware interrupt, measuring pulse frequency and validating PPS lock.

#### Scenario: 1PPS interrupt detection
- **WHEN** the GPS module outputs a 1 Hz timing pulse on GPIO 38
- **THEN** the system interrupt service routine SHALL increment a pulse counter and confirm exactly 1 pulse per second during satellite lock.

### Requirement: Bidirectional GNSS Command & Query Testing
The system SHALL provide a diagnostic routine that transmits query commands on GPIO 41 (MCU TX to BE-166 RXD) and listens for responses on GPIO 42 (MCU RX from BE-166 TXD) to verify the bidirectional UART link and determine receiver chipset capabilities.

#### Scenario: Probe command transmission and response
- **WHEN** the user executes the GPS bidirectional test command (`[p]`)
- **THEN** the system SHALL transmit standard UBX, CASIC, and MTK probe queries over UART
- **THEN** the system SHALL capture and display any immediate responses received from the GNSS receiver within a 500 ms window per probe.

