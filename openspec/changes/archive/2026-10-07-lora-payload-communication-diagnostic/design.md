## Context

The Rocket BlackBox payload hardware integrates a Semtech SX1262 LoRa transceiver housed inside the RAK3112-8-SM-I module (ESP32-S3). Currently, the diagnostic firmware (`firmware/src/main.cpp`) exercises power latching, environmental sensors, IMU orientation, GPS UART, and SDMMC storage, but has no driver or test routines for the onboard LoRa transceiver.

On the ground station side, the Waveshare USB-to-LoRa-HF dongle is running `meshcore-waveshare-usb-lora` on `/dev/ttyACM0`, exposing a standard KISS TNC serial interface.

To verify the RF front-end, antenna matching, transmitter output, receiver sensitivity, and link budget, we need a LoRa diagnostic subsystem on the rocket payload and an automated ping-pong responder on the ground station.

## Goals / Non-Goals

**Goals:**
- Initialize the RAK3112 SX1262 transceiver using RadioLib via its dedicated internal SPI pins and RF control lines (TCXO at 1.6V on DIO3, RF switch on DIO2 + GPIO 4).
- Configure RF parameters to 868.0 MHz, 125 kHz bandwidth, Spreading Factor 7, Coding Rate 4/5, and sync word `0x12` with 16-symbol preamble.
- Add an interactive menu option `[l]` in `firmware/src/main.cpp` providing:
  - LoRa Hardware Check (readback of SX1262 silicon version and status).
  - Bidirectional Ping-Pong test (transmitting numbered pings, listening for ground responses, and calculating Round-Trip Time and packet loss).
  - Telemetry Beacon (periodic packet broadcast).
  - Continuous packet receiver/sniffer mode.
- Provide an automated ground station responder script in `flight_dashboard/lora_ping_pong_ground.py` that connects to the Waveshare dongle, auto-tunes to 868 MHz, and echoes pongs back to the rocket.

**Non-Goals:**
- Implementing the final flight state machine telemetry protocol (this is hardware and RF verification).
- Adding complex mesh routing (peer-to-peer point-to-point packet testing only).

## Decisions

### 1. Library: RadioLib (`jgromes/RadioLib`)
- **Decision**: Use RadioLib in `firmware/platformio.ini`.
- **Rationale**: Proven, rock-solid Arduino SX126x support, native support for ESP32 custom SPI pins, DIO2 RF switching, and DIO3 TCXO voltage configuration.
- **Alternatives Considered**: Custom register-level driver (unnecessary complexity) or Semtech SX126x C library.

### 2. RAK3112 Hardware Mapping
- **Decision**: Define and configure the following pins in `firmware/include/pin_definitions.h`:
  - `PIN_LORA_SCK = GPIO 5`
  - `PIN_LORA_MISO = GPIO 3`
  - `PIN_LORA_MOSI = GPIO 6`
  - `PIN_LORA_NSS = GPIO 7`
  - `PIN_LORA_RST = GPIO 8`
  - `PIN_LORA_BUSY = GPIO 48`
  - `PIN_LORA_DIO1 = GPIO 47`
  - `PIN_LORA_ANT_SW = GPIO 4`
- **Power & TCXO**:
  - Drive `PIN_LORA_ANT_SW` (GPIO 4) HIGH.
  - Call `radio.setDio2AsRfSwitch(true)`.
  - Call `radio.setTCXO(1.6)`.

### 3. RF Parameter Harmonization
- **Decision**: 868.000 MHz, 125 kHz BW, SF7, CR 4/5, Sync Word `0x12`, 16 Preamble symbols.
- **Rationale**:
  - `0x12` matches the private LoRa sync word and the hardcoded `MESHCORE_SYNC_WORD` on the Waveshare dongle.
  - 125 kHz / SF7 yields low airtime (~35 ms for small frames), allowing rapid ping-pong turnarounds and high update rates during flight.

### 4. Ping-Pong Message Protocol
- **Decision**: Simple text frame:
  - Payload -> Ground: `PING:<seq>:<tx_millis>`
  - Ground -> Payload: `PONG:<seq>:<tx_millis>`
- **Rationale**: Human-readable, easily parsed by both the embedded MCU and the Python ground script, allows exact RTT measurement in milliseconds on the payload.

## Risks / Trade-offs

- **[Risk] RF Switch Power Gating**: If GPIO 4 is not driven HIGH or DIO2 RF switch is disabled, TX/RX signals will be severely attenuated (~30-40 dB loss).
  - **Mitigation**: Explicitly assert GPIO 4 as `OUTPUT HIGH` before initializing SPI and enable `setDio2AsRfSwitch(true)`.
- **[Risk] TCXO Stabilization Delay**: The SX1262 TCXO requires stabilization time.
  - **Mitigation**: RadioLib handles TCXO stabilization delay automatically when `setTCXO(1.6)` is configured.
- **[Risk] Desynchronization / Port Conflicts**: Both the payload (`/dev/ttyACM1`) and the Waveshare dongle (`/dev/ttyACM0`) are connected to the same PC.
  - **Mitigation**: Ground station script explicitly targets `/dev/ttyACM0`, while PlatformIO uploads and monitors target `/dev/ttyACM1`.
