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
  const lastTickRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const phasesRef = useRef(phases)
  const lastSecondRef = useRef<number | null>(null)
  const eventsRef = useRef({ onStart, onPhaseChange, onSecond, onComplete })

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
    lastTickRef.current = null
  }, [])

  const resetToIdle = useCallback(() => {
    stopLoop()
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

  const tick = useCallback(
    (now: number) => {
      if (statusRef.current !== 'running') return
      const list = phasesRef.current

      if (lastTickRef.current === null) {
        lastTickRef.current = now
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const delta = (now - lastTickRef.current) / 1000
      lastTickRef.current = now

      let remaining = phaseRemainingRef.current - delta
      let elapsed = elapsedRef.current + delta
      let index = phaseIndexRef.current

      while (remaining <= 0) {
        const overflow = -remaining
        const finishedPhase = list[index]
        if (!finishedPhase) break

        elapsed = Math.min(
          totalDuration(list),
          elapsedRef.current + finishedPhase.duration - phaseRemainingRef.current + overflow,
        )

        index += 1
        if (index >= list.length) {
          stopLoop()
          setPhaseIndex(Math.max(0, list.length - 1))
          setPhaseRemaining(0)
          setElapsedInWorkout(totalDuration(list))
          setStatus('finished')
          eventsRef.current.onComplete?.()
          return
        }

        remaining = list[index].duration - overflow
        setPhaseIndex(index)
        lastSecondRef.current = null
        eventsRef.current.onPhaseChange?.(list[index], list[index + 1] ?? null)
      }

      const whole = Math.ceil(remaining)
      if (lastSecondRef.current !== whole && list[index]) {
        lastSecondRef.current = whole
        eventsRef.current.onSecond?.(remaining, list[index])
      }

      setPhaseRemaining(remaining)
      setElapsedInWorkout(Math.min(totalDuration(list), elapsed))
      rafRef.current = requestAnimationFrame(tick)
    },
    [stopLoop],
  )

  const startLoop = useCallback(() => {
    stopLoop()
    lastTickRef.current = null
    rafRef.current = requestAnimationFrame(tick)
  }, [stopLoop, tick])

  const start = useCallback(async () => {
    setStatus('running')
    setPhaseIndex(0)
    setPhaseRemaining(phases[0]?.duration ?? 0)
    setElapsedInWorkout(0)
    lastSecondRef.current = null
    startLoop()
    if (phases[0]) {
      eventsRef.current.onStart?.(phases[0], phases[1] ?? null)
    }
  }, [phases, startLoop])

  const pause = useCallback(() => {
    stopLoop()
    setStatus('paused')
  }, [stopLoop])

  const resume = useCallback(async () => {
    setStatus('running')
    startLoop()
  }, [startLoop])

  const reset = useCallback(() => {
    resetToIdle()
  }, [resetToIdle])

  useEffect(() => () => stopLoop(), [stopLoop])

  useEffect(() => {
    if (status !== 'running') return
    const onVisibility = () => {
      if (document.hidden) lastTickRef.current = null
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [status])

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
