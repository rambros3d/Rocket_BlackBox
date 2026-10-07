## Why

The Rocket BlackBox payload (RAK3112 / ESP32-S3 + SX1262) transmits live telemetry and flight sensor data from the sounding rocket over LoRa. The stock firmware on the Waveshare USB-to-LoRa-HF dongle uses a proprietary, closed-source point-to-point DTU protocol that cannot receive arbitrary LoRa packets or integrate with PC ground station software. To serve as a high-performance ground station receiver, the Waveshare dongle must be flashed with custom open firmware (`meshcore-waveshare-usb-lora`) configured for its TCXO oscillator and providing a standard KISS TNC interface over USB serial.

## What Changes

- Build the `meshcore-waveshare-usb-lora` firmware target for the GD32F103 MCU with TCXO support (`WITH_TCXO=1`).
- Flash the compiled binary directly to the Waveshare dongle using the connected ST-Link V2 programmer and pyOCD/OpenOCD.
- Verify basic hardware initialization, serial communication, and modem responses via the KISS TNC interface using `tools/kissmon.py`.
- Establish RF parameter alignment (frequency, bandwidth, spreading factor, coding rate, and sync word) between the Rocket BlackBox payload transmitter and the ground station receiver.
- Provide a Python telemetry reception script in `flight_dashboard/` to decode KISS frames and print live telemetry/signal quality (RSSI and SNR).

## Capabilities

### New Capabilities
- `ground-station-lora-receiver`: Firmware configuration, flashing, KISS modem operation, and ground station serial telemetry reception for the Waveshare USB-to-LoRa-HF dongle.

### Modified Capabilities
None.

## Impact

- **Firmware Subsystem (`usb-to-lora-firmwares/meshcore-waveshare-usb-lora`)**:
  - Clones/configures `libopencm3` and compiles `firmware.bin`.
  - Replaces the stock Waveshare factory firmware on the GD32F103 MCU via SWD.
- **Flight Dashboard Subsystem (`flight_dashboard/`)**:
  - Adds USB serial connection and KISS frame decoder script for real-time telemetry capture.
- **Hardware & Tools**:
  - Uses the connected ST-Link V2 probe to program the dongle at `0x08000000`.
  - Uses `pyocd` / `openocd` for programming and verification.
