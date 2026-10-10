import clsx from 'clsx'
import type { ReactNode } from 'react'
import { ChartColumn, Cloud, Droplet, MapPin, Mountain, RadioTower, Thermometer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader, Panel, Toggle } from '../components/ui/primitives'
import { Sparkline, TimeChart, type Series } from '../components/charts/TimeChart'
import { useLatest, useView } from '../hooks'
import { fmt, int, latStr, lonStr, signed, srcLabel, windowFrames } from '../lib/format'
import { co2Status, humStatus, LEVEL_TEXT, tempComfort } from '../lib/status'
import { useSettings } from '../store/settings'
import { useTelemetry } from '../store/telemetry'
import type { Frame } from '../lib/types'

const S = {
  temp: [{ name: 'Temperature', color: '#f59e0b', get: (f: Frame) => f.env.t }],
  hum: [{ name: 'Humidity', color: '#2dd4bf', get: (f: Frame) => f.env.h }],
  pres: [{ name: 'Pressure', color: '#3b82f6', get: (f: Frame) => f.env.p }],
  co2: [{ name: 'CO₂', color: '#a78bfa', get: (f: Frame) => f.env.co2 }],
  voc: [{ name: 'VOC', color: '#eab308', get: (f: Frame) => f.env.voc }],
  nox: [{ name: 'NOx', color: '#4ade80', get: (f: Frame) => f.env.nox }],
  alt: [{ name: 'Altitude', color: '#3b82f6', get: (f: Frame) => f.baro.alt }],
  lux: [{ name: 'Light', color: '#eab308', get: (f: Frame) => f.env.lux }],
  acc: [
    { name: 'Acc X', color: '#ef4444', get: (f: Frame) => f.imu.ax },
    { name: 'Acc Y', color: '#22c55e', get: (f: Frame) => f.imu.ay },
    { name: 'Acc Z', color: '#3b82f6', get: (f: Frame) => f.imu.az },
  ],
} satisfies Record<string, Series[]>

const getAlt = (f: Frame) => f.baro.alt

export default function LiveDataPage() {
  const f = useLatest()
  const stats = useTelemetry((s) => s.stats)
  const { frames } = useView()
  const autoRefresh = useSettings((s) => s.autoRefresh)
  const refreshSec = useSettings((s) => s.refreshSec)
  const update = useSettings((s) => s.update)
  const recent = windowFrames(frames, 900)
  const isUsb = f?.source === 'usb'
  const co2 = co2Status(f?.env.co2)
  const comfort = tempComfort(f?.env.t)
  const hum = humStatus(f?.env.h)

  return (
    <>
      <PageHeader
        title="Live Data"
        subtitle="Real-time sensor data streaming from the device"
        actions={
          <>
            <span className="text-sm text-slate-300">Auto Refresh</span>
            <Toggle checked={autoRefresh} onChange={(v) => update({ autoRefresh: v })} label="Auto refresh" />
            {f?.source === 'lora' ? <span className="ml-2 text-xs text-slate-400">Live LoRa packets</span> : (
              <select className="select ml-2 w-28" value={refreshSec} onChange={(e) => update({ refreshSec: Number(e.target.value) })} aria-label="Refresh interval">
                {[1, 2, 5, 10].map((s) => <option key={s} value={s}>{s} sec</option>)}
              </select>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 2xl:grid-cols-6">
        <TopCard icon={MapPin} iconClass="text-emerald-400" title="GPS Position">
          <Line label="Latitude" value={f?.gps.fix ? latStr(f.gps.lat) : '--'} valueClass="text-emerald-400" />
          <Line label="Longitude" value={f?.gps.fix ? lonStr(f.gps.lon) : '--'} valueClass="text-emerald-400" />
          <div className="mt-2 flex gap-3 text-sm"><span className="text-slate-400">Satellites</span><span className="font-semibold text-teal-300">{f?.gps.sats ?? '--'}</span></div>
        </TopCard>
        <TopCard icon={Mountain} iconClass="text-sky-400" title={<>Altitude <span className="text-xs font-normal text-slate-400">(Barometric)</span></>}>
          <div className="text-xs text-slate-400">Altitude</div>
          <div className="text-[22px] font-semibold text-sky-400 tabular-nums">{fmt(f?.baro.alt)} m</div>
          <Sparkline frames={recent} get={getAlt} color="#3b82f6" height={34} />
          <div className="mt-1 flex gap-2 text-xs"><span className="text-slate-400">Vertical Speed</span><span className="text-sky-300 tabular-nums">{signed(f?.baro.vs)} m/s</span></div>
        </TopCard>
        <TopCard icon={Cloud} iconClass="text-violet-400" title="CO₂ Concentration">
          <Big className="text-violet-400">{int(f?.env.co2)} ppm</Big>
          <Status label="Status" value={co2.label} className={LEVEL_TEXT[co2.level]} />
        </TopCard>
        <TopCard icon={Thermometer} iconClass="text-orange-400" title="Temperature">
          <Big className="text-orange-400">{fmt(f?.env.t)} °C</Big>
          <Status label="Status" value={comfort.label} className="text-orange-300" />
        </TopCard>
        <TopCard icon={Droplet} iconClass="text-teal-300" title="Humidity">
          <Big className="text-teal-300">{fmt(f?.env.h)} %</Big>
          <Status label="Status" value={hum.label} className={LEVEL_TEXT[hum.level]} />
        </TopCard>
        <TopCard icon={RadioTower} iconClass="text-red-400" title={isUsb ? 'USB Frames' : f ? 'LoRa Packets' : 'Packets Received'}>
          <Big className="text-red-400">{int(stats.packets)}</Big>
          <Status label="Sequence gaps" value={int(stats.lost)} className="text-red-400" />
        </TopCard>
      </div>

      <h2 className="mt-6 mb-3 text-[17px] font-semibold text-slate-100">Sensor Data</h2>
      <div className="grid gap-3.5 md:grid-cols-2 2xl:grid-cols-4">
        <ChartCard title="Temperature" src={srcLabel(f?.env.tSrc)} unit="°C" value={`${fmt(f?.env.t)} °C`} valueClass="text-orange-400" frames={recent} series={S.temp} domain={[0, 40]} />
        <ChartCard title="Humidity" src={srcLabel(f?.env.hSrc)} unit="%" value={`${fmt(f?.env.h)} %`} valueClass="text-teal-300" frames={recent} series={S.hum} domain={[0, 100]} />
        <ChartCard title="Pressure" src={srcLabel(f?.env.pSrc)} unit="hPa" value={`${fmt(f?.env.p)} hPa`} valueClass="text-sky-400" frames={recent} series={S.pres} domain={[960, 1040]} />
        <ChartCard title="CO₂" src="SCD40" unit="ppm" value={`${int(f?.env.co2)} ppm`} valueClass="text-violet-400" frames={recent} series={S.co2} domain={[0, 1200]} digits={0} />
        <ChartCard title="VOC Index" src="SGP41" unit="Index" value={int(f?.env.voc)} valueClass="text-yellow-400" frames={recent} series={S.voc} domain={[0, 200]} digits={0} />
        <ChartCard title="NOx Index" src="SGP41" unit="Index" value={int(f?.env.nox)} valueClass="text-emerald-400" frames={recent} series={S.nox} domain={[0, 200]} digits={0} />
        <ChartCard title="Altitude" src="MS5607" unit="m" value={`${fmt(f?.baro.alt)} m`} valueClass="text-sky-400" frames={recent} series={S.alt} domain={[0, 200]} />
        <ChartCard title="Light Intensity" src="TSL25911" unit="lux" value={`${int(f?.env.lux)} lux`} valueClass="text-yellow-400" frames={recent} series={S.lux} domain={[0, 6000]} digits={0} />
      </div>

      <Panel className="mt-4 grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <h3 className="panel-title">IMU (BNO055) – Acceleration <span className="font-normal text-slate-400">(m/s²)</span></h3>
            <div className="flex gap-4 text-xs text-slate-300">
              {S.acc.map((s) => <span key={s.name} className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded" style={{ background: s.color }} />{s.name}</span>)}
            </div>
          </div>
          <div className="mt-2"><TimeChart frames={recent} series={S.acc} fill={false} height={230} domain={[-12, 12]} unit="m/s²" digits={2} maxPoints={400} /></div>
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-ink-900/50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><ChartColumn className="size-4 text-sky-400" />Current Values</div>
          <dl className="mt-3 space-y-2 text-sm tabular-nums">
            <Row label="Acc X" labelClass="text-red-400" value={`${fmt(f?.imu.ax, 2)} m/s²`} />
            <Row label="Acc Y" labelClass="text-emerald-400" value={`${fmt(f?.imu.ay, 2)} m/s²`} />
            <Row label="Acc Z" labelClass="text-sky-400" value={`${fmt(f?.imu.az, 2)} m/s²`} />
            <div className="my-2 h-px bg-white/[0.07]" />
            <Row label="Gyro X" value={`${fmt(f?.imu.gx, 2)} °/s`} />
            <Row label="Gyro Y" value={`${fmt(f?.imu.gy, 2)} °/s`} />
            <Row label="Gyro Z" value={`${fmt(f?.imu.gz, 2)} °/s`} />
          </dl>
        </div>
      </Panel>
    </>
  )
}

function TopCard({ icon: Icon, iconClass, title, children }: { icon: LucideIcon; iconClass: string; title: ReactNode; children: ReactNode }) {
  return (
    <Panel className="flex flex-col p-4">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-slate-200"><Icon className={clsx('size-5', iconClass)} />{title}</div>
      {children}
    </Panel>
  )
}
const Big = ({ className, children }: { className: string; children: ReactNode }) => (
  <div className={clsx('mt-1 text-[24px] font-semibold tracking-tight tabular-nums', className)}>{children}</div>
)
const Status = ({ label, value, className }: { label: string; value: string; className: string }) => (
  <div className="mt-auto pt-3">
    <div className="text-xs text-slate-400">{label}</div>
    <div className={clsx('text-[17px] font-semibold', className)}>{value}</div>
  </div>
)
const Line = ({ label, value, valueClass }: { label: string; value: string; valueClass: string }) => (
  <div className="mb-1.5">
    <div className="text-xs text-slate-400">{label}</div>
    <div className={clsx('text-[15px] font-semibold tabular-nums', valueClass)}>{value}</div>
  </div>
)
const Row = ({ label, value, labelClass }: { label: string; value: string; labelClass?: string }) => (
  <div className="flex justify-between"><dt className={labelClass ?? 'text-slate-300'}>{label}</dt><dd className="text-slate-100">{value}</dd></div>
)

function ChartCard({ title, src, unit, value, valueClass, frames, series, domain, digits = 1 }: {
  title: string; src: string; unit: string; value: string; valueClass: string; frames: Frame[]; series: Series[]; domain: [number, number]; digits?: number
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-200">{title} <span className="text-xs text-slate-400">({src})</span></span>
        <span className="text-xs text-slate-400">{unit}</span>
      </div>
      <div className={clsx('mt-1 text-[20px] font-semibold tabular-nums', valueClass)}>{value}</div>
      <div className="mt-1"><TimeChart frames={frames} series={series} domain={domain} unit={unit} digits={digits} height={140} /></div>
    </Panel>
  )
}
