#include "telemetry_packet.h"
#include <math.h>

static_assert(sizeof(TelemetryPacket) == 88, "TelemetryPacket layout changed; update dashboard/src/lib/protocol.ts");

namespace {

template <typename T>
T clampTo(double v, double lo, double hi) {
    if (!isfinite(v)) return (T)0;
    if (v < lo) v = lo;
    if (v > hi) v = hi;
    return (T)llround(v);
}

void num(Print& out, double v, uint8_t digits) {
    if (!isfinite(v)) {
        out.print("null");
    } else {
        out.print(v, digits);
    }
}

}  // namespace

namespace Telemetry {

uint16_t crc16(const uint8_t* data, size_t len) {
    // CRC-16/CCITT-FALSE
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < len; i++) {
        crc ^= (uint16_t)data[i] << 8;
        for (uint8_t b = 0; b < 8; b++) {
            crc = (crc & 0x8000) ? (uint16_t)((crc << 1) ^ 0x1021) : (uint16_t)(crc << 1);
        }
    }
    return crc;
}

size_t encode(const TelemetryFrame& f, TelemetryPacket& p) {
    memset(&p, 0, sizeof(p));
    p.magic[0] = TELEMETRY_MAGIC_0;
    p.magic[1] = TELEMETRY_MAGIC_1;
    p.version = TELEMETRY_PROTOCOL_VERSION;
    p.deviceId = f.deviceId;
    p.seq = f.seq;
    p.uptimeS = f.uptimeS;
    p.flags = f.flags;

    p.gpsFix = f.gpsFix;
    p.satellites = f.satellites;
    p.hdopX10 = clampTo<uint16_t>(f.hdop * 10.0, 0, 65535);
    p.latE7 = clampTo<int32_t>(f.latitude * 1e7, -900000000.0, 900000000.0);
    p.lonE7 = clampTo<int32_t>(f.longitude * 1e7, -1800000000.0, 1800000000.0);
    p.gpsAltCm = clampTo<int32_t>(f.gpsAltM * 100.0, -2e9, 2e9);
    p.speedKmhX10 = clampTo<uint16_t>(f.speedKmh * 10.0, 0, 65535);
    p.headingX100 = clampTo<uint16_t>(f.headingDeg * 100.0, 0, 36000);
    p.utc[0] = f.utcHour;
    p.utc[1] = f.utcMinute;
    p.utc[2] = f.utcSecond;

    p.baroAltCm = clampTo<int32_t>(f.baroAltM * 100.0, -2e9, 2e9);
    p.vSpeedDms = clampTo<int16_t>(f.verticalSpeedMs * 10.0, -32768, 32767);
    p.pressurePa = clampTo<uint32_t>(f.pressureHpa * 100.0, 0, 4e9);

    p.tempX100 = clampTo<int16_t>(f.temperatureC * 100.0, -32768, 32767);
    p.humX100 = clampTo<uint16_t>(f.humidityPct * 100.0, 0, 10000);
    p.sources = (uint8_t)(((f.tempSrc & 0x3) << 4) | ((f.humSrc & 0x3) << 2) | (f.presSrc & 0x3));
    p.co2Ppm = f.co2Ppm;
    p.vocIndex = f.vocIndex;
    p.noxIndex = f.noxIndex;
    p.lux = f.lux;
    p.irRaw = f.irRaw;

    p.rollX10 = clampTo<int16_t>(f.rollDeg * 10.0, -32768, 32767);
    p.pitchX10 = clampTo<int16_t>(f.pitchDeg * 10.0, -32768, 32767);
    p.yawX10 = clampTo<uint16_t>(f.yawDeg * 10.0, 0, 3600);
    p.accX100[0] = clampTo<int16_t>(f.accX * 100.0, -32768, 32767);
    p.accX100[1] = clampTo<int16_t>(f.accY * 100.0, -32768, 32767);
    p.accX100[2] = clampTo<int16_t>(f.accZ * 100.0, -32768, 32767);
    p.gyrX10[0] = clampTo<int16_t>(f.gyrX * 10.0, -32768, 32767);
    p.gyrX10[1] = clampTo<int16_t>(f.gyrY * 10.0, -32768, 32767);
    p.gyrX10[2] = clampTo<int16_t>(f.gyrZ * 10.0, -32768, 32767);
    p.calibration = (uint8_t)(((f.calSys & 0x3) << 6) | ((f.calGyro & 0x3) << 4) |
                              ((f.calAccel & 0x3) << 2) | (f.calMag & 0x3));

    p.batteryMv = clampTo<uint16_t>(f.batteryV * 1000.0, 0, 65535);
    p.batteryPct = f.batteryPct;
    p.mcuTempC = f.mcuTempC;

    p.crc = crc16(reinterpret_cast<const uint8_t*>(&p), offsetof(TelemetryPacket, crc));
    return sizeof(p);
}

bool decode(const uint8_t* data, size_t len, TelemetryFrame& f) {
    if (len != sizeof(TelemetryPacket)) return false;
    TelemetryPacket p;
    memcpy(&p, data, sizeof(p));
    if (p.magic[0] != TELEMETRY_MAGIC_0 || p.magic[1] != TELEMETRY_MAGIC_1) return false;
    if (p.version != TELEMETRY_PROTOCOL_VERSION) return false;
    if (crc16(data, offsetof(TelemetryPacket, crc)) != p.crc) return false;

    memset(&f, 0, sizeof(f));
    f.deviceId = p.deviceId;
    f.seq = p.seq;
    f.uptimeS = p.uptimeS;
    f.flags = p.flags;

    f.gpsFix = p.gpsFix;
    f.satellites = p.satellites;
    f.hdop = p.hdopX10 / 10.0f;
    f.latitude = p.latE7 / 1e7;
    f.longitude = p.lonE7 / 1e7;
    f.gpsAltM = p.gpsAltCm / 100.0f;
    f.speedKmh = p.speedKmhX10 / 10.0f;
    f.headingDeg = p.headingX100 / 100.0f;
    f.utcHour = p.utc[0];
    f.utcMinute = p.utc[1];
    f.utcSecond = p.utc[2];

    f.baroAltM = p.baroAltCm / 100.0f;
    f.verticalSpeedMs = p.vSpeedDms / 10.0f;
    f.pressureHpa = p.pressurePa / 100.0f;

    f.temperatureC = p.tempX100 / 100.0f;
    f.humidityPct = p.humX100 / 100.0f;
    f.tempSrc = (p.sources >> 4) & 0x3;
    f.humSrc = (p.sources >> 2) & 0x3;
    f.presSrc = p.sources & 0x3;
    f.co2Ppm = p.co2Ppm;
    f.vocIndex = p.vocIndex;
    f.noxIndex = p.noxIndex;
    f.lux = p.lux;
    f.irRaw = p.irRaw;

    f.rollDeg = p.rollX10 / 10.0f;
    f.pitchDeg = p.pitchX10 / 10.0f;
    f.yawDeg = p.yawX10 / 10.0f;
    f.accX = p.accX100[0] / 100.0f;
    f.accY = p.accX100[1] / 100.0f;
    f.accZ = p.accX100[2] / 100.0f;
    f.gyrX = p.gyrX10[0] / 10.0f;
    f.gyrY = p.gyrX10[1] / 10.0f;
    f.gyrZ = p.gyrX10[2] / 10.0f;
    f.calSys = (p.calibration >> 6) & 0x3;
    f.calGyro = (p.calibration >> 4) & 0x3;
    f.calAccel = (p.calibration >> 2) & 0x3;
    f.calMag = p.calibration & 0x3;

    f.batteryV = p.batteryMv / 1000.0f;
    f.batteryPct = p.batteryPct;
    f.mcuTempC = p.mcuTempC;
    return true;
}

bool findCommand(const uint8_t* data, size_t len, CommandPacket& out) {
    for (size_t i = 0; i + sizeof(CommandPacket) <= len; i++) {
        if (data[i] != TELEMETRY_MAGIC_0 || data[i + 1] != 'C') continue;
        memcpy(&out, data + i, sizeof(out));
        if (out.version == TELEMETRY_PROTOCOL_VERSION &&
            crc16(data + i, offsetof(CommandPacket, crc)) == out.crc) {
            return true;
        }
    }
    return false;
}

size_t encodeAck(uint8_t cmd, uint8_t status, uint16_t deviceId, AckPacket& p) {
    p.magic[0] = TELEMETRY_MAGIC_0;
    p.magic[1] = 'A';
    p.version = TELEMETRY_PROTOCOL_VERSION;
    p.cmd = cmd;
    p.status = status;
    p.deviceId = deviceId;
    p.crc = crc16(reinterpret_cast<const uint8_t*>(&p), offsetof(AckPacket, crc));
    return sizeof(p);
}

const char* sourceName(uint8_t src) {
    switch (src) {
        case SRC_MS5607: return "MS5607";
        case SRC_BME680: return "BME680";
        case SRC_SCD40:  return "SCD40";
        default:         return "NONE";
    }
}

void formatDeviceId(uint16_t id, char* buf, size_t len) {
    snprintf(buf, len, "RBB-%04X", id);
}

void writeJson(Print& out, const TelemetryFrame& f) {
    char dev[12];
    formatDeviceId(f.deviceId, dev, sizeof(dev));

    out.printf("{\"type\":\"telemetry\",\"dev\":\"%s\",\"fw\":\"%s\",\"seq\":%u,\"up\":%lu,\"flags\":%u,",
               dev, TELEMETRY_FW_VERSION, f.seq, (unsigned long)f.uptimeS, f.flags);

    out.printf("\"gps\":{\"fix\":%u,\"sats\":%u,\"hdop\":", f.gpsFix, f.satellites);
    num(out, f.hdop, 1);
    out.print(",\"lat\":");  num(out, f.latitude, 7);
    out.print(",\"lon\":");  num(out, f.longitude, 7);
    out.print(",\"alt\":");  num(out, f.gpsAltM, 1);
    out.print(",\"spd\":");  num(out, f.speedKmh, 1);
    out.print(",\"hdg\":");  num(out, f.headingDeg, 1);
    if (f.flags & TLM_GPS_TIME) {
        out.printf(",\"utc\":\"%02u:%02u:%02u\"},", f.utcHour, f.utcMinute, f.utcSecond);
    } else {
        out.print(",\"utc\":null},");
    }

    out.print("\"baro\":{\"alt\":"); num(out, f.baroAltM, 2);
    out.print(",\"vs\":");           num(out, f.verticalSpeedMs, 2);
    out.print(",\"p\":");            num(out, f.pressureHpa, 2);
    out.print("},");

    out.print("\"env\":{\"t\":"); num(out, f.temperatureC, 2);
    out.print(",\"h\":");         num(out, f.humidityPct, 2);
    out.print(",\"p\":");         num(out, f.pressureHpa, 2);
    out.printf(",\"t_src\":\"%s\",\"h_src\":\"%s\",\"p_src\":\"%s\",\"co2\":%u,\"voc\":%u,\"nox\":%u,\"lux\":",
               sourceName(f.tempSrc), sourceName(f.humSrc), sourceName(f.presSrc),
               f.co2Ppm, f.vocIndex, f.noxIndex);
    num(out, f.lux, 1);
    out.printf(",\"ir\":%u},", f.irRaw);

    out.print("\"imu\":{\"roll\":"); num(out, f.rollDeg, 1);
    out.print(",\"pitch\":");        num(out, f.pitchDeg, 1);
    out.print(",\"yaw\":");          num(out, f.yawDeg, 1);
    out.print(",\"ax\":");           num(out, f.accX, 2);
    out.print(",\"ay\":");           num(out, f.accY, 2);
    out.print(",\"az\":");           num(out, f.accZ, 2);
    out.print(",\"gx\":");           num(out, f.gyrX, 1);
    out.print(",\"gy\":");           num(out, f.gyrY, 1);
    out.print(",\"gz\":");           num(out, f.gyrZ, 1);
    out.printf(",\"cal\":[%u,%u,%u,%u]},", f.calSys, f.calGyro, f.calAccel, f.calMag);

    out.print("\"sys\":{\"bat\":"); num(out, f.batteryV, 2);
    out.printf(",\"bat_pct\":%u,\"mcu_t\":%d}}\n", f.batteryPct, f.mcuTempC);
}

}  // namespace Telemetry
