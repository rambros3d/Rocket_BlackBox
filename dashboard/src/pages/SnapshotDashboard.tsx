import clsx from 'clsx'
import { Clock, Cloud, Cpu, Droplet, Factory, Gauge, Leaf, MapPin, Mountain, RadioTower, RefreshCw, Sun, Thermometer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LayoutSwitch, PageHeader, Panel, PanelTitle } from '../components/ui/primitives'
import { TintCard } from '../components/ui/TintCard'
import TelemetryMap from '../components/map/TelemetryMap'
import { AttitudeCube } from '../components/attitude/Attitude'
import { useLatest, useLinkState, useView, TONE_TEXT } from '../hooks'
import { fixLabel, fmt, gpsLocalTime, int, latStr, lonStr, signed, srcLabel } from '../lib/format'
import { co2Status, humStatus, lightStatus, LEVEL_TEXT, noxStatus, pressureStatus, tempComfort, tempRange, vocStatus, type Status } from '../lib/status'
import { sensorsActive } from '../lib/derive'
import { useSettings } from '../store/settings'
import { useTelemetry } from '../store/telemetry'

export default function SnapshotDashboard() {
  const f = useLatest()
  const { track } = useView()
  const linkState = useLinkState()
  const refreshSec = useSettings((s) => s.refreshSec)
  const autoRefresh = useSettings((s) => s.autoRefresh)
  const commit = useTelemetry((s) => s.commitView)
  const stats = useTelemetry((s) => s.stats)
  const sensors = sensorsActive(f)
  const isUsb = f?.source === 'usb'

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Real-time overview of your environmental telemetry data" actions={<LayoutSwitch />} />

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 2xl:grid-cols-6">
        <TintCard color="#22c55e" icon={MapPin} label="GPS Status" value={fixLabel(f?.gps.fix)} sub={<>Satellites: {f?.gps.sats ?? '--'}</>} />
        <TintCard color="#3b82f6" icon={Mountain} label={<>Altitude <span className="text-xs text-sky-300">(Barometric)</span></>} value={<>{fmt(f?.baro.alt)} m</>} sub={<>Vertical Speed: <span className="whitespace-nowrap text-sky-300">{signed(f?.baro.vs)} m/s</span></>} />
        <TintCard color="#a78bfa" icon={Cloud} label={<>CO₂ Concentration</>} value={<>{int(f?.env.co2)} ppm</>} sub={co2Status(f?.env.co2).label} />
        <TintCard color="#f59e0b" icon={Thermometer} label="Temperature" accentLabel value={<>{fmt(f?.env.t)} °C</>} sub={tempComfort(f?.env.t).label} accentSub />
        <TintCard color="#14b8a6" icon={Droplet} label="Humidity" value={<>{fmt(f?.env.h)} %</>} sub={humStatus(f?.env.h).label} accentSub />
        <TintCard color="#ef4444" icon={RadioTower} label={isUsb ? 'USB Frames' : f ? 'LoRa Packets' : 'Packets Received'} accentLabel value={int(stats.packets)} sub={`${int(stats.lost)} sequence gaps`} accentSub />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
        <Panel className="flex flex-col p-4">
          <PanelTitle right={<span className="flex items-center gap-1.5 text-xs text-emerald-400"><i className="size-1.5 rounded-full bg-emerald-400" />Live</span>}>Live Location</PanelTitle>
          <div className="relative mt-3 min-h-[300px] flex-1 overflow-hidden rounded-lg">
            <TelemetryMap track={track} position={f && f.gps.fix ? { lat: f.gps.lat, lon: f.gps.lon, t: f.t } : null} markerStyle="pin" className="absolute inset-0" zoom={13} />
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-ink-900/85 px-4 py-2.5 text-xs backdrop-blur">
              <div><div className="text-slate-400">Latitude</div><div className="mt-0.5 font-semibold text-slate-100 tabular-nums">{f?.gps.fix ? latStr(f.gps.lat) : '--'}</div></div>
              <div><div className="text-slate-400">Longitude</div><div className="mt-0.5 font-semibold text-slate-100 tabular-nums">{f?.gps.fix ? lonStr(f.gps.lon) : '--'}</div></div>
              <div><div className="text-slate-400">GPS Altitude</div><div className="mt-0.5 font-semibold text-slate-100 tabular-nums">{f?.gps.fix ? `${fmt(f.gps.alt)} m` : '--'}</div></div>
            </div>
          </div>
        </Panel>

        <Panel className="p-4">
          <PanelTitle>System Status</PanelTitle>
          <div className="mt-3 space-y-2.5">
            <SysItem icon={RadioTower} color="#2dd4bf" name={isUsb ? 'USB Connection' : 'LoRa Connection'} state={linkState.connected ? (linkState.tone === 'ok' ? 'Connected' : linkState.short) : 'Disconnected'} stateClass={TONE_TEXT[linkState.tone]} />
            <SysItem icon={MapPin} color="#22c55e" name="GPS" state={fixLabel(f?.gps.fix)} stateClass={f?.gps.fix ? 'text-emerald-400' : 'text-amber-400'} />
            <SysItem icon={Cpu} color="#60a5fa" name="Sensors" state={sensors.label} stateClass={sensors.missing.length ? 'text-amber-400' : 'text-emerald-400'} title={sensors.missing.join(', ')} />
            <SysItem icon={Clock} color="#60a5fa" name="Time (GPS)" state={gpsLocalTime(f?.gps.utc)} stateClass="text-emerald-400 tabular-nums" />
          </div>
        </Panel>

        <Panel className="flex flex-col p-4">
          <PanelTitle>Orientation <span className="text-sm font-normal text-slate-400">(BNO055)</span></PanelTitle>
          <AttitudeCube attitude={f ? f.imu : null} className="mt-1 h-[230px] w-full flex-1" />
          <div className="mt-2 grid grid-cols-3 divide-x divide-white/10 rounded-lg border border-white/10 bg-ink-900/50 py-2.5 text-center">
            <Angle label="Roll" value={f?.imu.roll} className="text-red-400" />
            <Angle label="Pitch" value={f?.imu.pitch} className="text-emerald-400" />
            <Angle label="Yaw" value={f?.imu.yaw} className="text-sky-400" />
          </div>
        </Panel>
      </div>

      <Panel className="mt-4 p-4">
        <PanelTitle>Environmental Snapshot</PanelTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          <SnapCard icon={Gauge} iconClass="text-teal-300" title="Pressure" src={srcLabel(f?.env.pSrc)} value={fmt(f?.env.p)} unit="hPa" status={pressureStatus(f?.env.p)} />
          <SnapCard icon={Cloud} iconClass="text-sky-400" title="CO₂" src="SCD40" value={int(f?.env.co2)} unit="ppm" status={co2Status(f?.env.co2)} />
          <SnapCard icon={Leaf} iconClass="text-lime-400" title="VOC Index" src="SGP41" value={int(f?.env.voc)} status={vocStatus(f?.env.voc)} />
          <SnapCard icon={Factory} iconClass="text-emerald-400" title="NOx Index" src="SGP41" value={int(f?.env.nox)} status={noxStatus(f?.env.nox)} />
          <SnapCard icon={Thermometer} iconClass="text-orange-400" title="Temperature" src={srcLabel(f?.env.tSrc)} value={fmt(f?.env.t)} unit="°C" status={tempRange(f?.env.t)} />
          <SnapCard icon={Droplet} iconClass="text-teal-300" title="Humidity" src={srcLabel(f?.env.hSrc)} value={fmt(f?.env.h)} unit="%" status={humStatus(f?.env.h)} />
          <SnapCard icon={Sun} iconClass="text-yellow-400" title="Light" src="TSL25911" value={int(f?.env.lux)} unit="lux" status={lightStatus(f?.env.lux)} />
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-400">
          {autoRefresh ? (f?.source === 'lora' ? 'Dashboard updates with each LoRa packet' : `Dashboard will auto-refresh every ${refreshSec} second${refreshSec === 1 ? '' : 's'}`) : 'Auto-refresh paused'}
          <button type="button" onClick={commit} title="Refresh now" className="grid size-7 place-items-center rounded-md text-sky-300 transition hover:bg-white/[0.06]">
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </Panel>
    </>
  )
}

function SysItem({ icon: Icon, color, name, state, stateClass, title }: { icon: LucideIcon; color: string; name: string; state: string; stateClass: string; title?: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-white/[0.07] bg-ink-900/50 px-3.5 py-3" title={title}>
      <Icon className="size-6 shrink-0" style={{ color }} />
      <div className="min-w-0">
        <div className="text-[13px] text-slate-200">{name}</div>
        <div className={clsx('mt-0.5 truncate text-[13px] font-semibold', stateClass)}>{state}</div>
      </div>
    </div>
  )
}

function Angle({ label, value, className }: { label: string; value?: number; className: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={clsx('mt-0.5 text-[17px] font-semibold tabular-nums', className)}>{fmt(value)}°</div>
    </div>
  )
}

function SnapCard({ icon: Icon, iconClass, title, src, value, unit, status }: { icon: LucideIcon; iconClass: string; title: string; src: string; value: string; unit?: string; status: Status }) {
  return (
    <div className="rounded-lg border border-teal-400/15 bg-gradient-to-b from-teal-500/[0.09] to-teal-500/[0.03] p-3.5 text-center">
      <div className="flex items-center justify-center gap-1.5 text-[13px] text-slate-200">
        <Icon className={clsx('size-4 shrink-0', iconClass)} />
        <span className="truncate">{title}</span>
      </div>
      <div className="text-[11px] text-slate-400">({src})</div>
      <div className="mt-2 text-[24px] font-semibold tracking-tight text-white tabular-nums">
        {value}
        {unit && <span className="ml-1 text-base font-medium text-slate-300">{unit}</span>}
      </div>
      <div className={clsx('mt-1 text-[13px] font-medium', LEVEL_TEXT[status.level])}>{status.label}</div>
    </div>
  )
}
