export type SourceName = 'MS5607' | 'BME680' | 'SCD40' | 'NONE'
export type LinkMode = 'lora' | 'usb' | 'demo'

export interface Frame {
  /** Host receive time, ms since epoch */
  t: number
  source: LinkMode
  dev: string
  fw?: string
  seq: number
  up: number
  flags: number
  gps: {
    fix: number
    sats: number
    hdop: number
    lat: number
    lon: number
    alt: number
    spd: number
    hdg: number
    utc: string | null
  }
  baro: { alt: number; vs: number; p: number }
  env: {
    t: number
    h: number
    p: number
    tSrc: SourceName
    hSrc: SourceName
    pSrc: SourceName
    co2: number
    voc: number
    nox: number
    lux: number
    ir: number
  }
  imu: {
    roll: number
    pitch: number
    yaw: number
    ax: number
    ay: number
    az: number
    gx: number
    gy: number
    gz: number
    cal: [number, number, number, number]
  }
  sys: { bat: number; batPct: number; mcuT: number }
  link: { rssi: number | null; snr: number | null }
}

export interface TrackPoint {
  t: number
  lat: number
  lon: number
  alt: number
  baroAlt: number
  spd: number
}

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface Alert {
  id: string
  key: string
  severity: AlertSeverity
  title: string
  message: string
  raisedAt: number
  resolvedAt: number | null
  acknowledged: boolean
}

/** Subsystem presence bits carried in Frame.flags (mirrors firmware TelemetryFlag) */
export const FLAG = {
  MS5607: 1 << 0,
  BME680: 1 << 1,
  SCD40: 1 << 2,
  SGP41: 1 << 3,
  LTR390: 1 << 4,
  TSL2591: 1 << 5,
  BNO055: 1 << 6,
  GPS_UART: 1 << 7,
  FLASH: 1 << 8,
  SDCARD: 1 << 9,
  LOGGING: 1 << 10,
  PPS_LOCK: 1 << 11,
  GPS_TIME: 1 << 12,
} as const
