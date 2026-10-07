## 1. PlatformIO & Hardware Definitions Setup

- [x] 1.1 Add `RadioLib` dependency to `firmware/platformio.ini`
- [x] 1.2 Add RAK3112 SX1262 SPI, control, and RF switch pin definitions to `firmware/include/pin_definitions.h`

## 2. LoRa Diagnostic Subsystem Implementation

- [x] 2.1 Create `firmware/src/lora_diagnostic.h` and `firmware/src/lora_diagnostic.cpp` implementing SPI, TCXO, RF switch, and 868 MHz modulation setup
- [x] 2.2 Implement ping-pong test, telemetry beacon, and packet sniffer routines in `firmware/src/lora_diagnostic.cpp`
- [x] 2.3 Wire menu option `[l]` into `firmware/src/main.cpp` to launch the LoRa diagnostic menu
- [x] 2.4 Verify clean compilation by running `pio run` in `firmware/`

## 3. Ground Station Ping-Pong Responder

- [x] 3.1 Implement automated KISS ping-pong responder script in `flight_dashboard/lora_ping_pong_ground.py`
- [x] 3.2 Update `flight_dashboard/README.md` with instructions for running the bidirectional verification

## 4. End-to-End Hardware Verification

- [x] 4.1 Upload payload diagnostic firmware to ESP32-S3 via `/dev/ttyACM1` in `firmware/`
- [x] 4.2 Launch `flight_dashboard/lora_ping_pong_ground.py` connected to `/dev/ttyACM0`
- [x] 4.3 Run ping-pong test from payload serial console and verify round-trip latency, RSSI, SNR, and 0% packet loss
