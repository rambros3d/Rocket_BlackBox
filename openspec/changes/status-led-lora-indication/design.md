## Design
- Power manager (`power_mgr.cpp/h`) gains a LED pattern state machine:
  - `LedState::Disconnected`: 1 Hz square wave (500 ms on/500 ms off) — preserves previous "no link" behavior.
  - `LedState::Connected`: double-flash pattern repeating every ~1 s: pulse 1: on 70 ms, off 70 ms, pulse 2: on 70 ms, off 800 ms (total cycle ~1010 ms). Non-blocking using `millis() % CYCLE_MS` and window checks.
- Flight app tracks last valid uplink time: on any valid command decoded in `handleUplink()` (CMD_PING, CMD_LOG_START/STOP, or others) set `s_lastUplinkMs = millis()`.
- Link state: `linkAlive = (now - s_lastUplinkMs < LORA_LINK_TIMEOUT_MS)`. Initialize `s_lastUplinkMs = 0` → disconnected until first uplink. Timeout 3000 ms (4 missed pings at ~736 ms cadence) for tolerance.
- Update rate: drive pattern every loop iteration (non-blocking) instead of calling `updateHeartbeat(500)` on a fixed 500 ms toggle when link is connected; for disconnected, same as old behavior. Call `PowerManager::updateLed()` (or `updateLedState()`) each loop, and/or `setLedState()` when state transitions.
