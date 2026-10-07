## ADDED Requirements

### Requirement: Firmware Compilation for TCXO Hardware
The firmware build system SHALL compile `firmware.bin` targeted for the GD32F103 MCU with TCXO oscillator support explicitly enabled.

#### Scenario: Clean compilation with TCXO flags
- **WHEN** the user compiles the firmware using `make WITH_TCXO=1` in `usb-to-lora-firmwares/meshcore-waveshare-usb-lora/firmware`
- **THEN** the build produces a `firmware.bin` binary linking against libopencm3 with flash origin at `0x08000000` and total size within 64 KiB.

### Requirement: SWD Probe Flashing
The firmware binary SHALL be flashed directly to the GD32F103 flash memory at `0x08000000` using the attached ST-Link V2 SWD programmer.

#### Scenario: Successful flash via pyOCD
- **WHEN** pyOCD executes the flash command targeting `stm32f103c8` with `firmware.bin` at base address `0x08000000`
- **THEN** the chip memory is erased, programmed, verified, and reset without verification errors.

### Requirement: KISS Modem Protocol Operation
The flashed dongle SHALL enumerate on the host operating system via the CH343 USB-to-UART bridge and respond to standard KISS TNC frames.

#### Scenario: Host queries modem information
- **WHEN** the host sends a KISS `SetHardware` query (`0x06` sub-command `0x11` or `0x16`) over the USB serial port at 115200 baud
- **THEN** the dongle responds with a valid KISS frame containing the device identifier or version string.

### Requirement: Live Packet and Signal Telemetry Capture
The ground station receiver SHALL receive LoRa packets transmitted by the rocket payload and emit them to the host computer along with link quality metrics.

#### Scenario: LoRa packet received over air
- **WHEN** a matching LoRa packet arrives at the SX1262 antenna matching configured RF parameters
- **THEN** the dongle decodes the payload, asserts the RX LED, and forwards a KISS Data frame containing the raw telemetry bytes along with RSSI and SNR signal metadata.

### Requirement: Configurable RF Parameters
The ground receiver SHALL allow runtime configuration of RF parameters (frequency, bandwidth, spreading factor, and coding rate) via KISS commands.

#### Scenario: Host reconfigures listening frequency
- **WHEN** the host issues a KISS SetRadio command specifying target frequency and modulation parameters
- **THEN** the SX1262 transceiver retunes to the requested frequency and begins listening with the updated parameters.
