import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { ArrowLeftRight, Compass, Cpu, HardDrive, Laptop, RadioTower, Send, Settings2, SquareTerminal, Unplug, Usb } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { KV, PageHeader, Panel, PanelTitle } from '../components/ui/primitives'
import { connectWithToast, disconnectAll } from '../components/layout/ConnectionMenu'
import { toast } from '../components/ui/Toast'
import { link, serialSupported } from '../lib/link'
import { Command, COMMAND_LABEL } from '../lib/protocol'
import { FLAG } from '../lib/types'
import { duration, fmt, int } from '../lib/format'
import { useLinkState, TONE_DOT, TONE_TEXT } from '../hooks'
import { useSettings } from '../store/settings'
import { useTelemetry } from '../store/telemetry'

const SUBSYSTEMS = [
  { flag: FLAG.MS5607, name: 'Flight altimeter', part: 'MS5607-02BA03', bus: 'I2C1 · 0x77', fn: 'Pressure, barometric altitude' },
  { flag: FLAG.BME680, name: 'Environmental', part: 'Bosch BME680', bus: 'I2C1 · 0x76', fn: 'Temperature, humidity, pressure' },
  { flag: FLAG.SCD40, name: 'CO₂ sensor', part: 'Sensirion SCD40', bus: 'I2C1 · 0x62', fn: 'NDIR CO₂, temperature, RH' },
  { flag: FLAG.SGP41, name: 'Gas sensor', part: 'Sensirion SGP41', bus: 'I2C1 · 0x59', fn: 'VOC / NOx index' },
  { flag: FLAG.TSL2591, name: 'Light sensor', part: 'TSL25911FN', bus: 'I2C1 · 0x29', fn: 'Lux, IR channel' },
  { flag: FLAG.LTR390, name: 'UV / ambient', part: 'LTR-390UV-01', bus: 'I2C1 · 0x53', fn: 'Backup lux, UV index' },
  { flag: FLAG.BNO055, name: '9-DOF IMU', part: 'Bosch BNO055', bus: 'I2C2 · 0x28', fn: 'Attitude, acceleration, gyro' },
  { flag: FLAG.GPS_UART, name: 'GNSS receiver', part: 'Beitian BE-166', bus: 'UART1 · 115200', fn: 'Position, velocity, UTC, 1PPS' },
  { flag: FLAG.FLASH, name: 'Flight log flash', part: '12 MB FFat', bus: 'SPI flash', fn: 'CSV flight log, USB MSC' },
  { flag: FLAG.SDCARD, name: 'MicroSD', part: 'SDMMC 4-bit', bus: 'SDMMC', fn: 'High-rate storage' },
]

const BW = ['125 kHz', '250 kHz', '500 kHz']

export default function DevicesPage() {
  const latest = useTelemetry((s) => s.live.latest)
  const stats = useTelemetry((s) => s.stats)
  const conn = useTelemetry((s) => s.conn)
  const command = useTelemetry((s) => s.command)
  const payloadInfo = useTelemetry((s) => s.payloadInfo)
  const dongle = useSettings((s) => s.dongle)
  const updateDongle = useSettings((s) => s.updateDongle)
  const autoConfigure = useSettings((s) => s.autoConfigureDongle)
  const autoConnect = useSettings((s) => s.autoConnectLora)
  const updateSettings = useSettings((s) => s.update)
  const linkState = useLinkState()
  const [busy, setBusy] = useState(false)

  const isLora = conn.mode === 'lora'
  const logging = !!latest && (latest.flags & FLAG.LOGGING) !== 0
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    try {
      await fn()
      if (ok) toast(ok, 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const buildFlags = `-DLORA_CHANNEL=${dongle.channel} -DLORA_SPREADING_FACTOR=${dongle.sf} -DLORA_BANDWIDTH_KHZ=${[125, 250, 500][dongle.bw]}.0f -DLORA_CODING_RATE=${dongle.cr + 4} -DLORA_TX_POWER_DBM=${dongle.power}`

  return (
    <>
      <PageHeader
        title="Devices"
        subtitle="Ground receiver, payload link and on-board subsystems"
        actions={
          <>
            <button type="button" className="btn-primary" disabled={!serialSupported} onClick={() => void connectWithToast('lora')}><RadioTower className="size-4" />Connect LoRa Receiver</button>
            <button type="button" className="btn-ghost" disabled={!serialSupported} onClick={() => void connectWithToast('usb')}><Usb className="size-4" />Payload USB</button>
            <button type="button" className="btn-ghost" disabled={!linkState.connected} onClick={() => void disconnectAll()}><Unplug className="size-4" />Disconnect</button>
          </>
        }
      />
      {!serialSupported && (
        <p className="mb-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Web Serial is unavailable in this browser. Open the dashboard in Chrome or Edge (desktop) via <code>http://localhost</code> or HTTPS to talk to the receiver.
        </p>
      )}

      <Panel className="p-5">
        <div className="grid w-full min-w-0 grid-cols-1 items-center gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] xl:gap-4">
          <Node icon={Cpu} title="Rocket BlackBox" sub="RAK3112 · SX1262 · flight firmware v2" active={!!latest} />
          <Hop label={isLora ? `LoRa ${850 + dongle.channel} MHz · SF${dongle.sf}` : 'LoRa 866 MHz'} active={isLora && linkState.tone === 'ok'} />
          <Node icon={RadioTower} title="USB-TO-LoRa-HF" sub="Waveshare SX1262 (custom KISS firmware)" active={isLora} />
          <Hop label="USB serial 115200" active={conn.status === 'connected'} />
          <Node icon={Laptop} title="This dashboard" sub={conn.label || 'Not connected'} active={linkState.connected} />
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel className="p-4 xl:col-span-2">
          <PanelTitle icon={<Settings2 className="size-[18px] text-sky-400" />} right={
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" className="accent-sky-500" checked={autoConnect} onChange={(e) => updateSettings({ autoConnectLora: e.target.checked })} />
                Auto-connect
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" className="accent-sky-500" checked={autoConfigure} onChange={(e) => updateSettings({ autoConfigureDongle: e.target.checked })} />
                Configure on connect
              </label>
            </div>
          }>LoRa Receiver Configuration</PanelTitle>
          <p className="mt-1 text-xs text-slate-400">Must match the payload firmware radio settings. Channel N = 850 + N MHz (use 16 = 866 MHz in India).</p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
            <Field label="Channel">
              <input type="number" className="input" min={0} max={80} value={dongle.channel} onChange={(e) => updateDongle({ channel: Math.max(0, Math.min(80, Number(e.target.value))) })} />
              <span className="mt-1 block text-[11px] text-slate-500">{850 + dongle.channel} MHz</span>
            </Field>
            <Field label="Spreading factor">
              <select className="select w-full" value={dongle.sf} onChange={(e) => updateDongle({ sf: Number(e.target.value) })}>
                {[7, 8, 9, 10, 11, 12].map((v) => <option key={v} value={v}>SF{v}</option>)}
              </select>
            </Field>
            <Field label="Bandwidth">
              <select className="select w-full" value={dongle.bw} onChange={(e) => updateDongle({ bw: Number(e.target.value) as 0 | 1 | 2 })}>
                {BW.map((l, i) => <option key={l} value={i}>{l}</option>)}
              </select>
            </Field>
            <Field label="Coding rate">
              <select className="select w-full" value={dongle.cr} onChange={(e) => updateDongle({ cr: Number(e.target.value) as 1 | 2 | 3 | 4 })}>
                {[1, 2, 3, 4].map((v) => <option key={v} value={v}>4/{v + 4}</option>)}
              </select>
            </Field>
            <Field label="TX power">
              <select className="select w-full" value={dongle.power} onChange={(e) => updateDongle({ power: Number(e.target.value) })}>
                {[10, 13, 16, 19, 22].map((v) => <option key={v} value={v}>{v} dBm</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!isLora || busy} onClick={() => void run(() => link.configureDongle(dongle), 'Receiver configured')}>Apply to Receiver</button>
            <button type="button" className="btn-ghost" disabled={!isLora || busy} onClick={() => void run(() => link.queryDongle())}>Read KISS Version</button>
            <code className="ml-auto rounded-md bg-ink-900/70 px-2.5 py-1.5 text-[11px] text-slate-400 select-all" title="Matching PlatformIO build_flags for the payload">{buildFlags}</code>
          </div>
        </Panel>

        <Panel className="p-4">
          <PanelTitle icon={<ArrowLeftRight className="size-[18px] text-emerald-400" />}>Payload Commands</PanelTitle>
          <p className="mt-1 text-xs text-slate-400">Sent over LoRa through the receiver (or USB in bench mode); the payload replies with an acknowledgement.</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="btn-ghost justify-start" disabled={!linkState.connected} onClick={() => void run(() => link.sendCommand(Command.PING))}><Send className="size-4 text-sky-300" />Ping payload</button>
            <button type="button" className="btn-ghost justify-start" disabled={!linkState.connected || logging} onClick={() => void run(() => link.sendCommand(Command.LOG_START))}><HardDrive className="size-4 text-emerald-300" />Start flash logging</button>
            <button type="button" className="btn-ghost justify-start" disabled={!linkState.connected || !logging} onClick={() => void run(() => link.sendCommand(Command.LOG_STOP))}><HardDrive className="size-4 text-red-300" />Stop flash logging</button>
          </div>
          <div className="mt-4 rounded-lg border border-white/[0.07] bg-ink-900/50 px-3 py-2.5 text-sm">
            {command ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-300">{COMMAND_LABEL[command.cmd]}</span>
                <span className={clsx('font-medium', command.status === 'acked' ? 'text-emerald-400' : command.status === 'failed' ? 'text-red-400' : 'text-amber-300')}>
                  {command.status === 'acked' ? (command.result === 0 ? 'Acknowledged' : 'Rejected') : command.status === 'failed' ? 'No response' : `Waiting… (try ${command.attempts}/3)`}
                </span>
              </div>
            ) : (
              <span className="text-slate-500">No command sent yet</span>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel className="p-4">
          <PanelTitle icon={<Cpu className="size-[18px] text-sky-400" />}>Payload</PanelTitle>
          <dl className="mt-2">
            <KV label="Device ID" valueClass="text-sky-400">{latest?.dev ?? '--'}</KV>
            <KV label="Firmware">{latest?.fw ?? (payloadInfo?.fw as string | undefined) ?? (latest ? 'v2 (LoRa)' : '--')}</KV>
            <KV label="Uptime">{duration(latest?.up)}</KV>
            <KV label="Battery">{latest && latest.sys.bat > 0.5 ? `${fmt(latest.sys.bat, 2)} V (${latest.sys.batPct} %)` : '--'}</KV>
            <KV label="MCU temperature">{latest ? `${latest.sys.mcuT} °C` : '--'}</KV>
            <KV label="Flash logging" valueClass={logging ? 'text-emerald-400' : 'text-slate-400'}>{latest ? (logging ? 'Recording' : 'Stopped') : '--'}</KV>
            <KV label="GPS 1PPS lock">{latest ? ((latest.flags & FLAG.PPS_LOCK) ? 'Locked' : 'Not locked') : '--'}</KV>
          </dl>
        </Panel>
        <Panel className="p-4">
          <PanelTitle icon={<RadioTower className="size-[18px] text-teal-300" />}>Link Statistics</PanelTitle>
          <dl className="mt-2">
            <KV label="Link">{conn.label || '--'}</KV>
            <KV label="Status" valueClass={TONE_TEXT[linkState.tone]}>{linkState.label}</KV>
            <KV label="Packets received">{int(stats.packets)}</KV>
            <KV label="Sequence gaps">{int(stats.lost)}{stats.packets ? ` (${((stats.lost / (stats.packets + stats.lost)) * 100).toFixed(1)} %)` : ''}</KV>
            <KV label="Data rate">{stats.rateHz ? `${stats.rateHz.toFixed(2)} Hz` : '--'}</KV>
            <KV label="Commands / ACKs">{stats.commandsSent} / {stats.acks}</KV>
          </dl>
        </Panel>
        <Panel className="p-4">
          <PanelTitle icon={<Compass className="size-[18px] text-violet-400" />}>BNO055 Calibration</PanelTitle>
          <div className="mt-4 space-y-4">
            {(['System', 'Gyroscope', 'Accelerometer', 'Magnetometer'] as const).map((name, i) => {
              const v = latest?.imu.cal[i] ?? 0
              return (
                <div key={name}>
                  <div className="mb-1.5 flex justify-between text-sm"><span className="text-slate-300">{name}</span><span className="text-slate-400 tabular-nums">{latest ? `${v}/3` : '--'}</span></div>
                  <div className="grid grid-cols-3 gap-1">
                    {[1, 2, 3].map((k) => <span key={k} className={clsx('h-2 rounded-full', v >= k ? (v === 3 ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-white/10')} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      <Panel className="mt-4 overflow-hidden">
        <div className="px-4 pt-4"><PanelTitle>Subsystems</PanelTitle></div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs text-slate-400 uppercase">
              <tr>{['Subsystem', 'Part', 'Interface', 'Function', 'Status'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {SUBSYSTEMS.map((s) => {
                const on = !!latest && (latest.flags & s.flag) !== 0
                return (
                  <tr key={s.part} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-slate-100">{s.name}</td>
                    <td className="px-4 py-2.5 text-slate-300">{s.part}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{s.bus}</td>
                    <td className="px-4 py-2.5 text-slate-400">{s.fn}</td>
                    <td className="px-4 py-2.5">
                      <span className={clsx('chip ring-1', !latest ? 'text-slate-500 ring-white/10' : on ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' : 'bg-red-500/10 text-red-300 ring-red-500/30')}>
                        <i className={clsx('size-1.5 rounded-full', !latest ? 'bg-slate-500' : on ? TONE_DOT.ok : 'bg-red-400')} />
                        {!latest ? 'Unknown' : on ? 'Online' : 'Offline'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <SerialConsole />
    </>
  )
}

function SerialConsole() {
  const lines = useTelemetry((s) => s.console)
  const connected = useTelemetry((s) => s.conn.status === 'connected')
  const isLora = useTelemetry((s) => s.conn.mode === 'lora')
  const [text, setText] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  return (
    <Panel className="mt-4 p-4">
      <PanelTitle icon={<SquareTerminal className="size-[18px] text-slate-300" />} right={
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const cmd = text.trim()
            if (!cmd) return
            link.sendConsole(cmd).catch((err: Error) => toast(err.message, 'error'))
            setText('')
          }}
        >
          <input className="input w-72" placeholder={isLora ? 'Send text over LoRa' : 'Payload key (i, l, t, x)'} value={text} maxLength={120} onChange={(e) => setText(e.target.value)} disabled={!connected} />
          <button type="submit" className="btn-ghost" disabled={!connected}><Send className="size-4" />Send</button>
        </form>
      }>Serial Console</PanelTitle>
      <div ref={ref} className="mt-3 h-64 overflow-y-auto rounded-lg border border-white/[0.07] bg-ink-950/80 p-3 font-mono text-xs leading-relaxed">
        {lines.length === 0 && <div className="text-slate-500">Receiver and payload messages appear here.</div>}
        {lines.map((l, i) => (
          <div key={i} className={clsx(l.dir === 'tx' ? 'text-sky-300' : l.dir === 'sys' ? 'text-amber-200/80' : 'text-slate-300')}>
            <span className="text-slate-600">{new Date(l.t).toLocaleTimeString()} </span>
            {l.dir === 'tx' ? '› ' : l.dir === 'sys' ? '• ' : ''}{l.text}
          </div>
        ))}
      </div>
    </Panel>
  )
}

function Node({ icon: Icon, title, sub, active }: { icon: LucideIcon; title: string; sub: string; active: boolean }) {
  return (
    <div className={clsx('flex min-w-0 items-center gap-3 rounded-xl border p-3.5 transition', active ? 'border-emerald-400/30 bg-emerald-500/[0.06]' : 'border-white/[0.08] bg-ink-900/50')}>
      <span className={clsx('grid size-11 shrink-0 place-items-center rounded-lg', active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.05] text-slate-400')}><Icon className="size-5" /></span>
      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-100">{title}</div>
        <div className="truncate text-xs text-slate-400">{sub}</div>
      </div>
    </div>
  )
}

function Hop({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 px-1 text-center text-[11px] leading-tight text-slate-400">
      <ArrowLeftRight className={clsx('size-5', active ? 'text-emerald-400' : 'text-slate-600')} />
      <span className="max-w-32">{label}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-slate-400">{label}</span>
      {children}
    </label>
  )
}
