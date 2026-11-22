import type { GeneralSettings } from '../types'

export type TimeFormat = GeneralSettings['timeFormat']

export function formatTime(totalSeconds: number, format: TimeFormat = 'mmss'): string {
  const safe = Math.max(0, Math.ceil(totalSeconds))

  if (format === 'ss') {
    return String(safe).padStart(2, '0')
  }

  if (format === 'm_ss') {
    const minutes = Math.floor(safe / 60)
    const seconds = safe % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** Stopwatch display: 00:00.00 or h:mm:ss.00 */
export function formatStopwatch(ms: number): string {
  const safe = Math.max(0, Math.floor(ms))
  const centis = Math.floor(safe / 10) % 100
  const totalSec = Math.floor(safe / 1000)
  const seconds = totalSec % 60
  const totalMin = Math.floor(totalSec / 60)
  const minutes = totalMin % 60
  const hours = Math.floor(totalMin / 60)
  const cs = String(centis).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  if (hours > 0) return `${hours}:${mm}:${ss}.${cs}`
  return `${mm}:${ss}.${cs}`
}

export const TIME_FORMATS: Array<{ id: TimeFormat; label: string }> = [
  { id: 'mmss', label: '00:00' },
  { id: 'm_ss', label: '0:00' },
  { id: 'ss', label: '00' },
]
