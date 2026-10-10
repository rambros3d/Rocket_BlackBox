import { Database, Download, FileText, Map, Route } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { KV, PageHeader, Panel, PanelTitle } from '../components/ui/primitives'
import { toast } from '../components/ui/Toast'
import { useTelemetry } from '../store/telemetry'
import { CSV_COLUMNS, exportCsv, exportGpx, exportJson, exportKml } from '../lib/export'
import { clock12, dateLong, duration, int, tripSummary } from '../lib/format'

export default function ExportPage() {
  const frames = useTelemetry((s) => s.live.frames)
  const track = useTelemetry((s) => s.live.track)
  const stats = useTelemetry((s) => s.stats)
  const summary = tripSummary(track)
  const first = frames[0]
  const last = frames[frames.length - 1]
  const preview = frames.slice(-10).reverse()
  const cols = CSV_COLUMNS.filter(([k]) => ['time_iso', 'seq', 'lat', 'lon', 'baro_alt_m', 'temp_c', 'humidity_pct', 'pressure_hpa', 'co2_ppm', 'voc_index', 'nox_index', 'lux'].includes(k))

  const guard = (fn: () => void, needsTrack = false) => () => {
    if (needsTrack ? track.length < 2 : frames.length === 0) {
      toast(needsTrack ? 'No GPS track recorded yet' : 'No telemetry recorded yet', 'error')
      return
    }
    fn()
  }

  return (
    <>
      <PageHeader title="Export Data" subtitle="Download the recorded session for offline analysis" />
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <ExportCard icon={FileText} color="#4ade80" title="Telemetry CSV" text={`${CSV_COLUMNS.length} columns per frame, spreadsheet ready.`} onClick={guard(() => exportCsv(frames))} label="Download CSV" />
        <ExportCard icon={Database} color="#60a5fa" title="Raw JSON" text="Decoded frames exactly as held by the dashboard." onClick={guard(() => exportJson(frames))} label="Download JSON" />
        <ExportCard icon={Route} color="#a78bfa" title="GPS Track (GPX)" text="Flight path for QGIS, GPS tools and mapping apps." onClick={guard(() => exportGpx(track), true)} label="Download GPX" />
        <ExportCard icon={Map} color="#fb923c" title="GPS Track (KML)" text="3D path with barometric altitude for Google Earth." onClick={guard(() => exportKml(track), true)} label="Download KML" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel className="p-4">
          <PanelTitle>Session Summary</PanelTitle>
          <dl className="mt-2">
            <KV label="Frames held">{int(frames.length)}</KV>
            <KV label="Packets received">{int(stats.packets)}</KV>
            <KV label="Packets lost">{int(stats.lost)}</KV>
            <KV label="GPS track points">{int(track.length)}</KV>
            <KV label="Start">{first ? `${dateLong(first.t)} ${clock12(first.t)}` : '--'}</KV>
            <KV label="End">{last ? clock12(last.t) : '--'}</KV>
            <KV label="Duration">{first && last ? duration((last.t - first.t) / 1000) : '--'}</KV>
            <KV label="Distance">{summary ? `${summary.distanceKm.toFixed(2)} km` : '--'}</KV>
            <KV label="Altitude range">{summary ? `${summary.minAlt.toFixed(1)} – ${summary.maxAlt.toFixed(1)} m` : '--'}</KV>
          </dl>
        </Panel>
        <Panel className="min-w-0 overflow-hidden">
          <div className="px-4 pt-4"><PanelTitle>Latest Frames</PanelTitle></div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-white/[0.03] text-slate-400">
                <tr>{cols.map(([k]) => <th key={k} className="px-3 py-2 font-medium">{k}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] font-mono text-slate-300">
                {preview.map((f) => (
                  <tr key={`${f.t}-${f.seq}`}>
                    {cols.map(([k, get]) => {
                      const v = get(f)
                      return <td key={k} className="px-3 py-1.5">{k === 'time_iso' ? clock12(f.t) : typeof v === 'number' ? +v.toFixed(2) : v ?? '—'}</td>
                    })}
                  </tr>
                ))}
                {preview.length === 0 && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={cols.length}>No frames yet</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  )
}

function ExportCard({ icon: Icon, color, title, text, onClick, label }: { icon: LucideIcon; color: string; title: string; text: string; onClick: () => void; label: string }) {
  return (
    <Panel className="flex flex-col p-5">
      <span className="grid size-11 place-items-center rounded-xl" style={{ background: `${color}1f`, color }}><Icon className="size-5" /></span>
      <h3 className="mt-4 font-semibold text-slate-100">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-slate-400">{text}</p>
      <button type="button" className="btn-primary mt-4 self-start" onClick={onClick}><Download className="size-4" />{label}</button>
    </Panel>
  )
}
