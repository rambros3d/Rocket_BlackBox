#!/usr/bin/env python3
"""
Rocket BlackBox — LoRa Ground Station Telemetry Receiver
---------------------------------------------------------
Interfaces with the Waveshare USB-to-LoRa-HF dongle (running meshcore-waveshare-usb-lora)
over USB serial (/dev/ttyACM* or /dev/ttyUSB*) to receive real-time rocket telemetry packets.

Decodes KISS TNC frames (SLIP framing) and extracts payload data along with RSSI and SNR metrics.
"""

import argparse
import csv
import datetime
import os
import struct
import sys
import time

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    sys.exit("Error: pyserial is required. Install with: pip install pyserial")

# Standard KISS TNC Framing Constants
FEND = 0xC0
FESC = 0xDB
TFEND = 0xDC
TFESC = 0xDD

# KISS Commands
CMD_DATA = 0x00
CMD_TXDELAY = 0x01
CMD_PERSISTENCE = 0x02
CMD_SLOTTIME = 0x03
CMD_FULLDUPLEX = 0x05
CMD_SETHARDWARE = 0x06

# SetHardware Sub-commands
HW_CMD_SET_RADIO = 0x09
HW_CMD_GET_RADIO = 0x0B
HW_CMD_GET_VERSION = 0x11
HW_CMD_GET_DEVICE_NAME = 0x16
HW_CMD_PING = 0x17
HW_CMD_SET_SIGNAL_REPORT = 0x19


def escape_slip(payload: bytes) -> bytes:
    out = bytearray()
    for b in payload:
        if b == FEND:
            out += bytes((FESC, TFEND))
        elif b == FESC:
            out += bytes((FESC, TFESC))
        else:
            out.append(b)
    return bytes(out)


def encode_kiss_frame(cmd: int, payload: bytes = b"") -> bytes:
    return bytes((FEND, cmd)) + escape_slip(payload) + bytes((FEND,))


class SlipDecoder:
    """Incremental SLIP / KISS frame decoder."""

    def __init__(self):
        self.buf = bytearray()
        self.have_type = False
        self.cmd = 0
        self.escaping = False

    def feed(self, chunk: bytes):
        frames = []
        for b in chunk:
            if self.escaping:
                self.escaping = False
                if b == TFEND:
                    b = FEND
                elif b == TFESC:
                    b = FESC
                else:
                    self.buf.clear()
                    self.have_type = False
                    continue
                if self.have_type and len(self.buf) < 1024:
                    self.buf.append(b)
                continue

            if b == FESC:
                self.escaping = True
                continue

            if b == FEND:
                if self.have_type:
                    frames.append((self.cmd, bytes(self.buf)))
                self.buf.clear()
                self.have_type = False
                continue

            if not self.have_type:
                self.cmd = b
                self.have_type = True
                continue

            if len(self.buf) < 1024:
                self.buf.append(b)

        return frames


def autodetect_port():
    """Finds the CH343 USB-to-LoRa serial port."""
    for p in serial.tools.list_ports.comports():
        if "1A86:55D3" in p.hwid.upper() or "USB SINGLE SERIAL" in p.description.upper():
            return p.device
    if os.path.exists("/dev/ttyACM0"):
        return "/dev/ttyACM0"
    return None


def query_modem_info(ser):
    """Queries device name, version, and radio configuration."""
    ser.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_PING,))))
    time.sleep(0.05)
    ser.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_GET_DEVICE_NAME,))))
    time.sleep(0.05)
    ser.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_GET_VERSION,))))
    time.sleep(0.05)
    ser.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_GET_RADIO,))))
    time.sleep(0.1)

    decoder = SlipDecoder()
    deadline = time.time() + 1.0
    info = {}

    while time.time() < deadline:
        if ser.in_waiting:
            chunk = ser.read(ser.in_waiting)
            for cmd, body in decoder.feed(chunk):
                if cmd == CMD_SETHARDWARE and body:
                    sub = body[0]
                    sub_body = body[1:]
                    if sub == 0x97:
                        info["pong"] = True
                    elif sub == 0x96:
                        info["device_name"] = sub_body.decode("utf-8", "replace")
                    elif sub == 0x91 and sub_body:
                        info["version"] = f"{sub_body[0] >> 4}.{sub_body[0] & 0x0F}"
                    elif sub == 0x8B and len(sub_body) >= 10:
                        freq, bw, sf, cr = struct.unpack("<IIBB", sub_body[:10])
                        info["radio"] = (
                            f"{freq / 1e6:.3f} MHz, BW {bw / 1e3:.1f} kHz, SF{sf}, CR 4/{cr}"
                        )
        time.sleep(0.02)
    return info


def configure_radio(ser, freq: int, bw: int, sf: int, cr: int):
    """Sets RF parameters on the modem."""
    payload = struct.pack("<II", freq, bw) + bytes((sf, cr))
    ser.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_SET_RADIO,)) + payload))
    time.sleep(0.1)


def main():
    parser = argparse.ArgumentParser(
        description="Rocket BlackBox Ground Station Telemetry Receiver"
    )
    parser.add_argument("-p", "--port", help="Serial port (e.g. /dev/ttyACM0)")
    parser.add_argument("-b", "--baud", type=int, default=115200, help="Baud rate (default: 115200)")
    parser.add_argument("--freq", type=int, help="Radio frequency in Hz (e.g. 869618000 or 868000000)")
    parser.add_argument("--bw", type=int, help="Bandwidth in Hz (e.g. 62500, 125000, 250000)")
    parser.add_argument("--sf", type=int, help="Spreading factor (5-12)")
    parser.add_argument("--cr", type=int, help="Coding rate denominator (5, 6, 7, 8 for 4/5..4/8)")
    parser.add_argument("--log", help="Path to CSV file to log received packets")
    args = parser.parse_args()

    port = args.port or autodetect_port()
    if not port:
        sys.exit("Error: No serial port found. Specify with --port /dev/ttyACM*")

    print(f"Connecting to modem on {port} @ {args.baud} baud...")
    try:
        ser = serial.Serial(port, args.baud, timeout=0.1)
    except Exception as e:
        sys.exit(f"Failed to open port {port}: {e}")

    try:
        ser.reset_input_buffer()
        info = query_modem_info(ser)
        print(f"Device Name : {info.get('device_name', 'Unknown')}")
        print(f"Firmware    : v{info.get('version', 'Unknown')}")
        print(f"Current RF  : {info.get('radio', 'Unknown')}")

        if args.freq or args.bw or args.sf or args.cr:
            freq = args.freq or 869618000
            bw = args.bw or 62500
            sf = args.sf or 8
            cr = args.cr or 8
            print(f"Tuning radio to {freq / 1e6:.3f} MHz, BW {bw / 1e3:.1f} kHz, SF{sf}, CR 4/{cr}...")
            configure_radio(ser, freq, bw, sf, cr)
            time.sleep(0.1)

        # Enable signal reporting (0x19 0x01)
        ser.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_SET_SIGNAL_REPORT, 0x01))))
        time.sleep(0.05)

        log_file = None
        csv_writer = None
        if args.log:
            file_exists = os.path.exists(args.log)
            log_file = open(args.log, "a", newline="", encoding="utf-8")
            csv_writer = csv.writer(log_file)
            if not file_exists:
                csv_writer.writerow(["timestamp", "rssi_dbm", "snr_db", "length_bytes", "hex_payload", "ascii_text"])
            print(f"Logging telemetry packets to: {args.log}")

        print("\n" + "=" * 70)
        print("  ROCKET BLACKBOX TELEMETRY RECEIVER LISTENING (Ctrl+C to stop)")
        print("=" * 70 + "\n")

        decoder = SlipDecoder()
        packet_count = 0
        pending_packet = None

        while True:
            if ser.in_waiting:
                chunk = ser.read(ser.in_waiting)
                for cmd, body in decoder.feed(chunk):
                    # Data frame
                    if cmd == CMD_DATA and body:
                        pending_packet = body
                        # Check if no signal report needed or print immediately if standalone
                    # Hardware response
                    elif cmd == CMD_SETHARDWARE and body:
                        sub = body[0]
                        sub_body = body[1:]
                        # 0xF9 is rx-meta: struct <bb (snr_quarter, rssi)
                        if sub == 0xF9 and len(sub_body) >= 2 and pending_packet:
                            snr_q, rssi = struct.unpack("<bb", sub_body[:2])
                            snr = snr_q / 4.0
                            packet_count += 1
                            ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

                            # ASCII printable preview
                            ascii_preview = "".join(
                                chr(b) if 32 <= b <= 126 else "." for b in pending_packet
                            )

                            print(f"[{ts}] PKT #{packet_count:<4} | RSSI: {rssi:>4} dBm | SNR: {snr:>5.1f} dB | {len(pending_packet):>3}B")
                            print(f"  HEX: {pending_packet.hex()}")
                            print(f"  ASC: {ascii_preview}\n")

                            if csv_writer and log_file:
                                csv_writer.writerow([ts, rssi, snr, len(pending_packet), pending_packet.hex(), ascii_preview])
                                log_file.flush()

                            pending_packet = None

            time.sleep(0.01)

    except KeyboardInterrupt:
        print("\nReceiver stopped by user.")
    finally:
        ser.close()
        if log_file:
            log_file.close()


if __name__ == "__main__":
    main()
