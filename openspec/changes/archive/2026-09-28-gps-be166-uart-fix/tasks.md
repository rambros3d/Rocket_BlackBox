## 1. Pin Definition & UART Configuration

- [x] 1.1 Invert `PIN_GPS_RX` and `PIN_GPS_TX` in `include/pin_definitions.h` (set RX to GPIO 42, TX to GPIO 41).
- [x] 1.2 Expand baud probing in `src/gps_diagnostics.cpp` to validate 9600, 115200, 38400, and 57600 baud.

## 2. Interactive NMEA Diagnostics & Telemetry

- [x] 2.1 Implement `GPSDiagnosticsManager::streamRawNMEA(Print& out, uint32_t durationMs)` in `src/gps_diagnostics.cpp` and `src/gps_diagnostics.h`.
- [x] 2.2 Wire command `[g]` into `src/main.cpp` diagnostic menu to launch live NMEA stream view.
- [x] 2.3 Verify 1PPS hardware interrupt counter and satellite fix parsing in `GPSDiagnosticsManager::runDiagnostics()`.

## 3. Hardware Diagnostics Documentation

- [x] 3.1 Update `HARDWARE_DIAGNOSTICS.md` to document U6 (TSL25911FN) as populated, verified, and operational at `0x29`.
- [x] 3.2 Update `HARDWARE_DIAGNOSTICS.md` to document the BE-166 UART RX/TX crossover resolution and live satellite tracking status.

## 4. Compilation, Flash, and Verification

- [x] 4.1 Compile firmware using PlatformIO and flash to ESP32-S3 via `/dev/ttyACM0`.
- [x] 4.2 Verify live serial reception: confirm incoming NMEA bytes, active baud lock, and raw sentences via option `[g]` and query option `[5]`.
