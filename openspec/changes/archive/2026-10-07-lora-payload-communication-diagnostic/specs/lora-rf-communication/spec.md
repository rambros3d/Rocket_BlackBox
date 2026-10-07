## ADDED Requirements

### Requirement: SX1262 Transceiver Initialization on RAK3112
The system SHALL initialize the onboard SX1262 LoRa transceiver over internal SPI (SCK=5, MISO=3, MOSI=6, NSS=7), configure control lines (RESET=8, BUSY=48, DIO1=47), assert RF switch power (ANT_SW=4 HIGH), enable DIO2 RF switching, and configure TCXO voltage at 1.6V via DIO3.

#### Scenario: Transceiver hardware detection
- **WHEN** the diagnostic firmware runs LoRa hardware initialization
- **THEN** the SX1262 SHALL respond to SPI queries with status `RADIOLIB_ERR_NONE` and report valid status without SPI communication errors.

### Requirement: RF Modulation Configuration
The system SHALL configure the SX1262 to operate at 868.000 MHz carrier frequency, 125.0 kHz bandwidth, Spreading Factor 7, Coding Rate 4/5, Sync Word 0x12, and 16 preamble symbols with CRC enabled.

#### Scenario: Modulation configuration applied
- **WHEN** the radio initialization routine sets frequency, bandwidth, spreading factor, and sync word
- **THEN** all RadioLib configuration calls SHALL return zero errors and verify the active radio state.

### Requirement: Bidirectional Ping-Pong Verification
The system SHALL support an interactive ping-pong test where the rocket payload transmits numbered `PING` frames to the ground station, awaits matching `PONG` frames within a bounded timeout (1500 ms), and calculates round-trip time, packet loss, and signal quality metrics (RSSI, SNR).

#### Scenario: Successful ping-pong transaction
- **WHEN** the payload transmits a `PING:<seq>:<time>` frame and the ground station returns `PONG:<seq>:<time>`
- **THEN** the payload console SHALL display the matching sequence number, round-trip latency in milliseconds, receiver RSSI (dBm), and SNR (dB).

#### Scenario: Ping timeout and loss tracking
- **WHEN** the payload transmits a `PING` frame and no matching `PONG` is received within the timeout window
- **THEN** the payload console SHALL record a timeout failure and increment the packet loss counter.

### Requirement: Ground Station Automated Ping-Pong Responder
The ground station software SHALL provide an automated responder script that interfaces with the Waveshare USB-to-LoRa dongle, decodes incoming KISS frames, and transmits an immediate `PONG` reply upon receiving any valid `PING` frame.

#### Scenario: Automated ground response
- **WHEN** the Waveshare adapter receives a LoRa packet containing `PING:<seq>:<time>`
- **THEN** the responder script SHALL output link budget metrics to the terminal and immediately transmit a `PONG:<seq>:<time>` packet back over LoRa.

### Requirement: Continuous Telemetry Beacon & Packet Sniffer
The system SHALL provide interactive diagnostic modes for continuously broadcasting test telemetry frames at regular intervals and passively listening for incoming LoRa transmissions.

#### Scenario: Telemetry beacon transmission
- **WHEN** the user selects beacon mode from the serial diagnostic console
- **THEN** the payload SHALL transmit simulated avionics packets periodically and blink the onboard status LED on each transmission.

#### Scenario: Passive packet sniffer
- **WHEN** the user selects packet sniffer mode
- **THEN** the payload SHALL enter continuous receive mode and print the timestamp, raw hex payload, RSSI, and SNR of all received packets.
