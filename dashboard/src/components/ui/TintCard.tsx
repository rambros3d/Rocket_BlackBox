import clsx from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function TintCard({ color, icon: Icon, label, value, sub, accentLabel, accentSub }: {
  color: string
  icon: LucideIcon
  label: ReactNode
  value: ReactNode
  sub: ReactNode
  accentLabel?: boolean
  accentSub?: boolean
}) {
  const style: CSSProperties = {
    background: `linear-gradient(160deg, ${color}2e 0%, ${color}12 55%, ${color}08 100%)`,
    borderColor: `${color}55`,
  }
  return (
    <div className="flex gap-3 rounded-xl border p-4 shadow-[0_10px_30px_-14px_rgb(0_0_0/0.7)]" style={style}>
      <Icon className="mt-0.5 size-6 shrink-0" style={{ color }} strokeWidth={2} />
      <div className="min-w-0">
        <div className={clsx('truncate text-[13px] font-medium', !accentLabel && 'text-slate-200')} style={accentLabel ? { color } : undefined}>{label}</div>
        <div className="mt-1.5 text-[26px] leading-none font-semibold tracking-tight text-white tabular-nums">{value}</div>
        <div className={clsx('mt-2 text-[13px] leading-snug', !accentSub && 'text-slate-300')} style={accentSub ? { color } : undefined}>{sub}</div>
      </div>
    </div>
  )
}
