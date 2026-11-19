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

export const TIME_FORMATS: Array<{ id: TimeFormat; label: string }> = [
  { id: 'mmss', label: '00:00' },
  { id: 'm_ss', label: '0:00' },
  { id: 'ss', label: '00' },
]
