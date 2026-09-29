# Design Document: 12MB FFat Flash Storage & USB Composite (CDC + MSC) Drive

## Context
The Rocket BlackBox payload is built on the RAK3112 module (ESP32-S3 with 16MB Quad SPI Flash and 8MB Octal PSRAM). High-altitude flights subject payloads to severe g-forces and impact, making MicroSD cards vulnerable to momentary disconnections. To ensure a guaranteed blackbox flight record and effortless recovery workflow, the payload will utilize 12.0MB of its onboard flash as a FAT filesystem and expose it as a USB Mass Storage flash drive alongside its serial debug interface.

## Goals / Non-Goals

**Goals:**
* Define a 16MB partition table allocating 12.0MB directly to a FAT filesystem (`ffat`) and 3.94MB to the application.
* Implement a USB Composite Device utilizing the ESP32-S3 native USB-OTG controller to concurrently service CDC ACM (virtual serial port) and MSC (USB thumb drive).
* Enforce Read-Only mode on the USB MSC interface to eliminate concurrent FAT write hazards from the host operating system.
* Provide an asynchronous, buffered CSV flight logging manager that records multi-rate telemetry directly to flash.
* Equip the serial diagnostic console with flash inspection, directory listing, log dump, and format utilities.

**Non-Goals:**
* Wi-Fi/Bluetooth web file servers (strictly out of scope for early bring-up).
* Host-writable USB Mass Storage (write permissions are intentionally restricted to protect filesystem integrity).

## Decisions

### Decision 1: 16MB Partition Layout (`partitions_12MB_ffat.csv`)
* **Rationale:** The application binary currently occupies ~470 KB. Allocating 3.94MB (`0x3F0000`) for `app0` leaves massive headroom for future flight computer algorithms while allowing exactly 12.0MB (`0xC00000`) for `ffat` spanning `0x400000` to `0x1000000`.
* **Alternatives Considered:** Dual OTA partitions (2x 1.95MB). Deferred since the payload is currently in bring-up and prioritizes single-slot simplicity and maximum application space.

### Decision 2: TinyUSB Composite Device (CDC + MSC)
* **Rationale:** The ESP32-S3 Arduino core includes native TinyUSB classes (`USBCDC` and `USBMSC`). By initializing both before `USB.begin()`, the operating system loads the composite driver automatically.
* **Alternatives Considered:** ESP-IDF native USB driver without Arduino wrappers. Unnecessarily complex; Arduino's `USBMSC` handles SCSI block commands and inquiry descriptors natively.

### Decision 3: Read-Only MSC Mounting
* **Rationale:** FAT filesystems are not cluster-aware or multi-master. If a host OS mounts the partition with write access while the rocket MCU is appending flight records, cached metadata desynchronizes and corrupts the allocation table. Marking the drive as read-only (`msc.setReadWrite(true, false)`) allows the host PC to copy files without interfering with the MCU.
* **Deletion Policy:** Deletion and formatting are managed exclusively via the Serial CLI console.

### Decision 4: Ring-Buffered CSV Logging with Periodic Flush
* **Rationale:** SPI flash page writes and sector erasures take tens of milliseconds. A 4 KB RAM buffer in SRAM/PSRAM absorbs incoming 50 Hz telemetry records and writes aligned blocks to flash, flushing headers and directory clusters every 1–2 seconds.

## Risks / Trade-offs

* **[Risk] Unformatted Flash on First Boot:** A newly flashed board will have blank/erased flash at `0x400000`, causing `FFat.begin()` to fail initially.  
  *Mitigation:* Detect mount failure in `FlashStorageManager::init()` and automatically execute `FFat.format()` on first boot, logging the initialization to serial.
* **[Risk] Host OS File Cache Latency:** Some operating systems cache directory listings when a USB drive is plugged in. If new logs are written while plugged into USB, the PC might not see the new file until replugged.  
  *Mitigation:* The rocket logs primarily during flight when disconnected from USB. On bench testing, the CLI provides an explicit drive remount command (`[m] Remount USB MSC`).
