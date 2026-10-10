#!/usr/bin/env python3
"""Receive Rocket BlackBox telemetry through the Waveshare KISS modem.

Run: python tools/rocket_telemetry.py --port /dev/cu.usbmodem...
The modem is configured in RAM to match the payload's 866 MHz, SF9, BW125 kHz,
CR4/5 link. Each CRC-checked packet is printed as one JSON line.
"""

import argparse
import json
import math
import struct
import sys
import time

import kissmon


FRAME_SIZE = 88
SOURCE = ("NONE", "MS5607", "BME680", "SCD40")
FLAGS = ("ms5607", "bme680", "scd40", "sgp41", "ltr390", "tsl2591",
         "bno055", "gps_uart", "flash", "sdcard", "logging", "pps_lock", "gps_time")


def crc16(data):
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ (0x1021 if crc & 0x8000 else 0)) & 0xFFFF
    return crc


def decode(payload):
    """Find a valid frame even if a legacy DTU prefix precedes the RB magic."""
    for offset in range(len(payload) - FRAME_SIZE + 1):
        b = payload[offset:offset + FRAME_SIZE]
        if b[:3] != b"RB\x01" or crc16(b[:-2]) != struct.unpack_from("<H", b, 86)[0]:
            continue

        def u8(i): return b[i]
        def i8(i): return struct.unpack_from("<b", b, i)[0]
        def u16(i): return struct.unpack_from("<H", b, i)[0]
        def i16(i): return struct.unpack_from("<h", b, i)[0]
        def u32(i): return struct.unpack_from("<I", b, i)[0]
        def i32(i): return struct.unpack_from("<i", b, i)[0]

        flags = u16(11)
        sources = u8(50)
        frame = {
            "type": "telemetry", "dev": f"RBB-{u16(3):04X}",
            "seq": u16(5), "up": u32(7), "flags": flags,
            "status": {name: bool(flags & (1 << bit)) for bit, name in enumerate(FLAGS)},
            "gps": {
                "fix": u8(13), "sats": u8(14), "hdop": u16(15) / 10,
                "lat": i32(17) / 1e7, "lon": i32(21) / 1e7,
                "alt": i32(25) / 100, "spd": u16(29) / 10,
                "hdg": u16(31) / 100,
                "utc": f"{u8(33):02}:{u8(34):02}:{u8(35):02}" if flags & (1 << 12) else None,
            },
            "baro": {"alt": i32(36) / 100, "vs": i16(40) / 10, "p": u32(42) / 100},
            "env": {
                "t": i16(46) / 100, "h": u16(48) / 100, "p": u32(42) / 100,
                "t_src": SOURCE[(sources >> 4) & 3],
                "h_src": SOURCE[(sources >> 2) & 3],
                "p_src": SOURCE[sources & 3],
                "co2": u16(51), "voc": u16(53), "nox": u16(55),
                "lux": (lambda v: v if math.isfinite(v) else None)(struct.unpack_from("<f", b, 57)[0]),
                "ir": u16(61),
            },
            "imu": {
                "roll": i16(63) / 10, "pitch": i16(65) / 10, "yaw": u16(67) / 10,
                "ax": i16(69) / 100, "ay": i16(71) / 100, "az": i16(73) / 100,
                "gx": i16(75) / 10, "gy": i16(77) / 10, "gz": i16(79) / 10,
                "cal": [(u8(81) >> shift) & 3 for shift in (6, 4, 2, 0)],
            },
            "sys": {"bat": u16(82) / 1000, "bat_pct": u8(84), "mcu_t": i8(85)},
        }
        # The air format uses zero for fields from unavailable sensors. Keep
        # genuine zero readings (for example stationary vertical speed), but
        # expose unavailable measurements as null in the terminal output.
        if not frame["gps"]["fix"]:
            for key in ("lat", "lon", "alt", "spd", "hdg", "hdop"):
                frame["gps"][key] = None
        if not (flags & (1 << 6)):
            for key in ("roll", "pitch", "yaw", "ax", "ay", "az", "gx", "gy", "gz", "cal"):
                frame["imu"][key] = None
        if not (flags & (1 << 2)):
            frame["env"]["co2"] = None
        if not (flags & (1 << 3)):
            frame["env"]["voc"] = None
            frame["env"]["nox"] = None
        if not (flags & ((1 << 4) | (1 << 5))):
            frame["env"]["lux"] = None
        if not (flags & (1 << 5)):
            frame["env"]["ir"] = None
        if frame["env"]["t_src"] == "NONE":
            frame["env"]["t"] = None
        if frame["env"]["h_src"] == "NONE":
            frame["env"]["h"] = None
        if frame["env"]["p_src"] == "NONE":
            frame["env"]["p"] = None
        if not (flags & (1 << 0)):
            frame["baro"]["alt"] = None
            frame["baro"]["vs"] = None
        if frame["env"]["p_src"] == "NONE":
            frame["baro"]["p"] = None
        return frame
    return None


def configure(ser):
    radio = struct.pack("<II", 866000000, 125000) + b"\x09\x05"
    ser.write(kissmon.encode(kissmon.CMD_SETHARDWARE, b"\x09" + radio))
    decoder = kissmon.Decoder()
    deadline = time.monotonic() + 3
    acknowledged = False
    while time.monotonic() < deadline:
        for cmd, body in decoder.feed(ser.read(ser.in_waiting or 1)):
            if cmd == kissmon.CMD_SETHARDWARE and body == b"\xF0":
                acknowledged = True
                break
            if cmd == kissmon.CMD_SETHARDWARE and body[:1] == b"\xF1":
                raise RuntimeError(f"modem rejected radio settings: {body.hex()}")
        if acknowledged:
            break
    if not acknowledged:
        raise RuntimeError("modem did not acknowledge radio settings")

    ser.write(kissmon.encode(kissmon.CMD_SETHARDWARE, b"\x0B"))
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        for cmd, body in decoder.feed(ser.read(ser.in_waiting or 1)):
            if cmd == kissmon.CMD_SETHARDWARE and body[:1] == b"\x8B":
                if body[1:] != radio:
                    raise RuntimeError(f"radio readback differs: {body[1:].hex()}")
                ser.write(kissmon.encode(kissmon.CMD_SETHARDWARE, b"\x19\x01"))
                return
    raise RuntimeError("modem did not confirm radio settings")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", "-p", required=True, help="Waveshare KISS serial port")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--count", type=int, default=0, help="exit after N valid telemetry packets")
    parser.add_argument("--timeout", type=float, default=0, help="exit after N seconds without a packet")
    args = parser.parse_args()

    import serial
    count = 0
    last_packet = time.monotonic()
    with serial.Serial(args.port, args.baud, timeout=0.2) as ser:
        configure(ser)
        print("# Listening on 866 MHz, SF9, BW125 kHz, CR4/5", file=sys.stderr, flush=True)
        decoder = kissmon.Decoder()
        pending = None
        try:
            while True:
                for cmd, body in decoder.feed(ser.read(ser.in_waiting or 1)):
                    if cmd == kissmon.CMD_DATA:
                        frame = decode(body)
                        if frame is not None:
                            frame["link"] = {"rssi": None, "snr": None}
                            if pending is not None:
                                print(json.dumps(pending, allow_nan=False), flush=True)
                                count += 1
                            pending = frame
                            last_packet = time.monotonic()
                    elif cmd == kissmon.CMD_SETHARDWARE and body[:1] == b"\xF9" and len(body) >= 3:
                        if pending is not None:
                            snr_q, rssi = struct.unpack_from("<bb", body, 1)
                            valid_signal = rssi < 0
                            pending["link"] = {"rssi": rssi if valid_signal else None,
                                               "snr": snr_q / 4 if valid_signal else None}
                            print(json.dumps(pending, allow_nan=False), flush=True)
                            pending = None
                            count += 1
                    elif cmd == kissmon.CMD_SETHARDWARE and body[:1] == b"\xF1":
                        print(f"# modem error: {body.hex()}", file=sys.stderr)
                if pending is not None and time.monotonic() - last_packet > 0.5:
                    print(json.dumps(pending, allow_nan=False), flush=True)
                    pending = None
                    count += 1
                if args.count and count >= args.count:
                    return 0
                if args.timeout and time.monotonic() - last_packet >= args.timeout:
                    print("No valid telemetry packets received", file=sys.stderr)
                    return 1
        except KeyboardInterrupt:
            return 0


if __name__ == "__main__":
    sys.exit(main())
