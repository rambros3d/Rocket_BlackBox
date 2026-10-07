#!/usr/bin/env bash
set -e

# Change directory to the project folder
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

LOG_FILE="$PROJECT_DIR/serial-log.txt"

# Clear the log file every time the script is executed
> "$LOG_FILE"

echo "=================================================="
echo "    Rocket Blackbox Diagnostic Serial Monitor       "
echo "=================================================="

# Check if a port was manually specified as argument
TARGET_PORT="$1"

if [ -z "$TARGET_PORT" ]; then
    # Auto-detect target serial port using Python
    TARGET_PORT=$(python3 -c "
import serial.tools.list_ports
ports = list(serial.tools.list_ports.comports())

# 1. Look for Espressif VID (0x303A)
for p in ports:
    if p.vid == 0x303a:
        print(p.device)
        exit(0)

# 2. Look for any ACM device
for p in ports:
    if 'ACM' in p.device:
        print(p.device)
        exit(0)

# 3. Look for any USB serial converter
for p in ports:
    if 'USB' in p.device:
        print(p.device)
        exit(0)

# 4. Fallback to first available port if any
if ports:
    print(ports[0].device)
    exit(0)
" 2>/dev/null || true)
fi

if [ -z "$TARGET_PORT" ] || [ ! -e "$TARGET_PORT" ]; then
    echo "[ERROR] No compatible serial device detected!"
    echo "Please connect your ESP32-S3 board and verify it appears under /dev/ttyACM* or /dev/ttyUSB*."
    echo
    echo "Available ports:"
    ls -l /dev/ttyACM* /dev/ttyUSB* 2>/dev/null || echo "  (None found)"
    exit 1
fi

BAUD_RATE=115200
echo "[INFO] Auto-detected device: $TARGET_PORT"
echo "[INFO] Baud rate:           $BAUD_RATE"
echo "[INFO] Logging to:          $LOG_FILE (cleared on start)"
echo "--------------------------------------------------"
echo "Diagnostic Commands once connected:"
echo "  [1] Run Full Subsystem POST Report"
echo "  [2] Toggle Live Telemetry Stream (1 Hz)"
echo "  [3] Run 1 MB SDMMC Storage Benchmark"
echo "  [4] Re-scan Dual I2C Buses"
echo "  [5] Query GPS & 1PPS Status"
echo "  [6] Query Power & Battery Health"
echo "  [Ctrl+C] Exit Monitor"
echo "=================================================="
echo

# Run monitor unbuffered and tee all stdout/stderr directly into serial-log.txt
if command -v pio >/dev/null 2>&1; then
    stdbuf -oL -eL pio device monitor -p "$TARGET_PORT" -b "$BAUD_RATE" --dtr 1 --rts 0 2>&1 | tee "$LOG_FILE"
elif [ -x "$HOME/.local/bin/pio" ]; then
    stdbuf -oL -eL "$HOME/.local/bin/pio" device monitor -p "$TARGET_PORT" -b "$BAUD_RATE" --dtr 1 --rts 0 2>&1 | tee "$LOG_FILE"
else
    stdbuf -oL -eL python3 -m serial.tools.miniterm "$TARGET_PORT" "$BAUD_RATE" --dtr 1 --rts 0 2>&1 | tee "$LOG_FILE"
fi
