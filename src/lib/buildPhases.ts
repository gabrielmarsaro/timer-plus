import {
  PHASE_COLORS,
  PHASE_LABELS,
  type Phase,
  type RoundsSettings,
  type TabataSettings,
} from '../types'

export function buildPhases(settings: TabataSettings): Phase[] {
  const phases: Phase[] = []

  if (settings.prepare > 0) {
    phases.push({
      kind: 'prepare',
      label: PHASE_LABELS.prepare,
      duration: settings.prepare,
      color: PHASE_COLORS.prepare,
    })
  }

  for (let cycle = 1; cycle <= settings.cycles; cycle += 1) {
    for (let round = 1; round <= settings.rounds; round += 1) {
      phases.push({
        kind: 'work',
        label: PHASE_LABELS.work,
        duration: settings.work,
        color: PHASE_COLORS.work,
        round,
        cycle,
      })

      const isLastRound = round === settings.rounds
      const isLastCycle = cycle === settings.cycles

      if (!isLastRound && settings.rest > 0) {
        phases.push({
          kind: 'rest',
          label: PHASE_LABELS.rest,
          duration: settings.rest,
          color: PHASE_COLORS.rest,
          round,
          cycle,
        })
      }

      if (isLastRound && !isLastCycle && settings.cycleRest > 0) {
        phases.push({
          kind: 'cycleRest',
          label: PHASE_LABELS.cycleRest,
          duration: settings.cycleRest,
          color: PHASE_COLORS.cycleRest,
          round,
          cycle,
        })
      }
    }
  }

  if (settings.cooldown > 0) {
    phases.push({
      kind: 'cooldown',
      label: PHASE_LABELS.cooldown,
      duration: settings.cooldown,
      color: PHASE_COLORS.cooldown,
    })
  }

  return phases
}

/** Rondas estilo boxe: preparar → [ronda → descanso] × N */
export function buildRoundsPhases(settings: RoundsSettings): Phase[] {
  const phases: Phase[] = []

  if (settings.prepare > 0) {
    phases.push({
      kind: 'prepare',
      label: PHASE_LABELS.prepare,
      duration: settings.prepare,
      color: PHASE_COLORS.prepare,
    })
  }

  for (let round = 1; round <= settings.rounds; round += 1) {
    phases.push({
      kind: 'work',
      label: PHASE_LABELS.work,
      duration: settings.round,
      color: PHASE_COLORS.work,
      round,
      cycle: 1,
    })

    if (round < settings.rounds && settings.rest > 0) {
      phases.push({
        kind: 'rest',
        label: PHASE_LABELS.rest,
        duration: settings.rest,
        color: PHASE_COLORS.rest,
        round,
        cycle: 1,
      })
    }
  }

  return phases
}

export function totalDuration(phases: Phase[]): number {
  return phases.reduce((sum, phase) => sum + phase.duration, 0)
}
