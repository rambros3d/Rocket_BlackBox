## Context

The Rocket BlackBox payload hardware integrates an Espressif ESP32-S3 microcontroller (hosted inside a RAK3112 module) alongside an extensive sensor cluster, a 4-bit SDMMC card slot, a BE-166 GPS receiver, power latch circuitry, and an internal SX1262 LoRa transceiver. The physical PCB is assembled and manufactured. Before writing mission flight software, the hardware requires a dedicated diagnostic test firmware to validate component soldering, power latch behavior, I2C bus integrity, high-speed SD storage, and GPS acquisition.

## Goals / Non-Goals

**Goals:**
- Provide complete self-test diagnostics and live data readouts for all onboard sensors: MS5607, BME680, SCD40, SGP41, LTR-390UV, TSL25911FN, and BNO055.
- Isolate the BNO055 IMU on secondary I2C Bus 2 in polled mode, bypassing the unexposed/conflicted GPIO 4 interrupt pin.
- Verify 4-bit SDMMC card operation with card identification (CID/CSD) and read/write throughput benchmarking.
- Validate BE-166 GPS UART reception, NMEA parsing, and hardware 1PPS pulse detection on GPIO 38.
- Ensure reliable power latching on GPIO 40 and accurate battery ADC reading on GPIO 9.
- Target PlatformIO using `pioarduino` (Arduino ESP32 Core 3.x) with native USB CDC serial output.

**Non-Goals:**
- Wireless testing (LoRa SX1262 communication, Wi-Fi telemetry, and BLE are strictly excluded from this bring-up change).
- Flight telemetry state machines (e.g. launch detection, apogee detection, parachute pyrotechnic deployment).
- Long-duration sensor logging or flight-ready data compression formats.

## Decisions

### 1. Build System: PlatformIO with `pioarduino`
- **Decision:** Use PlatformIO configured with the `pioarduino` community platform (`https://github.com/pioarduino/platform-espressif32/releases/download/stable/platform-espressif32.zip`) and ESP32-S3 DevKit target.
- **Rationale:** The upstream PlatformIO `espressif32` platform lags on Arduino Core 2.x, whereas `pioarduino` provides modern Arduino ESP32 Core 3.x with updated SDMMC drivers, USB CDC stability, and native chip support.
- **Alternatives Considered:**
  - *Upstream PlatformIO espressif32:* Lacks latest ESP32-S3 SDMMC matrix routing fixes and Arduino 3.x APIs.
  - *ESP-IDF native:* Increases boilerplate for fast sensor bring-up; Arduino framework provides readily available, battle-tested vendor libraries for Sensirion, Bosch, and AMS sensors.

### 2. Dual I2C Bus Topology & BNO055 Polled Mode
- **Decision:** Drive Wire 1 (`SDA: 10, SCL: 11`) for the environmental cluster and Wire 2 (`SDA: 2, SCL: 1`) exclusively for BNO055. Operate BNO055 in continuous polled mode without relying on the INT pin on GPIO 4.
- **Rationale:** GPIO 4 on the RAK3112 module is internally hardwired to `ANT_SW` (RF antenna switch), making it unavailable externally. Polling the BNO055 over I2C at 50–100 Hz avoids hardware line contention and allows orientation and fusion telemetry without hardware interrupts.

### 3. Immediate Power Latching Sequence
- **Decision:** Configure `GPIO 40` as `OUTPUT` and assert `HIGH` within the first two lines of `setup()`.
- **Rationale:** The hardware circuit requires `GPIO 40` to be pulled high to latch the DC-DC regulator on. Asserting it immediately prevents power dropout when the user releases the tactile power button `GPIO 39`.

### 4. Non-Destructive SDMMC Benchmark
- **Decision:** Initialize `SD_MMC` with custom pin routing (`CLK: 14, CMD: 21, D0: 13, D1: 12, D2: 17, D3: 18`) in 4-bit bus mode. Write and read a temporary 1 MB file (`/diag_test.bin`) with MD5/checksum verification, then remove the file.
- **Rationale:** Validates all 6 physical SDMMC traces, pull-up resistors, and transfer rates without altering existing card data.

## Risks / Trade-offs

- **[Risk: I2C Address Collision between BME680 and MS5607]** $\rightarrow$ *Mitigation:* Both share `0x76` / `0x77`. The diagnostic firmware scans both addresses on boot. If only one address responds, the diagnostic CLI logs an explicit hardware configuration alert indicating identical address strapping on the PCB.
- **[Risk: GPIO 45 Strapping Pin Flash Voltage Conflict]** $\rightarrow$ *Mitigation:* Ensure GPIO 45 (LED) is driven as Active-High output only after bootloader completion.
- **[Risk: Power Dropout on Button Release]** $\rightarrow$ *Mitigation:* Drive GPIO 40 HIGH immediately on startup, before any peripheral initialization or serial waits.
- **[Risk: Sensor Init Hangs (Clock Stretching / Unresponsive I2C)]** $\rightarrow$ *Mitigation:* Set I2C timeouts to 50 ms and wrap each sensor probe in independent try-init blocks so a missing or damaged sensor does not freeze the boot process.

## Open Questions

- What baud rate is factory-flashed on the BE-166 GPS module (9600 vs 115200)? The diagnostic firmware will support automatic baud probing across both standard rates.
- Does the physical PCB tie BME680 SDO to GND (0x76) and MS5607 CSB to GND (0x77), or vice versa? The initial bus scan will verify this automatically.
