export type PhaseKind = 'prepare' | 'work' | 'rest' | 'cycleRest' | 'cooldown' | 'done'

export type Tab = 'tabata' | 'rounds' | 'stopwatch' | 'more'

export interface TabataSettings {
  prepare: number
  work: number
  rest: number
  rounds: number
  cycles: number
  cycleRest: number
  cooldown: number
}

export interface Phase {
  kind: PhaseKind
  label: string
  duration: number
  color: string
  round?: number
  cycle?: number
}

export const DEFAULT_SETTINGS: TabataSettings = {
  prepare: 10,
  work: 900,
  rest: 10,
  rounds: 3,
  cycles: 1,
  cycleRest: 0,
  cooldown: 0,
}

export const PHASE_COLORS: Record<PhaseKind, string> = {
  prepare: '#f5e600',
  work: '#9dff4a',
  rest: '#4ad2ff',
  cycleRest: '#ff9f4a',
  cooldown: '#c08cff',
  done: '#222222',
}

export const PHASE_LABELS: Record<PhaseKind, string> = {
  prepare: 'PREPARAR',
  work: 'EXERCÍCIO',
  rest: 'DESCANSO',
  cycleRest: 'DESCANSO CICLO',
  cooldown: 'COOLDOWN',
  done: 'CONCLUÍDO',
}
