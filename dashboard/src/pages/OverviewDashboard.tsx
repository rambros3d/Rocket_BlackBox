import clsx from 'clsx'
import type { ReactNode } from 'react'
import { AudioWaveform, Clock, Cloud, Cpu, Droplet, Factory, Gauge, Leaf, Package, Plane, RadioTower, Satellite, Signal, Sun, Thermometer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LayoutSwitch, Panel } from '../components/ui/primitives'
import { Sparkline } from '../components/charts/TimeChart'
import TelemetryMap from '../components/map/TelemetryMap'
import { AttitudePlane } from '../components/attitude/Attitude'
import ConnectionMenu from '../components/layout/ConnectionMenu'
import { useLatest, useLinkState, useNow, useView, TONE_TEXT } from '../hooks'
import { clock12, dateLong, fixLabel, fmt, int, latStr, lonStr, signed, srcLabel, windowFrames } from '../lib/format'
import { sensorsActive } from '../lib/derive'
import { useTelemetry } from '../store/telemetry'
import type { Frame } from '../lib/types'

const getT = (f: Frame) => f.env.t
const getH = (f: Frame) => f.env.h
const getP = (f: Frame) => f.env.p
const getCo2 = (f: Frame) => f.env.co2
const getVoc = (f: Frame) => f.env.voc
const getNox = (f: Frame) => f.env.nox
const getLux = (f: Frame) => f.env.lux

export default function OverviewDashboard() {
  const f = useLatest()
  const { frames, track } = useView()
  const now = useNow(250)
  const linkState = useLinkState()
  const stats = useTelemetry((s) => s.stats)
  const lastFrameAt = useTelemetry((s) => s.conn.lastFrameAt)
  const unresolved = useTelemetry((s) => s.alerts.filter((a) => a.resolvedAt === null).length)
  const sensors = sensorsActive(f)
  const recent = windowFrames(frames, 600)
  const ago = lastFrameAt ? (now - lastFrameAt) / 1000 : null
  const operational = linkState.tone === 'ok' && sensors.missing.length === 0
  const isUsb = f?.source === 'usb'

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-white">Environmental Telemetry Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">Real-time Monitoring &amp; Data Visualization</p>
        </div>
        <div className="flex items-center gap-3">
          <LayoutSwitch />
          <ConnectionMenu variant="overview" />
          <div className="flex h-12 items-center gap-3 rounded-lg border border-white/10 bg-ink-800/80 px-4">
            <Clock className="size-5 text-slate-300" />
            <div className="leading-tight tabular-nums">
              <div className="text-sm font-semibold text-slate-100">{clock12(now)}</div>
              <div className="text-xs text-slate-400">{dateLong(now)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 2xl:grid-cols-4">
        <StatusCard icon={RadioTower} iconClass="text-emerald-400" title="Connection Status" value={linkState.short} valueClass={TONE_TEXT[linkState.tone]}
          footLabel={isUsb ? 'USB' : 'LoRa'} foot={isUsb ? 'Direct serial link' : `${int(stats.packets)} received · ${int(stats.lost)} gaps`} />
        <StatusCard icon={Satellite} iconClass="text-emerald-400" title="GPS Status" value={fixLabel(f?.gps.fix)} valueClass={f?.gps.fix ? 'text-emerald-400' : 'text-amber-400'}
          footLabel="Satellites" foot={f?.gps.sats ?? '--'} />
        <StatusCard icon={Clock} iconClass="text-sky-400" title="Last Update" value={ago === null ? '--' : `${ago.toFixed(1)} s ago`} valueClass="text-sky-400 tabular-nums"
          footLabel="Data Rate" foot={stats.rateHz ? `${stats.rateHz.toFixed(1)} Hz` : '--'} />
        <StatusCard icon={Cpu} iconClass="text-violet-400" title="Device Status" value={!f ? '--' : operational ? 'Operational' : linkState.tone === 'ok' ? 'Degraded' : 'Offline'}
          valueClass={operational ? 'text-violet-400' : 'text-amber-400'} footLabel="System" foot={!f ? '--' : unresolved ? `${unresolved} active alert${unresolved > 1 ? 's' : ''}` : 'Normal'} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Panel className="grid overflow-hidden md:grid-cols-[minmax(0,1fr)_200px]">
          <div className="relative min-h-[330px]">
            <TelemetryMap track={track} position={f && f.gps.fix ? { lat: f.gps.lat, lon: f.gps.lon, t: f.t } : null} markerStyle="dot" locateButton className="absolute inset-0" zoom={13} />
            <div className="pointer-events-none absolute top-3 left-14 z-[500] flex items-center gap-2 rounded-md bg-ink-900/80 px-2.5 py-1 text-sm font-semibold text-slate-100 backdrop-blur">
              <i className="size-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153/0.8)]" /> Live Location
            </div>
          </div>
          <div className="border-l border-white/[0.07] bg-ink-900/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Satellite className="size-4 text-sky-400" />GPS Coordinates</div>
            <dl className="mt-3 space-y-3 text-sm">
              <Coord label="Latitude" value={f?.gps.fix ? latStr(f.gps.lat) : '--'} />
              <Coord label="Longitude" value={f?.gps.fix ? lonStr(f.gps.lon) : '--'} />
              <Coord label="GPS Altitude" value={f?.gps.fix ? `${fmt(f.gps.alt)} m` : '--'} />
              <Coord label="Speed" value={f?.gps.fix ? `${fmt(f.gps.spd)} km/h` : '--'} />
              <Coord label="Heading" value={f?.gps.fix ? `${fmt(f.gps.hdg)}°` : '--'} />
              <Coord label="Fix Type" value={fixLabel(f?.gps.fix)} className="text-emerald-400" />
            </dl>
          </div>
        </Panel>

        <Panel className="flex flex-col p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Plane className="size-4 text-sky-400" />Attitude <span className="font-normal text-slate-400">(BNO055)</span></div>
          <div className="relative min-h-[230px] flex-1">
            <AttitudePlane attitude={f ? f.imu : null} className="absolute inset-0" />
            <Reading label="Roll" value={f?.imu.roll} className="top-6 left-2 text-lime-400" />
            <Reading label="Pitch" value={f?.imu.pitch} className="top-6 right-2 text-right text-sky-400" />
            <Reading label="Yaw" value={f?.imu.yaw} className="bottom-4 left-2 text-amber-400" />
          </div>
          <div className="mt-2 grid grid-cols-2 divide-x divide-white/10 rounded-lg border border-white/10 bg-ink-900/50 text-sm">
            <Vector title="Acceleration (m/s²)" values={[f?.imu.ax, f?.imu.ay, f?.imu.az]} digits={2} />
            <Vector title="Angular Velocity (°/s)" values={[f?.imu.gx, f?.imu.gy, f?.imu.gz]} digits={1} />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-7">
        <SparkCard icon={Thermometer} iconClass="text-red-400" title="Temperature" value={fmt(f?.env.t)} unit="°C" color="#f87171" frames={recent} get={getT} src={srcLabel(f?.env.tSrc)} />
        <SparkCard icon={Droplet} iconClass="text-sky-400" title="Humidity" value={fmt(f?.env.h)} unit="%" color="#60a5fa" frames={recent} get={getH} src={srcLabel(f?.env.hSrc)} />
        <SparkCard icon={Gauge} iconClass="text-yellow-400" title="Pressure" value={fmt(f?.env.p)} unit="hPa" color="#facc15" frames={recent} get={getP} src={srcLabel(f?.env.pSrc)} />
        <SparkCard icon={Cloud} iconClass="text-emerald-400" title="CO₂" value={int(f?.env.co2)} unit="ppm" color="#4ade80" frames={recent} get={getCo2} src="SCD40" />
        <SparkCard icon={Leaf} iconClass="text-violet-400" title="VOC Index" value={int(f?.env.voc)} color="#c084fc" frames={recent} get={getVoc} src="SGP41" />
        <SparkCard icon={Factory} iconClass="text-orange-400" title="NOx Index" value={int(f?.env.nox)} color="#fb923c" frames={recent} get={getNox} src="SGP41" />
        <SparkCard icon={Sun} iconClass="text-yellow-400" title="Light" value={int(f?.env.lux)} unit="lux" extra={`IR: ${int(f?.env.ir)}`} color="#facc15" frames={recent} get={getLux} src="TSL25911FN" />
      </div>

      <Panel className="mt-4 grid grid-cols-1 divide-white/10 px-2 py-3 sm:grid-cols-3 sm:divide-x">
        <FooterItem icon={Signal} label={isUsb ? 'USB Link' : 'Packet Rate'} value={isUsb ? 'Direct serial' : stats.rateHz ? `${stats.rateHz.toFixed(1)} Hz` : '--'} />
        <FooterItem icon={Package} label="Packet Count" value={`${int(stats.packets)} received · ${int(stats.lost)} gaps`} />
        <FooterItem icon={AudioWaveform} label="Data Stream" value={linkState.tone === 'ok' ? 'Live' : linkState.short} valueClass={TONE_TEXT[linkState.tone]} />
      </Panel>
      <p className="mt-2 text-right text-[11px] text-slate-500">Vertical speed {signed(f?.baro.vs)} m/s · Barometric altitude {fmt(f?.baro.alt)} m</p>
    </>
  )
}

function StatusCard({ icon: Icon, iconClass, title, value, valueClass, footLabel, foot }: { icon: LucideIcon; iconClass: string; title: string; value: ReactNode; valueClass: string; footLabel: string; foot: ReactNode }) {
  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3.5">
        <Icon className={clsx('mt-0.5 size-9 shrink-0', iconClass)} strokeWidth={1.8} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-200">{title}</div>
          <div className={clsx('mt-1 truncate text-[19px] font-semibold', valueClass)}>{value}</div>
        </div>
      </div>
      <div className="mt-3 text-xs text-slate-400">{footLabel}</div>
      <div className="mt-0.5 truncate text-sm font-medium whitespace-pre text-slate-100 tabular-nums">{foot}</div>
    </Panel>
  )
}

function Coord({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={clsx('mt-0.5 font-semibold tabular-nums', className ?? 'text-slate-100')}>{value}</dd>
    </div>
  )
}

function Reading({ label, value, className }: { label: string; value?: number; className: string }) {
  return (
    <div className={clsx('pointer-events-none absolute', className)}>
      <div className="text-xs text-slate-300">{label}</div>
      <div className="text-[22px] font-semibold tabular-nums">{fmt(value)}°</div>
    </div>
  )
}

function Vector({ title, values, digits }: { title: string; values: Array<number | undefined>; digits: number }) {
  const axes = [['X', 'text-red-400'], ['Y', 'text-emerald-400'], ['Z', 'text-sky-400']]
  return (
    <div className="px-3 py-2.5">
      <div className="text-xs text-slate-400">{title}</div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
        {axes.map(([a, c], i) => (
          <span key={a}><span className={clsx('mr-1 font-semibold', c)}>{a}</span><span className="text-slate-100">{fmt(values[i], digits)}</span></span>
        ))}
      </div>
    </div>
  )
}

function SparkCard({ icon: Icon, iconClass, title, value, unit, extra, color, frames, get, src }: {
  icon: LucideIcon; iconClass: string; title: ReactNode; value: string; unit?: string; extra?: string; color: string; frames: Frame[]; get: (f: Frame) => number; src: string
}) {
  return (
    <Panel className="flex flex-col p-3.5">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-200"><Icon className={clsx('size-4', iconClass)} />{title}</div>
      <div className="mt-2 text-[24px] font-semibold tracking-tight text-white tabular-nums">
        {value}{unit && <span className="ml-1 text-sm font-medium text-slate-300">{unit}</span>}
      </div>
      {extra && <div className="text-sm text-slate-300 tabular-nums">{extra}</div>}
      <div className="mt-auto pt-2"><Sparkline frames={frames} get={get} color={color} height={extra ? 38 : 50} /></div>
      <div className="mt-1 text-[11px] text-slate-400">{src}</div>
    </Panel>
  )
}

function FooterItem({ icon: Icon, label, value, valueClass }: { icon: LucideIcon; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-1">
      <Icon className="size-5 text-sky-400" />
      <div className="min-w-0">
        <div className="text-xs text-slate-400">{label}</div>
        <div className={clsx('truncate text-sm font-medium whitespace-pre', valueClass ?? 'text-slate-100')}>{value}</div>
      </div>
    </div>
  )
}
