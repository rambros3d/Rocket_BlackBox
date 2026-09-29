## Context

The Rocket BlackBox payload PCB integrates an onboard BE-166 GNSS receiver (U11) interfaced with the RAK3112 MCU (U1, ESP32-S3) via a breakable header pair (H1/H2) and a 1PPS synchronization line. During initial diagnostics:
- The ambient light sensor TSL25911FN (U6, I2C `0x29`) was discovered to be populated and fully functional.
- The BE-166 GNSS receiver UART connection reported `NO_DATA`. Schematic analysis confirmed that the net named `GNSS_RXD` connects U11 Pin 1 (`RXD`) to U1 Pin 18 (`GPIO41`), and net `GNSS_TXD` connects U11 Pin 2 (`TXD`) to U1 Pin 19 (`GPIO42`).
- Firmware assigned `PIN_GPS_RX = GPIO_NUM_41` and `PIN_GPS_TX = GPIO_NUM_42`, creating a direct RX-to-RX and TX-to-TX mismatch.

## Goals / Non-Goals

**Goals:**
- Correct the GPIO pin mappings in `pin_definitions.h` (`PIN_GPS_RX = GPIO_NUM_42`, `PIN_GPS_TX = GPIO_NUM_41`).
- Verify multi-baud auto-detection (9600, 115200, 38400, 57600 baud) for the BE-166.
- Implement an interactive raw NMEA sentence viewer (Option `[g]` in serial CLI) to stream incoming sentences for debugging.
- Verify 1PPS hardware interrupt triggering on GPIO 38.
- Update hardware diagnostic documentation reflecting TSL25911 and BE-166 status.

**Non-Goals:**
- Physical hardware trace cutting or wire bodging (software pin swapping via ESP32-S3 GPIO matrix completely resolves the issue).
- Reconfiguring default NMEA constellation rates / binary UBX protocols (keep standard NMEA 0183 decoding).

## Decisions

### 1. Invert `PIN_GPS_RX` and `PIN_GPS_TX` in `include/pin_definitions.h`
- **Choice:** Swap pin numbers in definitions rather than modifying peripheral driver logic.
- **Rationale:** The ESP32-S3 GPIO matrix allows any hardware UART (such as `UART_NUM_1`) to be assigned to arbitrary GPIOs with zero electrical penalty.
- **Alternative Considered:** Hardware jumper swap on H1/H2. Rejected because software remapping is instant, non-destructive, and requires no soldering.

### 2. Auto-Baud Detection Suite
- **Choice:** Probe standard baud rates (9600, 115200, 38400, 57600) with a 600 ms window each to lock onto the BE-166 default baud.
- **Rationale:** BE-166 modules ship from different manufacturers with either 9600 baud or 115200 baud factory defaults. Probing ensures robust bring-up regardless of factory batch.

### 3. Dedicated Raw NMEA Stream Console Mode `[g]`
- **Choice:** Add command `[g]` to `src/main.cpp` that pumps bytes from `HardwareSerial _gpsSerial` directly to `Serial` until the user sends another key.
- **Rationale:** Crucial for observing raw `$GNGGA`, `$GNRMC`, `$GPGSV` sentences, satellite SNR, and satellite fix progress when testing indoors vs outdoors.

## Risks / Trade-offs

- **[Risk] Indoor Satellite Signal Attenuation:** Indoors, the GPS module may not achieve a 3D fix or lock 1PPS timing pulses immediately.
  - *Mitigation:* Focus diagnostic verification on active UART byte streaming, valid NMEA checksum counts, and satellite visibility counts ($GSV), noting that 3D fix requires open-sky or window placement.
- **[Risk] Serial Buffer Overflow during High Baud Streaming:**
  - *Mitigation:* Ensure `GPSDiagnosticsManager::update()` drains UART1 FIFO rapidly in `loop()`, using a 256-byte or 512-byte ring buffer.
