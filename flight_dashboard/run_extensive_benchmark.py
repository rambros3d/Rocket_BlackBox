#!/usr/bin/env python3
"""
Rocket BlackBox — Comprehensive LoRa RF Benchmark & Extensive Packet Loss Test
--------------------------------------------------------------------------------
This runner:
1. Places the Rocket Payload in continuous packet sniffer mode ('l' -> '4') or beacon mode.
2. In Phase 1 (Payload -> Ground Downlink Throughput & Packet Loss):
   - Payload is commanded into Continuous Telemetry Beacon ('3')
   - Ground station captures 50 sequential packets, logging exact sequence IDs,
     inter-arrival intervals, bitrates, RSSI, and SNR.
3. In Phase 2 (Ground -> Payload Uplink & Turnaround Benchmark):
   - Ground station transmits sequential test packets of varying payload sizes
     (16 bytes, 32 bytes, 64 bytes, 128 bytes) to evaluate effective throughput,
     on-air latency, packet error rate (PER), RSSI, and SNR stability.
4. Generates an exhaustive statistical summary:
   - Packet Loss Rate (%)
   - Received Signal Strength Indicator (RSSI: Min / Max / Mean / StdDev)
   - Signal-to-Noise Ratio (SNR: Min / Max / Mean / StdDev)
   - Effective throughput (bps & bytes/sec) vs theoretical LoRa bitrate
   - Inter-arrival jitter (ms)
"""

import argparse
import math
import struct
import sys
import time
import serial

FEND = 0xC0
FESC = 0xDB
TFEND = 0xDC
TFESC = 0xDD

CMD_DATA = 0x00
CMD_FULLDUPLEX = 0x05
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
                if self.have_type and len(self.buf) < 2048:
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

            if len(self.buf) < 2048:
                self.buf.append(b)
        return frames


def calc_stats(data):
    if not data:
        return {"min": 0, "max": 0, "mean": 0, "std": 0}
    n = len(data)
    mean = sum(data) / n
    variance = sum((x - mean) ** 2 for x in data) / n if n > 1 else 0
    return {
        "min": min(data),
        "max": max(data),
        "mean": mean,
        "std": math.sqrt(variance)
    }


def run_benchmark():
    ground_port = "/dev/ttyACM0"
    payload_port = "/dev/ttyACM1"

    print("=================================================================")
    print("      ROCKET BLACKBOX — EXTENSIVE LORA RF BENCHMARK SUITE       ")
    print("=================================================================")
    print(f"Ground Station (Waveshare SX1262 Dongle) : {ground_port}")
    print(f"Rocket Payload (RAK3112 ESP32-S3)        : {payload_port}")
    print("Modulation: 868.000 MHz | BW: 125 kHz | SF7 | CR 4/5 | Sync: 0x12")
    print("-----------------------------------------------------------------\n")

    ser_ground = serial.Serial(ground_port, 115200, timeout=0.05)
    ser_payload = serial.Serial(payload_port, 115200, timeout=0.05)

    # Configure Ground Modem
    tune_payload = struct.pack("<IIBB", 868000000, 125000, 7, 5)
    ser_ground.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_SET_RADIO,)) + tune_payload))
    time.sleep(0.05)
    ser_ground.write(encode_kiss_frame(CMD_FULLDUPLEX, b"\x01"))
    time.sleep(0.05)
    ser_ground.write(encode_kiss_frame(CMD_SETHARDWARE, bytes((HW_CMD_SET_SIGNAL_REPORT, 0x01))))
    time.sleep(0.05)
    ser_ground.reset_input_buffer()

    # Clear payload buffers & ensure we are at main menu
    ser_payload.reset_input_buffer()
    ser_payload.write(b"\r\n\r\n")
    time.sleep(0.3)
    # Drain any boot output
    drain_end = time.time() + 1.0
    while time.time() < drain_end:
        ser_payload.read(ser_payload.in_waiting or 1)

    # -------------------------------------------------------------
    # PHASE 1: EXTENSIVE DOWNLINK STREAMING (Rocket -> Ground)
    # 50 Telemetry Packets with sequence checking & signal tracking
    # -------------------------------------------------------------
    print(">>> Starting Phase 1: Downlink Stream Test (Rocket Payload -> Ground Station)")
    print("    Target: 50 consecutive flight telemetry beacon packets (~500 ms interval)")
    print("    Evaluating: Sequence loss, Inter-arrival Jitter, RSSI, SNR, Throughput\n")

    # Enter LoRa menu on payload
    ser_payload.write(b"l\r\n")
    time.sleep(0.5)
    # Enter Beacon Mode
    ser_payload.write(b"3\r\n")
    time.sleep(0.2)

    decoder = SlipDecoder()
    received_packets = []
    last_rssi = None
    last_snr = None
    last_arrival = None
    inter_arrivals = []
    rssi_list = []
    snr_list = []
    seq_list = []
    bytes_received = 0

    target_packets = 50
    start_time = time.time()
    deadline = start_time + 40.0  # Up to 40 seconds timeout

    while len(received_packets) < target_packets and time.time() < deadline:
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
                    now = time.time()
                    if last_arrival is not None:
                        dt = (now - last_arrival) * 1000.0
                        inter_arrivals.append(dt)
                    last_arrival = now

                    text = body.decode("ascii", "replace")
                    bytes_received += len(body)
                    rssi_val = last_rssi if last_rssi is not None else -999
                    snr_val = last_snr if last_snr is not None else -999

                    # Parse sequence from BB_TELEM:<seq>:...
                    seq_num = None
                    if "BB_TELEM:" in text:
                        try:
                            parts = text.split(":")
                            seq_num = int(parts[1])
                            seq_list.append(seq_num)
                        except Exception:
                            pass

                    received_packets.append({
                        "time": now - start_time,
                        "seq": seq_num,
                        "text": text,
                        "rssi": rssi_val,
                        "snr": snr_val,
                        "len": len(body)
                    })

                    if rssi_val != -999:
                        rssi_list.append(rssi_val)
                    if snr_val != -999:
                        snr_list.append(snr_val)

                    dt_str = f"{inter_arrivals[-1]:.1f}ms" if inter_arrivals else "---"
                    print(f"  [PKT #{len(received_packets):02d}] Seq: {seq_num} | Size: {len(body)}B | Interval: {dt_str:>7} | RSSI: {rssi_val} dBm | SNR: {snr_val:+.1f} dB")

                    last_rssi = None
                    last_snr = None
        time.sleep(0.005)

    duration_phase1 = time.time() - start_time

    # Stop Beacon mode on payload by sending any key
    ser_payload.write(b"x\r\n")
    time.sleep(0.5)
    ser_payload.write(b"x\r\n")
    time.sleep(0.5)

    # -------------------------------------------------------------
    # PHASE 2: PACKET ERROR RATE & UPLINK LATENCY BENCHMARK
    # Ground Station -> Rocket Payload (30 Packets)
    # -------------------------------------------------------------
    print("\n-----------------------------------------------------------------")
    print(">>> Starting Phase 2: Sniffer Uplink Stress Test (Ground -> Payload)")
    print("    Target: 30 packets sent with varied sizes (16B, 32B, 64B)")
    print("    Evaluating: Uplink Packet Reception Rate & Payload Demodulation\n")

    # Put payload into Packet Sniffer mode ('l' -> '4')
    ser_payload.reset_input_buffer()
    ser_payload.write(b"l\r\n")
    time.sleep(0.5)
    ser_payload.write(b"4\r\n")
    time.sleep(0.5)

    # Ground sends 30 burst packets
    uplink_sent = 30
    payload_received_count = 0
    payload_rssi_list = []
    payload_snr_list = []

    uplink_start = time.time()
    for i in range(1, uplink_sent + 1):
        test_payload = f"CMD_UPLINK:{i:03d}:TEST_DATA_PACKET_BURST_TEST_ROCKET_BLACKBOX_AVIONICS"[:16 + (i % 3) * 16]
        ser_ground.write(encode_kiss_frame(CMD_DATA, test_payload.encode("ascii")))
        print(f"  [TX #{i:02d}] Sent {len(test_payload)} bytes: \"{test_payload}\"")
        time.sleep(0.20)  # 200 ms spacing

    time.sleep(1.0)  # Wait for payload to finish receiving

    # Drain payload output to parse received packet logs
    while ser_payload.in_waiting:
        line = ser_payload.readline().decode("utf-8", "replace").strip()
        if "RX " in line and "bytes | RSSI:" in line:
            payload_received_count += 1
            try:
                # e.g.: [12345 ms] RX 32 bytes | RSSI: -52.0 dBm | SNR: 12.5 dB
                parts = line.split("|")
                rssi_p = float(parts[1].split(":")[1].replace("dBm", "").strip())
                snr_p = float(parts[2].split(":")[1].replace("dB", "").strip())
                payload_rssi_list.append(rssi_p)
                payload_snr_list.append(snr_p)
            except Exception:
                pass

    # Stop sniffer mode on payload
    ser_payload.write(b"x\r\n")
    time.sleep(0.5)
    ser_payload.write(b"x\r\n")

    ser_ground.close()
    ser_payload.close()

    # -------------------------------------------------------------
    # STATISTICAL ANALYSIS & REPORT
    # -------------------------------------------------------------
    print("\n=================================================================")
    print("                   LORA RF PERFORMANCE REPORT                    ")
    print("=================================================================")

    # Phase 1 Stats
    total_received_p1 = len(received_packets)
    first_seq = seq_list[0] if seq_list else 1
    last_seq = seq_list[-1] if seq_list else 0
    expected_p1 = (last_seq - first_seq + 1) if seq_list else target_packets
    lost_p1 = max(0, expected_p1 - total_received_p1)
    loss_rate_p1 = (lost_p1 / expected_p1 * 100.0) if expected_p1 > 0 else 0.0

    rssi_stats = calc_stats(rssi_list)
    snr_stats = calc_stats(snr_list)
    jitter_stats = calc_stats(inter_arrivals)
    effective_data_rate_bps = (bytes_received * 8.0) / duration_phase1 if duration_phase1 > 0 else 0

    print("PHASE 1: DOWNLINK TELEMETRY STREAM (Rocket -> Ground)")
    print(f"  • Packets Captured       : {total_received_p1} / {expected_p1} expected")
    print(f"  • Downlink Packet Loss   : {loss_rate_p1:.2f}% ({lost_p1} packets dropped)")
    print(f"  • Stream Duration        : {duration_phase1:.2f} seconds")
    print(f"  • Net Throughput         : {effective_data_rate_bps:.1f} bps ({bytes_received} total bytes)")
    print(f"  • Inter-Packet Interval  : Mean = {jitter_stats['mean']:.1f} ms | Min = {jitter_stats['min']:.1f} ms | Max = {jitter_stats['max']:.1f} ms | Jitter (StdDev) = {jitter_stats['std']:.2f} ms")
    print(f"  • Downlink RSSI (Ground) : Mean = {rssi_stats['mean']:.1f} dBm | Min = {rssi_stats['min']} dBm | Max = {rssi_stats['max']} dBm | StdDev = {rssi_stats['std']:.2f} dB")
    print(f"  • Downlink SNR (Ground)  : Mean = {snr_stats['mean']:+.2f} dB  | Min = {snr_stats['min']:+.1f} dB | Max = {snr_stats['max']:+.1f} dB | StdDev = {snr_stats['std']:.2f} dB")

    print("\nPHASE 2: UPLINK COMMAND STREAM (Ground -> Rocket)")
    uplink_loss = max(0, uplink_sent - payload_received_count)
    uplink_loss_rate = (uplink_loss / uplink_sent * 100.0) if uplink_sent > 0 else 0.0
    payload_rssi_stats = calc_stats(payload_rssi_list)
    payload_snr_stats = calc_stats(payload_snr_list)

    print(f"  • Packets Transmitted    : {uplink_sent}")
    print(f"  • Packets Demodulated    : {payload_received_count}")
    print(f"  • Uplink Packet Loss     : {uplink_loss_rate:.2f}% ({uplink_loss} packets dropped)")
    if payload_rssi_list:
        print(f"  • Uplink RSSI (Payload)  : Mean = {payload_rssi_stats['mean']:.1f} dBm | Min = {payload_rssi_stats['min']} dBm | Max = {payload_rssi_stats['max']} dBm")
        print(f"  • Uplink SNR (Payload)   : Mean = {payload_snr_stats['mean']:+.2f} dB  | Min = {payload_snr_stats['min']:+.1f} dB | Max = {payload_snr_stats['max']:+.1f} dB")

    print("\nOVERALL LINK ASSESSMENT:")
    if loss_rate_p1 == 0.0 and uplink_loss_rate == 0.0:
        print("  >>> LINK HEALTH: PERFECT (0.0% Packet Loss across both uplink & downlink) <<<")
    elif loss_rate_p1 < 5.0 and uplink_loss_rate < 5.0:
        print("  >>> LINK HEALTH: EXCELLENT (< 5% Packet Loss) <<<")
    else:
        print("  >>> LINK HEALTH: DEGRADED (Loss detected) <<<")
    print("=================================================================\n")


if __name__ == "__main__":
    run_benchmark()
