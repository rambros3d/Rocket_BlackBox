import type { ReactNode } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { PageHeader, Panel, PanelTitle, Toggle } from '../components/ui/primitives'
import { toast } from '../components/ui/Toast'
import { useSettings, type Thresholds } from '../store/settings'
import { useTelemetry } from '../store/telemetry'

export default function SettingsPage() {
  const s = useSettings()
  const resetSession = useTelemetry((t) => t.resetSession)

  const threshold = (key: keyof Thresholds, label: string, props: { min?: number; max?: number; step?: number } = {}) => (
    <Row label={label}>
      <input
        type="number"
        className="input w-28 text-right"
        value={s.thresholds[key]}
        {...props}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) s.updateThresholds({ [key]: v })
        }}
      />
    </Row>
  )

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Display, connection and alert preferences (saved in this browser)"
        actions={<button type="button" className="btn-ghost" onClick={() => { s.reset(); toast('Settings restored to defaults', 'success') }}><RotateCcw className="size-4" />Reset Defaults</button>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="p-4">
          <PanelTitle>Display</PanelTitle>
          <div className="mt-3 divide-y divide-white/[0.06]">
            <Row label="Dashboard layout">
              <select className="select w-36" value={s.layout} onChange={(e) => s.update({ layout: e.target.value as 'snapshot' | 'overview' })}>
                <option value="snapshot">Snapshot</option>
                <option value="overview">Overview</option>
              </select>
            </Row>
            <Row label="Auto refresh"><Toggle checked={s.autoRefresh} onChange={(v) => s.update({ autoRefresh: v })} label="Auto refresh" /></Row>
            <Row label="USB refresh interval" hint="LoRa packets update the dashboard as they arrive">
              <select className="select w-36" value={s.refreshSec} onChange={(e) => s.update({ refreshSec: Number(e.target.value) })}>
                {[1, 2, 5, 10].map((v) => <option key={v} value={v}>{v} sec</option>)}
              </select>
            </Row>
            <Row label="Map style">
              <select className="select w-36" value={s.mapLayer} onChange={(e) => s.update({ mapLayer: e.target.value as 'satellite' | 'dark' })}>
                <option value="satellite">Satellite</option>
                <option value="dark">Dark streets</option>
              </select>
            </Row>
            <Row label="History kept (min)">
              <input type="number" className="input w-28 text-right" min={5} max={720} step={5} value={s.historyMin} onChange={(e) => s.update({ historyMin: Math.max(5, Math.min(720, Number(e.target.value) || 5)) })} />
            </Row>
          </div>
        </Panel>

        <Panel className="p-4">
          <PanelTitle>Connection</PanelTitle>
          <div className="mt-3 divide-y divide-white/[0.06]">
            <Row label="Serial baud rate" hint="USB-TO-LoRa-HF default: 115200">
              <select className="select w-36" value={s.baud} onChange={(e) => s.update({ baud: Number(e.target.value) })}>
                {[9600, 57600, 115200].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Row>
            <Row label="Auto-connect LoRa receiver" hint="Automatically connect when a paired LoRa dongle is detected">
              <Toggle checked={s.autoConnectLora} onChange={(v) => s.update({ autoConnectLora: v })} label="Auto-connect LoRa receiver" />
            </Row>
            <Row label="Configure receiver on connect"><Toggle checked={s.autoConfigureDongle} onChange={(v) => s.update({ autoConfigureDongle: v })} label="Configure receiver on connect" /></Row>
            {threshold('linkTimeout', 'Link timeout (s)', { min: 2, max: 60 })}
          </div>
          <button type="button" className="btn-danger mt-4" onClick={() => { resetSession(); toast('Session data cleared', 'success') }}>
            <Trash2 className="size-4" />Clear Session Data
          </button>
        </Panel>

        <Panel className="p-4">
          <PanelTitle>Alert Thresholds</PanelTitle>
          <div className="mt-3 divide-y divide-white/[0.06]">
            {threshold('co2Warn', 'CO₂ warning (ppm)', { min: 400, max: 10000, step: 50 })}
            {threshold('co2Crit', 'CO₂ critical (ppm)', { min: 400, max: 40000, step: 50 })}
            {threshold('tempHigh', 'Temperature high (°C)', { step: 0.5 })}
            {threshold('tempLow', 'Temperature low (°C)', { step: 0.5 })}
            {threshold('humHigh', 'Humidity high (%)', { min: 0, max: 100 })}
            {threshold('batLow', 'Battery low (%)', { min: 0, max: 100 })}
          </div>
        </Panel>
      </div>
    </>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div className="text-sm text-slate-200">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
      {children}
    </div>
  )
}
