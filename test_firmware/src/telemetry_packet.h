#pragma once

#include <Arduino.h>

#define TELEMETRY_FW_VERSION "2.0.0"

constexpr uint8_t TELEMETRY_MAGIC_0 = 'R';
constexpr uint8_t TELEMETRY_MAGIC_1 = 'B';
constexpr uint8_t TELEMETRY_PROTOCOL_VERSION = 1;

// Subsystem presence / state bits carried in TelemetryFrame::flags
enum TelemetryFlag : uint16_t {
    TLM_MS5607   = 1u << 0,
    TLM_BME680   = 1u << 1,
    TLM_SCD40    = 1u << 2,
    TLM_SGP41    = 1u << 3,
    TLM_LTR390   = 1u << 4,
    TLM_TSL2591  = 1u << 5,
    TLM_BNO055   = 1u << 6,
    TLM_GPS_UART = 1u << 7,
    TLM_FLASH    = 1u << 8,
    TLM_SDCARD   = 1u << 9,
    TLM_LOGGING  = 1u << 10,
    TLM_PPS_LOCK = 1u << 11,
    TLM_GPS_TIME = 1u << 12,
};

enum TelemetrySource : uint8_t {
    SRC_NONE   = 0,
    SRC_MS5607 = 1,
    SRC_BME680 = 2,
    SRC_SCD40  = 3,
};

// Engineering-unit frame sampled on the payload; sent as the LoRa packet below and as USB JSON.
struct TelemetryFrame {
    uint16_t deviceId;
    uint16_t seq;
    uint32_t uptimeS;
    uint16_t flags;

    uint8_t gpsFix;          // 0 = none, 2 = 2D, 3 = 3D
    uint8_t satellites;
    float hdop;
    double latitude;
    double longitude;
    float gpsAltM;
    float speedKmh;
    float headingDeg;
    uint8_t utcHour, utcMinute, utcSecond;

    float baroAltM;
    float verticalSpeedMs;
    float pressureHpa;

    float temperatureC;
    float humidityPct;
    uint8_t tempSrc, humSrc, presSrc;
    uint16_t co2Ppm;
    uint16_t vocIndex;
    uint16_t noxIndex;
    float lux;
    uint16_t irRaw;

    float rollDeg, pitchDeg, yawDeg;
    float accX, accY, accZ;  // raw accelerometer incl. gravity, m/s^2
    float gyrX, gyrY, gyrZ;  // deg/s
    uint8_t calSys, calGyro, calAccel, calMag;

    float batteryV;
    uint8_t batteryPct;
    int8_t mcuTempC;
};

// Compact little-endian LoRa payload (both ends are ESP32-S3).
struct __attribute__((packed)) TelemetryPacket {
    uint8_t magic[2];
    uint8_t version;
    uint16_t deviceId;
    uint16_t seq;
    uint32_t uptimeS;
    uint16_t flags;

    uint8_t gpsFix;
    uint8_t satellites;
    uint16_t hdopX10;
    int32_t latE7;
    int32_t lonE7;
    int32_t gpsAltCm;
    uint16_t speedKmhX10;
    uint16_t headingX100;
    uint8_t utc[3];

    int32_t baroAltCm;
    int16_t vSpeedDms;
    uint32_t pressurePa;

    int16_t tempX100;
    uint16_t humX100;
    uint8_t sources;         // [tempSrc:2][humSrc:2][presSrc:2]
    uint16_t co2Ppm;
    uint16_t vocIndex;
    uint16_t noxIndex;
    float lux;
    uint16_t irRaw;

    int16_t rollX10, pitchX10;
    uint16_t yawX10;
    int16_t accX100[3];
    int16_t gyrX10[3];
    uint8_t calibration;     // [sys:2][gyro:2][accel:2][mag:2]

    uint16_t batteryMv;
    uint8_t batteryPct;
    int8_t mcuTempC;

    uint16_t crc;
};

// Dashboard -> payload uplink (sent through the USB-TO-LoRa dongle)
enum TelemetryCommand : uint8_t {
    CMD_PING      = 0x01,
    CMD_LOG_START = 0x02,
    CMD_LOG_STOP  = 0x03,
};

struct __attribute__((packed)) CommandPacket {
    uint8_t magic[2];        // 'R','C'
    uint8_t version;
    uint8_t cmd;
    uint16_t arg;
    uint16_t crc;
};

struct __attribute__((packed)) AckPacket {
    uint8_t magic[2];        // 'R','A'
    uint8_t version;
    uint8_t cmd;
    uint8_t status;          // 0 = OK
    uint16_t deviceId;
    uint16_t crc;
};

namespace Telemetry {
    uint16_t crc16(const uint8_t* data, size_t len);
    size_t encode(const TelemetryFrame& f, TelemetryPacket& out);
    bool decode(const uint8_t* data, size_t len, TelemetryFrame& out);

    // Scans a received buffer (which may carry DTU header bytes) for a valid command.
    bool findCommand(const uint8_t* data, size_t len, CommandPacket& out);
    size_t encodeAck(uint8_t cmd, uint8_t status, uint16_t deviceId, AckPacket& out);

    const char* sourceName(uint8_t src);
    void formatDeviceId(uint16_t id, char* buf, size_t len);

    // One JSON object per line for the dashboard's direct-USB mode.
    void writeJson(Print& out, const TelemetryFrame& f);
}
