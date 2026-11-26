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
  /** Round total for the active session (frozen while running/paused). */
  sessionTotalRounds: number
  start: () => Promise<void>
  pause: () => void
  resume: () => Promise<void>
  reset: () => void
  /** Jump to the next phase (or finish). Works while running or paused. */
  skipPhase: () => void
  /** Add seconds to the current phase remaining. */
  extendPhase: (seconds: number) => void
}

/**
 * Wall-clock based phase timer. Uses absolute deadlines so locking the screen
 * (which pauses rAF) does not freeze the countdown — when ticks resume we catch up.
 * Session phases are snapshotted on start so editing settings mid-run does not
 * reshuffle the active workout.
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
  /** Phases + round/cycle totals for the live session (frozen at start). */
  const sessionPhasesRef = useRef(phases)
  const sessionRoundsRef = useRef(totalRounds)
  const sessionCyclesRef = useRef(totalCycles)
  const lastSecondRef = useRef<number | null>(null)
  const eventsRef = useRef({ onStart, onPhaseChange, onSecond, onComplete })
  const phaseEndsAtRef = useRef<number | null>(null)
  const elapsedAtPhaseStartRef = useRef(0)

  statusRef.current = status
  phaseIndexRef.current = phaseIndex
  phaseRemainingRef.current = phaseRemaining
  elapsedRef.current = elapsedInWorkout
  eventsRef.current = { onStart, onPhaseChange, onSecond, onComplete }

  if (status === 'idle' || status === 'finished') {
    sessionPhasesRef.current = phases
    sessionRoundsRef.current = totalRounds
    sessionCyclesRef.current = totalCycles
  }

  const sessionPhases = sessionPhasesRef.current
  const sessionRounds = sessionRoundsRef.current
  const sessionCycles = sessionCyclesRef.current
  const currentPhase = sessionPhases[phaseIndex] ?? null
  const nextPhase = sessionPhases[phaseIndex + 1] ?? null
  const workoutTotal = useMemo(
    () => totalDuration(status === 'idle' || status === 'finished' ? phases : sessionPhases),
    [phases, sessionPhases, status],
  )
  const totalRemaining = Math.max(0, workoutTotal - elapsedInWorkout)

  const roundsLeft = useMemo(() => {
    if (status === 'finished') return 0
    if (status === 'idle') return totalRounds
    if (!currentPhase) return 0
    // prepare/cooldown have no round — keep full count until work starts
    if (currentPhase.round == null) return sessionRounds
    const round = currentPhase.round
    return Math.max(0, sessionRounds - round + (currentPhase.kind === 'work' ? 1 : 0))
  }, [currentPhase, sessionRounds, status, totalRounds])

  const cyclesLeft = useMemo(() => {
    if (status === 'finished') return 0
    if (status === 'idle') return totalCycles
    if (!currentPhase) return 0
    return sessionCycles - (currentPhase.cycle ?? 1) + 1
  }, [currentPhase, sessionCycles, status, totalCycles])

  const currentRoundNumber = useMemo(() => {
    if (status === 'idle') return 1
    if (status === 'finished') return sessionRounds
    return currentPhase?.round ?? 1
  }, [currentPhase, sessionRounds, status])

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
    sessionPhasesRef.current = phases
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

  const finishWorkout = useCallback(
    (list: Phase[]) => {
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
    },
    [stopLoop],
  )

  const advanceFromWallClock = useCallback(() => {
    if (statusRef.current !== 'running') return
    let endsAt = phaseEndsAtRef.current
    if (endsAt === null) return

    const list = sessionPhasesRef.current
    const now = Date.now()
    let index = phaseIndexRef.current
    let elapsedBase = elapsedAtPhaseStartRef.current

    while (now >= endsAt) {
      const finishedPhase = list[index]
      if (!finishedPhase) break

      elapsedBase += finishedPhase.duration
      index += 1

      if (index >= list.length) {
        finishWorkout(list)
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
  }, [finishWorkout])

  const tick = useCallback(() => {
    if (statusRef.current !== 'running') return
    advanceFromWallClock()
    rafRef.current = requestAnimationFrame(tick)
  }, [advanceFromWallClock])

  const startLoop = useCallback(() => {
    stopLoop()
    rafRef.current = requestAnimationFrame(tick)
    intervalRef.current = window.setInterval(() => {
      advanceFromWallClock()
    }, 250)
  }, [advanceFromWallClock, stopLoop, tick])

  const start = useCallback(async () => {
    const snapshot = phases
    sessionPhasesRef.current = snapshot
    sessionRoundsRef.current = totalRounds
    sessionCyclesRef.current = totalCycles
    const first = snapshot[0]
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
      eventsRef.current.onStart?.(first, snapshot[1] ?? null)
    }
  }, [armPhaseDeadline, phases, startLoop, totalCycles, totalRounds])

  const pause = useCallback(() => {
    advanceFromWallClock()
    stopLoop()
    phaseEndsAtRef.current = null
    setStatus('paused')
  }, [advanceFromWallClock, stopLoop])

  const resume = useCallback(async () => {
    const phaseDuration = sessionPhasesRef.current[phaseIndexRef.current]?.duration ?? 0
    const consumed = phaseDuration - phaseRemainingRef.current
    elapsedAtPhaseStartRef.current = Math.max(0, elapsedRef.current - consumed)
    armPhaseDeadline(phaseRemainingRef.current)
    setStatus('running')
    startLoop()
  }, [armPhaseDeadline, startLoop])

  const reset = useCallback(() => {
    resetToIdle()
  }, [resetToIdle])

  const skipPhase = useCallback(() => {
    if (statusRef.current !== 'running' && statusRef.current !== 'paused') return
    const list = sessionPhasesRef.current
    const index = phaseIndexRef.current
    const current = list[index]
    if (!current) return

    // Count current phase as completed for elapsed.
    const consumed = current.duration - phaseRemainingRef.current
    const elapsedBase = Math.max(0, elapsedRef.current - consumed) + current.duration
    const nextIndex = index + 1

    if (nextIndex >= list.length) {
      finishWorkout(list)
      return
    }

    const next = list[nextIndex]
    phaseIndexRef.current = nextIndex
    phaseRemainingRef.current = next.duration
    elapsedRef.current = elapsedBase
    elapsedAtPhaseStartRef.current = elapsedBase
    lastSecondRef.current = null
    setPhaseIndex(nextIndex)
    setPhaseRemaining(next.duration)
    setElapsedInWorkout(elapsedBase)

    if (statusRef.current === 'running') {
      armPhaseDeadline(next.duration)
    } else {
      phaseEndsAtRef.current = null
    }

    eventsRef.current.onPhaseChange?.(next, list[nextIndex + 1] ?? null)
  }, [armPhaseDeadline, finishWorkout])

  const extendPhase = useCallback(
    (seconds: number) => {
      if (statusRef.current !== 'running' && statusRef.current !== 'paused') return
      if (seconds <= 0) return
      if (statusRef.current === 'running') {
        advanceFromWallClock()
      }
      const next = phaseRemainingRef.current + seconds
      phaseRemainingRef.current = next
      setPhaseRemaining(next)
      // Elapsed decreases relative to phase end — keep base, re-arm deadline.
      if (statusRef.current === 'running') {
        armPhaseDeadline(next)
      }
      lastSecondRef.current = null
    },
    [advanceFromWallClock, armPhaseDeadline],
  )

  useEffect(() => () => stopLoop(), [stopLoop])

  useEffect(() => {
    if (status !== 'running') return
    const onVisibility = () => {
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
    phases: sessionPhases,
    currentPhase,
    nextPhase,
    phaseRemaining,
    totalRemaining,
    roundsLeft,
    cyclesLeft,
    currentRoundNumber,
    sessionTotalRounds: status === 'idle' ? totalRounds : sessionRounds,
    start,
    pause,
    resume,
    reset,
    skipPhase,
    extendPhase,
  }
}
