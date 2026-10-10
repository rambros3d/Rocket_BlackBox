#include "gps_diagnostics.h"
#include "pin_definitions.h"

HardwareSerial GPSDiagnosticsManager::_gpsSerial(1);
TinyGPSPlus GPSDiagnosticsManager::_gps;
GPSDiagnosticResults GPSDiagnosticsManager::_results = {0};
volatile uint32_t GPSDiagnosticsManager::_ppsCount = 0;
volatile uint32_t GPSDiagnosticsManager::_lastPpsMs = 0;
volatile uint32_t GPSDiagnosticsManager::_ppsIntervalMs = 0;
bool GPSDiagnosticsManager::_initialized = false;

void IRAM_ATTR GPSDiagnosticsManager::onPpsInterrupt() {
    uint32_t now = millis();
    if (_lastPpsMs > 0) {
        _ppsIntervalMs = now - _lastPpsMs;
    }
    _lastPpsMs = now;
    _ppsCount = _ppsCount + 1;
}

bool GPSDiagnosticsManager::probeBaud(uint32_t baud) {
    _gpsSerial.end();
    delay(25);
    _gpsSerial.begin(baud, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
    
    uint32_t startMs = millis();
    uint32_t dollarSeen = 0;

    // Listen for up to 1100 ms for incoming NMEA '$' sentence markers
    while (millis() - startMs < 1100) {
        while (_gpsSerial.available()) {
            char c = (char)_gpsSerial.read();
            if (c == '$') {
                dollarSeen++;
                if (dollarSeen >= 2) return true;
            }
        }
        delay(5);
    }
    return (dollarSeen > 0);
}

bool GPSDiagnosticsManager::initGPS(Print& out) {
    out.printf("Initializing BE-166 GPS Receiver (UART: RX=%d, TX=%d, 1PPS=%d)...\n",
               PIN_GPS_RX, PIN_GPS_TX, PIN_GPS_1PPS);

    const uint32_t candidateBauds[] = {115200, 38400, 9600, 57600, 4800, 230400};
    uint32_t selectedBaud = 0;

    for (uint32_t baud : candidateBauds) {
        out.printf("  Probing %u baud... ", baud);
        if (probeBaud(baud)) {
            selectedBaud = baud;
            out.println("[LOCKED]");
            break;
        } else {
            out.println("[NO NMEA]");
        }
    }

    if (selectedBaud > 0) {
        _results.uartConnected = true;
        _results.activeBaudRate = selectedBaud;
        out.printf("  [OK] GPS UART stream detected at %u baud.\n", selectedBaud);
    } else {
        out.printf("  [WARN] No incoming bytes from GPS on RX %d at standard baud rates.\n", PIN_GPS_RX);
        _results.uartConnected = false;
        _results.activeBaudRate = 9600;
        _gpsSerial.begin(9600, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
    }

    // Configure 1PPS interrupt on GPIO 38
    pinMode(PIN_GPS_1PPS, INPUT);
    attachInterrupt(digitalPinToInterrupt(PIN_GPS_1PPS), onPpsInterrupt, RISING);

    _initialized = true;
    return _results.uartConnected;
}

void GPSDiagnosticsManager::streamRawNMEA(Stream& console, uint32_t durationMs) {
    if (!_initialized) {
        console.println("[GPS] Receiver not initialized.");
        return;
    }
    console.printf("\n>>> Streaming Raw NMEA Sentences (%u baud, RX=%d) <<<\n",
                   _results.activeBaudRate, PIN_GPS_RX);
    console.println("Press any key to exit...\n");

    uint32_t startMs = millis();
    uint32_t bytesReceived = 0;

    while (millis() - startMs < durationMs) {
        if (console.available()) {
            while (console.available()) console.read();
            break;
        }
        while (_gpsSerial.available()) {
            char c = _gpsSerial.read();
            console.write(c);
            _gps.encode(c);
            bytesReceived++;
        }
        delay(2);
    }
    console.printf("\n>>> Raw NMEA Stream Finished (%u bytes received) <<<\n\n", bytesReceived);
}

void GPSDiagnosticsManager::testBidirectionalLink(Stream& console) {
    if (!_initialized) {
        console.println("[GPS] Receiver not initialized.");
        return;
    }

    console.println("\n==================================================");
    console.println("      BE-166 BIDIRECTIONAL LINK & CHIPSET PROBE   ");
    console.println("==================================================");
    console.printf("Target UART: TX=GPIO%d (MCU->GPS), RX=GPIO%d (GPS->MCU) @ %u baud\n\n",
                   PIN_GPS_TX, PIN_GPS_RX, _results.activeBaudRate);

    // Helper lambda to drain buffer
    auto flushRx = [&]() {
        while (_gpsSerial.available()) _gpsSerial.read();
    };

    struct ProbeQuery {
        const char* name;
        const char* cmd;
        const uint8_t* binCmd;
        size_t binLen;
        const char* expectedPrefix;
    };

    const uint8_t ubxMonVer[] = { 0xB5, 0x62, 0x0A, 0x04, 0x00, 0x00, 0x0E, 0x34 };

    ProbeQuery queries[] = {
        { "UBX Poll UTC Time ($PUBX,04)", "$PUBX,04*37\r\n", nullptr, 0, "$PUBX,04" },
        { "UBX Poll Position ($PUBX,00)", "$PUBX,00*33\r\n", nullptr, 0, "$PUBX,00" },
        { "UBX Binary MON-VER Query", nullptr, ubxMonVer, sizeof(ubxMonVer), "\xB5\x62\x0A\x04" },
        { "CASIC System Info ($PCAS06,0)", "$PCAS06,0*1B\r\n", nullptr, 0, "$PCAS06" },
        { "CASIC Query Constellation ($PCAS03,0)", "$PCAS03,0*1E\r\n", nullptr, 0, "$PCAS03" },
        { "CASIC Model/Version ($PCAS06,1)", "$PCAS06,1*1A\r\n", nullptr, 0, "$PCAS06" },
        { "MTK Version Query ($PMTK605)", "$PMTK605*31\r\n", nullptr, 0, "$PMTK705" }
    };

    bool bidirectionalVerified = false;

    for (const auto& q : queries) {
        console.printf("Sending [%s]... ", q.name);
        flushRx();

        if (q.binCmd != nullptr) {
            _gpsSerial.write(q.binCmd, q.binLen);
        } else {
            _gpsSerial.print(q.cmd);
        }
        _gpsSerial.flush();

        // Listen for up to 700 ms
        uint32_t tStart = millis();
        bool receivedMatch = false;
        String captured = "";
        char buf[256];
        size_t bIdx = 0;

        while (millis() - tStart < 700) {
            while (_gpsSerial.available()) {
                uint8_t c = (uint8_t)_gpsSerial.read();
                _gps.encode((char)c);
                if (bIdx < sizeof(buf) - 1) {
                    buf[bIdx++] = (char)c;
                    buf[bIdx] = '\0';
                }
                if (c == '\n') {
                    if (q.expectedPrefix && strstr(buf, q.expectedPrefix)) {
                        receivedMatch = true;
                        captured = buf;
                        captured.trim();
                        break;
                    }
                    bIdx = 0;
                }
            }
            if (receivedMatch) break;
            delay(5);
        }

        if (receivedMatch) {
            console.printf("[MATCHED!]\n  Response -> %s\n", captured.c_str());
            bidirectionalVerified = true;
        } else if (bIdx > 0 && q.binCmd != nullptr) {
            // Check if binary header 0xB5 0x62 was captured
            for (size_t i = 0; i + 3 < bIdx; i++) {
                if ((uint8_t)buf[i] == 0xB5 && (uint8_t)buf[i+1] == 0x62 && (uint8_t)buf[i+2] == 0x0A && (uint8_t)buf[i+3] == 0x04) {
                    receivedMatch = true;
                    console.println("[MATCHED UBX BINARY!]\n  Response -> UBX-MON-VER ACK/Data Frame");
                    bidirectionalVerified = true;
                    break;
                }
            }
            if (!receivedMatch) {
                console.println("[NO PROTOCOL ACK] (Standard NMEA streaming)");
            }
        } else {
            console.println("[NO PROTOCOL ACK] (Standard NMEA streaming)");
        }
        delay(50);
    }

    console.println("\n--------------------------------------------------");
    if (bidirectionalVerified) {
        console.println("  Result: [PASS] Bidirectional UART TX/RX 100% OPERATIONAL!");
        console.println("          Receiver accepted command and returned protocol response.");
    } else {
        console.println("  Result: [INFO] Commands transmitted on GPIO 41 without errors.");
        console.println("          Receiver operates in autonomous streaming NMEA mode.");
    }
    console.println("==================================================\n");
}


void GPSDiagnosticsManager::update() {
    if (!_initialized) return;

    while (_gpsSerial.available()) {
        char c = _gpsSerial.read();
        _gps.encode(c);
    }

    _results.charsProcessed = _gps.charsProcessed();
    _results.sentencesWithFix = _gps.sentencesWithFix();
    _results.failedChecksums = _gps.failedChecksum();

    _results.hasFix = _gps.location.isValid();
    _results.satellites = _gps.satellites.isValid() ? _gps.satellites.value() : 0;
    _results.hdop = _gps.hdop.isValid() ? _gps.hdop.hdop() : 99.9f;

    if (_results.hasFix) {
        _results.latitude = _gps.location.lat();
        _results.longitude = _gps.location.lng();
        _results.altitudeM = _gps.altitude.isValid() ? _gps.altitude.meters() : 0.0;
        _results.speedKmh = _gps.speed.isValid() ? _gps.speed.kmph() : 0.0;
        _results.courseDeg = _gps.course.isValid() ? _gps.course.deg() : 0.0;
    }

    if (_gps.time.isValid()) {
        _results.hour = _gps.time.hour();
        _results.minute = _gps.time.minute();
        _results.second = _gps.time.second();
    }

    _results.ppsPulseCount = _ppsCount;
    _results.lastPpsIntervalMs = _ppsIntervalMs;
    // 1PPS is considered locked if interval is 1000ms +- 20ms and pulses are arriving
    _results.ppsLocked = (_ppsCount > 2) && (_ppsIntervalMs >= 980 && _ppsIntervalMs <= 1020);
}

void GPSDiagnosticsManager::runDiagnostics(Print& out) {
    update();

    out.println("==================================================");
    out.println("           BE-166 GPS & 1PPS DIAGNOSTICS          ");
    out.println("==================================================");
    out.printf("  UART Status:        %s (%u baud)\n",
               _results.uartConnected ? "CONNECTED" : "NO_DATA", _results.activeBaudRate);
    out.printf("  NMEA Characters:    %u (Checksum Failures: %u)\n",
               _results.charsProcessed, _results.failedChecksums);
    out.printf("  Fix Status:         %s\n", _results.hasFix ? "3D / VALID FIX" : "NO FIX (Searching...)");
    out.printf("  Satellites in Fix:  %u\n", _results.satellites);
    out.printf("  HDOP (Precision):   %.2f\n", _results.hdop);

    if (_results.hasFix) {
        out.printf("  Coordinates:        Lat=%.6f, Lon=%.6f\n", _results.latitude, _results.longitude);
        out.printf("  Altitude:           %.2f m\n", _results.altitudeM);
        out.printf("  Speed:              %.2f km/h | Course: %.1f deg\n", _results.speedKmh, _results.courseDeg);
        out.printf("  UTC Time:           %02u:%02u:%02u\n", _results.hour, _results.minute, _results.second);
    }

    out.printf("  1PPS Pulse Counter: %u ticks\n", _results.ppsPulseCount);
    out.printf("  1PPS Interval:      %u ms (%s)\n",
               _results.lastPpsIntervalMs, _results.ppsLocked ? "LOCKED 1.00 Hz" : "ACQUIRING");
    out.println("--------------------------------------------------");
}
