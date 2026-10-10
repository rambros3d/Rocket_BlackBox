import clsx from 'clsx'
import type { ReactNode } from 'react'
import { LayoutGrid, Columns2 } from 'lucide-react'
import { useSettings } from '../../store/settings'

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx('panel', className)}>{children}</section>
}

export function PanelTitle({ icon, children, right, className }: { icon?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      {icon}
      <h3 className="panel-title">{children}</h3>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none',
        checked ? 'bg-emerald-500' : 'bg-white/15',
      )}
    >
      <span className={clsx('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition', checked && 'translate-x-5')} />
    </button>
  )
}

export function LayoutSwitch() {
  const layout = useSettings((s) => s.layout)
  const update = useSettings((s) => s.update)
  const btn = (value: 'snapshot' | 'overview', Icon: typeof LayoutGrid, title: string) => (
    <button
      type="button"
      title={title}
      aria-pressed={layout === value}
      onClick={() => update({ layout: value })}
      className={clsx('grid size-8 place-items-center rounded-md transition', layout === value ? 'bg-accent-soft text-white' : 'text-slate-400 hover:text-slate-200')}
    >
      <Icon className="size-4" />
    </button>
  )
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-ink-800/80 p-0.5" role="group" aria-label="Dashboard layout">
      {btn('snapshot', LayoutGrid, 'Snapshot layout')}
      {btn('overview', Columns2, 'Overview layout')}
    </div>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-ink-800/80 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx('h-8 rounded-md px-3 text-sm font-medium transition', value === o.value ? 'bg-accent-soft text-white' : 'text-slate-400 hover:text-slate-200')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function KV({ label, children, valueClass }: { label: string; children: ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[7px] text-sm">
      <dt className="text-slate-400">{label}</dt>
      <dd className={clsx('text-right font-medium tabular-nums', valueClass ?? 'text-slate-100')}>{children}</dd>
    </div>
  )
}
