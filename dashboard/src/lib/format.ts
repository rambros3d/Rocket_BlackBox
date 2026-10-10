import type { Frame, SourceName, TrackPoint } from './types'

export const fmt = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? '--' : v.toFixed(digits)

export const signed = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? '--' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`

export const int = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? '--' : Math.round(v).toLocaleString('en-US')

export const latStr = (v: number | undefined) =>
  v === undefined ? '--' : `${Math.abs(v).toFixed(6)}° ${v >= 0 ? 'N' : 'S'}`
export const lonStr = (v: number | undefined) =>
  v === undefined ? '--' : `${Math.abs(v).toFixed(6)}° ${v >= 0 ? 'E' : 'W'}`

const pad = (n: number) => String(n).padStart(2, '0')

export const clock12 = (t: number | Date, seconds = true) =>
  new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}), hour12: true })

export const hhmm = (t: number) => {
  const d = new Date(t)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const dateLong = (t: number | Date) =>
  new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const duration = (sec: number | undefined) => {
  if (sec === undefined || !Number.isFinite(sec) || sec < 0) return '--:--:--'
  const s = Math.floor(sec)
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

export const srcLabel = (s: SourceName | undefined) => (s && s !== 'NONE' ? s : '—')

/** Converts the payload's GPS UTC "HH:MM:SS" into a local 12-hour clock string */
export function gpsLocalTime(utc: string | null | undefined): string {
  if (!utc) return '--'
  const [h, m, s] = utc.split(':').map(Number)
  const d = new Date()
  d.setUTCHours(h, m, s, 0)
  return clock12(d)
}

export const fixLabel = (fix: number | undefined) => (fix === 3 ? '3D Fix' : fix === 2 ? '2D Fix' : fix === undefined ? '--' : 'No Fix')

export function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000
  const r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r
  const dLon = (b.lon - a.lon) * r
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export interface TripSummary {
  distanceKm: number
  maxAlt: number
  minAlt: number
  maxSpeedMs: number
  movingSec: number
  durationSec: number
}

export function tripSummary(track: TrackPoint[]): TripSummary | null {
  if (track.length < 2) return null
  let dist = 0
  let moving = 0
  let maxAlt = -Infinity
  let minAlt = Infinity
  let maxSpd = 0
  for (let i = 0; i < track.length; i++) {
    const p = track[i]
    maxAlt = Math.max(maxAlt, p.baroAlt)
    minAlt = Math.min(minAlt, p.baroAlt)
    maxSpd = Math.max(maxSpd, p.spd / 3.6)
    if (i > 0) {
      const d = haversineM(track[i - 1], p)
      // Ignore GNSS jitter while stationary
      if (d > 0.5) dist += d
      const dt = (p.t - track[i - 1].t) / 1000
      if (p.spd > 1 && dt < 10) moving += dt
    }
  }
  return {
    distanceKm: dist / 1000,
    maxAlt,
    minAlt,
    maxSpeedMs: maxSpd,
    movingSec: moving,
    durationSec: (track[track.length - 1].t - track[0].t) / 1000,
  }
}

/** Evenly thins a series to at most `max` points for charting */
export function downsample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items
  const step = items.length / max
  const out: T[] = []
  for (let i = 0; i < max - 1; i++) out.push(items[Math.floor(i * step)])
  out.push(items[items.length - 1])
  return out
}

export function windowFrames(frames: Frame[], seconds: number): Frame[] {
  if (!seconds || !frames.length) return frames
  const since = frames[frames.length - 1].t - seconds * 1000
  let i = frames.length - 1
  while (i > 0 && frames[i - 1].t >= since) i--
  return frames.slice(i)
}
