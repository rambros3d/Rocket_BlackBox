#pragma once

#include <Arduino.h>

namespace LoRaDiagnostic {
    // Initializes SPI bus, RF power gating, TCXO, and SX1262 modulation
    bool init();

    // Queries SX1262 transceiver status and configuration registers
    void runHardwareCheck();

    // Runs bidirectional ping-pong test with the ground station
    void runPingPongTest(uint16_t count = 10, uint32_t timeoutMs = 1500);

    // Broadcasts periodic simulated avionics telemetry frames
    void runBeaconMode();

    // Passively listens for incoming LoRa packets
    void runPacketSniffer();

    // Displays interactive console menu for LoRa diagnostics
    void showMenu();
}
