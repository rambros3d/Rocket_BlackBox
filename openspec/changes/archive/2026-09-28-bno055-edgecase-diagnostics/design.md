## Context

The BNO055 9-DOF IMU on Bus 2 (SDA: GPIO 2, SCL: GPIO 1) has failed to acknowledge standard I2C probe sequences. Hardware measurements verify that power rails (+3.3V) and internal 1.2V LDO are active, but the schematic reveals that Pin 11 (`nRESET`) is floating. Before physically reworking the PCB (soldering a 0.1mm bodge wire to Pin 11), we must exhaustively execute all software-level edge cases to confirm that no protocol or controller quirk is masking an operational chip.

## Goals / Non-Goals

**Goals:**
- Implement an automated edge-case diagnostic function `IMUSensorManager::runEdgeCaseDiagnostics(Print& out)`.
- Test parasitic charge bleed: Actively drive SDA and SCL LOW for 500 ms, release with internal pull-up, and enforce a 650 ms Bosch POR delay.
- Test 72-clock pulse train with repeated STOP conditions to release any locked internal shift register.
- Test I2C General Call Software Reset (`0x00` address, `0x06` data payload).
- Cross-check hardware peripheral mapping: re-initialize `Wire` (`I2C_NUM_0`) on GPIO 2 and 1 to verify whether the primary ESP32-S3 I2C hardware controller behaves differently than `Wire1` (`I2C_NUM_1`).
- Report definitive pass/fail logs to the serial diagnostic console.

**Non-Goals:**
- Replacing or soldering the physical chip in this software change.
- Altering the operational telemetry streaming of healthy Environmental Bus 1 sensors.

## Decisions

- **Decision 1: Direct register manipulation and bit-banging for line drain**:
  - *Rationale*: Standard Arduino `Wire` cannot force lines to 0V continuously without de-initializing the peripheral. We de-init `Wire1`, set pins to `OUTPUT` `LOW`, wait 500ms, then re-initialize.
- **Decision 2: General Call Reset at low bus speed (10 kHz)**:
  - *Rationale*: If the internal Cortex-M0 is stuck in a low-frequency bootloader or brownout state, a 10 kHz General Call has the highest probability of being sampled correctly.
- **Decision 3: Dedicated CLI trigger**:
  - *Rationale*: Expose this suite under option `[e]` (Run BNO055 Edge-Case Recovery Suite) in `src/main.cpp` so it can be re-run at will during bench testing.

## Risks / Trade-offs

- [Risk: Forcing lines LOW during external pull-up causes minor current draw (~1.5mA through R4/R5)] → Mitigation: 500ms duration is well within thermal limits of 2.2kΩ 0402 resistors.
- [Risk: Re-routing `Wire` to Pins 2 and 1 alters Environmental Bus 1 mappings] → Mitigation: Save and restore `Wire` configuration on Pins 10 and 11 immediately after the cross-check completes.
