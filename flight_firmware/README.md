# Rocket BlackBox Flight Telemetry Firmware

Flight telemetry firmware for the **Rocket BlackBox Payload Board (Rev 1.0)**, built on the **RAK3112** module (Espressif ESP32-S3 + Semtech SX1262 LoRa transceiver) using PlatformIO and the Arduino-ESP32 framework. The existing diagnostic image is maintained separately in [`test_firmware/`](../test_firmware/).

---

## 1. Hardware Architecture & Interfaces

| Subsystem | IC / Part | Interface & Pins | Operational Status |
| :--- | :--- | :--- | :--- |
| **Microcontroller** | RAK3112 (ESP32-S3) | Native USB CDC / MSC (`/dev/ttyACM0`, `/dev/sdb`) | **100% PASS** (16MB Flash, 8MB PSRAM, Power Latch on GPIO 40) |
| **Flight Altimeter & Barometer** | MS5607-02BA03 | I2C Bus 1 (`SDA: 10`, `SCL: 11` @ `0x77`) | **100% PASS** (24-bit $\Delta\Sigma$ ADC, PROM CRC4 verified, $0.01^\circ\text{C}$ resolution) |
| **Cabin CO2 & Humidity** | Sensirion SCD40 | I2C Bus 1 (`SDA: 10`, `SCL: 11` @ `0x62`) | **100% PASS** (Photoacoustic NDIR CO2, temp, RH with anti-flicker caching) |
| **MOX VOC / NOx Gas Index** | Sensirion SGP41 | I2C Bus 1 (`SDA: 10`, `SCL: 11` @ `0x59`) | **100% PASS** (Dynamic temp/humidity compensation from SCD40) |
| **Precision Ambient Light** | TSL25911FN | I2C Bus 1 (`SDA: 10`, `SCL: 11` @ `0x29`) | **100% PASS** (Device ID `0x50`, Dual-channel Full Spectrum + IR lux) |
| **GNSS Receiver** | Beitian BE-166 | UART1 (`MCU_RX: 42`, `MCU_TX: 41`, `1PPS: 38`) | **100% PASS** (115200 baud, NMEA streaming, UBX core verified via `$PUBX,04`) |
| **Internal Flash Storage** | 16MB SPI Flash | 12MB `/ffat` partition | **100% PASS** (Wear-leveling FAT, TinyUSB MSC composite drive `/dev/sdb`, 1Hz CSV flight logging) |
| **MicroSD Card Reader** | High-Speed Slot | 4-bit SDMMC (`CLK: 14`, `CMD: 21`, `D0: 13`, `D1: 12`, `D2: 17`, `D3: 18`) | **Driver Ready** (Awaiting physical card insertion for benchmark) |
| **9-DOF IMU** | Bosch BNO055 | I2C Bus 2 (`SDA: 2`, `SCL: 1` @ `0x28`) | **HW Issue (Rev 1.0)**: Pin 11 (`nRESET`) is floating; requires bodge wire to 3.3V |
| **Auxiliary Temp/Pressure** | Bosch BME680 | I2C Bus 1 (`0x76`) | **Isolated**: `R26` desoldered to clear pin 3 ground short; roles assumed by MS5607 & SCD40 |

---

## 2. Payload Interfaces

The flight image streams telemetry over LoRa and USB CDC at **115200 baud**. The
interactive diagnostic console and its POST commands belong to the unchanged
[`test_firmware/`](../test_firmware/) project; they are documented there.

<!-- The diagnostic console is documented in test_firmware/README.md. -->
<!--
==================================================
        ROCKET BLACKBOX DIAGNOSTIC CONSOLE        
==================================================
Select a diagnostic command:
  [1] Run Full Subsystem POST (Power-On Self-Test)
  [2] Toggle Live Sensor Telemetry Stream (1 Hz)
  [j] Toggle Dashboard JSON Telemetry Stream (1 Hz)
  [3] Run SDMMC Storage Benchmark (1 MB R/W)
  [4] Re-scan Dual I2C Buses
  [5] Query GPS & 1PPS Timing Status
  [g] Stream Raw BE-166 NMEA Sentences
  [p] Probe GPS Bidirectional Command Link
  [6] Query Power & Battery Health
  [7] Probe BNO055 Electrical Lines & Ping
  [e] Run BNO055 Edge-Case Recovery Suite
  [i] Re-initialize BNO055 & Enter NDOF Fusion
  [8] Query 12MB Flash & USB MSC Storage
  [9] List Flash Files (/ffat)
  [d] Dump Latest Flight Log CSV
  [0] Toggle Flash CSV Flight Logging
  [r] Remount / Refresh USB MSC Drive
  [f] Format 12MB Flash Storage Partition
  [h] Show this menu
--------------------------------------------------
-->

---

## 3. Building and Flashing

This project builds the flight image for the RAK3112 main system. Use `test_firmware/` when you need the existing interactive diagnostic image.

| Environment | Version | Purpose |
| :--- | :--- | :--- |
| `rocket_payload_telemetry` | v2 | Flight telemetry: 1 Hz LoRa downlink to the ground dashboard, USB JSON stream, auto CSV logging to `/ffat`, uplink commands |

### Compile Firmware
```bash
pio run -e rocket_payload_telemetry    # v2 flight telemetry
```

### Upload to Target Hardware (ESP32-S3 Native USB CDC)
Because the ESP32-S3 uses native USB CDC, trigger a 1200 bps touch reset before uploading to enter the internal ROM bootloader:
```bash
python3 -c "import serial, time; s=serial.Serial('/dev/ttyACM0', 1200); s.close(); time.sleep(1.5)"
pio run -e rocket_payload_telemetry -t upload
```

### v2 LoRa Link (Waveshare USB-TO-LoRa-HF ground receiver)

For the **custom KISS firmware** in `meshcore-waveshare-usb-lora/`, use the
terminal receiver below. It configures the dongle's radio in RAM to match the
payload, checks the frame CRC, and prints one JSON object per packet with GPS,
barometer, environmental sensors, IMU, battery, subsystem flags, and link
readings when the modem reports valid RSSI/SNR:

```bash
cd meshcore-waveshare-usb-lora
python3 -m pip install pyserial
python3 tools/rocket_telemetry.py --port /dev/cu.usbmodem5B901624291
```

Use the actual Waveshare serial port from `python3 tools/find_port.py` if it
differs. `--count 10` exits after ten packets; `--timeout 15` reports a missing
link. The KISS modem's normal MeshCore radio settings are different, so run this
receiver each time the dongle is connected or reset. The payload must run the
`rocket_payload_telemetry` image; the diagnostic image does not transmit LoRa.
The terminal output uses `null` for measurements from unavailable sensors and
for GPS position before a fix, while retaining genuine zero readings.

The payload's SX1262 transmits an 88-byte binary frame (`flight_firmware/src/telemetry_packet.h`, CRC-16/CCITT) every second, preceded by a DTU-style header (`FF FF <channel>`). The terminal receiver above and the local dashboard both read it through the custom KISS modem. In Chrome or Edge, open the dashboard's **Devices** page and choose **Connect LoRa Receiver**. Select the Waveshare CH343 serial port; the dashboard configures the KISS radio, verifies its readback, and updates live telemetry. Close the terminal receiver first because only one program can use the dongle's serial port at a time.

| Setting | Default | Build flag |
| :--- | :--- | :--- |
| Channel / frequency | 16 → 866 MHz (DTU: 850 + ch) | `LORA_CHANNEL` |
| Spreading factor / bandwidth / coding rate | SF9 / 125 kHz / 4/5 | `LORA_SPREADING_FACTOR`, `LORA_BANDWIDTH_KHZ`, `LORA_CODING_RATE` |
| TX power | 22 dBm | `LORA_TX_POWER_DBM` |
| Sync word / air prefix | `0x12` / `{0xFF,0xFF,ch}` | `LORA_SYNC_WORD`, `LORA_AIR_PREFIX` |

On first bring-up, verify that the dashboard's **Devices** page shows received packets and the payload subsystem flags. The payload USB console's `[t]` command sends a text test packet; `[x]` runs a receive sniffer. Adjust `LORA_SYNC_WORD` / `LORA_AIR_PREFIX` only if the radio link does not match.

v2 serial keys: `[i]` info JSON, `[s]` toggle USB JSON, `[l]` toggle flash log, `[t]` LoRa test packet, `[x]` LoRa sniffer. Uplink commands from the dashboard (`R C ver cmd arg crc`): ping, start logging, stop logging — each acknowledged with an `R A` packet.

---

## 4. Key Documentation Links
- [Ground Station Dashboard](../dashboard/)
- [Hardware Diagnostics Detailed Report](HARDWARE_DIAGNOSTICS.md)
- [Hardware Pinout & Net Mapping](pinout.md)
- [OpenSpec Architecture Specifications](../openspec/specs/)
