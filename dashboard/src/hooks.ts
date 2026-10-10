import { useEffect, useState } from 'react'
import { useTelemetry } from './store/telemetry'
import { useSettings } from './store/settings'

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export const useLatest = () => useTelemetry((s) => s.view.latest)
export const useView = () => useTelemetry((s) => s.view)

export type LinkTone = 'ok' | 'warn' | 'off'

export interface LinkState {
  tone: LinkTone
  label: string
  short: string
  kind: 'LoRa' | 'USB' | '—'
  connected: boolean
}

export function useLinkState(): LinkState {
  const conn = useTelemetry((s) => s.conn)
  const timeout = useSettings((s) => s.thresholds.linkTimeout)
  const now = useNow(1000)
  const fresh = conn.lastFrameAt !== null && now - conn.lastFrameAt < timeout * 1000

  if (conn.status !== 'connected' || !conn.mode) {
    return { tone: 'off', label: conn.status === 'connecting' ? 'Connecting…' : 'Disconnected', short: conn.status === 'connecting' ? 'Connecting' : 'Disconnected', kind: '—', connected: false }
  }
  if (conn.mode === 'usb') {
    return { tone: fresh ? 'ok' : 'warn', label: fresh ? 'USB Connected' : 'USB Waiting', short: fresh ? 'Connected' : 'Waiting', kind: 'USB', connected: true }
  }
  return {
    tone: fresh ? 'ok' : 'warn',
    label: fresh ? 'LoRa Connected' : 'LoRa Searching',
    short: fresh ? 'Connected' : 'Searching',
    kind: 'LoRa',
    connected: true,
  }
}

export const TONE_TEXT: Record<LinkTone, string> = {
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  off: 'text-red-400',
}
export const TONE_DOT: Record<LinkTone, string> = {
  ok: 'bg-emerald-400 shadow-[0_0_8px_2px_rgb(52_211_153/0.6)]',
  warn: 'bg-amber-400 shadow-[0_0_8px_2px_rgb(251_191_36/0.5)]',
  off: 'bg-red-400',
}
