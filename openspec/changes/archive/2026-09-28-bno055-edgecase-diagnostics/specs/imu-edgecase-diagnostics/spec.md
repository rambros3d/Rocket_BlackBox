## ADDED Requirements

### Requirement: Parasitic Bus Discharge & 72-Clock Pulse Sequence
The diagnostic firmware SHALL provide a routine that forces I2C Bus 2 pins (SDA: GPIO 2, SCL: GPIO 1) LOW for at least 500 ms to bleed parasitic charge, releases the lines with pull-ups, generates a 72-clock cycle pulse train on SCL, and issues 3 consecutive I2C STOP conditions.

#### Scenario: Bus Discharge and Clock Pulse Execution
- **WHEN** the edge-case recovery routine executes
- **THEN** both lines are pulled LOW, released, clocked 72 times, and verified to return to 3.3V idle high.

### Requirement: I2C General Call Software Reset
The diagnostic firmware SHALL broadcast an I2C General Call reset sequence by sending a START condition, addressing `0x00`, transmitting byte `0x06`, and terminating with a STOP condition.

#### Scenario: General Call Reset Execution
- **WHEN** the General Call reset command is transmitted
- **THEN** the firmware logs whether an ACK was received on address `0x00` and allows a 100 ms settling window for connected slaves to reboot.

### Requirement: Hardware Peripheral Cross-Check (I2C0 vs I2C1)
The diagnostic firmware SHALL support dynamically mapping ESP32-S3 hardware controller `I2C_NUM_0` to Pins 2 and 1 to test for peripheral controller divergence, followed by restoring the default bus pinout.

#### Scenario: Hardware Controller Divergence Check
- **WHEN** the controller cross-check runs
- **THEN** `Wire` (I2C0) probes addresses `0x28` and `0x29`, logs any ACK response, and cleanly re-attaches to Bus 1 pins (GPIO 10 and 11).

### Requirement: Interactive Edge-Case CLI Menu Option
The diagnostic serial menu SHALL expose command `[e]` to execute the complete edge-case diagnostic sweep and print a structured summary report.

#### Scenario: User Edge-Case Trigger
- **WHEN** the user inputs `e` or `E` into the serial console
- **THEN** the console runs the discharge, 72-clock pulse, General Call, and peripheral cross-check sequences and outputs the final result.
