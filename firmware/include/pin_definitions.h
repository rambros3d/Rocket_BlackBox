#pragma once

#include <Arduino.h>

// ==========================================
// Power Management
// ==========================================
constexpr gpio_num_t PIN_PWR_EN     = GPIO_NUM_40; // Needs to be pulled HIGH immediately to maintain power
constexpr gpio_num_t PIN_PWR_BTN    = GPIO_NUM_39; // Power button input (detects user button presses)
constexpr gpio_num_t PIN_BAT_ADC    = GPIO_NUM_9;  // Battery voltage ADC sensing (1/2 divider)
constexpr gpio_num_t PIN_LED        = GPIO_NUM_45; // Onboard status/heartbeat LED

// ==========================================
// Environmental Sensor I2C Bus 1
// (SCD40, BME680, SGP41, LTR-390UV, TSL25911FN, MS5607)
// ==========================================
constexpr gpio_num_t PIN_I2C1_SDA   = GPIO_NUM_10;
constexpr gpio_num_t PIN_I2C1_SCL   = GPIO_NUM_11;

// ==========================================
// Dedicated IMU I2C Bus 2 (BNO055)
// ==========================================
constexpr gpio_num_t PIN_I2C2_SDA   = GPIO_NUM_2;
constexpr gpio_num_t PIN_I2C2_SCL   = GPIO_NUM_1;
constexpr gpio_num_t PIN_IMU_INT    = GPIO_NUM_4;  // Note: Internal ANT_SW on RAK3112; unused in polled mode

// ==========================================
// GPS Receiver (BE-166) UART & Sync
// ==========================================
constexpr gpio_num_t PIN_GPS_RX     = GPIO_NUM_42; // Connected to BE-166 TXD (U11 Pin 2 via H1/H2)
constexpr gpio_num_t PIN_GPS_TX     = GPIO_NUM_41; // Connected to BE-166 RXD (U11 Pin 1 via H1/H2)
constexpr gpio_num_t PIN_GPS_1PPS   = GPIO_NUM_38; // 1 Pulse-Per-Second timing pulse

// ==========================================
// SD Card Reader (4-Bit SDMMC Mode)
// ==========================================
constexpr gpio_num_t PIN_SD_CLK     = GPIO_NUM_14;
constexpr gpio_num_t PIN_SD_CMD     = GPIO_NUM_21;
constexpr gpio_num_t PIN_SD_DAT0    = GPIO_NUM_13;
constexpr gpio_num_t PIN_SD_DAT1    = GPIO_NUM_12;
constexpr gpio_num_t PIN_SD_DAT2    = GPIO_NUM_17;
constexpr gpio_num_t PIN_SD_DAT3    = GPIO_NUM_18;

// ==========================================
// RAK3112 Internal SX1262 LoRa Transceiver
// ==========================================
constexpr gpio_num_t PIN_LORA_SCK    = GPIO_NUM_5;   // SPI Clock
constexpr gpio_num_t PIN_LORA_MISO   = GPIO_NUM_3;   // SPI MISO
constexpr gpio_num_t PIN_LORA_MOSI   = GPIO_NUM_6;   // SPI MOSI
constexpr gpio_num_t PIN_LORA_NSS    = GPIO_NUM_7;   // SPI Chip Select (NSS)
constexpr gpio_num_t PIN_LORA_RST    = GPIO_NUM_8;   // SX1262 NRESET
constexpr gpio_num_t PIN_LORA_BUSY   = GPIO_NUM_48;  // SX1262 BUSY Status
constexpr gpio_num_t PIN_LORA_DIO1   = GPIO_NUM_47;  // SX1262 DIO1 Interrupt
constexpr gpio_num_t PIN_LORA_ANT_SW = GPIO_NUM_4;   // RF Antenna Switch Power (High = Active)
