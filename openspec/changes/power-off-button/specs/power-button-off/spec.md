## ADDED Requirements

### Requirement: Power-Off Countdown LED
The status LED (GPIO 45) SHALL indicate a button-hold countdown once the power button (GPIO 39) has been held continuously for at least 2 seconds. While the countdown is active, the LED SHALL blink with **60 ms ON / 120 ms OFF**.

### Requirement: Power-Off Release
If the power button is held continuously for at least 5 seconds, the power manager SHALL release the power latch (`PIN_PWR_EN` driven LOW) to power off the board.

### Requirement: Button-Release Abort
If the power button is released before 5 seconds of continuous hold, the countdown SHALL be canceled immediately. The LED SHALL stop the countdown blink and resume its prior pattern (link-state LED behavior when no button is held; the prior link state may be re-evaluated on release).

### Requirement: Blink Timing
The blink timing SHALL be 60 ms ON followed by 120 ms OFF while the countdown is active. No other blink pattern SHALL be used during the countdown.

### Requirement: No Link-State Conflict While Holding
While the power button is held, the countdown LED SHALL take precedence over the Lora link-state LED pattern. Scheduling conflicts between updates shall be resolved in favor of the newest state decision each loop iteration.

## Scenario: Short button press (less than 2 s)
- GIVEN the button is pressed for less than 2 seconds
- WHEN the button is released
- THEN no countdown blink occurs and the LED resumes its prior pattern

## Scenario: Countdown completes but button released before 5 s
- GIVEN the button has been held for at least 2 seconds
- WHEN the button is released before 5 seconds of hold
- THEN the countdown blink stops and the LED resumes its prior pattern; no power-off occurs

## Scenario: 5-second hold
- GIVEN the button has been held for 5 seconds continuously
- WHEN the 5th second of hold completes
- THEN the power latch is released and the board powers off

## Scenario: Blink timing during countdown
- GIVEN the countdown is active
- WHEN time advances
- THEN the LED follows a 60 ms ON / 120 ms OFF square wave

## Scenario: Link-state LED resumes
- GIVEN the button is not held
- WHEN no button is pressed
- THEN the LoRa link-state LED pattern (1 Hz disconnected / double-flash connected) applies as before
