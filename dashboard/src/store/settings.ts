import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DongleConfig {
  /** Waveshare DTU channel: frequency = 850 + channel MHz (HF model) */
  channel: number
  sf: number
  /** 0 = 125 kHz, 1 = 250 kHz, 2 = 500 kHz */
  bw: 0 | 1 | 2
  /** 1 = 4/5 … 4 = 4/8 */
  cr: 1 | 2 | 3 | 4
  power: number
  netId: number
  address: number
  rssiOutput: boolean
}

export interface Thresholds {
  co2Warn: number
  co2Crit: number
  tempHigh: number
  tempLow: number
  humHigh: number
  batLow: number
  linkTimeout: number
}

export interface Settings {
  layout: 'snapshot' | 'overview'
  autoRefresh: boolean
  refreshSec: number
  mapLayer: 'satellite' | 'dark'
  historyMin: number
  baud: number
  autoConfigureDongle: boolean
  autoConnectLora: boolean
  dongle: DongleConfig
  thresholds: Thresholds
}

export const DEFAULT_SETTINGS: Settings = {
  layout: 'snapshot',
  autoRefresh: true,
  refreshSec: 5,
  mapLayer: 'satellite',
  historyMin: 120,
  baud: 115200,
  autoConfigureDongle: true,
  autoConnectLora: true,
  dongle: { channel: 16, sf: 9, bw: 0, cr: 1, power: 22, netId: 0, address: 65535, rssiOutput: true },
  thresholds: {
    co2Warn: 1000,
    co2Crit: 2000,
    tempHigh: 45,
    tempLow: 0,
    humHigh: 85,
    batLow: 20,
    linkTimeout: 5,
  },
}

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void
  updateDongle: (patch: Partial<DongleConfig>) => void
  updateThresholds: (patch: Partial<Thresholds>) => void
  reset: () => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      updateDongle: (patch) => set((s) => ({ dongle: { ...s.dongle, ...patch } })),
      updateThresholds: (patch) => set((s) => ({ thresholds: { ...s.thresholds, ...patch } })),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'rbb.settings',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>
        return {
          ...current,
          ...p,
          autoConnectLora: p.autoConnectLora ?? current.autoConnectLora,
          dongle: { ...current.dongle, ...p.dongle },
          thresholds: { ...current.thresholds, ...p.thresholds },
        }
      },
    },
  ),
)
