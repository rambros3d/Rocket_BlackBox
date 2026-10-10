import { FLAG, type Frame } from './types'

// Simulated flight around Chennai so the dashboard is explorable without hardware.
const CENTER = { lat: 13.0827, lon: 80.2707 }
const LOOP_S = 3600
const WAYPOINTS: Array<[number, number]> = [
  [0.0245, -0.0185], [0.0175, -0.0105], [0.0085, -0.0062], [0.0012, -0.0035],
  [-0.0072, 0.0012], [-0.0135, 0.0078], [-0.0095, 0.0162], [0.0005, 0.0188],
  [0.0118, 0.0122], [0.0215, 0.0035], [0.0268, -0.0078],
]

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

function position(tSec: number): { lat: number; lon: number } {
  const n = WAYPOINTS.length
  const u = (((tSec % LOOP_S) + LOOP_S) % LOOP_S) / LOOP_S * n
  const i = Math.floor(u)
  const f = u - i
  const p = (k: number) => WAYPOINTS[(i + k + n) % n]
  return {
    lat: CENTER.lat + catmull(p(-1)[0], p(0)[0], p(1)[0], p(2)[0], f),
    lon: CENTER.lon + catmull(p(-1)[1], p(0)[1], p(1)[1], p(2)[1], f),
  }
}

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLon = (b.lon - a.lon) * toRad
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const toRad = Math.PI / 180
  const y = Math.sin((b.lon - a.lon) * toRad) * Math.cos(b.lat * toRad)
  const x = Math.cos(a.lat * toRad) * Math.sin(b.lat * toRad) - Math.sin(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.cos((b.lon - a.lon) * toRad)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

const jitter = (amp: number) => (Math.random() - 0.5) * 2 * amp
const pad = (v: number) => String(v).padStart(2, '0')

const FLAGS =
  FLAG.MS5607 | FLAG.BME680 | FLAG.SCD40 | FLAG.SGP41 | FLAG.TSL2591 | FLAG.BNO055 |
  FLAG.GPS_UART | FLAG.FLASH | FLAG.LOGGING | FLAG.PPS_LOCK | FLAG.GPS_TIME

export function makeDemoFrame(t: number, seq: number, startedAt: number): Frame {
  const s = t / 1000
  const pos = position(s)
  const prev = position(s - 1)
  const speedMs = haversine(prev, pos)
  const alt = 118 + 14 * Math.sin(s / 520) + 6 * Math.sin(s / 97) + jitter(0.3)
  const altPrev = 118 + 14 * Math.sin((s - 1) / 520) + 6 * Math.sin((s - 1) / 97)
  const utc = new Date(t)
  const temp = 28.4 + 0.7 * Math.sin(s / 300) + 0.3 * Math.sin(s / 47) + jitter(0.08)
  const hum = 54.2 + 3.5 * Math.sin(s / 420 + 1) + jitter(0.3)
  const pres = 1009.6 + 0.6 * Math.sin(s / 600) + jitter(0.05)
  const lux = Math.max(0, 2560 + 900 * Math.sin(s / 260) + 300 * Math.sin(s / 31) + jitter(120))
  const hdg = bearing(prev, pos)

  return {
    t,
    source: 'demo',
    dev: 'RBB-0023',
    fw: '2.0.0',
    seq: seq & 0xffff,
    up: Math.floor(9348 + (t - startedAt) / 1000),
    flags: FLAGS,
    gps: {
      fix: 3,
      sats: 12 + (Math.sin(s / 200) > 0.8 ? -1 : 0),
      hdop: 0.7 + Math.abs(Math.sin(s / 150)) * 0.2,
      lat: pos.lat,
      lon: pos.lon,
      alt: alt - 13 + jitter(1.2),
      spd: speedMs * 3.6,
      hdg,
      utc: `${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}:${pad(utc.getUTCSeconds())}`,
    },
    baro: { alt, vs: alt - altPrev, p: pres },
    env: {
      t: temp, h: hum, p: pres, tSrc: 'BME680', hSrc: 'BME680', pSrc: 'BME680',
      co2: Math.round(612 + 70 * Math.sin(s / 350) + jitter(12)),
      voc: Math.round(86 + 18 * Math.sin(s / 200) + jitter(4)),
      nox: Math.round(42 + 8 * Math.sin(s / 260 + 2) + jitter(2)),
      lux,
      ir: Math.round(lux * 0.4),
    },
    imu: {
      roll: -2.6 + 3 * Math.sin(s / 7) + jitter(0.3),
      pitch: 1.8 + 2 * Math.sin(s / 9 + 1) + jitter(0.3),
      yaw: (hdg + 360) % 360,
      ax: 0.12 + 0.6 * Math.sin(s / 3) + jitter(0.4),
      ay: -0.05 + 0.6 * Math.sin(s / 4 + 1) + jitter(0.4),
      az: 9.81 + 0.4 * Math.sin(s / 5) + jitter(0.3),
      gx: 0.8 * Math.sin(s / 6) + jitter(0.1),
      gy: 0.6 * Math.sin(s / 8) + jitter(0.1),
      gz: -0.3 + 0.3 * Math.sin(s / 10) + jitter(0.05),
      cal: [3, 3, 3, 3],
    },
    sys: { bat: 3.92 - (t - startedAt) / 3.6e8, batPct: 84, mcuT: 41 },
    link: { rssi: Math.round(-78 + 4 * Math.sin(s / 40) + jitter(1.5)), snr: +(9.5 + Math.sin(s / 33) + jitter(0.4)).toFixed(1) },
  }
}

export class DemoSource {
  private timer: ReturnType<typeof setInterval> | null = null
  private seq = 0
  private startedAt = 0

  get running() {
    return this.timer !== null
  }

  start(onFrame: (f: Frame) => void, backfillMin = 40) {
    this.stop()
    const now = Date.now()
    this.startedAt = now - backfillMin * 60_000
    this.seq = 0
    for (let t = this.startedAt; t < now; t += 1000) onFrame(makeDemoFrame(t, this.seq++, this.startedAt))
    this.timer = setInterval(() => onFrame(makeDemoFrame(Date.now(), this.seq++, this.startedAt)), 1000)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
