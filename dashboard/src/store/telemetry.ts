import { create } from 'zustand'
import { FLAG, type Alert, type AlertSeverity, type Frame, type LinkMode, type TrackPoint } from '../lib/types'
import { useSettings } from './settings'

export type ConnStatus = 'disconnected' | 'connecting' | 'connected'

export interface ConnState {
  status: ConnStatus
  mode: LinkMode | null
  label: string
  connectedAt: number | null
  lastFrameAt: number | null
  lastRxAt: number | null
}

export interface LinkStats {
  packets: number
  lost: number
  rateHz: number
  lastSeq: number | null
  commandsSent: number
  acks: number
}

export interface ConsoleLine {
  t: number
  dir: 'rx' | 'tx' | 'sys'
  text: string
}

export interface CommandState {
  cmd: number
  sentAt: number
  attempts: number
  status: 'pending' | 'acked' | 'failed'
  result?: number
}

export interface Snapshot {
  latest: Frame | null
  frames: Frame[]
  track: TrackPoint[]
  at: number
}

interface TelemetryState {
  conn: ConnState
  stats: LinkStats
  live: Snapshot
  /** What the UI renders; refreshed from `live` at the configured refresh interval */
  view: Snapshot
  payloadInfo: Record<string, unknown> | null
  console: ConsoleLine[]
  alerts: Alert[]
  command: CommandState | null

  ingest: (frame: Frame) => void
  applyRssi: (rssi: number) => void
  applyLinkMetrics: (rssi: number, snr: number) => void
  commitView: () => void
  log: (dir: ConsoleLine['dir'], text: string) => void
  setConn: (patch: Partial<ConnState>) => void
  setPayloadInfo: (info: Record<string, unknown>) => void
  setCommand: (c: CommandState | null) => void
  noteCommandSent: () => void
  noteAck: (cmd: number, status: number) => void
  resetSession: () => void
  checkLink: (now: number) => void
  ackAlert: (id: string) => void
  ackAllAlerts: () => void
  clearAlerts: () => void
}

const EMPTY: Snapshot = { latest: null, frames: [], track: [], at: 0 }
const EMPTY_STATS: LinkStats = { packets: 0, lost: 0, rateHz: 0, lastSeq: null, commandsSent: 0, acks: 0 }

export const EXPECTED_SENSORS: Array<{ flag: number; name: string }> = [
  { flag: FLAG.MS5607, name: 'MS5607 barometer' },
  { flag: FLAG.SCD40, name: 'SCD40 CO₂ sensor' },
  { flag: FLAG.SGP41, name: 'SGP41 gas sensor' },
  { flag: FLAG.TSL2591, name: 'TSL25911 light sensor' },
  { flag: FLAG.BNO055, name: 'BNO055 IMU' },
  { flag: FLAG.GPS_UART, name: 'BE-166 GNSS receiver' },
]

interface RuleResult {
  key: string
  active: boolean
  severity: AlertSeverity
  title: string
  message: string
}

function evaluateRules(f: Frame): RuleResult[] {
  const th = useSettings.getState().thresholds
  const rules: RuleResult[] = []

  if (f.flags & FLAG.SCD40) {
    const crit = f.env.co2 >= th.co2Crit
    rules.push({
      key: 'co2',
      active: f.env.co2 >= th.co2Warn,
      severity: crit ? 'critical' : 'warning',
      title: crit ? 'CO₂ critical' : 'CO₂ elevated',
      message: `CO₂ at ${f.env.co2} ppm (limit ${crit ? th.co2Crit : th.co2Warn} ppm)`,
    })
  }
  if (f.env.tSrc !== 'NONE') {
    rules.push({
      key: 'temp-high', active: f.env.t >= th.tempHigh, severity: 'warning',
      title: 'Temperature high', message: `${f.env.t.toFixed(1)} °C ≥ ${th.tempHigh} °C`,
    })
    rules.push({
      key: 'temp-low', active: f.env.t <= th.tempLow, severity: 'warning',
      title: 'Temperature low', message: `${f.env.t.toFixed(1)} °C ≤ ${th.tempLow} °C`,
    })
  }
  if (f.env.hSrc !== 'NONE') {
    rules.push({
      key: 'hum-high', active: f.env.h >= th.humHigh, severity: 'warning',
      title: 'Humidity high', message: `${f.env.h.toFixed(1)} % ≥ ${th.humHigh} %`,
    })
  }
  if (f.sys.bat > 0.5) {
    rules.push({
      key: 'battery', active: f.sys.batPct <= th.batLow, severity: f.sys.batPct <= th.batLow / 2 ? 'critical' : 'warning',
      title: 'Battery low', message: `${f.sys.bat.toFixed(2)} V (${f.sys.batPct} %)`,
    })
  }
  if (f.flags & FLAG.GPS_UART) {
    rules.push({
      key: 'gps-fix', active: f.gps.fix === 0, severity: 'warning',
      title: 'No GPS fix', message: `${f.gps.sats} satellites in view`,
    })
  }
  for (const s of EXPECTED_SENSORS) {
    rules.push({
      key: `sensor-${s.flag}`, active: (f.flags & s.flag) === 0, severity: 'warning',
      title: `${s.name} offline`, message: 'Subsystem not detected by the payload firmware',
    })
  }
  return rules
}

function applyRules(alerts: Alert[], results: RuleResult[], now: number): Alert[] {
  let next = alerts
  const mutate = () => {
    if (next === alerts) next = alerts.slice()
  }
  for (const r of results) {
    const idx = next.findIndex((a) => a.key === r.key && a.resolvedAt === null)
    if (r.active) {
      if (idx < 0) {
        mutate()
        next.unshift({
          id: `${r.key}-${now}`, key: r.key, severity: r.severity, title: r.title, message: r.message,
          raisedAt: now, resolvedAt: null, acknowledged: false,
        })
      } else if (next[idx].message !== r.message || next[idx].severity !== r.severity) {
        mutate()
        next[idx] = { ...next[idx], message: r.message, severity: r.severity, title: r.title }
      }
    } else if (idx >= 0) {
      mutate()
      next[idx] = { ...next[idx], resolvedAt: now }
    }
  }
  return next.length > 500 ? next.slice(0, 500) : next
}

export const useTelemetry = create<TelemetryState>()((set, get) => ({
  conn: { status: 'disconnected', mode: null, label: '', connectedAt: null, lastFrameAt: null, lastRxAt: null },
  stats: EMPTY_STATS,
  live: EMPTY,
  view: EMPTY,
  payloadInfo: null,
  console: [],
  alerts: [],
  command: null,

  ingest: (frame) => {
    const s = get()
    const historyMs = useSettings.getState().historyMin * 60_000
    const now = frame.t

    let frames = s.live.frames.length ? [...s.live.frames, frame] : [frame]
    let drop = 0
    while (drop < frames.length && frames[drop].t < now - historyMs) drop++
    if (drop) frames = frames.slice(drop)

    let track = s.live.track
    if (frame.gps.fix > 0 && (frame.gps.lat !== 0 || frame.gps.lon !== 0)) {
      track = [...track, { t: now, lat: frame.gps.lat, lon: frame.gps.lon, alt: frame.gps.alt, baroAlt: frame.baro.alt, spd: frame.gps.spd }]
      let tdrop = 0
      while (tdrop < track.length && track[tdrop].t < now - historyMs) tdrop++
      if (tdrop) track = track.slice(tdrop)
    }

    const stats = { ...s.stats, packets: s.stats.packets + 1 }
    if (s.stats.lastSeq !== null) {
      const gap = (frame.seq - s.stats.lastSeq) & 0xffff
      // Large jumps mean the payload rebooted rather than lost packets
      if (gap > 1 && gap < 1000) stats.lost += gap - 1
    }
    stats.lastSeq = frame.seq
    if (s.conn.lastFrameAt) {
      const dt = (now - s.conn.lastFrameAt) / 1000
      if (dt > 0 && dt < 30) stats.rateHz = s.stats.rateHz ? s.stats.rateHz * 0.8 + (1 / dt) * 0.2 : 1 / dt
    }

    const live = { latest: frame, frames, track, at: now }
    const alerts = applyRules(
      applyRules(s.alerts.filter((a) => a.key !== 'rssi'), [{ key: 'link', active: false, severity: 'critical', title: '', message: '' }], now),
      evaluateRules(frame),
      now,
    )
    set({
      live,
      stats,
      alerts,
      conn: { ...s.conn, lastFrameAt: now, lastRxAt: now },
      // Show the first frame immediately rather than waiting for the next refresh tick
      ...(s.view.latest ? {} : { view: live }),
    })
  },

  applyRssi: (rssi) => {
    const { live } = get()
    if (!live.latest) return
    const latest = { ...live.latest, link: { ...live.latest.link, rssi } }
    const frames = live.frames.slice()
    frames[frames.length - 1] = latest
    set({ live: { ...live, latest, frames } })
  },

  applyLinkMetrics: (rssi, snr) => {
    const { live, view } = get()
    if (!live.latest) return
    const latest = { ...live.latest, link: { rssi, snr } }
    const frames = live.frames.slice()
    frames[frames.length - 1] = latest
    const updated = { ...live, latest, frames }
    set({ live: updated, ...(view.latest?.t === latest.t ? { view: updated } : {}) })
  },

  commitView: () => set((s) => ({ view: s.live })),

  log: (dir, text) =>
    set((s) => {
      const line = { t: Date.now(), dir, text }
      const lines = s.console.length >= 500 ? [...s.console.slice(-499), line] : [...s.console, line]
      return { console: lines }
    }),

  setConn: (patch) => set((s) => ({ conn: { ...s.conn, ...patch } })),
  setPayloadInfo: (info) => set({ payloadInfo: info }),
  setCommand: (command) => set({ command }),
  noteCommandSent: () => set((s) => ({ stats: { ...s.stats, commandsSent: s.stats.commandsSent + 1 } })),
  noteAck: (cmd, status) =>
    set((s) => ({
      stats: { ...s.stats, acks: s.stats.acks + 1 },
      command: s.command && s.command.cmd === cmd ? { ...s.command, status: 'acked', result: status } : s.command,
    })),

  resetSession: () =>
    set({ live: EMPTY, view: EMPTY, stats: EMPTY_STATS, payloadInfo: null, command: null, alerts: [] }),

  checkLink: (now) => {
    const s = get()
    if (s.conn.status !== 'connected' || !s.conn.connectedAt) return
    const timeoutMs = useSettings.getState().thresholds.linkTimeout * 1000
    const since = s.conn.lastFrameAt ?? s.conn.connectedAt
    const lost = now - since > timeoutMs
    const alerts = applyRules(
      s.alerts,
      [{
        key: 'link', active: lost, severity: 'critical', title: 'Telemetry link lost',
        message: s.conn.lastFrameAt ? 'No frames received within the link timeout' : 'Waiting for the first telemetry frame',
      }],
      now,
    )
    if (alerts !== s.alerts) set({ alerts })
  },

  ackAlert: (id) => set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)) })),
  ackAllAlerts: () => set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, acknowledged: true })) })),
  clearAlerts: () => set((s) => ({ alerts: s.alerts.filter((a) => a.resolvedAt === null) })),
}))
