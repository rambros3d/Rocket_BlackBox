#!/usr/bin/env python3
"""
Rocket BlackBox — End-to-End Bidirectional LoRa Ping-Pong Test Runner
---------------------------------------------------------------------
Concurrently runs:
1. Ground station KISS responder on /dev/ttyACM0 (Waveshare USB-to-LoRa-HF)
2. Payload diagnostic console on /dev/ttyACM1 (RAK3112 ESP32-S3)
   - Sends 'l' (LoRa Menu)
   - Sends '2' (Run 10-packet Ping-Pong Test)
   - Captures and displays real-time results from both ends!
"""

import threading
import time
import struct
import sys
import serial

FEND = 0xC0
FESC = 0xDB
TFEND = 0xDC
TFESC = 0xDD

CMD_DATA = 0x00
CMD_SETHARDWARE = 0x06
HW_CMD_SET_RADIO = 0x09
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


def run_test():
    ground_port = "/dev/ttyACM0"
    payload_port = "/dev/ttyACM1"

    print("Opening Ground Station modem on", ground_port)
    ser_ground = serial.Serial(ground_port, 115200, timeout=0.1)

    print("Opening Payload serial console on", payload_port)
    ser_payload = serial.Serial(payload_port, 115200, timeout=0.1)

    # 1. Configure Ground Station Radio: 868.0 MHz, 125 kHz BW, SF7, CR 4/5
    # payload: freq (uint32), bw (uint32), sf (uint8), cr (uint8)
    tune_payload = struct.pack("<IIBB", 868000000, 125000, 7, 5)
    ser_ground.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_SET_RADIO,)) + tune_payload))
    time.sleep(0.1)

    # Enable full-duplex (bypasses 500ms CSMA TX-delay for immediate turnaround)
    CMD_FULLDUPLEX = 0x05
    ser_ground.write(encode_kiss_frame(CMD_FULLDUPLEX, b"\x01"))
    time.sleep(0.05)

    # Enable signal reporting
    ser_ground.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_SET_SIGNAL_REPORT, 0x01))))
    time.sleep(0.1)
    ser_ground.reset_input_buffer()

    stop_event = threading.Event()
    ground_stats = {"pings": 0, "pongs": 0}

    # Background thread: Ground responder
    def ground_thread():
        decoder = SlipDecoder()
        last_rssi = None
        last_snr = None

        while not stop_event.is_set():
            if ser_ground.in_waiting:
                chunk = ser_ground.read(ser_ground.in_waiting)
                for cmd, body in decoder.feed(chunk):
                    if cmd == CMD_SETHARDWARE and body:
                        sub = body[0]
                        sub_body = body[1:]
                        if sub == 0xF9 and len(sub_body) >= 2:
                            snr_q, rssi = struct.unpack("<bb", sub_body[:2])
                            last_rssi = rssi
                            last_snr = snr_q / 4.0
                    elif cmd == CMD_DATA and body:
                        text = body.decode("ascii", "replace")
                        if text.startswith("PING"):
                            ground_stats["pings"] += 1
                            sig = f" [RSSI: {last_rssi} dBm, SNR: {last_snr:.1f} dB]" if last_rssi else ""
                            print(f"  [GROUND RX] {text}{sig}")

                            pong_text = "PONG" + text[4:]
                            time.sleep(0.08)  # 80ms turnaround time to allow payload to enter RX mode
                            ser_ground.write(encode_kiss_frame(CMD_DATA, pong_text.encode("ascii")))
                            ground_stats["pongs"] += 1
                            print(f"  [GROUND TX] {pong_text}")

                        last_rssi = None
                        last_snr = None
            time.sleep(0.005)

    gt = threading.Thread(target=ground_thread, daemon=True)
    gt.start()

    # Wait for payload to finish setup and display main menu
    print("Waiting for payload to boot and display main menu...")
    boot_deadline = time.time() + 15.0
    while time.time() < boot_deadline:
        if ser_payload.in_waiting:
            line = ser_payload.readline().decode("utf-8", "replace").strip()
            if line:
                print(f"[PAYLOAD BOOT] {line}")
                if "Select a diagnostic command:" in line or "DIAGNOSTIC CONSOLE" in line or ">" in line:
                    break
        time.sleep(0.05)

    time.sleep(0.5)
    ser_payload.reset_input_buffer()

    print("\n>>> Triggering LoRa menu on payload ('l')...")
    ser_payload.write(b"l\r\n")

    menu_deadline = time.time() + 5.0
    while time.time() < menu_deadline:
        if ser_payload.in_waiting:
            line = ser_payload.readline().decode("utf-8", "replace").strip()
            if line:
                print(f"[PAYLOAD MENU] {line}")
                if "Select option >" in line or "LORA DIAGNOSTIC MENU" in line:
                    break
        time.sleep(0.05)

    time.sleep(0.5)
    print("\n>>> Triggering Bidirectional Ping-Pong Test ('2')...\n")
    ser_payload.write(b"2\r\n")

    # Read test execution output
    test_start = time.time()
    while time.time() - test_start < 12.0:
        if ser_payload.in_waiting:
            line = ser_payload.readline().decode("utf-8", "replace").strip()
            if line:
                print(f"[PAYLOAD] {line}")
                if "PING-PONG TEST RESULTS:" in line:
                    # Capture remaining results
                    time.sleep(1.0)
                    while ser_payload.in_waiting:
                        print(f"[PAYLOAD] {ser_payload.readline().decode('utf-8', 'replace').strip()}")
                    break
        time.sleep(0.02)

    stop_event.set()
    time.sleep(0.2)
    ser_ground.close()
    ser_payload.close()

    print("\n=======================================================")
    print(f"Test Run Completed! Ground Handled: {ground_stats['pings']} Pings, {ground_stats['pongs']} Pongs")
    print("=======================================================")


if __name__ == "__main__":
    run_test()
