# Rocket BlackBox: run commands

These commands are for the RAK3112 payload running `rocket_payload_telemetry`
and the Waveshare USB dongle running the custom KISS firmware. Run them from
the repository root on macOS. The payload transmits once per second without a
computer command; the terminal program is needed to configure the dongle's
radio and display the received packets.

## 1. Find the two USB ports

```bash
cd /Volumes/Raj/Projects/Rocket_BlackBox
~/.platformio/penv/bin/python meshcore-waveshare-usb-lora/tools/find_port.py --list
```

On the tested setup, the payload **application** port was
`/dev/cu.usbmodemA4CB8FC7E48C2` (Espressif `303A:1001`) and the Waveshare
dongle was `/dev/cu.usbmodem5B901624291` (CH343 `1A86:55D3`). Port names can
change after reconnecting. The payload **download-mode** port was
`/dev/cu.usbmodem1101`; that mode does not run the flight application.

## 2. Receive LoRa telemetry on the Waveshare dongle

In terminal 1:

```bash
cd /Volumes/Raj/Projects/Rocket_BlackBox
~/.platformio/penv/bin/python meshcore-waveshare-usb-lora/tools/rocket_telemetry.py \
  --port /dev/cu.usbmodem5B901624291
```

Replace the port if `find_port.py --list` shows a different CH343 device.
Press Ctrl-C to stop. For a short link test, add `--count 5 --timeout 15`.
The program configures the dongle in RAM for 866 MHz, SF9, 125 kHz bandwidth,
and coding rate 4/5; **run it again after unplugging or resetting the dongle**.
Each line is one CRC-checked packet. `status.bno055: true` plus non-null
`imu.ax/ay/az` confirms the BNO055 data crossed the LoRa link.

If `link.rssi` and `link.snr` are `null`, check the dongle's raw KISS receive
metadata. The firmware image currently on the connected dongle emitted
`f90000` (`0 dBm`, `0 dB`) for several valid telemetry packets. These zeros
are invalid signal measurements, so the receiver prints `null` and the
dashboard shows `n/a`. An earlier report showed valid RSSI/SNR using the same
dongle firmware. The source in `meshcore-waveshare-usb-lora/firmware/src/radio.c`
has a packet-status read bug and a candidate fix is built, but the earlier
measurement path has not been established. Do not flash solely on the basis of
the current `null` display; compare a prior raw log or repeat the prior test
configuration first. A build alone does not change the dongle. If flashing is
eventually needed, this board's USB serial connection cannot flash its
GD32F103; see `meshcore-waveshare-usb-lora/README.md` for the SWD pads and
flashing procedure.

To build the corrected dongle image on this Mac:

```bash
cd /Volumes/Raj/Projects/Rocket_BlackBox/meshcore-waveshare-usb-lora/firmware
make -j2 PREFIX=../toolchain/arm-gnu-toolchain-15.2.rel1-darwin-arm64-arm-none-eabi/bin/arm-none-eabi
```

For the graphical dashboard instead, start it with:

```bash
cd /Volumes/Raj/Projects/Rocket_BlackBox/dashboard
npm install
npm run dev
```

Open `http://localhost:5173/` in Chrome or Edge. If the Waveshare CH343 dongle was
previously paired in the browser, the dashboard automatically connects to it
when available. Otherwise, click **Connect LoRa Receiver** (on **Devices** or the
topbar menu) and select the port to grant permission once; auto-connect will then
reconnect on future sessions and when plugged in. The dashboard configures the
custom KISS firmware and displays each received packet. Demo data is disabled;
packet counts, sequence gaps, and arrival rate replace the unverified RSSI/SNR
display. Stop the terminal receiver before connecting the dashboard: they cannot
both open the same serial port.

## 3. View the payload's own USB output

In terminal 2, while the payload is running its application:

```bash
cd /Volumes/Raj/Projects/Rocket_BlackBox/firmware
~/.platformio/penv/bin/pio device monitor \
  --port /dev/cu.usbmodemA4CB8FC7E48C2 --baud 115200
```

Replace the port with the current Espressif application port. Type `i` and
Enter for device/LoRa/logging status; `s` toggles the USB JSON stream; `l`
toggles flash logging; `t` sends a LoRa test packet; `h` prints help. The
application streams USB JSON automatically, so no command is needed to start
telemetry. Exit the monitor with Ctrl-C before uploading firmware or opening
that same port in another program. Only one program can own a serial port at a
time.

## 4. Build or reflash the payload (only when firmware changes)

The new flight image checks BNO055 and Bus 1 sensor reads while running. After
repeated failures it restarts only the affected I2C bus and retries the sensor;
failed samples clear that sensor's telemetry status flag. USB output logs lines
starting `# BNO055` or `# I2C Bus 1` when recovery runs. This behavior takes
effect only after uploading the new payload image.

```bash
cd /Volumes/Raj/Projects/Rocket_BlackBox/firmware
~/.platformio/penv/bin/pio run -e rocket_payload_telemetry
```

For upload, keep the board powered; hold **BOOT/GPIO0**, tap **RESET/EN**,
release RESET, then release BOOT. Confirm that the download-mode USB port
appears, then run:

```bash
~/.platformio/penv/bin/pio run -e rocket_payload_telemetry -t upload \
  --upload-port /dev/cu.usbmodem1101
```

After the upload succeeds, tap **RESET/EN with BOOT released** to start the
application. The flight image is stored in flash and normally starts again on
power-up; it does not need reflashing each time. The diagnostic image is a
different build (`-e rocket_payload_diagnostic`) and does not transmit the
flight LoRa packets.

## Why does this board currently need a manual RESET after power cycling?

The observed behavior is that the board sometimes enumerates over USB after a
cold power-on but the flight application does not start sending telemetry;
pressing RESET/EN then starts it. The exact electrical cause has **not** been
measured yet. The schematic shows a push-button power latch controlled by
`PWR_EN`/GPIO40 and a separate RESET circuit with a 10 kOhm pull-up and 1 uF
capacitor. The firmware drives GPIO40 high at the very start of `setup()` to
hold power on. A manual reset restarts the ESP32 after the power rails have
already settled. That makes power-ramp/reset timing a plausible cause, but it
does not prove that the RESET circuit is defective. GPIO0 being low at boot
would instead select download mode.

To distinguish the cases after the next cold power-on, run the port-list
command in section 1 **before** pressing RESET:

| Observation before manual RESET | Meaning / next check |
| --- | --- |
| No payload USB port | Check the power switch/latch, 3.3 V rail, and GPIO40 hold path. |
| Download-mode port (`/dev/cu.usbmodem1101`) | Check that BOOT/GPIO0 is released and pulled high during power-up. |
| Application port, but no USB JSON or LoRa packets | The MCU enumerated, but application startup may have stalled; capture the startup serial log and check the reset/power ramp. |
| USB JSON is present, but the receiver is silent | Restart the Waveshare receiver command; its radio settings are volatile. |

The 10 kOhm/1 uF RESET values in the schematic match Espressif's usual RC
recommendation, but Espressif notes that an RC alone can be insufficient with
a slow or unstable supply. An oscilloscope capture of the 3.3 V rail and RESET
line during cold power-on, plus GPIO0 level and the USB boot log, would identify
the actual fault before changing PCB components.

Sources: [local payload schematic](pcb/Payload_Schematic.pdf),
[`power_mgr.cpp`](firmware/src/power_mgr.cpp),
[Espressif ESP32-S3 power-up/reset guidance](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/schematic-checklist.html),
[Espressif ESP32-S3 boot-mode guidance](https://docs.espressif.com/projects/esptool/en/latest/esp32s3/advanced-topics/boot-mode-selection.html).
