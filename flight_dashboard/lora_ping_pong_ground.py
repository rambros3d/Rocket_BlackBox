#!/usr/bin/env python3
"""
Rocket BlackBox — Ground Station Automated LoRa Ping-Pong Responder
---------------------------------------------------------------------
Connects to the Waveshare USB-to-LoRa dongle running meshcore-waveshare-usb-lora.
Tunes the SX1262 to match the rocket payload (868.0 MHz, 125 kHz BW, SF7, CR 4/5).
Listens for incoming "PING:<seq>:<time>" frames and immediately returns "PONG:<seq>:<time>".
"""

import argparse
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


def configure_radio(ser, freq: int, bw: int, sf: int, cr: int):
    """Sets RF parameters on the modem."""
    payload = struct.pack("<II", freq, bw) + bytes((sf, cr))
    ser.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_SET_RADIO,)) + payload))
    time.sleep(0.1)


def main():
    parser = argparse.ArgumentParser(
        description="Ground Station Automated LoRa Ping-Pong Responder"
    )
    parser.add_argument("-p", "--port", help="Serial port (e.g. /dev/ttyACM0)")
    parser.add_argument("-b", "--baud", type=int, default=115200, help="Baud rate (default: 115200)")
    parser.add_argument("--freq", type=int, default=868000000, help="Frequency in Hz (default: 868000000)")
    parser.add_argument("--bw", type=int, default=125000, help="Bandwidth in Hz (default: 125000)")
    parser.add_argument("--sf", type=int, default=7, help="Spreading factor (default: 7)")
    parser.add_argument("--cr", type=int, default=5, help="Coding rate denominator (default: 5 for 4/5)")
    args = parser.parse_args()

    port = args.port or autodetect_port()
    if not port:
        sys.exit("Error: No serial port found. Specify with --port /dev/ttyACM*")

    print(f"Opening Waveshare modem on {port} @ {args.baud} baud...")
    try:
        ser = serial.Serial(port, args.baud, timeout=0.1)
    except Exception as e:
        sys.exit(f"Failed to open port {port}: {e}")

    try:
        ser.reset_input_buffer()

        # Query ping & version
        ser.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_PING,))))
        time.sleep(0.05)
        ser.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_GET_DEVICE_NAME,))))
        time.sleep(0.05)

        # Tune to rocket frequency and modulation
        print(f"Tuning radio to {args.freq / 1e6:.3f} MHz, BW {args.bw / 1e3:.1f} kHz, SF{args.sf}, CR 4/{args.cr}...")
        configure_radio(ser, args.freq, args.bw, args.sf, args.cr)

        # Enable full duplex (bypasses 500ms CSMA TX-delay for instant turnaround)
        ser.write(encode_kiss_frame(CMD_FULLDUPLEX, b"\x01"))
        time.sleep(0.05)

        # Enable signal reporting
        ser.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_SET_SIGNAL_REPORT, 0x01))))
        time.sleep(0.05)

        print("\n" + "=" * 70)
        print("  GROUND STATION AUTOMATED PING-PONG RESPONDER ACTIVE")
        print("  Listening for PING packets from Rocket Payload... (Ctrl+C to stop)")
        print("=" * 70 + "\n")

        decoder = SlipDecoder()
        pings_received = 0
        pongs_sent = 0
        last_rssi = None
        last_snr = None

        while True:
            if ser.in_waiting:
                chunk = ser.read(ser.in_waiting)
                for cmd, body in decoder.feed(chunk):
                    # Signal metadata frame
                    if cmd == CMD_SETHARDWARE and body:
                        sub = body[0]
                        sub_body = body[1:]
                        if sub == 0xF9 and len(sub_body) >= 2:
                            snr_q, rssi = struct.unpack("<bb", sub_body[:2])
                            last_rssi = rssi
                            last_snr = snr_q / 4.0

                    # Data frame
                    elif cmd == CMD_DATA and body:
                        pings_received += 1
                        ts = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
                        text = body.decode("ascii", "replace")

                        sig_str = ""
                        if last_rssi is not None:
                            sig_str = f" | RSSI: {last_rssi:>4} dBm | SNR: {last_snr:>5.1f} dB"

                        print(f"[{ts}] RX #{pings_received:<4}: \"{text}\"{sig_str}")

                        # Check if message is a PING
                        if text.startswith("PING"):
                            pong_text = "PONG" + text[4:]
                            pong_bytes = pong_text.encode("ascii")

                            # Short turnaround delay allowing payload to transition from TX to RX
                            time.sleep(0.08)

                            # Immediate reply
                            ser.write(encode_kiss_frame(CMD_DATA, pong_bytes))
                            pongs_sent += 1
                            print(f"[{ts}] TX #{pongs_sent:<4}: Responded with \"{pong_text}\"")

                        last_rssi = None
                        last_snr = None

            time.sleep(0.005)

    except KeyboardInterrupt:
        print(f"\nResponder stopped by user. (Total Pings: {pings_received}, Pongs: {pongs_sent})")
    finally:
        ser.close()


if __name__ == "__main__":
    main()
