import { useId, useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Frame } from '../../lib/types'
import { downsample, hhmm } from '../../lib/format'

export interface Series {
  name: string
  color: string
  get: (f: Frame) => number | null
}

type Row = { t: number } & Record<string, number | null>

function toRows(frames: Frame[], series: Series[], maxPoints: number): Row[] {
  return downsample(frames, maxPoints).map((f) => {
    const row: Row = { t: f.t }
    series.forEach((s, i) => {
      const v = s.get(f)
      row[`s${i}`] = v === null || !Number.isFinite(v) ? null : v
    })
    return row
  })
}

const tooltipStyle = {
  background: 'rgba(6,21,31,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
}

interface ChartProps {
  frames: Frame[]
  series: Series[]
  height?: number
  /** Preferred axis range; widened automatically if data falls outside */
  domain?: [number, number]
  fill?: boolean
  unit?: string
  maxPoints?: number
  digits?: number
}

export function TimeChart({ frames, series, height = 150, domain, fill = true, unit = '', maxPoints = 240, digits = 1 }: ChartProps) {
  const id = useId().replace(/:/g, '')
  const rows = useMemo(() => toRows(frames, series, maxPoints), [frames, series, maxPoints])
  const yDomain = domain
    ? ([(min: number) => Math.min(domain[0], Math.floor(min)), (max: number) => Math.max(domain[1], Math.ceil(max))] as [(n: number) => number, (n: number) => number])
    : (['auto', 'auto'] as const)
  const common = {
    data: rows,
    margin: { top: 6, right: 8, left: -14, bottom: 0 },
  }
  const axes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={hhmm} tickCount={5} axisLine={false} tickLine={false} minTickGap={24} />
      <YAxis domain={yDomain} axisLine={false} tickLine={false} tickCount={5} width={46} allowDecimals={false} />
      <Tooltip
        contentStyle={tooltipStyle}
        labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()}
        formatter={(v, key) => {
          const s = series[Number(String(key).slice(1))]
          return [`${typeof v === 'number' ? v.toFixed(digits) : v} ${unit}`, s?.name ?? '']
        }}
        cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
      />
    </>
  )

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {fill ? (
          <AreaChart {...common}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={i} id={`${id}-g${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {axes}
            {series.map((s, i) => (
              <Area key={i} type="monotone" dataKey={`s${i}`} stroke={s.color} strokeWidth={1.6} fill={`url(#${id}-g${i})`} isAnimationActive={false} connectNulls dot={false} />
            ))}
          </AreaChart>
        ) : (
          <LineChart {...common}>
            {axes}
            {series.map((s, i) => (
              <Line key={i} type="monotone" dataKey={`s${i}`} stroke={s.color} strokeWidth={1.5} isAnimationActive={false} connectNulls dot={false} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

export function Sparkline({ frames, get, color, height = 48, maxPoints = 120 }: { frames: Frame[]; get: (f: Frame) => number; color: string; height?: number; maxPoints?: number }) {
  const id = useId().replace(/:/g, '')
  const rows = useMemo(() => downsample(frames, maxPoints).map((f) => ({ t: f.t, v: get(f) })), [frames, get, maxPoints])
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`${id}-sp`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} fill={`url(#${id}-sp)`} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
