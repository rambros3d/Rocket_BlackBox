## ADDED Requirements

### Requirement: GPS UART Communication & Baud Probing
The system SHALL establish UART communication with the BE-166 GPS receiver using RX on GPIO 41 and TX on GPIO 42, with automatic baud rate validation (testing 9600 and 115200 baud).

#### Scenario: Valid NMEA stream detection
- **WHEN** UART communication is opened with the GPS receiver
- **THEN** the system SHALL detect and count incoming NMEA characters without framing or parity errors.

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
