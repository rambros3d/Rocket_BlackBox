## 1. Partition & Build Configuration

- [x] 1.1 Create `partitions_12MB_ffat.csv` defining a 3.94MB application slot (`app0`) and a 12.0MB FAT partition (`ffat`).
- [x] 1.2 Update `platformio.ini` to use `partitions_12MB_ffat.csv` and configure TinyUSB build flags.

## 2. Flash Storage & Filesystem Management

- [x] 2.1 Create `src/flash_storage_mgr.h` and `src/flash_storage_mgr.cpp` implementing `FFat` mounting, auto-formatting on first mount, and capacity telemetry.
- [x] 2.2 Implement ring-buffered CSV flight logging with periodic sync to prevent data loss on power cutoff.

## 3. TinyUSB Composite (CDC + MSC) Integration

- [x] 3.1 Implement USB Composite initialization binding `USBCDC` (Serial) and `USBMSC` (Mass Storage) over the native USB-OTG controller.
- [x] 3.2 Configure the USB MSC drive descriptor (`ROCKET_DATA`, Read-Only) to protect filesystem integrity from host operating systems.

## 4. CLI Storage Commands & Telemetry Integration

- [x] 4.1 Add flash storage diagnostics, directory listing, log formatting, and file dumping commands to the serial console menu in `src/main.cpp`.
- [x] 4.2 Connect sensor telemetry generation to the flash CSV logger.
- [x] 4.3 Compile, flash to `/dev/ttyACM0`, and verify both serial communication and USB thumb drive enumeration.
