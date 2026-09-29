# Storage SDMMC Specification

## Purpose
Covers high-speed 4-bit SDMMC bus initialization, card metadata interrogation (CID/CSD), FAT filesystem mounting, and throughput benchmarking.

## Requirements

### Requirement: 4-Bit SDMMC Card Initialization
The system SHALL configure the ESP32-S3 SDMMC host controller to communicate with the onboard MicroSD card slot using 4-bit bus mode on pins CLK: GPIO 14, CMD: GPIO 21, DAT0: GPIO 13, DAT1: GPIO 12, DAT2: GPIO 17, and DAT3: GPIO 18.

#### Scenario: Successful 4-bit mount
- **WHEN** a MicroSD card is inserted and the diagnostic test mounts the storage
- **THEN** it SHALL verify that the bus is established in 4-bit mode (not 1-bit fallback) and mount the FAT filesystem.

### Requirement: Card Metadata and Capacity Query
The system SHALL read card identification and specific data (CID/CSD registers) to report card type, capacity, sector size, and volume free space.

#### Scenario: Capacity reporting
- **WHEN** the SD card diagnostic executes
- **THEN** it SHALL display the detected card type (SDSC, SDHC, or SDXC), total capacity in megabytes/gigabytes, used space, and free space.

### Requirement: Non-Destructive Read/Write Benchmark
The system SHALL perform a throughput benchmark by creating a 1 MB temporary file (`/diag_test.bin`), writing data blocks, reading the file back with checksum validation, calculating throughput in MB/s, and cleaning up the test file.

#### Scenario: Write throughput benchmark
- **WHEN** the SDMMC write benchmark runs
- **THEN** it SHALL write 1 MB in 4 KB blocks, calculate write speed in MB/s, and report whether all blocks were written without error.

#### Scenario: Read throughput and data integrity verification
- **WHEN** the SDMMC read benchmark runs
- **THEN** it SHALL read the 1 MB test file, verify that the read bytes match the written data pattern, calculate read speed in MB/s, and remove the temporary file.
