import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Calendar, ChevronDown, Download, MapPin, Mountain, Pause, Play, RadioTower, Route, Square } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { KV, PageHeader, Panel } from '../components/ui/primitives'
import { TimeChart, type Series } from '../components/charts/TimeChart'
import TelemetryMap from '../components/map/TelemetryMap'
import { useLatest, useView } from '../hooks'
import { clock12, dateLong, duration, fixLabel, fmt, latStr, lonStr, tripSummary } from '../lib/format'
import { exportGpx } from '../lib/export'
import type { Frame, TrackPoint } from '../lib/types'

const PROFILE: Series[] = [{ name: 'Altitude', color: '#3b82f6', get: (f: Frame) => f.baro.alt }]
const dayKey = (t: number) => new Date(t).toDateString()

function interpolate(track: TrackPoint[], t: number): TrackPoint | null {
  if (!track.length) return null
  if (t <= track[0].t) return track[0]
  if (t >= track[track.length - 1].t) return track[track.length - 1]
  let lo = 0
  let hi = track.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (track[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = track[lo]
  const b = track[hi]
  const k = (t - a.t) / (b.t - a.t || 1)
  return { t, lat: a.lat + (b.lat - a.lat) * k, lon: a.lon + (b.lon - a.lon) * k, alt: a.alt + (b.alt - a.alt) * k, baroAlt: a.baroAlt + (b.baroAlt - a.baroAlt) * k, spd: a.spd }
}

export default function MapViewPage() {
  const f = useLatest()
  const { track, frames } = useView()
  const [pathMode, setPathMode] = useState<'full' | 'recent' | 'none'>('full')
  const [mode, setMode] = useState<'live' | 'playback'>('live')
  const [day, setDay] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [playT, setPlayT] = useState<number | null>(null)

  const days = useMemo(() => Array.from(new Set(track.map((p) => dayKey(p.t)))), [track])
  const activeDay = day && days.includes(day) ? day : days[days.length - 1] ?? null
  const dayTrack = useMemo(() => (activeDay ? track.filter((p) => dayKey(p.t) === activeDay) : []), [track, activeDay])
  const dayFrames = useMemo(() => (activeDay ? frames.filter((fr) => dayKey(fr.t) === activeDay) : []), [frames, activeDay])
  const shownTrack = useMemo(() => {
    if (pathMode !== 'recent' || !dayTrack.length) return dayTrack
    const since = dayTrack[dayTrack.length - 1].t - 15 * 60_000
    return dayTrack.filter((p) => p.t >= since)
  }, [dayTrack, pathMode])

  const start = dayTrack[0]?.t ?? 0
  const end = dayTrack[dayTrack.length - 1]?.t ?? 0
  const summary = useMemo(() => tripSummary(dayTrack), [dayTrack])
  const playPoint = mode === 'playback' && playT !== null ? interpolate(dayTrack, playT) : null
  const livePoint = dayTrack[dayTrack.length - 1] ?? null
  const marker = playPoint ?? livePoint

  const raf = useRef(0)
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const step = (now: number) => {
      const dt = now - last
      last = now
      let stop = false
      setPlayT((t) => {
        const next = (t ?? start) + dt * speed
        if (next >= end) {
          stop = true
          return end
        }
        return next
      })
      if (stop) setPlaying(false)
      else raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, speed, start, end])

  const togglePlay = () => {
    if (!dayTrack.length) return
    if (mode !== 'playback' || playT === null || playT >= end) {
      setMode('playback')
      setPlayT(start)
    }
    setPlaying((p) => !p)
  }
  const stop = () => {
    setPlaying(false)
    setPlayT(null)
    setMode('live')
  }
  const sliderValue = mode === 'playback' && playT !== null && end > start ? ((playT - start) / (end - start)) * 1000 : 1000

  return (
    <>
      <PageHeader
        title="Map View"
        subtitle="Real-time location tracking and movement path"
        actions={
          <>
            <SelectWithIcon icon={Route} value={pathMode} onChange={(v) => setPathMode(v as typeof pathMode)} options={[['full', 'Track Path'], ['recent', 'Last 15 min'], ['none', 'Hide Path']]} />
            <SelectWithIcon icon={Calendar} value={activeDay ?? ''} onChange={setDay} options={days.length ? days.map((d) => [d, dateLong(new Date(d))]) : [['', dateLong(Date.now())]]} />
            <SelectWithIcon icon={RadioTower} primary value={mode} onChange={(v) => (v === 'live' ? stop() : (setMode('playback'), setPlayT(start)))} options={[['live', 'Live'], ['playback', 'Playback']]} />
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Panel className="relative min-h-[520px] overflow-hidden p-0">
          <TelemetryMap
            track={pathMode === 'none' ? [] : shownTrack}
            position={marker ? { lat: marker.lat, lon: marker.lon, t: marker.t } : f && f.gps.fix ? { lat: f.gps.lat, lon: f.gps.lon, t: f.t } : null}
            markerStyle="labelled"
            showPath={pathMode !== 'none'}
            timeLabels={pathMode !== 'none'}
            scale
            layersButton
            zoom={14}
            className="absolute inset-0"
          />
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel className="p-4">
            <Title icon={MapPin} iconClass="text-emerald-400">Location Information</Title>
            <dl className="mt-2">
              <KV label="Latitude" valueClass="text-teal-300">{marker ? latStr(marker.lat) : f?.gps.fix ? latStr(f.gps.lat) : '--'}</KV>
              <KV label="Longitude" valueClass="text-teal-300">{marker ? lonStr(marker.lon) : f?.gps.fix ? lonStr(f.gps.lon) : '--'}</KV>
              <KV label="GPS Altitude">{marker ? `${fmt(marker.alt)} m` : f?.gps.fix ? `${fmt(f.gps.alt)} m` : '--'}</KV>
              <KV label="Satellites">{f?.gps.sats ?? '--'}</KV>
              <KV label="Fix Type" valueClass={f?.gps.fix ? 'text-emerald-400' : 'text-amber-400'}>{fixLabel(f?.gps.fix)}</KV>
              <KV label="Accuracy">{f?.gps.fix ? `≈ ${fmt(f.gps.hdop * 2.5)} m` : '--'}</KV>
              <KV label={playPoint ? 'Playback Time' : 'Last Update'}>{marker ? clock12(marker.t) : '--'}</KV>
            </dl>
          </Panel>
          <Panel className="p-4">
            <Title icon={Route} iconClass="text-violet-400">Trip Summary <span className="font-normal text-slate-400">({activeDay === dayKey(Date.now()) ? 'Today' : activeDay ? dateLong(new Date(activeDay)) : 'Today'})</span></Title>
            <dl className="mt-2 [&_dd]:text-violet-300">
              <KV label="Distance Traveled">{summary ? `${summary.distanceKm.toFixed(2)} km` : '--'}</KV>
              <KV label="Max Altitude">{summary ? `${summary.maxAlt.toFixed(1)} m` : '--'}</KV>
              <KV label="Min Altitude">{summary ? `${summary.minAlt.toFixed(1)} m` : '--'}</KV>
              <KV label="Max Speed">{summary ? `${summary.maxSpeedMs.toFixed(1)} m/s` : '--'}</KV>
              <KV label="Moving Time">{summary ? duration(summary.movingSec) : '--'}</KV>
            </dl>
          </Panel>
          <Panel className="flex-1 p-4">
            <Title icon={Mountain} iconClass="text-teal-300">Altitude Profile</Title>
            <div className="mt-2"><TimeChart frames={dayFrames} series={PROFILE} unit="m" height={150} domain={[0, 160]} /></div>
          </Panel>
        </div>
      </div>

      <Panel className="mt-4 p-4">
        <Title icon={Play} iconClass="text-sky-400">Path Playback</Title>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button type="button" onClick={togglePlay} disabled={!dayTrack.length} className="btn-primary size-10 p-0" title={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4 fill-current" />}
          </button>
          <button type="button" onClick={stop} className="btn-ghost size-10 p-0" title="Stop">
            <Square className="size-3.5 fill-current" />
          </button>
          <select className="select w-20" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Playback speed">
            {[1, 5, 10, 30, 60, 120].map((s) => <option key={s} value={s}>{s}x</option>)}
          </select>
          <div className="min-w-[240px] flex-1">
            <div className="mb-1.5 flex justify-between text-xs text-slate-400 tabular-nums">
              <span>{start ? clock12(start) : '--'}</span>
              <span>{end ? clock12(end) : '--'}</span>
            </div>
            <input
              type="range"
              className="range w-full"
              min={0}
              max={1000}
              value={sliderValue}
              style={{ ['--pct' as string]: `${sliderValue / 10}%` }}
              onChange={(e) => {
                setMode('playback')
                setPlaying(false)
                setPlayT(start + (Number(e.target.value) / 1000) * (end - start))
              }}
              aria-label="Playback position"
            />
          </div>
          <div className="text-sm text-slate-300">Total Duration: <span className="font-semibold text-sky-400 tabular-nums">{summary ? duration(summary.durationSec) : '--'}</span></div>
          <button type="button" className="btn-ghost" disabled={!dayTrack.length} onClick={() => exportGpx(dayTrack)}>
            <Download className="size-4" /> Export Path
          </button>
        </div>
      </Panel>
    </>
  )
}

function Title({ icon: Icon, iconClass, children }: { icon: LucideIcon; iconClass: string; children: React.ReactNode }) {
  return <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-100"><Icon className={clsx('size-[18px]', iconClass)} />{children}</div>
}

function SelectWithIcon({ icon: Icon, value, options, onChange, primary }: { icon: LucideIcon; value: string; options: Array<[string, string]>; onChange: (v: string) => void; primary?: boolean }) {
  return (
    <label className={clsx('relative flex h-10 items-center rounded-lg border pl-3', primary ? 'border-sky-400/30 bg-gradient-to-b from-[#2f7fbf] to-[#1f6199] text-white' : 'border-white/10 bg-ink-800 text-slate-200')}>
      <Icon className="size-4 opacity-80" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-full cursor-pointer appearance-none bg-transparent pr-9 pl-2.5 text-sm outline-none [&>option]:bg-ink-800">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 size-4 opacity-70" />
    </label>
  )
}
