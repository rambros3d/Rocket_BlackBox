#include "i2c_bus_manager.h"

void I2CBusManager::initBuses() {
    // Bus 1: Environmental sensors (Pins 10, 11)
    Wire.begin(PIN_I2C1_SDA, PIN_I2C1_SCL, 100000);
    Wire.setTimeOut(50);

    // Bus 2: Dedicated IMU (Pins 2, 1) at 50 kHz for reliable BNO055 clock-stretching
    Wire1.begin(PIN_I2C2_SDA, PIN_I2C2_SCL, 50000);
    Wire1.setTimeOut(100);
}

bool I2CBusManager::isDevicePresent(TwoWire& bus, uint8_t address) {
    bus.beginTransmission(address);
    return (bus.endTransmission() == 0);
}

const char* I2CBusManager::lookupDeviceName(uint8_t address, uint8_t busIndex) {
    if (busIndex == 1) { // Environmental Bus 1
        switch (address) {
            case 0x29: return "TSL25911FN (Precision Lux)";
            case 0x53: return "LTR-390UV (Ambient Light / UV)";
            case 0x59: return "SGP41 (MOX VOC / NOx)";
            case 0x62: return "SCD40 (Photoacoustic CO2)";
            case 0x76: return "MS5607 or BME680 (Addr 0x76)";
            case 0x77: return "MS5607 or BME680 (Addr 0x77)";
            default:   return "Unknown Device";
        }
    } else { // IMU Bus 2
        switch (address) {
            case 0x28: return "BNO055 9-DOF IMU (Default 0x28)";
            case 0x29: return "BNO055 9-DOF IMU (Alt 0x29)";
            default:   return "Unknown Device";
        }
    }
}

std::vector<uint8_t> I2CBusManager::scanBus(TwoWire& bus, const char* busName, Print& out) {
    std::vector<uint8_t> foundAddrs;
    out.printf("--- Scanning %s ---\n", busName);
    uint8_t busIndex = (strcmp(busName, "I2C Bus 1 (Env)") == 0) ? 1 : 2;

    for (uint8_t addr = 0x08; addr <= 0x77; ++addr) {
        if (isDevicePresent(bus, addr)) {
            foundAddrs.push_back(addr);
            const char* devName = lookupDeviceName(addr, busIndex);
            out.printf("  [FOUND] 0x%02X (%3d) : %s\n", addr, addr, devName);
        }
    }

    if (foundAddrs.empty()) {
        out.println("  [WARN] No I2C devices responded on this bus!");
    } else {
        out.printf("  Total devices detected: %u\n", foundAddrs.size());
    }

    return foundAddrs;
}

void I2CBusManager::runDiagnosticScan(Print& out) {
    out.println("==================================================");
    out.println("            DUAL I2C BUS SCANNER                  ");
    out.println("--- Bus 1 Electrical Probe & Unstick Routine (Pins 10, 11) ---");
    Wire.end();
    delay(10);

    // Step 1: High-Z natural voltage test
    pinMode(PIN_I2C1_SDA, INPUT);
    pinMode(PIN_I2C1_SCL, INPUT);
    delay(5);
    int bus1Sda = digitalRead(PIN_I2C1_SDA);
    int bus1Scl = digitalRead(PIN_I2C1_SCL);
    out.printf("  1. Natural Line Voltage (High-Z):\n");
    out.printf("     - SDA1 (GPIO %d): %s\n", PIN_I2C1_SDA, bus1Sda ? "HIGH (3.3V)" : "LOW (0V)");
    out.printf("     - SCL1 (GPIO %d): %s\n", PIN_I2C1_SCL, bus1Scl ? "HIGH (3.3V)" : "LOW (0V)");

    // Step 2: If SDA1 is LOW, attempt 36-clock SCL bus recovery
    if (!bus1Sda) {
        out.println("  2. SDA1 is LOW! Attempting SCL clocking unstick recovery...");
        pinMode(PIN_I2C1_SDA, INPUT_PULLUP);
        pinMode(PIN_I2C1_SCL, OUTPUT);
        digitalWrite(PIN_I2C1_SCL, HIGH);
        delayMicroseconds(20);

        bool released = false;
        int clockCount = 0;
        for (int i = 1; i <= 36; i++) {
            digitalWrite(PIN_I2C1_SCL, LOW);
            delayMicroseconds(25);
            digitalWrite(PIN_I2C1_SCL, HIGH);
            delayMicroseconds(25);
            if (digitalRead(PIN_I2C1_SDA) == HIGH) {
                released = true;
                clockCount = i;
                break;
            }
        }

        // Send STOP condition
        pinMode(PIN_I2C1_SDA, OUTPUT);
        digitalWrite(PIN_I2C1_SDA, LOW);
        delayMicroseconds(20);
        digitalWrite(PIN_I2C1_SCL, HIGH);
        delayMicroseconds(20);
        digitalWrite(PIN_I2C1_SDA, HIGH);
        delayMicroseconds(20);
        pinMode(PIN_I2C1_SDA, INPUT);

        if (released) {
            out.printf("     [RECOVERED] SDA1 released HIGH after %d SCL clock pulses!\n", clockCount);
        } else {
            out.println("     [FAILED] SDA1 is still LOW (0V) after 36 SCL clock pulses.");
            // Test with internal pull-up (~45k)
            pinMode(PIN_I2C1_SDA, INPUT_PULLUP);
            delay(5);
            int puRead = digitalRead(PIN_I2C1_SDA);
            if (puRead == LOW) {
                out.println("     [HARD SHORT] SDA1 cannot be pulled high even with internal pull-up.");
                out.println("     -> Cause: Direct short to GND, solder bridge, or IC clamp diode/FET.");
            }
            pinMode(PIN_I2C1_SDA, INPUT);
        }
    } else {
        out.println("  2. SDA1 is HIGH (Bus idle and ready).");
    }

    Wire.begin(PIN_I2C1_SDA, PIN_I2C1_SCL, 100000);
    Wire.setTimeOut(50);
    delay(10);

    std::vector<uint8_t> bus1Devs = scanBus(Wire, "I2C Bus 1 (Env)", out);
    out.println();
    std::vector<uint8_t> bus2Devs = scanBus(Wire1, "I2C Bus 2 (IMU)", out);
    out.println();

    // Check specific collision condition between MS5607 and BME680
    bool has76 = isDevicePresent(Wire, 0x76);
    bool has77 = isDevicePresent(Wire, 0x77);

    out.println("--- Bus 1 Address Check (MS5607 vs BME680) ---");
    if (has76 && has77) {
        out.println("  [OK] Both 0x76 and 0x77 detected! MS5607 and BME680 have separate addresses.");
    } else if (has76 && !has77) {
        out.println("  [ALERT] Only 0x76 detected. One sensor is missing OR both share 0x76!");
    } else if (!has76 && has77) {
        out.println("  [ALERT] Only 0x77 detected. One sensor is missing OR both share 0x77!");
    } else {
        out.println("  [FAIL] Neither 0x76 nor 0x77 detected. Check power and I2C lines.");
    }
    out.println("--------------------------------------------------");
}
