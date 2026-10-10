Module: RAK3112-8-SM-I
 - MCU: ESP32-S3
 - Lora: SX1262

---
 
ESP32-S3 GPIO:

POWER management
EN-40 //  this is used to enable the power, needs to be high. when pulled low, the device will switch off
BTN-39  //  power button will switch on the device, this can also be read after power on

Voltage sensing
VADC-9  //  connected to battery voltage with a 1/2 voltage divider

Onboard LED
LED-45

SENSOR I2C (SCD40, BME680, SGP41,LTR-390UV, TSL25911FN, MS5607)
SDA1-10
SCL1-11

IMU sensor (BNO055)
SDA2-2
SCL2-1
INT-4

GPS receiver (BE-166)
MCU_RX-42  // Connected to BE-166 TXD (U11 Pin 2 via H1/H2)
MCU_TX-41  // Connected to BE-166 RXD (U11 Pin 1 via H1/H2)
IPPS-38    // 1PPS hardware pulse interrupt (1.00 Hz)

SD CARD reader
CMD-21
CLK-14
DAT0-13
DAT1-12
DAT2-17
DAT3-18
