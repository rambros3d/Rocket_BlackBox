import { useState } from 'react'
import clsx from 'clsx'
import { Bell, Check, CircleCheck, Info, Trash2, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader, Panel, Segmented } from '../components/ui/primitives'
import { useTelemetry } from '../store/telemetry'
import { clock12, duration } from '../lib/format'
import type { AlertSeverity } from '../lib/types'

const SEVERITY: Record<AlertSeverity, { icon: LucideIcon; cls: string; label: string }> = {
  critical: { icon: TriangleAlert, cls: 'text-red-400 bg-red-500/10 ring-red-500/30', label: 'Critical' },
  warning: { icon: Bell, cls: 'text-amber-300 bg-amber-500/10 ring-amber-500/30', label: 'Warning' },
  info: { icon: Info, cls: 'text-sky-300 bg-sky-500/10 ring-sky-500/30', label: 'Info' },
}

export default function AlertsPage() {
  const alerts = useTelemetry((s) => s.alerts)
  const ack = useTelemetry((s) => s.ackAlert)
  const ackAll = useTelemetry((s) => s.ackAllAlerts)
  const clear = useTelemetry((s) => s.clearAlerts)
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all')

  const active = alerts.filter((a) => a.resolvedAt === null)
  const shown = filter === 'all' ? alerts : filter === 'active' ? active : alerts.filter((a) => a.resolvedAt !== null)
  const count = (sev: AlertSeverity) => active.filter((a) => a.severity === sev).length

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="Threshold and health events raised during this session"
        actions={
          <>
            <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'resolved', label: 'Resolved' }]} />
            <button type="button" className="btn-ghost" onClick={ackAll}><Check className="size-4" />Acknowledge All</button>
            <button type="button" className="btn-ghost" onClick={clear}><Trash2 className="size-4" />Clear Resolved</button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Summary icon={TriangleAlert} color="#f87171" value={count('critical')} label="Critical" />
        <Summary icon={Bell} color="#fbbf24" value={count('warning')} label="Warnings" />
        <Summary icon={Info} color="#60a5fa" value={count('info')} label="Info" />
        <Summary icon={CircleCheck} color="#4ade80" value={alerts.length - active.length} label="Resolved" />
      </div>

      <Panel className="mt-4 divide-y divide-white/[0.06]">
        {shown.length === 0 && <div className="px-5 py-14 text-center text-sm text-slate-400">No alerts to show.</div>}
        {shown.map((a) => {
          const sev = SEVERITY[a.severity]
          const Icon = sev.icon
          return (
            <div key={a.id} className={clsx('flex items-center gap-4 px-5 py-3.5', a.resolvedAt !== null && 'opacity-60')}>
              <span className={clsx('grid size-9 shrink-0 place-items-center rounded-lg ring-1', sev.cls)}><Icon className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-100">{a.title}</span>
                  <span className={clsx('chip ring-1', sev.cls)}>{sev.label}</span>
                  {a.resolvedAt !== null ? (
                    <span className="chip bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30">Resolved after {duration((a.resolvedAt - a.raisedAt) / 1000)}</span>
                  ) : (
                    <span className="chip bg-red-500/10 text-red-300 ring-1 ring-red-500/25">Active</span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-sm text-slate-400">{a.message}</div>
              </div>
              <div className="text-right text-xs text-slate-400 tabular-nums">{clock12(a.raisedAt)}</div>
              <button type="button" disabled={a.acknowledged} onClick={() => ack(a.id)} className="btn-ghost h-8 px-2.5 text-xs">
                {a.acknowledged ? 'Acknowledged' : 'Acknowledge'}
              </button>
            </div>
          )
        })}
      </Panel>
    </>
  )
}

function Summary({ icon: Icon, color, value, label }: { icon: LucideIcon; color: string; value: number; label: string }) {
  return (
    <Panel className="flex items-center gap-4 p-4">
      <span className="grid size-11 place-items-center rounded-xl" style={{ background: `${color}1f`, color }}><Icon className="size-5" /></span>
      <div>
        <div className="text-[24px] font-semibold text-white tabular-nums">{value}</div>
        <div className="text-sm text-slate-400">{label}</div>
      </div>
    </Panel>
  )
}
