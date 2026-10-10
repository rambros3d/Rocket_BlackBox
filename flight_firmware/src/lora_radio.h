#pragma once

#include <Arduino.h>

// Defaults match a Waveshare USB-TO-LoRa-HF receiver configured by the dashboard
// (AT+TXCH/RXCH=16 -> 866 MHz, SF9, BW125, CR4/5). The DTU maps channel N to 850+N MHz.
#ifndef LORA_CHANNEL
#define LORA_CHANNEL 16
#endif
#ifndef LORA_FREQUENCY_MHZ
#define LORA_FREQUENCY_MHZ (850.0f + LORA_CHANNEL)
#endif
#ifndef LORA_BANDWIDTH_KHZ
#define LORA_BANDWIDTH_KHZ 125.0f
#endif
#ifndef LORA_SPREADING_FACTOR
#define LORA_SPREADING_FACTOR 9
#endif
#ifndef LORA_CODING_RATE
#define LORA_CODING_RATE 5
#endif
#ifndef LORA_TX_POWER_DBM
#define LORA_TX_POWER_DBM 22
#endif
#ifndef LORA_SYNC_WORD
#define LORA_SYNC_WORD 0x12
#endif
#ifndef LORA_PREAMBLE_LEN
#define LORA_PREAMBLE_LEN 8
#endif
#ifndef LORA_TCXO_VOLTAGE
#define LORA_TCXO_VOLTAGE 1.8f
#endif
// Bytes sent ahead of every frame; defaults to a DTU-style broadcast header (addr FFFF + channel).
// The dashboard resynchronises on the frame magic, so extra or stripped header bytes are tolerated.
#ifndef LORA_AIR_PREFIX
#define LORA_AIR_PREFIX {0xFF, 0xFF, LORA_CHANNEL}
#endif

class LoRaRadio {
public:
    static bool begin(Print& out);
    static bool isReady() { return _ready; }

    // Non-blocking transmit; the radio returns to receive mode automatically when done.
    static bool send(const uint8_t* data, size_t len, bool withPrefix = true);
    static bool isTransmitting();
    static void service();

    static bool packetAvailable();
    static int readPacket(uint8_t* buf, size_t maxLen, float& rssiDbm, float& snrDb);

    // Link bring-up: listens on each candidate sync word and hex-dumps anything received.
    static void runSniffer(Stream& console);

    static void printConfig(Print& out);

private:
    static bool _ready;
    static bool _txBusy;
    static uint32_t _txStartMs;
    static bool startReceive();
};
