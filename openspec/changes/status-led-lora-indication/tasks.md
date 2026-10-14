## 1. Power Manager: Add LED pattern engine
- [x] 1.1 In `flight_firmware/src/power_mgr.h`, add `enum class LedState { Disconnected, Connected }` and new methods: `static void setLedState(LedState s); static void updateLedState();` (implemented as `updateLed()` per design)
- [x] 1.2 In `flight_firmware/src/power_mgr.cpp`, replace/extend heartbeat logic: track `LedState`, implement non-blocking double-flash for Connected, 1 Hz blink for Disconnected, and update loop methods.

## 2. Flight app: Track link state from uplinks
- [x] 2.1 In `flight_firmware/src/app_flight/main_flight.cpp`, add `static uint32_t s_lastUplinkMs = 0;` and `static constexpr uint32_t LORA_LINK_TIMEOUT_MS = 3000;`
- [x] 2.2 In `handleUplink()`, set `s_lastUplinkMs = millis()` on every valid command.
- [x] 2.3 In `loop()`, compute link state: connected if `(millis() - s_lastUplinkMs) < LORA_LINK_TIMEOUT_MS`; call `PowerManager::setLedState` and/or drive LED pattern. `updateHeartbeat(500)` replaced by `setLedState()` + `updateLed()` every loop iteration.

## 3. Verify
- [x] 3.1 Build flight_firmware: `pio run -e rocket_payload_telemetry` (or default flight env) — verify compile succeeds.
- [ ] 3.2 Observe LED behavior: 1 Hz when no uplink received in 3 s; double-flash when dashboard sends pings/commands.
