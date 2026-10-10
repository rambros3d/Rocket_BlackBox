export type Level = 'good' | 'normal' | 'moderate' | 'poor' | 'bad' | 'none'

export interface Status {
  label: string
  level: Level
}

const none: Status = { label: '--', level: 'none' }

export const LEVEL_TEXT: Record<Level, string> = {
  good: 'text-emerald-400',
  normal: 'text-teal-300',
  moderate: 'text-amber-400',
  poor: 'text-orange-400',
  bad: 'text-red-400',
  none: 'text-slate-500',
}

export function co2Status(ppm?: number): Status {
  if (ppm === undefined || ppm <= 0) return none
  if (ppm < 800) return { label: 'Normal', level: 'normal' }
  if (ppm < 1200) return { label: 'Moderate', level: 'moderate' }
  if (ppm < 2000) return { label: 'Poor', level: 'poor' }
  return { label: 'Hazardous', level: 'bad' }
}

export function tempComfort(c?: number): Status {
  if (c === undefined) return none
  if (c < 0) return { label: 'Freezing', level: 'bad' }
  if (c < 18) return { label: 'Cool', level: 'moderate' }
  if (c <= 30) return { label: 'Comfortable', level: 'normal' }
  if (c <= 38) return { label: 'Warm', level: 'moderate' }
  return { label: 'Hot', level: 'bad' }
}

export function tempRange(c?: number): Status {
  if (c === undefined) return none
  if (c < 10) return { label: 'Low', level: 'moderate' }
  if (c <= 35) return { label: 'Normal', level: 'normal' }
  return { label: 'High', level: 'poor' }
}

export function humStatus(h?: number): Status {
  if (h === undefined || h <= 0) return none
  if (h < 30) return { label: 'Dry', level: 'moderate' }
  if (h <= 60) return { label: 'Normal', level: 'normal' }
  if (h <= 75) return { label: 'Humid', level: 'moderate' }
  return { label: 'Very Humid', level: 'poor' }
}

export function pressureStatus(p?: number): Status {
  if (p === undefined || p <= 0) return none
  if (p < 980) return { label: 'Low', level: 'moderate' }
  if (p <= 1040) return { label: 'Normal', level: 'normal' }
  return { label: 'High', level: 'moderate' }
}

export function vocStatus(v?: number): Status {
  if (v === undefined || v <= 0) return v === 0 ? { label: 'Warming up', level: 'none' } : none
  if (v <= 80) return { label: 'Good', level: 'good' }
  if (v <= 150) return { label: 'Moderate', level: 'moderate' }
  if (v <= 250) return { label: 'Poor', level: 'poor' }
  return { label: 'Bad', level: 'bad' }
}

export function noxStatus(v?: number): Status {
  if (v === undefined || v <= 0) return v === 0 ? { label: 'Warming up', level: 'none' } : none
  if (v <= 50) return { label: 'Good', level: 'good' }
  if (v <= 150) return { label: 'Moderate', level: 'moderate' }
  if (v <= 300) return { label: 'Poor', level: 'poor' }
  return { label: 'Bad', level: 'bad' }
}

export function lightStatus(lux?: number): Status {
  if (lux === undefined) return none
  if (lux < 50) return { label: 'Dark', level: 'moderate' }
  if (lux < 500) return { label: 'Dim', level: 'normal' }
  if (lux < 2000) return { label: 'Normal', level: 'normal' }
  return { label: 'Bright', level: 'good' }
}
