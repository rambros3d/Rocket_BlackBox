## Why
During live operations, it was decided that the payload status LED should give a visible countdown while the power button is held, so a user press-and-hold cannot happen without the user's awareness. No firmware currently flashes the LED differently based on button-hold duration; the button handler (`getButtonHoldDurationMs`) exists but is unused for any LED/soft-off behavior.

## What Changes
- Flight firmware (`flight_firmware/src/power_mgr.{h,cpp}`): add button-hold LED countdown behavior.
  - While the power button is held, the status LED starts blinking once the hold reaches 2 seconds: fast blink **60 ms ON / 120 ms OFF**.
  - Keep blinking while the button remains held.
  - At exactly 5 seconds of hold, turn the LED ON solid briefly and release the power latch (`PIN_PWR_EN` LOW) to cut power.
  - The existing LoRa link-state LED pattern (1 Hz disconnect / double-flash connect) continues to take precedence when no button is being held.
- Flight firmware (`flight_firmware/src/app_flight/main_flight.cpp`) may call the power-manager's button-hold check each loop if the power manager does not drive it itself.

No hardware or board changes. No dependencies on the LoRa link or the LoRa LED feature beyond sharing the same status LED.

## Capabilities
### New Capabilities
- `power-button-off`: While the power button (GPIO 39) is held, the status LED fast-blanks at 2 s of hold (60 ms ON / 120 ms OFF); the power latch is released at 5 s of hold, after which the board powers off.

### Modified Capabilities
- `status-led-indication`: The status LED may be overridden by button-hold countdown while the button is held; when the button is not held, link-state patterns apply as before.

## Impact
- **Subsystems Affected**: `flight_firmware/` (power management)
- **Files Modified**: `flight_firmware/src/power_mgr.h`, `flight_firmware/src/power_mgr.cpp`, `flight_firmware/src/app_flight/main_flight.cpp`
- **Hardware Impact**: None
