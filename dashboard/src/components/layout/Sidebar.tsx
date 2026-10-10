import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { Activity, Bell, ChartColumn, Cpu, Download, House, Map, Settings } from 'lucide-react'
import { useTelemetry } from '../../store/telemetry'
import { useLinkState, TONE_DOT } from '../../hooks'
import { duration } from '../../lib/format'

const NAV = [
  { to: '/', label: 'Dashboard', icon: House, end: true },
  { to: '/live', label: 'Live Data', icon: Activity },
  { to: '/map', label: 'Map View', icon: Map },
  { to: '/charts', label: 'Charts', icon: ChartColumn },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/devices', label: 'Devices', icon: Cpu },
  { to: '/export', label: 'Export Data', icon: Download },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const latest = useTelemetry((s) => s.live.latest)
  const payloadFw = useTelemetry((s) => s.payloadInfo?.fw as string | undefined)
  const unacked = useTelemetry((s) => s.alerts.filter((a) => !a.acknowledged && a.resolvedAt === null).length)
  const linkState = useLinkState()
  const online = linkState.tone === 'ok'

  return (
    <aside className="relative hidden w-[248px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/95 lg:flex">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(120%_80%_at_20%_0%,rgb(13_42_60/0.9),transparent)]" />

      <NavLink to="/" className="relative flex items-center gap-3 px-5 pt-6 pb-7">
        <img src="./brand/logo-mark-white.png" alt="" className="h-11 w-auto drop-shadow-[0_2px_8px_rgb(59_143_208/0.35)]" />
        <div className="min-w-0">
          <img src="./brand/logo-wordmark-white.png" alt="Antariksha India" className="h-[22px] w-auto" />
          <div className="mt-1 text-[12px] font-medium tracking-wide text-silver/70">Telemetry System</div>
        </div>
      </NavLink>

      <nav className="relative flex flex-col gap-1 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition',
                isActive
                  ? 'bg-gradient-to-r from-accent-soft to-ink-700/60 text-white shadow-[inset_0_0_0_1px_rgb(200_206_210/0.12)]'
                  : 'text-slate-300 hover:bg-white/[0.04] hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={clsx('size-[18px]', isActive ? 'text-sky-300' : 'text-slate-400 group-hover:text-slate-200')} />
                <span className="flex-1">{label}</span>
                {to === '/alerts' && unacked > 0 && (
                  <span className="rounded-full bg-red-500/90 px-1.5 text-[11px] font-semibold text-white">{unacked}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="relative mt-auto px-3 pb-3">
        <div className="panel space-y-3 bg-ink-850/70 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs text-slate-400">Device ID</div>
              <div className="mt-0.5 text-[17px] font-semibold tracking-wide text-sky-400">{latest?.dev ?? '—'}</div>
            </div>
            <span className={clsx('chip mt-4 px-0 text-xs', online ? 'text-emerald-400' : 'text-slate-500')}>
              <i className={clsx('size-1.5 rounded-full', online ? TONE_DOT.ok : 'bg-slate-500')} />
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          <div>
            <div className="text-xs text-slate-400">Firmware Version</div>
            <div className="mt-0.5 text-sm text-slate-100">{latest?.fw ?? payloadFw ?? (latest ? 'v2 (LoRa)' : '—')}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Uptime</div>
            <div className="mt-0.5 font-mono text-[15px] text-slate-100">{duration(latest?.up)}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 border-t border-white/[0.06] px-2 pt-4 pb-1">
          <div className="grid size-9 place-items-center rounded-lg bg-brand ring-1 ring-silver/15">
            <img src="./brand/logo-mark-white.png" alt="" className="h-6 w-auto" />
          </div>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold text-sky-200">Rocket BlackBox</div>
            <div className="text-[11px] tracking-wide text-slate-400">Acknowledge the knowledge</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
