# Change Proposal: 12MB FFat Flash Storage & USB Composite (CDC + MSC) Drive

## Why
While high-power rocket payloads typically log to MicroSD cards, high-g boost shocks, vibrations, and hard ground touchdowns risk momentary card ejects and pin contact bounce. Providing an internal 12MB FFat partition on the 16MB SPI flash gives the rocket an indestructible, vibration-proof flight blackbox. Additionally, by leveraging the ESP32-S3's native USB-OTG peripheral as a USB Composite Device (concurrent CDC Serial CLI + MSC Flash Drive), operators can plug in a USB-C cable on recovery and immediately access CSV telemetry as a standard drag-and-drop thumb drive without removing cards or opening enclosures.

## What Changes
* **Custom 16MB Partition Table (`partitions_12MB_ffat.csv`)**: Replaces the default layout with a single 3.9MB application slot (`app0`) and a dedicated 12.0MB FAT filesystem partition (`ffat`).
* **USB Composite Interface (TinyUSB CDC + MSC)**: Configures the native USB peripheral to expose both `/dev/ttyACM0` for interactive CLI commands and a Mass Storage disk drive labeled `ROCKET_DATA`.
* **Read-Only USB MSC Protection**: Mounts the USB MSC drive with write-protection enabled toward the host computer to prevent concurrent FAT table corruptions while allowing instant CSV copying.
* **Internal Flash CSV Flight Logger**: Implements ring-buffered, sector-aligned CSV logging directly to the 12MB FFat partition.
* **CLI Storage Operations**: Adds interactive commands to inspect flash storage capacity, list stored flight logs, format/erase the partition, and stream/dump CSV files.

## Capabilities

### New Capabilities
- `flash-usb-storage`: High-speed internal SPI flash FAT filesystem logging (12MB) and dual-interface USB composite emulation (CDC virtual serial port + Read-Only USB Mass Storage flash drive).

### Modified Capabilities
<!-- No requirement changes to existing specs. storage-sdmmc, sensor-diagnostics, etc. remain intact. -->

## Impact
* **Memory & Flash**: 12 MB allocated to FFat partition; firmware partition sized at 3.9 MB (plenty of headroom for future expansion).
* **USB Stack**: Uses native TinyUSB stack with dual endpoints (CDC ACM + MSC).
* **Dependencies**: Uses `FFat.h`, `USB.h`, `USBMSC.h`, and `USBCDC.h` built into the ESP32-S3 Arduino framework.
