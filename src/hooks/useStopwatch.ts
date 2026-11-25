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

/**
 * Wall-clock stopwatch so locking the screen does not freeze elapsed time.
 */
export function useStopwatch(): UseStopwatchResult {
  const [status, setStatus] = useState<StopwatchStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [laps, setLaps] = useState<Lap[]>([])

  const statusRef = useRef(status)
  const elapsedRef = useRef(0)
  const lapBaseRef = useRef(0)
  const rafRef = useRef(0)
  const intervalRef = useRef<number | null>(null)
  const lastShownCsRef = useRef(0)
  /** Wall time when the current running segment started. */
  const segmentStartedAtRef = useRef<number | null>(null)
  /** Elapsed ms accumulated before the current running segment. */
  const baseElapsedRef = useRef(0)

  statusRef.current = status
  elapsedRef.current = elapsedMs

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const readElapsed = useCallback(() => {
    const started = segmentStartedAtRef.current
    if (started === null) return baseElapsedRef.current
    return baseElapsedRef.current + (Date.now() - started)
  }, [])

  const publish = useCallback((next: number) => {
    elapsedRef.current = next
    const shownCs = Math.floor(next / 10)
    if (shownCs !== lastShownCsRef.current) {
      lastShownCsRef.current = shownCs
      setElapsedMs(shownCs * 10)
    }
  }, [])

  const tick = useCallback(() => {
    if (statusRef.current !== 'running') return
    publish(readElapsed())
    rafRef.current = requestAnimationFrame(tick)
  }, [publish, readElapsed])

  const startLoop = useCallback(() => {
    stopLoop()
    rafRef.current = requestAnimationFrame(tick)
    intervalRef.current = window.setInterval(() => {
      if (statusRef.current === 'running') publish(readElapsed())
    }, 250)
  }, [publish, readElapsed, stopLoop, tick])

  const start = useCallback(() => {
    setStatus('running')
    setElapsedMs(0)
    setLaps([])
    elapsedRef.current = 0
    lapBaseRef.current = 0
    lastShownCsRef.current = 0
    baseElapsedRef.current = 0
    segmentStartedAtRef.current = Date.now()
    startLoop()
  }, [startLoop])

  const pause = useCallback(() => {
    const next = readElapsed()
    stopLoop()
    baseElapsedRef.current = next
    segmentStartedAtRef.current = null
    const shown = Math.floor(next / 10) * 10
    elapsedRef.current = shown
    lastShownCsRef.current = shown / 10
    setElapsedMs(shown)
    setStatus('paused')
  }, [readElapsed, stopLoop])

  const resume = useCallback(() => {
    segmentStartedAtRef.current = Date.now()
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
    baseElapsedRef.current = 0
    segmentStartedAtRef.current = null
  }, [stopLoop])

  const lap = useCallback(() => {
    if (statusRef.current !== 'running') return
    const total = readElapsed()
    const lapMs = total - lapBaseRef.current
    lapBaseRef.current = total
    setLaps((prev) => [
      { index: prev.length + 1, lapMs, totalMs: total },
      ...prev,
    ])
  }, [readElapsed])

  useEffect(() => () => stopLoop(), [stopLoop])

  useEffect(() => {
    if (status !== 'running') return
    const onVisibility = () => {
      publish(readElapsed())
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    window.addEventListener('pageshow', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
      window.removeEventListener('pageshow', onVisibility)
    }
  }, [publish, readElapsed, status])

  return { status, elapsedMs, laps, start, pause, resume, reset, lap }
}
