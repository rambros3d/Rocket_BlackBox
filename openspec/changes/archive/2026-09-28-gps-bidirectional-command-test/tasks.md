# Tasks: GPS Bidirectional Command Verification

- [x] 1. Firmware Implementation
  - [x] 1.1 Declare `testBidirectionalLink(Stream& console)` in `src/gps_diagnostics.h`.
  - [x] 1.2 Implement UBX, CASIC, and MTK command polling in `src/gps_diagnostics.cpp`.
  - [x] 1.3 Add command `[p]` to serial diagnostic menu in `src/main.cpp`.
- [x] 2. Build and Flash
  - [x] 2.1 Compile firmware with PlatformIO.
  - [x] 2.2 Flash firmware to ESP32-S3 over `/dev/ttyACM0`.
- [x] 3. Target Verification
  - [x] 3.1 Execute command `[p]` and analyze response packets from BE-166.
  - [x] 3.2 Update `HARDWARE_DIAGNOSTICS.md` with results.
- [x] 4. OpenSpec Completion
  - [x] 4.1 Sync specs and archive change.
  - [x] 4.2 Git commit changes.
