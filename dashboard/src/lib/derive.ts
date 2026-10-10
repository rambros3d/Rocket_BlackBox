import { FLAG, type Frame } from './types'
import { EXPECTED_SENSORS } from '../store/telemetry'

export function sensorsActive(f: Frame | null) {
  if (!f) return { active: 0, total: EXPECTED_SENSORS.length, label: '--', missing: [] as string[] }
  const missing = EXPECTED_SENSORS.filter((s) => (f.flags & s.flag) === 0).map((s) => s.name)
  const active = EXPECTED_SENSORS.length - missing.length
  return {
    active,
    total: EXPECTED_SENSORS.length,
    label: missing.length === 0 ? 'All Active' : `${active}/${EXPECTED_SENSORS.length} Active`,
    missing,
  }
}

export const hasFlag = (f: Frame | null, flag: number) => !!f && (f.flags & flag) !== 0
export const isLogging = (f: Frame | null) => hasFlag(f, FLAG.LOGGING)
