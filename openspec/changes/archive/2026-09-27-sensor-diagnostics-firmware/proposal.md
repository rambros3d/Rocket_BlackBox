## Why

The Rocket BlackBox payload PCB has been fabricated and requires bring-up validation firmware to verify electrical connectivity, sensor functionality, high-speed SDMMC storage, and GPS receiver operations on the actual hardware. Wireless interfaces (LoRa SX1262, Wi-Fi, BLE) are deferred for later phases to focus strictly on validating sensor data acquisition, bus integrity, and onboard storage.

## What Changes

- Establish PlatformIO project setup using modern `pioarduino` platform (ESP32-S3 Arduino Core 3.x), 16MB flash configuration, and native USB CDC serial output.
- Implement power hold latching on `GPIO 40`, power button status monitoring on `GPIO 39`, and battery voltage sensing on `GPIO 9`.
- Implement automated dual-bus I2C discovery and health diagnostics on Wire 1 (`GPIO 10 / 11`) and Wire 2 (`GPIO 2 / 1`).
- Implement sensor diagnostics and self-test verification for MS5607 (barometer), BME680 (gas/environmental), SCD40 (CO2), SGP41 (VOC/NOx), LTR-390UV (ambient light/UV), TSL25911FN (lux), and BNO055 (IMU in polled mode).
- Implement 4-bit SDMMC driver setup, card metadata query, filesystem verification, and read/write throughput benchmarking.
- Implement BE-166 GPS UART receiver, NMEA parsing, satellite SNR tracking, and hardware 1PPS pulse timing diagnostics.
- Implement an interactive Serial Monitor interface with Power-On Self-Test (POST) reporting and continuous live sensor telemetry streaming.

## Capabilities

### New Capabilities
- `sensor-diagnostics`: Self-test, configuration, calibration, and engineering value readouts for all onboard environmental, optical, barometric, and inertial sensors across dual I2C buses.
- `storage-sdmmc`: High-speed 4-bit SDMMC card detection, metadata reporting (type, capacity, sector size), and non-destructive throughput benchmarking.
- `navigation-gps`: BE-166 GPS UART communication, NMEA sentence parsing, constellation SNR telemetry, and 1PPS time sync pulse tracking.
- `power-housekeeping`: Power management hold latching on GPIO 40, button state sensing on GPIO 39, and battery ADC conversion with status monitoring.

### Modified Capabilities
*(None - initial greenfield firmware bring-up)*

## Impact

- Creates the initial PlatformIO firmware build system in the repository.
- Provides immediate physical verification of manufactured hardware without requiring radio bring-up.
- Dependencies: `pioarduino` platform, Adafruit sensor libraries, Sensirion sensor libraries, MS5611/MS5607 library, TinyGPSPlus.
