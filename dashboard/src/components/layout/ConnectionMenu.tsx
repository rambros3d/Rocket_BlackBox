import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Cable, ChevronDown, RadioTower, Unplug, Usb, Wifi, WifiOff } from 'lucide-react'
import { link, serialSupported } from '../../lib/link'
import { useLinkState, TONE_DOT, TONE_TEXT } from '../../hooks'
import { useTelemetry } from '../../store/telemetry'
import { toast } from '../ui/Toast'

export async function connectWithToast(mode: 'lora' | 'usb') {
  try {
    link.resetUserDisconnected()
    await link.connect(mode)
    toast(mode === 'lora' ? 'LoRa receiver connected' : 'Payload connected over USB', 'success')
  } catch (err) {
    const e = err as Error
    if (e.name !== 'NotFoundError') toast(e.message || 'Could not open serial port', 'error')
  }
}

export async function disconnectAll() {
  if (link.isDemo) link.stopDemo()
  else await link.disconnect(true)
}

export default function ConnectionMenu({ variant = 'topbar' }: { variant?: 'topbar' | 'overview' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const state = useLinkState()
  const label = useTelemetry((s) => s.conn.label)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const Icon = state.tone === 'off' ? WifiOff : variant === 'overview' ? RadioTower : Wifi
  const run = (fn: () => unknown) => () => {
    setOpen(false)
    void fn()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(
          'flex items-center gap-2.5 rounded-lg text-sm font-medium transition',
          variant === 'overview'
            ? clsx('h-12 border px-4', state.tone === 'ok' ? 'border-emerald-500/30 bg-emerald-500/[0.07]' : 'border-white/10 bg-ink-800/80', TONE_TEXT[state.tone])
            : 'h-9 px-2.5 text-slate-200 hover:bg-white/[0.05]',
        )}
      >
        <Icon className={clsx('size-[18px]', TONE_TEXT[state.tone])} />
        <span>{variant === 'overview' ? state.short : state.label}</span>
        {variant === 'topbar' && <i className={clsx('size-2 rounded-full', TONE_DOT[state.tone])} />}
        <ChevronDown className={clsx('size-3.5 text-slate-500 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div role="menu" className="panel absolute right-0 z-[1500] mt-2 w-80 bg-ink-800/98 p-2 text-sm">
          <div className="px-3 pt-2 pb-3">
            <div className="text-xs text-slate-400">Current link</div>
            <div className="mt-0.5 font-medium text-slate-100">{label || 'Not connected'}</div>
          </div>
          {!serialSupported && (
            <p className="mx-2 mb-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Web Serial needs Chrome or Edge on desktop (https or localhost).
            </p>
          )}
          <MenuItem icon={RadioTower} title="Connect LoRa Receiver" sub="Waveshare USB-TO-LoRa-HF dongle" disabled={!serialSupported} onClick={run(() => connectWithToast('lora'))} />
          <MenuItem icon={Usb} title="Connect Payload via USB" sub="Rocket BlackBox USB-C (bench mode)" disabled={!serialSupported} onClick={run(() => connectWithToast('usb'))} />
          <div className="my-1 h-px bg-white/[0.06]" />
          <MenuItem icon={state.connected ? Unplug : Cable} title="Disconnect" disabled={!state.connected} onClick={run(disconnectAll)} />
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, title, sub, onClick, disabled }: { icon: typeof Usb; title: string; sub?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="grid size-8 place-items-center rounded-md bg-ink-700/70 text-sky-300"><Icon className="size-4" /></span>
      <span>
        <span className="block font-medium text-slate-100">{title}</span>
        {sub && <span className="block text-xs text-slate-400">{sub}</span>}
      </span>
    </button>
  )
}
