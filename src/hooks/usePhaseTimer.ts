import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { totalDuration } from '../lib/buildPhases'
import type { Phase } from '../types'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface PhaseTimerEvents {
  onStart?: (phase: Phase, next: Phase | null) => void
  onPhaseChange?: (phase: Phase, next: Phase | null) => void
  onSecond?: (remaining: number, phase: Phase) => void
  onComplete?: () => void
}

interface UsePhaseTimerOptions extends PhaseTimerEvents {
  totalRounds: number
  totalCycles?: number
}

interface UsePhaseTimerResult {
  status: TimerStatus
  phases: Phase[]
  currentPhase: Phase | null
  nextPhase: Phase | null
  phaseRemaining: number
  totalRemaining: number
  roundsLeft: number
  cyclesLeft: number
  currentRoundNumber: number
  start: () => Promise<void>
  pause: () => void
  resume: () => Promise<void>
  reset: () => void
}

/**
 * Wall-clock based phase timer. Uses absolute deadlines so locking the screen
 * (which pauses rAF) does not freeze the countdown — when ticks resume we catch up.
 */
export function usePhaseTimer(
  phases: Phase[],
  {
    totalRounds,
    totalCycles = 1,
    onStart,
    onPhaseChange,
    onSecond,
    onComplete,
  }: UsePhaseTimerOptions,
): UsePhaseTimerResult {
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [phaseRemaining, setPhaseRemaining] = useState(phases[0]?.duration ?? 0)
  const [elapsedInWorkout, setElapsedInWorkout] = useState(0)

  const statusRef = useRef(status)
  const phaseIndexRef = useRef(phaseIndex)
  const phaseRemainingRef = useRef(phaseRemaining)
  const elapsedRef = useRef(elapsedInWorkout)
  const rafRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const phasesRef = useRef(phases)
  const lastSecondRef = useRef<number | null>(null)
  const eventsRef = useRef({ onStart, onPhaseChange, onSecond, onComplete })
  /** Absolute wall time when the current phase ends (ms). */
  const phaseEndsAtRef = useRef<number | null>(null)
  /** Elapsed workout seconds frozen at last pause/start of phase. */
  const elapsedAtPhaseStartRef = useRef(0)

  statusRef.current = status
  phaseIndexRef.current = phaseIndex
  phaseRemainingRef.current = phaseRemaining
  elapsedRef.current = elapsedInWorkout
  phasesRef.current = phases
  eventsRef.current = { onStart, onPhaseChange, onSecond, onComplete }

  const currentPhase = phases[phaseIndex] ?? null
  const nextPhase = phases[phaseIndex + 1] ?? null
  const workoutTotal = useMemo(() => totalDuration(phases), [phases])
  const totalRemaining = Math.max(0, workoutTotal - elapsedInWorkout)

  const roundsLeft = useMemo(() => {
    if (status === 'finished') return 0
    if (status === 'idle') return totalRounds
    if (!currentPhase) return 0
    const round = currentPhase.round ?? totalRounds
    return Math.max(0, totalRounds - round + (currentPhase.kind === 'work' ? 1 : 0))
  }, [currentPhase, status, totalRounds])

  const cyclesLeft = useMemo(() => {
    if (status === 'finished') return 0
    if (status === 'idle') return totalCycles
    if (!currentPhase) return 0
    return totalCycles - (currentPhase.cycle ?? 1) + 1
  }, [currentPhase, status, totalCycles])

  const currentRoundNumber = useMemo(() => {
    if (status === 'idle') return 1
    if (status === 'finished') return totalRounds
    return currentPhase?.round ?? 1
  }, [currentPhase, status, totalRounds])

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const armPhaseDeadline = useCallback((remainingSec: number) => {
    phaseEndsAtRef.current = Date.now() + Math.max(0, remainingSec) * 1000
  }, [])

  const resetToIdle = useCallback(() => {
    stopLoop()
    phaseEndsAtRef.current = null
    elapsedAtPhaseStartRef.current = 0
    setStatus('idle')
    setPhaseIndex(0)
    setPhaseRemaining(phases[0]?.duration ?? 0)
    setElapsedInWorkout(0)
    lastSecondRef.current = null
  }, [phases, stopLoop])

  useEffect(() => {
    if (status === 'idle' || status === 'finished') {
      setPhaseIndex(0)
      setPhaseRemaining(phases[0]?.duration ?? 0)
      setElapsedInWorkout(0)
    }
  }, [phases, status])

  const advanceFromWallClock = useCallback(() => {
    if (statusRef.current !== 'running') return
    let endsAt = phaseEndsAtRef.current
    if (endsAt === null) return

    const list = phasesRef.current
    const now = Date.now()
    let index = phaseIndexRef.current
    let elapsedBase = elapsedAtPhaseStartRef.current

    // Absolute deadlines: skip any phases that ended while the screen was locked.
    while (now >= endsAt) {
      const finishedPhase = list[index]
      if (!finishedPhase) break

      elapsedBase += finishedPhase.duration
      index += 1

      if (index >= list.length) {
        stopLoop()
        phaseEndsAtRef.current = null
        phaseIndexRef.current = Math.max(0, list.length - 1)
        phaseRemainingRef.current = 0
        elapsedRef.current = totalDuration(list)
        setPhaseIndex(Math.max(0, list.length - 1))
        setPhaseRemaining(0)
        setElapsedInWorkout(totalDuration(list))
        setStatus('finished')
        eventsRef.current.onComplete?.()
        return
      }

      endsAt += list[index].duration * 1000
      phaseEndsAtRef.current = endsAt
      elapsedAtPhaseStartRef.current = elapsedBase
      phaseIndexRef.current = index
      setPhaseIndex(index)
      lastSecondRef.current = null
      eventsRef.current.onPhaseChange?.(list[index], list[index + 1] ?? null)
    }

    const remaining = Math.max(0, (endsAt - now) / 1000)
    const elapsed = Math.min(
      totalDuration(list),
      elapsedBase + (list[index]?.duration ?? 0) - remaining,
    )

    const whole = Math.ceil(remaining)
    if (lastSecondRef.current !== whole && list[index]) {
      lastSecondRef.current = whole
      eventsRef.current.onSecond?.(remaining, list[index])
    }

    phaseRemainingRef.current = remaining
    elapsedRef.current = elapsed
    setPhaseRemaining(remaining)
    setElapsedInWorkout(elapsed)
  }, [stopLoop])

  const tick = useCallback(() => {
    if (statusRef.current !== 'running') return
    advanceFromWallClock()
    rafRef.current = requestAnimationFrame(tick)
  }, [advanceFromWallClock])

  const startLoop = useCallback(() => {
    stopLoop()
    rafRef.current = requestAnimationFrame(tick)
    // Backup while backgrounded (rAF freezes) — wall clock still advances.
    intervalRef.current = window.setInterval(() => {
      advanceFromWallClock()
    }, 250)
  }, [advanceFromWallClock, stopLoop, tick])

  const start = useCallback(async () => {
    const first = phases[0]
    const remaining = first?.duration ?? 0
    setStatus('running')
    setPhaseIndex(0)
    setPhaseRemaining(remaining)
    setElapsedInWorkout(0)
    lastSecondRef.current = null
    elapsedAtPhaseStartRef.current = 0
    armPhaseDeadline(remaining)
    startLoop()
    if (first) {
      eventsRef.current.onStart?.(first, phases[1] ?? null)
    }
  }, [armPhaseDeadline, phases, startLoop])

  const pause = useCallback(() => {
    advanceFromWallClock()
    stopLoop()
    phaseEndsAtRef.current = null
    setStatus('paused')
  }, [advanceFromWallClock, stopLoop])

  const resume = useCallback(async () => {
    const phaseDuration = phasesRef.current[phaseIndexRef.current]?.duration ?? 0
    const consumed = phaseDuration - phaseRemainingRef.current
    elapsedAtPhaseStartRef.current = Math.max(0, elapsedRef.current - consumed)
    armPhaseDeadline(phaseRemainingRef.current)
    setStatus('running')
    startLoop()
  }, [armPhaseDeadline, startLoop])

  const reset = useCallback(() => {
    resetToIdle()
  }, [resetToIdle])

  useEffect(() => () => stopLoop(), [stopLoop])

  useEffect(() => {
    if (status !== 'running') return
    const onVisibility = () => {
      // Catch up immediately when returning from lock screen / background.
      advanceFromWallClock()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    window.addEventListener('pageshow', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
      window.removeEventListener('pageshow', onVisibility)
    }
  }, [advanceFromWallClock, status])

  return {
    status,
    phases,
    currentPhase,
    nextPhase,
    phaseRemaining,
    totalRemaining,
    roundsLeft,
    cyclesLeft,
    currentRoundNumber,
    start,
    pause,
    resume,
    reset,
  }
}
