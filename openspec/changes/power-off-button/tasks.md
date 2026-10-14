## 1. Power manager: button-hold countdown state machine
- [x] 1.1 In `flight_firmware/src/power_mgr.h`, add button-hold state enum and methods for countdown blink + latch release; add state variables to `PowerManager`.- [x] 1.2 In `flight_firmware/src/power_mgr.cpp`, implement the countdown logic: - track button-hold start time - at 2 s, begin 60 ms ON / 120 ms OFF blink - at 5 s, release power latch (`PIN_PWR_EN` LOW) and enter off state - on release before 5 s, cancel countdown - integrate with existing LED output (`updateLed()`) so the countdown overrides link-state blink while active

## 2. Wire button-hold check into the flight loop
- [x] 2.1 In `flight_firmware/src/app_flight/main_flight.cpp`, call `PowerManager::updateButtonHold()` each loop so countdown/off can occur during normal operation.

## 3. Verify
- [x] 3.1 Build flight_firmware (`pio run -e rocket_payload_telemetry`) — verify compile succeeds.
- [ ] 3.2 Button press < 2 s: LED does not enter countdown blink; resumes prior pattern after release.
- [ ] 3.3 Button hold 2 s to < 5 s: LED blinks 60 ms ON / 120 ms OFF; releasing before 5 s cancels blink and resumes prior pattern.
- [ ] 3.4 Button hold to 5 s: LED countdown stops and board powers off (latch released).
