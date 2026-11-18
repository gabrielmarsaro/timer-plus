export function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
