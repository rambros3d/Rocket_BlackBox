## Why

While the BE-166 GNSS receiver RX line (MCU listening to BE-166 TXD on GPIO 42) is successfully streaming valid NMEA data at 115200 baud, the reverse transmission path (MCU TX driving BE-166 RXD on GPIO 41) has not been exercised. Testing bidirectional command transmission verifies that the MCU can configure the GNSS receiver, poll proprietary diagnostics (UBX, CASIC, and MTK), and confirm full hardware link integrity across the H1/H2 header connections.

## What Changes

- Add a dedicated bidirectional GPS command test routine in `GPSDiagnosticsManager` and expose it via the interactive diagnostic console (command `[p]`).
- Transmit probe command sequences to the GPS receiver on GPIO 41:
  - UBX time poll query (`$PUBX,04*37\r\n`) and position poll query (`$PUBX,00*33\r\n`).
  - UBX binary `MON-VER` query frame (`B5 62 0A 04 00 00 0E 34`).
  - CASIC system/firmware version query (`$PCAS06,0*1B\r\n`).
  - MTK release/version query (`$PMTK605*31\r\n`).
- Monitor and capture receiver responses to positively identify the GNSS chipset family and prove bidirectional transmission.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `navigation-gps`: Add requirement for bidirectional command transmission and query response verification.

## Impact

- `src/gps_diagnostics.h` and `src/gps_diagnostics.cpp`: Implement `testBidirectionalLink(Stream& console)`.
- `src/main.cpp`: Add diagnostic command `[p]` to test bidirectional GPS link.
