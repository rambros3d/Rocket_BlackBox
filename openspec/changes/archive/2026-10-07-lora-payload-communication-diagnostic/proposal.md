## Why

The Rocket BlackBox payload hardware integrates a Semtech SX1262 LoRa transceiver inside the RAK3112 module (ESP32-S3), but currently lacks LoRa driver firmware and radio diagnostics. To validate the RF front-end, antenna matching, and packet telemetry link with the newly flashed Waveshare USB-to-LoRa ground station receiver, we need a dedicated LoRa diagnostic subsystem in the payload firmware and an automated bidirectional ping-pong test tool on the ground station.

## What Changes

- Add `jgromes/RadioLib` dependency to `firmware/platformio.ini`.
- Add RAK3112 SX1262 hardware pin definitions (`SPI: SCK 5, MISO 3, MOSI 6, NSS 7; Control: DIO1 47, RST 8, BUSY 48; RF SW: ANT_SW GPIO 4 + DIO2; TCXO: 1.6V DIO3`) to `firmware/include/pin_definitions.h`.
- Implement a modular LoRa manager and diagnostic module in `firmware/src/lora_diagnostic.h` and `firmware/src/lora_diagnostic.cpp`.
- Integrate an interactive `[l]` LoRa menu into `firmware/src/main.cpp` supporting:
  - Hardware status and register readback check.
  - Bidirectional ping-pong diagnostic (sending numbered pings and awaiting ground station pongs to measure RTT, packet loss, and RSSI/SNR).
  - Continuous telemetry packet beacon.
  - LoRa packet listener / sniffer.
- Create an automated ground station ping-pong responder script in `flight_dashboard/lora_ping_pong_ground.py` that listens on `/dev/ttyACM0` via KISS frames, answers payload pings with pongs, and reports link budget statistics.

## Capabilities

### New Capabilities
- `lora-rf-communication`: RAK3112 SX1262 LoRa initialization, RF parameter configuration (868.0 MHz, BW 125 kHz, SF7, CR 4/5, sync word 0x12), interactive diagnostic tests, and bidirectional communication validation with the ground station.

### Modified Capabilities
None.

## Impact

- **Firmware Subsystem (`firmware/`)**:
  - `firmware/platformio.ini`: adds RadioLib library.
  - `firmware/include/pin_definitions.h`: adds SX1262 pin mapping.
  - `firmware/src/lora_diagnostic.h` & `firmware/src/lora_diagnostic.cpp`: creates driver and test routines.
  - `firmware/src/main.cpp`: binds `[l]` menu option to run LoRa diagnostics.
- **Flight Dashboard Subsystem (`flight_dashboard/`)**:
  - `flight_dashboard/lora_ping_pong_ground.py`: creates automated ground responder.
  - `flight_dashboard/README.md`: documents ping-pong verification workflow.
