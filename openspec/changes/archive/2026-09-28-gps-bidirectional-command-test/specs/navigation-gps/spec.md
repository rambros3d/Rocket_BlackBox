## ADDED Requirements

### Requirement: Bidirectional GNSS Command & Query Testing
The system SHALL provide a diagnostic routine that transmits query commands on GPIO 41 (MCU TX to BE-166 RXD) and listens for responses on GPIO 42 (MCU RX from BE-166 TXD) to verify the bidirectional UART link and determine receiver chipset capabilities.

#### Scenario: Probe command transmission and response
- **WHEN** the user executes the GPS bidirectional test command (`[p]`)
- **THEN** the system SHALL transmit standard UBX, CASIC, and MTK probe queries over UART
- **THEN** the system SHALL capture and display any immediate responses received from the GNSS receiver within a 500 ms window per probe.
