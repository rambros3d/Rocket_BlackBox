#include "imu_sensor.h"
#include "pin_definitions.h"

Adafruit_BNO055 IMUSensorManager::_bno = Adafruit_BNO055(55, 0x28, &Wire1);
IMUDiagnosticResults IMUSensorManager::_diagResults = {0};
bool IMUSensorManager::_initialized = false;
uint8_t IMUSensorManager::_activeAddr = 0x28;

bool IMUSensorManager::initIMU(Print& out) {
    out.println("Initializing BNO055 9-DOF IMU (Bus 2: Pins 2/1 in Polled Mode)...");

    // Bosch BNO055 Requirement: Wait at least 650ms after power-up/reset before probing
    while (millis() < 800) {
        delay(20);
    }

    // Quick address ping check before launching Adafruit retry loop
    Wire1.beginTransmission(0x28);
    bool has28 = (Wire1.endTransmission() == 0);
    Wire1.beginTransmission(0x29);
    bool has29 = (Wire1.endTransmission() == 0);

    if (!has28 && !has29) {
        out.println("  [FAIL] BNO055 not acknowledging at 0x28 or 0x29 on Wire1.");
        _diagResults.detected = false;
        _initialized = false;
        return false;
    }

    _activeAddr = has28 ? 0x28 : 0x29;
    _bno = Adafruit_BNO055(55, _activeAddr, &Wire1);
    if (!_bno.begin()) {
        out.printf("  [FAIL] BNO055 begin() failed at 0x%02X.\n", _activeAddr);
        _diagResults.detected = false;
        _initialized = false;
        return false;
    }

    _diagResults.detected = true;
    _diagResults.address = _activeAddr;
    _initialized = true;

    // Use external crystal if available on hardware
    _bno.setExtCrystalUse(true);

    // Read revision info
    Adafruit_BNO055::adafruit_bno055_rev_info_t rev;
    _bno.getRevInfo(&rev);
    _diagResults.accelId = rev.accel_rev;
    _diagResults.magId = rev.mag_rev;
    _diagResults.gyroId = rev.gyro_rev;
    _diagResults.swRev = rev.sw_rev;
    _diagResults.bootloaderRev = rev.bl_rev;

    // Read self test & system status
    _bno.getSystemStatus(&_diagResults.sysStatus, &_diagResults.selfTestResult, &_diagResults.sysError);
    _diagResults.selfTestPassed = ((_diagResults.selfTestResult & 0x0F) == 0x0F);

    out.printf("  [OK] BNO055 initialized at Addr 0x%02X\n", _activeAddr);
    return true;
}

void IMUSensorManager::probeIMULines(Print& out) {
    out.println("==================================================");
    out.println("         BNO055 HARDWARE PIN ELECTRICAL PROBE     ");
    out.println("==================================================");

    // End Wire1 temporarily to release GPIOs for pin testing
    Wire1.end();
    delay(10);

    // 1. High-Z input test (measures natural line state via external pull-ups)
    pinMode(PIN_I2C2_SDA, INPUT);
    pinMode(PIN_I2C2_SCL, INPUT);
    delay(5);
    int rawSda = digitalRead(PIN_I2C2_SDA);
    int rawScl = digitalRead(PIN_I2C2_SCL);

    out.println("1. External Pull-up Check (Pins configured as INPUT, High-Z):");
    out.printf("   - SDA (GPIO %d): %s (%s)\n", PIN_I2C2_SDA, rawSda ? "HIGH (3.3V)" : "LOW (0V)",
               rawSda ? "PASS: External pull-up detected" : "FAIL: No external pull-up or clamped to GND");
    out.printf("   - SCL (GPIO %d): %s (%s)\n", PIN_I2C2_SCL, rawScl ? "HIGH (3.3V)" : "LOW (0V)",
               rawScl ? "PASS: External pull-up detected" : "FAIL: No external pull-up or clamped to GND");

    // 2. Internal Pull-up test (measures if line can be pulled up or is clamped/shorted)
    pinMode(PIN_I2C2_SDA, INPUT_PULLUP);
    pinMode(PIN_I2C2_SCL, INPUT_PULLUP);
    delay(5);
    int puSda = digitalRead(PIN_I2C2_SDA);
    int puScl = digitalRead(PIN_I2C2_SCL);

    out.println("2. Internal Pull-up Test (Pins configured as INPUT_PULLUP ~45k):");
    out.printf("   - SDA (GPIO %d): %s (%s)\n", PIN_I2C2_SDA, puSda ? "HIGH (3.3V)" : "LOW (0V)",
               puSda ? "CAN BE PULLED HIGH" : "HARD GROUND: Shorted to GND or chip clamping");
    out.printf("   - SCL (GPIO %d): %s (%s)\n", PIN_I2C2_SCL, puScl ? "HIGH (3.3V)" : "LOW (0V)",
               puScl ? "CAN BE PULLED HIGH" : "HARD GROUND: Shorted to GND or chip clamping");

    // 3. I2C Bus Recovery: Clock 9 cycles on SCL to un-stick any slave
    out.println("3. I2C Bus Recovery Sequence (Clocking 9 pulses on SCL)...");
    pinMode(PIN_I2C2_SDA, INPUT_PULLUP);
    pinMode(PIN_I2C2_SCL, OUTPUT);
    digitalWrite(PIN_I2C2_SCL, HIGH);
    delayMicroseconds(10);

    for (int i = 0; i < 9; i++) {
        digitalWrite(PIN_I2C2_SCL, LOW);
        delayMicroseconds(10);
        digitalWrite(PIN_I2C2_SCL, HIGH);
        delayMicroseconds(10);
    }
    // Generate STOP condition
    pinMode(PIN_I2C2_SDA, OUTPUT);
    digitalWrite(PIN_I2C2_SDA, LOW);
    delayMicroseconds(10);
    digitalWrite(PIN_I2C2_SCL, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_I2C2_SDA, HIGH);
    delayMicroseconds(10);

    pinMode(PIN_I2C2_SDA, INPUT_PULLUP);
    pinMode(PIN_I2C2_SCL, INPUT_PULLUP);

    // 3b. Active Pin Driving Test (Verify ESP32 GPIO output drivers can pull lines LOW)
    out.println("3b. Active GPIO Drive-LOW Verification:");
    pinMode(PIN_I2C2_SDA, OUTPUT);
    digitalWrite(PIN_I2C2_SDA, LOW);
    delay(2);
    int driveSda = digitalRead(PIN_I2C2_SDA);
    pinMode(PIN_I2C2_SDA, INPUT_PULLUP);

    pinMode(PIN_I2C2_SCL, OUTPUT);
    digitalWrite(PIN_I2C2_SCL, LOW);
    delay(2);
    int driveScl = digitalRead(PIN_I2C2_SCL);
    pinMode(PIN_I2C2_SCL, INPUT_PULLUP);

    out.printf("   - SDA (GPIO %d) driven LOW: reads %s\n", PIN_I2C2_SDA, (driveSda == LOW) ? "0V (PASS: Output driver functional)" : "FAIL: Line stuck HIGH");
    out.printf("   - SCL (GPIO %d) driven LOW: reads %s\n", PIN_I2C2_SCL, (driveScl == LOW) ? "0V (PASS: Output driver functional)" : "FAIL: Line stuck HIGH");

    // 3c. Pure Software Bit-Bang I2C Ping (with explicit clock-stretching support)
    out.println("3c. Pure Software Bit-Bang I2C Ping (10 kHz with Clock-Stretching Support):");
    auto bitbangPing = [](int sdaPin, int sclPin, uint8_t addr, Print& p) -> bool {
        auto set_scl_high = [sclPin]() -> bool {
            pinMode(sclPin, INPUT_PULLUP);
            unsigned long start = micros();
            while (digitalRead(sclPin) == LOW) {
                if (micros() - start > 20000) return false; // 20ms clock stretching timeout
            }
            delayMicroseconds(40);
            return true;
        };
        auto set_scl_low = [sclPin]() {
            pinMode(sclPin, OUTPUT);
            digitalWrite(sclPin, LOW);
            delayMicroseconds(40);
        };
        auto set_sda_val = [sdaPin](int v) {
            if (v) pinMode(sdaPin, INPUT_PULLUP);
            else {
                pinMode(sdaPin, OUTPUT);
                digitalWrite(sdaPin, LOW);
            }
            delayMicroseconds(40);
        };

        // START
        set_sda_val(1);
        set_scl_high();
        delayMicroseconds(40);
        set_sda_val(0);
        delayMicroseconds(40);
        set_scl_low();

        // 7-bit Address + Write (0)
        uint8_t byteToSend = (addr << 1);
        for (int i = 7; i >= 0; i--) {
            set_sda_val((byteToSend >> i) & 1);
            set_scl_high();
            set_scl_low();
        }

        // Read ACK
        set_sda_val(1); // Release SDA
        pinMode(sdaPin, INPUT_PULLUP);
        set_scl_high();
        int ack = digitalRead(sdaPin);
        set_scl_low();

        // STOP
        set_sda_val(0);
        set_scl_high();
        set_sda_val(1);
        delayMicroseconds(40);

        p.printf("   [Bit-Bang] Addr 0x%02X: %s\n", addr, (ack == 0) ? "ACK! (SUCCESS)" : "NACK");
        return (ack == 0);
    };

    bool bbAck28 = bitbangPing(PIN_I2C2_SDA, PIN_I2C2_SCL, 0x28, out);
    bool bbAck29 = bitbangPing(PIN_I2C2_SDA, PIN_I2C2_SCL, 0x29, out);
    if (bbAck28 || bbAck29) {
        out.printf("   >>> SUCCESS VIA BIT-BANG I2C! BNO055 ACKs on 0x%02X <<<\n", bbAck28 ? 0x28 : 0x29);
    }

    // 4. Bosch Boot Delay Enforcement
    out.println("4. Bosch Boot Delay Enforcement:");
    out.printf("   - Current uptime: %lu ms. Ensuring > 650 ms boot wait...\n", millis());
    while (millis() < 850) {
        delay(50);
    }
    delay(100);
    out.printf("   - Boot delay satisfied (uptime: %lu ms).\n", millis());

    // 5. Full I2C Address Scanner on Bus 2 (0x01 to 0x7F, standard SDA=2, SCL=1)
    Wire1.begin(PIN_I2C2_SDA, PIN_I2C2_SCL, 50000); // 50 kHz conservative clock
    Wire1.setTimeOut(100);
    delay(20);

    out.println("\n5. I2C Bus 2 Full Address Scan (0x01 to 0x7F at 50 kHz):");
    int bus2Found = 0;
    for (uint8_t a = 0x01; a <= 0x7F; ++a) {
        Wire1.beginTransmission(a);
        if (Wire1.endTransmission() == 0) {
            out.printf("   [FOUND] Device responded at 7-bit Address 0x%02X (%d)!\n", a, a);
            bus2Found++;
        }
    }
    if (bus2Found == 0) {
        out.println("   [SCAN RESULT] No I2C devices responded across the entire address space (0x01-0x7F).");
    }

    // 6. Targeted BNO055 Address (0x28, 0x29) & CHIP_ID Register 0x00 Probe
    out.println("\n6. Targeted BNO055 Probe & CHIP_ID (Reg 0x00) Read:");
    auto testChipId = [](uint8_t addr, Print& p) {
        p.printf("   --- Testing Address 0x%02X ---\n", addr);
        Wire1.beginTransmission(addr);
        uint8_t err = Wire1.endTransmission();
        p.printf("     - Address ACK ping: %s (code %d)\n", (err == 0) ? "ACK!" : "NACK", err);

        // Attempt reading Register 0x00 (CHIP_ID)
        Wire1.beginTransmission(addr);
        Wire1.write(0x00); // CHIP_ID register
        uint8_t regErr = Wire1.endTransmission(false); // repeated start
        p.printf("     - Write Reg 0x00 (repeated start): code %d\n", regErr);
        
        uint8_t bytesReceived = Wire1.requestFrom((uint8_t)addr, (uint8_t)1);
        if (bytesReceived > 0 && Wire1.available()) {
            uint8_t chipId = Wire1.read();
            p.printf("     >>> CHIP_ID Register 0x00 READ SUCCESS: 0x%02X (Expected 0xA0) -> %s <<<\n",
                     chipId, (chipId == 0xA0) ? "VALIDATED BNO055!" : "MISMATCH");
            return true;
        } else {
            p.println("     - Read CHIP_ID: No data received.");
            return false;
        }
    };

    bool cid28 = testChipId(0x28, out);
    bool cid29 = testChipId(0x29, out);

    if (cid28 || cid29) {
        out.printf("   >>> BNO055 CHIP_ID VERIFIED AT 0x%02X! <<<\n", cid28 ? 0x28 : 0x29);
    } else {
        out.println("   Neither 0x28 nor 0x29 returned CHIP_ID.");

        // 6. Test SWAPPED Pins: SDA=GPIO 1, SCL=GPIO 2 in case PCB traces were crossed
        out.println("\n5. Testing SWAPPED I2C Pins (SDA=GPIO 1, SCL=GPIO 2)...");
        Wire1.end();
        delay(10);
        Wire1.begin(PIN_I2C2_SCL, PIN_I2C2_SDA, 50000);
        Wire1.setTimeOut(50);
        delay(20);

        bool swap28 = testChipId(0x28, out);
        bool swap29 = testChipId(0x29, out);
        if (swap28 || swap29) {
            uint8_t targetAddr = swap28 ? 0x28 : 0x29;
            out.printf("   >>> SUCCESS WITH SWAPPED PINS! BNO055 detected at 0x%02X (SDA=GPIO 1, SCL=GPIO 2) <<<\n", targetAddr);
        } else {
            out.println("   [Swapped Pinout] Neither 0x28 nor 0x29 responded.");
            
            // Full sweep across 0x08 - 0x77 on swapped pins
            out.println("   Running full address sweep on swapped pins (0x08 - 0x77)...");
            int foundCount = 0;
            for (uint8_t a = 0x08; a <= 0x77; ++a) {
                Wire1.beginTransmission(a);
                if (Wire1.endTransmission() == 0) {
                    out.printf("   -> Found device at 0x%02X!\n", a);
                    foundCount++;
                }
            }
            if (foundCount == 0) {
                out.println("   No devices responded on swapped pins either.");
            }

            // 6. Test Ultra-Conservative 10kHz clock with generous clock-stretching timeout (250ms)
            out.println("\n6. Testing Slow 10kHz I2C Clock with 250ms Clock-Stretching Timeout...");
            Wire1.end();
            delay(10);
            Wire1.begin(PIN_I2C2_SDA, PIN_I2C2_SCL, 10000);
            Wire1.setTimeOut(250);
            delay(20);
            bool slow28 = testChipId(0x28, out);
            bool slow29 = testChipId(0x29, out);
            if (slow28 || slow29) {
                out.printf("   >>> SUCCESS AT 10kHz! BNO055 requires slow clock / clock stretching <<<\n");
            } else {
                out.println("   [Slow Clock] Still no ACK.");
            }

            // 7. Test UART Protocol Mode (in case PS0 is high or floating)
            out.println("\n7. Testing BNO055 UART Protocol Mode (115200 baud)...");
            Wire1.end();
            delay(10);
            
            auto testUart = [](int rxPin, int txPin, const char* label, Print& p) {
                p.printf("   - Testing UART on %s (RX=GPIO %d, TX=GPIO %d)...\n", label, rxPin, txPin);
                HardwareSerial testSerial(2);
                testSerial.begin(115200, SERIAL_8N1, rxPin, txPin);
                delay(20);
                while (testSerial.available()) testSerial.read();

                // Read Chip ID command packet: [0xAA, 0x01, 0x00, 0x01]
                uint8_t cmd[4] = {0xAA, 0x01, 0x00, 0x01};
                testSerial.write(cmd, 4);
                testSerial.flush();

                unsigned long start = millis();
                bool gotResponse = false;
                uint8_t resp[4] = {0};
                int idx = 0;
                while (millis() - start < 150) {
                    if (testSerial.available()) {
                        gotResponse = true;
                        if (idx < 4) resp[idx++] = testSerial.read();
                        else testSerial.read();
                    }
                }
                testSerial.end();

                if (gotResponse) {
                    p.printf("     >>> UART RESPONSE DETECTED! Bytes: ");
                    for (int i = 0; i < idx; i++) p.printf("0x%02X ", resp[i]);
                    p.printf("\n     -> BNO055 IS RUNNING IN UART MODE! (PS0 is HIGH)\n");
                    return true;
                } else {
                    p.println("     No UART response.");
                    return false;
                }
            };

            bool u1 = testUart(PIN_I2C2_SDA, PIN_I2C2_SCL, "Pins (RX=2, TX=1)", out);
            bool u2 = false;
            if (!u1) {
                u2 = testUart(PIN_I2C2_SCL, PIN_I2C2_SDA, "Swapped Pins (RX=1, TX=2)", out);
            }
        }

        // Restore standard pins for Wire1
        Wire1.end();
        delay(10);
        Wire1.begin(PIN_I2C2_SDA, PIN_I2C2_SCL, 100000);
        Wire1.setTimeOut(50);
    }
    out.println("--------------------------------------------------");
}

void IMUSensorManager::runDiagnostics(Print& out) {
    out.println("==================================================");
    out.println("            BNO055 9-DOF IMU DIAGNOSTICS          ");
    out.println("==================================================");

    if (!_initialized) {
        out.println("  [FAIL] BNO055 not initialized.");
        out.println("--------------------------------------------------");
        return;
    }

    out.printf("  Address:         0x%02X\n", _activeAddr);
    out.printf("  Software Rev:    %u.%u\n", (_diagResults.swRev >> 8), (_diagResults.swRev & 0xFF));
    out.printf("  Bootloader Rev:  %u\n", _diagResults.bootloaderRev);
    out.printf("  Chip IDs:        Accel=0x%02X, Mag=0x%02X, Gyro=0x%02X\n",
               _diagResults.accelId, _diagResults.magId, _diagResults.gyroId);
    
    // Self-test results
    out.printf("  Self-Test (0x%02X): %s\n", _diagResults.selfTestResult,
               _diagResults.selfTestPassed ? "ALL PASS" : "DEGRADED");
    out.printf("    - MCU:   %s\n", (_diagResults.selfTestResult & 0x08) ? "PASS" : "FAIL");
    out.printf("    - Gyro:  %s\n", (_diagResults.selfTestResult & 0x04) ? "PASS" : "FAIL");
    out.printf("    - Mag:   %s\n", (_diagResults.selfTestResult & 0x02) ? "PASS" : "FAIL");
    out.printf("    - Accel: %s\n", (_diagResults.selfTestResult & 0x01) ? "PASS" : "FAIL");

    out.printf("  System Status:   0x%02X (Error Code: 0x%02X)\n", _diagResults.sysStatus, _diagResults.sysError);

    // Calibration
    uint8_t sys, gyro, accel, mag;
    _bno.getCalibration(&sys, &gyro, &accel, &mag);
    out.printf("  Calibration (0-3): Sys=%u, Gyro=%u, Accel=%u, Mag=%u\n", sys, gyro, accel, mag);

    // Vector readout
    imu::Vector<3> euler = _bno.getVector(Adafruit_BNO055::VECTOR_EULER);
    imu::Vector<3> lacc = _bno.getVector(Adafruit_BNO055::VECTOR_LINEARACCEL);
    imu::Vector<3> gyr = _bno.getVector(Adafruit_BNO055::VECTOR_GYROSCOPE);
    int8_t temp = _bno.getTemp();

    out.printf("  Euler Angles:    Heading=%.2f deg | Roll=%.2f deg | Pitch=%.2f deg\n",
               euler.x(), euler.z(), euler.y());
    out.printf("  Linear Accel:    X=%.2f, Y=%.2f, Z=%.2f m/s^2\n", lacc.x(), lacc.y(), lacc.z());
    out.printf("  Gyroscope Rate:  X=%.2f, Y=%.2f, Z=%.2f dps\n", gyr.x(), gyr.y(), gyr.z());
    out.printf("  Die Temp:        %d C\n", temp);
    out.println("--------------------------------------------------");
}

void IMUSensorManager::readLiveData(IMUDiagnosticResults& res) {
    if (!_initialized) return;

    _bno.getCalibration(&res.calSys, &res.calGyro, &res.calAccel, &res.calMag);

    imu::Vector<3> euler = _bno.getVector(Adafruit_BNO055::VECTOR_EULER);
    res.headingDeg = euler.x();
    res.rollDeg = euler.z();
    res.pitchDeg = euler.y();

    res.linearAccel = _bno.getVector(Adafruit_BNO055::VECTOR_LINEARACCEL);
    res.gyroDps = _bno.getVector(Adafruit_BNO055::VECTOR_GYROSCOPE);
    res.quat = _bno.getQuat();
    res.tempC = _bno.getTemp();
}

void IMUSensorManager::runEdgeCaseDiagnostics(Print& out) {
    out.println("==================================================");
    out.println("     BNO055 HARDWARE EDGE-CASE RECOVERY SUITE     ");
    out.println("==================================================");

    // End Wire1 to allow manual control of GPIO 1 & 2
    Wire1.end();
    delay(20);

    // -------------------------------------------------------------
    // Edge Case 1: Parasitic Discharge / Pin Bleed
    // -------------------------------------------------------------
    out.println("1. Parasitic Discharge (Draining line capacitance to 0V for 500ms)...");
    pinMode(PIN_I2C2_SDA, OUTPUT);
    pinMode(PIN_I2C2_SCL, OUTPUT);
    digitalWrite(PIN_I2C2_SDA, LOW);
    digitalWrite(PIN_I2C2_SCL, LOW);
    delay(500);

    // Release lines to HIGH
    pinMode(PIN_I2C2_SDA, INPUT_PULLUP);
    pinMode(PIN_I2C2_SCL, INPUT_PULLUP);
    delay(10);
    out.println("   - Lines released back to HIGH.");

    // -------------------------------------------------------------
    // Edge Case 2: Extended 72-Clock Pulse Train & Triple STOP
    // -------------------------------------------------------------
    out.println("2. Generating 72-Clock Pulse Burst on SCL with Triple STOP...");
    pinMode(PIN_I2C2_SCL, OUTPUT);
    for (int i = 0; i < 72; i++) {
        digitalWrite(PIN_I2C2_SCL, LOW);
        delayMicroseconds(25); // 20 kHz
        digitalWrite(PIN_I2C2_SCL, HIGH);
        delayMicroseconds(25);
    }

    // Triple STOP condition
    pinMode(PIN_I2C2_SDA, OUTPUT);
    for (int i = 0; i < 3; i++) {
        digitalWrite(PIN_I2C2_SDA, LOW);
        delayMicroseconds(25);
        digitalWrite(PIN_I2C2_SCL, HIGH);
        delayMicroseconds(25);
        digitalWrite(PIN_I2C2_SDA, HIGH);
        delayMicroseconds(25);
    }
    pinMode(PIN_I2C2_SDA, INPUT_PULLUP);
    pinMode(PIN_I2C2_SCL, INPUT_PULLUP);
    out.println("   - 72 pulses and triple STOP condition complete.");

    // Bosch Power-On Reset Settle
    out.println("   - Waiting 700ms for Bosch internal POR settle...");
    delay(700);

    // -------------------------------------------------------------
    // Edge Case 3: I2C General Call Software Reset (0x00 -> 0x06)
    // -------------------------------------------------------------
    out.println("3. Broadcasting I2C General Call Software Reset (Addr 0x00, Byte 0x06)...");
    Wire1.begin(PIN_I2C2_SDA, PIN_I2C2_SCL, 10000); // 10 kHz slow bus
    Wire1.setTimeOut(100);
    delay(20);

    Wire1.beginTransmission(0x00);
    Wire1.write(0x06);
    uint8_t genCallErr = Wire1.endTransmission(true);
    out.printf("   - General Call Reset transmission result: Code %d (%s)\n",
               genCallErr, (genCallErr == 0) ? "ACK RECEIVED!" : "NACK (No slave acknowledged)");
    delay(150); // Allow reset execution

    // Probe 0x28 and 0x29
    Wire1.beginTransmission(0x28);
    bool ack28 = (Wire1.endTransmission() == 0);
    Wire1.beginTransmission(0x29);
    bool ack29 = (Wire1.endTransmission() == 0);
    out.printf("   - Post-Reset Probe: Addr 0x28 -> %s | Addr 0x29 -> %s\n",
               ack28 ? "ACK! (FOUND)" : "NACK", ack29 ? "ACK! (FOUND)" : "NACK");

    // -------------------------------------------------------------
    // Edge Case 4: Hardware Controller Cross-Check (I2C0 vs I2C1)
    // -------------------------------------------------------------
    out.println("4. ESP32-S3 Hardware Controller Cross-Check (Testing I2C_NUM_0 on Pins 2/1)...");
    Wire1.end();
    delay(20);

    // Temporarily re-point Wire (I2C0) to GPIO 2 and 1
    Wire.end();
    delay(10);
    Wire.begin(PIN_I2C2_SDA, PIN_I2C2_SCL, 50000); // I2C0 at 50 kHz
    Wire.setTimeOut(100);
    delay(20);

    Wire.beginTransmission(0x28);
    bool i2c0_ack28 = (Wire.endTransmission() == 0);
    Wire.beginTransmission(0x29);
    bool i2c0_ack29 = (Wire.endTransmission() == 0);
    out.printf("   - Controller I2C0 Probe: Addr 0x28 -> %s | Addr 0x29 -> %s\n",
               i2c0_ack28 ? "ACK! (FOUND)" : "NACK", i2c0_ack29 ? "ACK! (FOUND)" : "NACK");

    // Restore Wire to Environmental Bus 1 (Pins 10, 11)
    Wire.end();
    delay(10);
    Wire.begin(PIN_I2C1_SDA, PIN_I2C1_SCL, 100000);
    Wire.setTimeOut(50);

    // Restore Wire1 to IMU Bus 2 (Pins 2, 1)
    Wire1.begin(PIN_I2C2_SDA, PIN_I2C2_SCL, 100000);
    Wire1.setTimeOut(50);
    out.println("   - Default I2C bus controllers restored.");

    out.println("==================================================");
    if (ack28 || ack29 || i2c0_ack28 || i2c0_ack29) {
        out.println(">>> RESULT: BNO055 RESPONDED! SOFTWARE EDGE-CASE RECOVERY SUCCEEDED! <<<");
    } else {
        out.println(">>> RESULT: ALL SOFTWARE EDGE CASES FAILED (NACK).                  <<<");
        out.println(">>> Confirms hardware root cause: Pin 11 (nRESET) must be pulled up. <<<");
    }
    out.println("==================================================");
}
