## Why
The user wants the onboard status LED (GPIO 45) to reflect LoRa link state: a 1 Hz blink when LoRa is not connected, and an "airplane-heartbeat" double-flash when LoRa is connected. Neither the flight firmware nor test firmware currently implements 5-second button hold-to-off or link-state LED patterns; the LED is only a 500 ms heartbeat in normal operation.

## What Changes
- Flight firmware (`flight_firmware/src/`): replace `PowerManager::updateHeartbeat(500)` with a non-blocking LED pattern engine driven by LoRa link state. Link is considered "connected" when a valid uplink command was received within the last 3 s (matches the dashboard's periodic `CMD_PING` / command traffic). When not connected, LED blinks at 1 Hz. When connected, LED does a double-flash heartbeat (two short pulses, ~700-800 ms off) — "airplane" style.
- Power manager: extend to support a pattern-based LED state machine and a method to drive it.
- Tracking: record `lastUplinkMs` on every valid uplink command in the flight app.

## Capabilities
### New Capabilities
- `status-led-indication`: The payload status LED SHALL reflect bidirectional LoRa link health via blink patterns.

### Modified Capabilities
- (none)

## Impact
- **Subsystems Affected**: `flight_firmware/` (power management, flight telemetry app)
- **Files Modified**: `flight_firmware/src/power_mgr.h`, `flight_firmware/src/power_mgr.cpp`, `flight_firmware/src/app_flight/main_flight.cpp`
- **Hardware Impact**: None
