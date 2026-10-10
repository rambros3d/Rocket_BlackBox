import { create } from 'zustand'
import clsx from 'clsx'
import { CircleAlert, CircleCheck, Info } from 'lucide-react'

type Tone = 'info' | 'success' | 'error'
interface ToastItem {
  id: number
  text: string
  tone: Tone
}

const useToasts = create<{ items: ToastItem[]; push: (text: string, tone: Tone) => void; drop: (id: number) => void }>((set) => ({
  items: [],
  push: (text, tone) => {
    const id = Date.now() + Math.random()
    set((s) => ({ items: [...s.items.slice(-3), { id, text, tone }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 4500)
  },
  drop: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

export const toast = (text: string, tone: Tone = 'info') => useToasts.getState().push(text, tone)

const ICON = { info: Info, success: CircleCheck, error: CircleAlert }
const TONE = {
  info: 'border-sky-400/30 text-sky-100',
  success: 'border-emerald-400/30 text-emerald-100',
  error: 'border-red-400/40 text-red-100',
}

export function Toaster() {
  const items = useToasts((s) => s.items)
  const drop = useToasts((s) => s.drop)
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-[2000] flex w-[360px] flex-col gap-2">
      {items.map((t) => {
        const Icon = ICON[t.tone]
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => drop(t.id)}
            className={clsx('panel pointer-events-auto flex items-start gap-3 bg-ink-800/95 px-4 py-3 text-left text-sm', TONE[t.tone])}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span>{t.text}</span>
          </button>
        )
      })}
    </div>
  )
}
