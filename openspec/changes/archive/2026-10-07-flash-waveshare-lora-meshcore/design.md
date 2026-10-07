## Context

The Rocket BlackBox payload records avionics and atmospheric telemetry (barometric altitude, IMU 9-DOF orientation, GPS position, air quality, battery housekeeping) and broadcasts packetized telemetry over LoRa using its integrated SX1262 transceiver.

On the ground, a laptop or field computer needs to receive these telemetry packets in real time. The Waveshare USB-to-LoRa-HF dongle (TCXO variant) is connected to the ground computer via USB (`/dev/ttyACM*` or `/dev/ttyUSB*` via WCH CH343). An ST-Link V2 programmer is connected to the dongle's 4 SWD pads (`3V3`, `GND`, `SWDIO`, `SWCLK`).

The stock firmware running on the Waveshare dongle only supports proprietary, closed-source point-to-point AT/DTU transparent bridges. To transform the dongle into a programmable, standardized ground station receiver, we compile and flash `meshcore-waveshare-usb-lora`.

## Goals / Non-Goals

**Goals:**
- Fetch/configure `libopencm3` and compile the `meshcore-waveshare-usb-lora` firmware with TCXO support enabled (`WITH_TCXO=1`).
- Flash `firmware.bin` directly to the GD32F103 MCU starting at `0x08000000` using pyOCD and the attached ST-Link V2 probe.
- Verify communication over the CH343 USB serial port using the KISS protocol (`tools/kissmon.py info`).
- Provide an operational ground reception client in `flight_dashboard/` that parses KISS frames, extracts packet bytes, and monitors link budget metrics (RSSI, SNR).

**Non-Goals:**
- Creating a secondary USB bootloader (direct SWD flashing at `0x08000000` is faster, simpler, and fits within the 64KB GD32F103 memory budget).
- Implementing full MeshCore routing mesh nodes on the ground receiver (it functions as a KISS TNC telemetry modem).

## Decisions

### 1. Firmware Choice: `meshcore-waveshare-usb-lora` over `waveshare-usb-lora-firmware`
- **Decision**: Use `meshcore-waveshare-usb-lora`.
- **Rationale**:
  - `meshcore-waveshare-usb-lora` links directly at `0x08000000` (single-stage flashing) and does not require a proprietary two-stage bootloader.
  - It speaks standard KISS TNC protocol (SLIP framing with `0xC0`), enabling simple integration with standard serial tools and custom Python dashboards.
  - Built-in hardware CAD (Channel Activity Detection) and CSMA/CA prevents packet collisions if ground uplink is ever enabled.
- **Alternatives Considered**: `waveshare-usb-lora-firmware` by Archie3d, which requires flashing a separate bootloader first and relies on custom `0xAA` binary framing with proprietary escaping and CRC calculations.

### 2. Flashing Interface: pyOCD with ST-Link V2
- **Decision**: Use `pyocd` to flash `firmware.bin` over SWD targeting the GD32F103/STM32F103.
- **Rationale**:
  - `pyocd` is already installed and detects the connected ST-LINK/V2 probe (`6068FF28...`).
  - Supports erase, program, and verify in a single command.
- **Alternatives Considered**: `openocd` (more configuration scripts required) or `st-flash` (not installed on host).

### 3. TCXO Power and Clock Gating
- **Decision**: Compile with `WITH_TCXO=1`.
- **Rationale**:
  - The board is the TCXO variant (`USB-TO-LoRa-HF`).
  - Drives `PD1` HIGH during `global_init()` to power the TCXO oscillator and configures SX1262 DIO3 for 1.7V TCXO voltage control with 5 ms delay.

### 4. RF Parameter Strategy
- **Decision**: Match payload RF parameters via runtime KISS `SetHardware` commands (`0x06`) or compile-time defaults.
- **Rationale**:
  - `radio.c` sets initial defaults (frequency 869.618 MHz, SF8, BW 62.5 kHz, CR 4/8, sync word `0x14`).
  - Ground station script can issue KISS `SetHardware` configuration commands upon connection to dynamically adjust frequency, bandwidth, and spreading factor to match the rocket flight profile.

## Risks / Trade-offs

- **[Risk] Sync Word Mismatch**: If the rocket avionics code uses Semtech default private sync word (`0x12`) or public sync word (`0x34`), packets will be dropped by the hardware correlator.
  - **Mitigation**: Verify the payload's SX1262 configuration and align the sync word (`MESHCORE_SYNC_WORD` or compile-time define) between both units.
- **[Risk] pyOCD Chip Identification on GD32F103**: GigaDevice GD32F103 chips have slightly different core IDs than genuine ST STM32F103 chips.
  - **Mitigation**: Use `pyocd flash -t stm32f103c8` or generic `cortex_m` target with pyOCD.
- **[Risk] SWD Connection Quality**: Jumper wires between ST-Link and the 2x3 pads might have poor contact or incorrect pinout.
  - **Mitigation**: Check pad labels (`3V3`, `GND`, `SWDIO`, `SWCLK`) on PCB silkscreen and verify SWD communication before writing flash.
