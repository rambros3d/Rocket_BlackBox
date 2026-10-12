import { Calendar, Clock } from 'lucide-react'
import ConnectionMenu from './ConnectionMenu'
import { useNow } from '../../hooks'
import { clock12, dateLong } from '../../lib/format'

export default function Topbar({ showDate }: { showDate: boolean }) {
  const now = useNow(1000)
  return (
    <header className="flex h-[68px] shrink-0 items-center gap-4 border-b border-white/[0.06] bg-ink-900/70 px-6 backdrop-blur">
      <h2 className="truncate text-[17px] font-semibold tracking-tight text-slate-100">
        Environmental Telemetry &amp; Monitoring System
      </h2>
      <div className="ml-auto flex items-center gap-2 text-sm text-slate-200">
        <a
          href="../"
          target="_self"
          className="mr-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          title="Return to Rocket BlackBox Documentation"
        >
          📖 Docs
        </a>
        <ConnectionMenu />
        {showDate && (
          <span className="flex items-center gap-2 border-l border-white/10 pl-4">
            <Calendar className="size-4 text-slate-400" />
            {dateLong(now)}
          </span>
        )}
        <span className="flex items-center gap-2 border-l border-white/10 pl-4 tabular-nums">
          <Clock className="size-4 text-slate-400" />
          {clock12(now)}
        </span>
      </div>
    </header>
  )
}
