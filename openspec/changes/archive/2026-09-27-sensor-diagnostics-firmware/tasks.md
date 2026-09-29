## 1. Project Scaffolding & Pin Definitions

- [x] 1.1 Create `platformio.ini` with `pioarduino` platform, ESP32-S3 DevKit target, 16MB flash, USB CDC build flags, and library dependencies
- [x] 1.2 Create `include/pin_definitions.h` mapping all MCU GPIO assignments from `pinout.md`

## 2. Power Management & Housekeeping

- [x] 2.1 Implement `power_mgr.h` and `power_mgr.cpp` asserting GPIO 40 HIGH on boot and reading GPIO 39 button status
- [x] 2.2 Implement battery ADC voltage sensing on GPIO 9 with 1/2 divider calculation and state-of-charge percentage
- [x] 2.3 Implement non-blocking LED heartbeat on GPIO 45 and ESP32-S3 chip telemetry (heap, internal temp, frequency)

## 3. Dual I2C Bus Management & Device Scanner

- [x] 3.1 Implement `i2c_bus_manager.h` and `i2c_bus_manager.cpp` initializing Wire (Bus 1: SDA 10, SCL 11) and Wire1 (Bus 2: SDA 2, SCL 1)
- [x] 3.2 Implement automated 7-bit address discovery routine with timeout protection and address-to-device mapping table

## 4. Environmental & Optical Sensor Suite Diagnostics

- [x] 4.1 Implement MS5607 driver with PROM coefficient read, CRC4 validation, and pressure/altitude calculation
- [x] 4.2 Implement BME680 driver checking Chip ID (0x61), heater profile execution, and gas resistance/temperature/humidity readouts
- [x] 4.3 Implement SCD40 driver reading 48-bit serial number, executing self-test, and reading CO2 concentration
- [x] 4.4 Implement SGP41 driver executing silicon self-test and reading raw VOC/NOx sensor ticks
- [x] 4.5 Implement LTR-390 and TSL2591 optical drivers verifying part IDs, gain switching, and computing ambient lux and UV index

## 5. BNO055 9-DOF IMU Diagnostics

- [x] 5.1 Implement `imu_sensor.h` and `imu_sensor.cpp` initializing BNO055 on Bus 2 in polled mode
- [x] 5.2 Implement self-test register verification (MCU, Gyro, Mag, Accel) and calibration score monitoring
- [x] 5.3 Implement live 9-axis fusion data streaming (Euler angles, linear acceleration, quaternions)

## 6. SDMMC 4-Bit Storage & Benchmark

- [x] 6.1 Implement `sd_diagnostics.h` and `sd_diagnostics.cpp` configuring 4-bit SDMMC on pins 14, 21, 13, 12, 17, 18
- [x] 6.2 Implement card metadata query reporting card type, total capacity, sector size, and volume free space
- [x] 6.3 Implement non-destructive 1 MB read/write benchmark calculating throughput (MB/s) and verifying data integrity

## 7. GPS Receiver & 1PPS Time Sync

- [x] 7.1 Implement `gps_diagnostics.h` and `gps_diagnostics.cpp` managing UART communication on RX 41 / TX 42 with baud auto-probing
- [x] 7.2 Implement NMEA sentence parser tracking fix quality, latitude, longitude, altitude, speed, and dilution of precision (HDOP)
- [x] 7.3 Implement hardware interrupt tracker on GPIO 38 verifying 1PPS pulse timing regularity and GPS lock

## 8. Interactive Console & System Integration

- [x] 8.1 Implement CLI interface in `main.cpp` supporting POST diagnostic summary table and live continuous telemetry stream
- [x] 8.2 Verify complete firmware compilation using PlatformIO build command
