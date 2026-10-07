# Rocket BlackBox — Flight Dashboard & Ground Station

Ground station visualization, telemetry logging, and live receiver tools for the **Rocket BlackBox** avionics payload.

---

## Hardware Telemetry Receiver

The ground station uses a **Waveshare USB-to-LoRa-HF (TCXO)** dongle flashed with custom KISS firmware (`meshcore-waveshare-usb-lora`).

- **Interface:** USB Serial (`/dev/ttyACM0` or `/dev/ttyUSB*` via CH343)
- **Protocol:** Standard KISS TNC (SLIP byte framing)
- **RF Transceiver:** Semtech SX1262 (HF band: 850 – 930 MHz)
- **TCXO Oscillator:** Enabled via MCU GPIO `PD1` + SX1262 DIO3 supply

---

## Bidirectional Ping-Pong Verification

Use the automated ping-pong responder to verify link budget and RF turnaround with the rocket payload:

```bash
# Start automated ground responder on /dev/ttyACM0
python flight_dashboard/lora_ping_pong_ground.py --port /dev/ttyACM0 --freq 868000000 --bw 125000 --sf 7 --cr 5
```

Or run the full automated end-to-end test (interfacing concurrently with both the ground modem and the payload serial console):

```bash
python flight_dashboard/test_rf_ping_pong.py
```

Expected result: 10/10 packets received, 0.0% packet loss, ~216 ms average round-trip time.

---

## Real-Time Telemetry Receiver Client

[`lora_ground_receiver.py`](file:///home/sun/Filelink/PCBs/Rocket_BlackBox/flight_dashboard/lora_ground_receiver.py) connects directly to the USB modem, queries status, optionally reconfigures RF parameters, and streams live telemetry packets with RSSI and SNR link budget metrics.

### Basic Usage

Auto-detect the USB dongle and start listening on default parameters:

```bash
python flight_dashboard/lora_ground_receiver.py
```

### Specifying Frequency and Modulation

Tune to custom rocket RF parameters (e.g., 868.0 MHz, 125 kHz BW, SF7, CR 4/5):

```bash
python flight_dashboard/lora_ground_receiver.py \
  --port /dev/ttyACM0 \
  --freq 868000000 \
  --bw 125000 \
  --sf 7 \
  --cr 5
```

### Logging Packets to CSV

Log all received packets to a timestamped CSV file for flight post-processing:

```bash
python flight_dashboard/lora_ground_receiver.py --log flight_log.csv
```

CSV fields recorded: `timestamp`, `rssi_dbm`, `snr_db`, `length_bytes`, `hex_payload`, `ascii_text`.

---

## Low-Level Modem Diagnostics

You can also use the upstream diagnostic tool from `meshcore-waveshare-usb-lora`:

```bash
# Query hardware info and current RF configuration
python usb-to-lora-firmwares/meshcore-waveshare-usb-lora/tools/kissmon.py -p /dev/ttyACM0 info

# Live raw packet monitor
python usb-to-lora-firmwares/meshcore-waveshare-usb-lora/tools/kissmon.py -p /dev/ttyACM0 monitor
```
