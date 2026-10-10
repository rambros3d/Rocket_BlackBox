# Rocket BlackBox Payload Firmware

Flight diagnostic and instrumentation firmware for the **Rocket BlackBox Payload Board (Rev 1.0)**, built on the **RAK3112** module (Espressif ESP32-S3 + Semtech SX1262 LoRa transceiver) using PlatformIO and the Arduino-ESP32 framework.

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

## 2. Interactive Serial Console Commands

Connect at **115200 baud** over USB CDC (`/dev/ttyACM0`). The firmware presents an interactive diagnostic suite:

```text
==================================================
        ROCKET BLACKBOX DIAGNOSTIC CONSOLE        
==================================================
Select a diagnostic command:
  [1] Run Full Subsystem POST (Power-On Self-Test)
  [2] Toggle Live Sensor Telemetry Stream (1 Hz)
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
```

---

## 3. Building and Flashing

### Compile Firmware
```bash
pio run
```

### Upload to Target Hardware (ESP32-S3 Native USB CDC)
Because the ESP32-S3 uses native USB CDC, trigger a 1200 bps touch reset before uploading to enter the internal ROM bootloader:
```bash
python3 -c "import serial, time; s=serial.Serial('/dev/ttyACM0', 1200); s.close(); time.sleep(1.5)"
pio run -t upload
```

---

## 4. Key Documentation Links
- [Hardware Diagnostics Detailed Report](HARDWARE_DIAGNOSTICS.md)
- [Hardware Pinout & Net Mapping](pinout.md)
- [OpenSpec Architecture Specifications](../openspec/specs/)
