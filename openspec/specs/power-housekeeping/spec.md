# Power Housekeeping Specification

## Purpose
Covers power hold circuit latching on GPIO 40, push button state monitoring on GPIO 39, battery voltage ADC sensing on GPIO 9, and status LED indication on GPIO 45.

## Requirements

### Requirement: Power Latch Enable
The system SHALL assert GPIO 40 as an output driven HIGH immediately upon bootloader entry to maintain system power via the hardware latch circuit.

#### Scenario: Power latch hold on startup
- **WHEN** the firmware boot routine initializes
- **THEN** it SHALL set GPIO 40 to HIGH before releasing control to peripheral drivers, maintaining power after the user releases the physical power button.

### Requirement: Power Button Status Monitoring
The system SHALL configure GPIO 39 as a digital input to monitor the physical power button state and record hold durations.

#### Scenario: Button press detection
- **WHEN** the user presses or holds the power button
- **THEN** the firmware SHALL detect the logic state change on GPIO 39 and report button state (pressed/released) and duration in milliseconds.

### Requirement: Battery Voltage ADC Sensing
The system SHALL sample analog input channel ADC1_CH8 on GPIO 9, calculate the battery voltage using the hardware 1/2 divider factor, and report battery millivolts and state-of-charge percentage.

#### Scenario: Battery voltage measurement
- **WHEN** the power diagnostic samples GPIO 9
- **THEN** it SHALL compute `V_bat = analogReadMilliVolts(9) * 2.0` and output both the measured battery voltage and the estimated percentage for a 1S LiPo battery.

### Requirement: Status Heartbeat LED
The system SHALL drive the onboard LED on GPIO 45 to indicate active diagnostic execution via non-blocking periodic toggling.

#### Scenario: Active execution heartbeat
- **WHEN** the firmware is running normally
- **THEN** the LED on GPIO 45 SHALL toggle every 500 milliseconds without blocking sensor acquisition loops.
