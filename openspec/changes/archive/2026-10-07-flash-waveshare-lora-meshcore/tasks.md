## 1. Environment & Library Preparation

- [x] 1.1 Clone and initialize `libopencm3` inside `usb-to-lora-firmwares/meshcore-waveshare-usb-lora/firmware/libopencm3`
- [x] 1.2 Build `libopencm3` for the STM32F1 target in `usb-to-lora-firmwares/meshcore-waveshare-usb-lora/firmware/libopencm3`

## 2. Firmware Compilation

- [x] 2.1 Check and configure TCXO flags (`WITH_TCXO=1`) and default RF sync word / frequency in `usb-to-lora-firmwares/meshcore-waveshare-usb-lora/firmware/`
- [x] 2.2 Compile `firmware.bin` using `make WITH_TCXO=1` in `usb-to-lora-firmwares/meshcore-waveshare-usb-lora/firmware/`
- [x] 2.3 Verify binary geometry and ensure image size is strictly under 64 KiB flash geometry

## 3. SWD Flashing & Hardware Verification

- [x] 3.1 Probe the GD32F103 MCU over SWD using OpenOCD with the connected ST-Link V2
- [x] 3.2 Flash `firmware.bin` to base address `0x08000000` using OpenOCD (unlocking RDP protection first)
- [x] 3.3 Verify USB serial device enumeration for the CH343 bridge in Linux (`/dev/ttyACM*` or `/dev/ttyUSB*`)

## 4. Modem Protocol Verification

- [x] 4.1 Query device info and radio configuration using `python tools/kissmon.py -p <PORT> info`
- [x] 4.2 Validate runtime radio tuning by setting listening frequency and bandwidth with `kissmon`

## 5. Ground Station Integration

- [x] 5.1 Create a Python KISS telemetry receiver client in `flight_dashboard/` to stream live packets, RSSI, and SNR
- [x] 5.2 Document operational receiver commands and RF alignment in `flight_dashboard/README.md`
