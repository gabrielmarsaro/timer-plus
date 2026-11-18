import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playBeep, unlockAudio } from '../lib/beep'
import { buildPhases, totalDuration } from '../lib/buildPhases'
import type { Phase, TabataSettings } from '../types'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

interface UseTabataTimerResult {
  status: TimerStatus
  phases: Phase[]
  currentPhase: Phase | null
  nextPhase: Phase | null
  phaseRemaining: number
  totalRemaining: number
  roundsLeft: number
  cyclesLeft: number
  start: () => Promise<void>
  pause: () => void
  resume: () => Promise<void>
  reset: () => void
}

export function useTabataTimer(settings: TabataSettings): UseTabataTimerResult {
  const phases = useMemo(() => buildPhases(settings), [settings])
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

  statusRef.current = status
  phaseIndexRef.current = phaseIndex
  phaseRemainingRef.current = phaseRemaining
  elapsedRef.current = elapsedInWorkout

  const currentPhase = phases[phaseIndex] ?? null
  const nextPhase = phases[phaseIndex + 1] ?? null
  const workoutTotal = useMemo(() => totalDuration(phases), [phases])
  const totalRemaining = Math.max(0, workoutTotal - elapsedInWorkout)

  const roundsLeft = useMemo(() => {
    if (!currentPhase || status === 'finished') return 0
    const cycle = currentPhase.cycle ?? settings.cycles
    const round = currentPhase.round ?? settings.rounds
    const remainingInCycle = settings.rounds - round + 1
    const futureCycles = Math.max(0, settings.cycles - cycle)
    return remainingInCycle + futureCycles * settings.rounds
  }, [currentPhase, settings.cycles, settings.rounds, status])

  const cyclesLeft = useMemo(() => {
    if (!currentPhase || status === 'finished') return 0
    return settings.cycles - (currentPhase.cycle ?? 1) + 1
  }, [currentPhase, settings.cycles, status])

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
        const finishedPhase = phases[index]
        if (!finishedPhase) break

        elapsed = Math.min(
          totalDuration(phases),
          elapsedRef.current + finishedPhase.duration - phaseRemainingRef.current + overflow,
        )

        index += 1
        if (index >= phases.length) {
          stopLoop()
          setPhaseIndex(phases.length - 1)
          setPhaseRemaining(0)
          setElapsedInWorkout(totalDuration(phases))
          setStatus('finished')
          playBeep('done')
          return
        }

        playBeep('phase')
        remaining = phases[index].duration - overflow
        setPhaseIndex(index)
      }

      setPhaseRemaining(remaining)
      setElapsedInWorkout(Math.min(totalDuration(phases), elapsed))
      rafRef.current = requestAnimationFrame(tick)
    },
    [phases, stopLoop],
  )

  const startLoop = useCallback(() => {
    stopLoop()
    lastTickRef.current = null
    rafRef.current = requestAnimationFrame(tick)
  }, [stopLoop, tick])

  const start = useCallback(async () => {
    await unlockAudio()
    playBeep('phase')
    setStatus('running')
    setPhaseIndex(0)
    setPhaseRemaining(phases[0]?.duration ?? 0)
    setElapsedInWorkout(0)
    startLoop()
  }, [phases, startLoop])

  const pause = useCallback(() => {
    stopLoop()
    setStatus('paused')
  }, [stopLoop])

  const resume = useCallback(async () => {
    await unlockAudio()
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
      if (document.hidden) {
        lastTickRef.current = null
      }
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
    roundsLeft: status === 'idle' ? settings.rounds * settings.cycles : roundsLeft,
    cyclesLeft: status === 'idle' ? settings.cycles : cyclesLeft,
    start,
    pause,
    resume,
    reset,
  }
}
