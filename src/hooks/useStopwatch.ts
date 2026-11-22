import { useCallback, useEffect, useRef, useState } from 'react'

export type StopwatchStatus = 'idle' | 'running' | 'paused'

export interface Lap {
  index: number
  /** Duration of this lap in ms */
  lapMs: number
  /** Total elapsed at lap mark in ms */
  totalMs: number
}

export interface UseStopwatchResult {
  status: StopwatchStatus
  elapsedMs: number
  laps: Lap[]
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  lap: () => void
}

export function useStopwatch(): UseStopwatchResult {
  const [status, setStatus] = useState<StopwatchStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [laps, setLaps] = useState<Lap[]>([])

  const statusRef = useRef(status)
  const elapsedRef = useRef(0)
  const lapBaseRef = useRef(0)
  const rafRef = useRef(0)
  const lastTickRef = useRef<number | null>(null)
  const lastShownCsRef = useRef(0)

  statusRef.current = status
  elapsedRef.current = elapsedMs

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    lastTickRef.current = null
  }, [])

  const tick = useCallback(
    (now: number) => {
      if (statusRef.current !== 'running') return
      if (lastTickRef.current === null) {
        lastTickRef.current = now
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const delta = now - lastTickRef.current
      lastTickRef.current = now
      const next = elapsedRef.current + delta
      elapsedRef.current = next
      // Only re-render when the displayed centisecond changes — avoids jitter.
      const shownCs = Math.floor(next / 10)
      if (shownCs !== lastShownCsRef.current) {
        lastShownCsRef.current = shownCs
        setElapsedMs(shownCs * 10)
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [],
  )

  const startLoop = useCallback(() => {
    stopLoop()
    lastTickRef.current = null
    rafRef.current = requestAnimationFrame(tick)
  }, [stopLoop, tick])

  const start = useCallback(() => {
    setStatus('running')
    setElapsedMs(0)
    setLaps([])
    elapsedRef.current = 0
    lapBaseRef.current = 0
    lastShownCsRef.current = 0
    startLoop()
  }, [startLoop])

  const pause = useCallback(() => {
    stopLoop()
    const shown = Math.floor(elapsedRef.current / 10) * 10
    elapsedRef.current = shown
    lastShownCsRef.current = shown / 10
    setElapsedMs(shown)
    setStatus('paused')
  }, [stopLoop])

  const resume = useCallback(() => {
    setStatus('running')
    startLoop()
  }, [startLoop])

  const reset = useCallback(() => {
    stopLoop()
    setStatus('idle')
    setElapsedMs(0)
    setLaps([])
    elapsedRef.current = 0
    lapBaseRef.current = 0
    lastShownCsRef.current = 0
  }, [stopLoop])

  const lap = useCallback(() => {
    if (statusRef.current !== 'running') return
    const total = elapsedRef.current
    const lapMs = total - lapBaseRef.current
    lapBaseRef.current = total
    setLaps((prev) => [
      { index: prev.length + 1, lapMs, totalMs: total },
      ...prev,
    ])
  }, [])

  useEffect(() => () => stopLoop(), [stopLoop])

  useEffect(() => {
    if (status !== 'running') return
    const onVisibility = () => {
      if (document.hidden) lastTickRef.current = null
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [status])

  return { status, elapsedMs, laps, start, pause, resume, reset, lap }
}
