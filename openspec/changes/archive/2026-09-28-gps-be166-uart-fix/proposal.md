## Why

During exploration of the BE-166 GNSS receiver and TSL25911 optical sensor, two key findings emerged:
1. The **TSL25911FN** ambient light sensor (`0x29` on Bus 1) is populated and fully operational, reporting ~17 lux, but was previously documented as unpopulated in hardware logs.
2. The **BE-166 GNSS receiver** was failing to receive UART data (`NO_DATA`) due to an inverted pin mapping in firmware: the firmware set `PIN_GPS_RX` to GPIO 41 and `PIN_GPS_TX` to GPIO 42, but schematic net tracing between U11 (BE-166) and U1 (RAK3112 MCU) reveals that GPIO 41 connects to BE-166 `RXD` (input) and GPIO 42 connects to BE-166 `TXD` (output). Consequently, the MCU was listening to the GPS input pin and driving the GPS output pin.

This change corrects the UART pin assignment for BE-166, adds live NMEA monitoring/telemetry verification, and documents the operational verification of the TSL25911FN.

## What Changes

- Swap GPS UART pin assignments in `include/pin_definitions.h`:
  - `PIN_GPS_RX` becomes `GPIO_NUM_42` (connected to BE-166 TXD)
  - `PIN_GPS_TX` becomes `GPIO_NUM_41` (connected to BE-166 RXD)
- Update `gps_diagnostics.cpp` diagnostic output and baud rate probing to report live character counters, valid NMEA sentences, satellite counts, and 1PPS lock.
- Add an interactive raw NMEA sentence viewer / passthrough mode to the serial diagnostic console (command `[g]`) to inspect live incoming NMEA streams in real-time.
- Update `HARDWARE_DIAGNOSTICS.md` to reflect that U6 (TSL25911FN) is populated, healthy, and calibrated at address `0x29`.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `navigation-gps`: Correct UART RX and TX pin definitions (RX on GPIO 42, TX on GPIO 41) to match physical hardware routing, and add interactive NMEA stream monitoring.

## Impact

- `include/pin_definitions.h`: `PIN_GPS_RX` changed to 42, `PIN_GPS_TX` changed to 41.
- `src/gps_diagnostics.h` & `src/gps_diagnostics.cpp`: UART initialization and diagnostics updated to support raw NMEA stream display.
- `src/main.cpp`: Serial CLI menu updated with raw NMEA monitor option `[g]`.
- `HARDWARE_DIAGNOSTICS.md`: Updated to record TSL25911FN and BE-166 validation status.
