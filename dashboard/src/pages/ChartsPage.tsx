import { useState } from 'react'
import { PageHeader, Panel, Segmented } from '../components/ui/primitives'
import { TimeChart, type Series } from '../components/charts/TimeChart'
import { useView } from '../hooks'
import { windowFrames } from '../lib/format'
import type { Frame } from '../lib/types'

interface ChartDef {
  title: string
  sub?: string
  unit: string
  series: Series[]
  fill?: boolean
  digits?: number
}

const CHARTS: ChartDef[] = [
  { title: 'Altitude', sub: 'Barometric vs GPS', unit: 'm', fill: false, series: [
    { name: 'Barometric', color: '#3b82f6', get: (f: Frame) => f.baro.alt },
    { name: 'GPS', color: '#2dd4bf', get: (f: Frame) => (f.gps.fix ? f.gps.alt : null) },
  ] },
  { title: 'Vertical Speed', unit: 'm/s', digits: 2, series: [{ name: 'Vertical speed', color: '#60a5fa', get: (f) => f.baro.vs }] },
  { title: 'Temperature & Humidity', unit: '', fill: false, series: [
    { name: 'Temperature (°C)', color: '#f59e0b', get: (f) => f.env.t },
    { name: 'Humidity (%)', color: '#2dd4bf', get: (f) => f.env.h },
  ] },
  { title: 'Pressure', unit: 'hPa', digits: 2, series: [{ name: 'Pressure', color: '#3b82f6', get: (f) => f.env.p }] },
  { title: 'CO₂', sub: 'SCD40', unit: 'ppm', digits: 0, series: [{ name: 'CO₂', color: '#a78bfa', get: (f) => f.env.co2 }] },
  { title: 'Gas Indices', sub: 'SGP41', unit: '', fill: false, digits: 0, series: [
    { name: 'VOC', color: '#eab308', get: (f) => f.env.voc },
    { name: 'NOx', color: '#4ade80', get: (f) => f.env.nox },
  ] },
  { title: 'Light Intensity', sub: 'TSL25911', unit: 'lux', digits: 0, series: [{ name: 'Lux', color: '#eab308', get: (f) => f.env.lux }] },
  { title: 'Acceleration', unit: 'm/s²', fill: false, digits: 2, series: [
    { name: 'X', color: '#ef4444', get: (f) => f.imu.ax },
    { name: 'Y', color: '#22c55e', get: (f) => f.imu.ay },
    { name: 'Z', color: '#3b82f6', get: (f) => f.imu.az },
  ] },
  { title: 'Angular Velocity', unit: '°/s', fill: false, series: [
    { name: 'X', color: '#ef4444', get: (f) => f.imu.gx },
    { name: 'Y', color: '#22c55e', get: (f) => f.imu.gy },
    { name: 'Z', color: '#3b82f6', get: (f) => f.imu.gz },
  ] },
  { title: 'Attitude', unit: '°', fill: false, series: [
    { name: 'Roll', color: '#f87171', get: (f) => f.imu.roll },
    { name: 'Pitch', color: '#4ade80', get: (f) => f.imu.pitch },
    { name: 'Yaw', color: '#60a5fa', get: (f) => f.imu.yaw },
  ] },
  { title: 'Battery', unit: 'V', digits: 2, series: [{ name: 'Battery', color: '#4ade80', get: (f) => (f.sys.bat > 0.5 ? f.sys.bat : null) }] },
]

export default function ChartsPage() {
  const { frames } = useView()
  const [range, setRange] = useState(900)
  const shown = windowFrames(frames, range)

  return (
    <>
      <PageHeader
        title="Charts"
        subtitle="Historical trends for every telemetry channel in this session"
        actions={<Segmented value={range} onChange={setRange} options={[{ value: 300, label: '5 min' }, { value: 900, label: '15 min' }, { value: 3600, label: '1 h' }, { value: 0, label: 'All' }]} />}
      />
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {CHARTS.map((c) => (
          <Panel key={c.title} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-100">{c.title} {c.sub && <span className="text-xs font-normal text-slate-400">({c.sub})</span>}</div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                {c.series.length > 1
                  ? c.series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><i className="h-0.5 w-3.5 rounded" style={{ background: s.color }} />{s.name}</span>)
                  : <span className="text-slate-400">{c.unit}</span>}
              </div>
            </div>
            <div className="mt-2"><TimeChart frames={shown} series={c.series} fill={c.fill ?? true} unit={c.unit} digits={c.digits ?? 1} height={210} maxPoints={360} /></div>
          </Panel>
        ))}
      </div>
    </>
  )
}
