# Flash & USB Storage Specification

## Purpose
Covers internal 12MB SPI flash partitioning (FFat), wear-levelled FAT filesystem management, crash-resilient CSV flight telemetry logging, and USB Composite Mass Storage (MSC) read-only disk emulation over native USB-OTG.

## Requirements

### Requirement: 12MB Flash Partition Allocation
The firmware build system SHALL define a custom 16MB partition table (`firmware/partitions_12MB_ffat.csv`) reserving approximately 3.94MB for the application binary (`app0` at offset `0x010000`) and exactly 12.0MB for the FAT filesystem (`ffat` at offset `0x400000` to `0x1000000`).

#### Scenario: Partition Table Validation
- **WHEN** the firmware is compiled and flashed with `firmware/partitions_12MB_ffat.csv`
- **THEN** the ESP32-S3 boots with the full 12.0MB partition accessible to the `FFat` driver.

### Requirement: USB Composite CDC and MSC Concurrent Emulation
The firmware SHALL initialize the native ESP32-S3 USB peripheral as a USB composite device providing both a virtual COM port (CDC) for serial console interaction and a Mass Storage disk (MSC) exposing the 12MB FFat partition.

#### Scenario: Host Enumeration
- **WHEN** the payload is connected to a host computer via USB-C
- **THEN** the host operating system simultaneously detects a virtual serial interface (`/dev/ttyACM0` or equivalent COM port) and a removable disk drive labeled `ROCKET_DATA`.

### Requirement: Read-Only USB Mass Storage Protection
The USB MSC interface SHALL report write-protection to the host operating system, preventing the host from altering the FAT allocation tables or overwriting files while allowing unrestricted file reading and copying.

#### Scenario: Host Read Access
- **WHEN** a user copies a CSV flight log from the `ROCKET_DATA` USB drive to their computer
- **THEN** the file transfer completes successfully without modifying flash metadata or conflicting with firmware logging.

#### Scenario: Host Write Prevention
- **WHEN** a user attempts to save or delete files on the `ROCKET_DATA` drive from the host OS
- **THEN** the host operating system refuses the write with a write-protection error, maintaining filesystem integrity.

### Requirement: Flash CSV Flight Logger
The firmware SHALL provide a crash-resilient CSV logger capable of streaming telemetry records directly into sequential files on the FFat partition.

#### Scenario: Flight Record Logging
- **WHEN** data logging is active
- **THEN** flight records are buffered and appended to the current CSV file, and periodically synced to flash to ensure data is preserved upon unexpected power loss.

### Requirement: Interactive Storage CLI Commands
The serial diagnostic console SHALL include commands to query flash storage health, list existing flight logs, display available space, and format the 12MB partition.

#### Scenario: Query Flash Storage Status
- **WHEN** the user selects the flash storage diagnostic command from the console
- **THEN** the console outputs total partition bytes, used bytes, free bytes, and a directory listing of stored CSV logs.
