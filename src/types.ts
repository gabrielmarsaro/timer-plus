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

/** Timer de rondas estilo boxe/MMA */
export interface RoundsSettings {
  prepare: number
  round: number
  rest: number
  rounds: number
  warning: number
}

export interface GeneralSettings {
  soundEffect: boolean
  soundType: 'censor' | 'beep' | 'bell'
  volume: number
  voiceAssistant: boolean
  voice: 'luciana' | 'sistema'
  ducking: boolean
  ticking: boolean
  vibration: boolean
  flashlight: boolean
  screenFlash: boolean
  rotation: boolean
  lightColors: boolean
  timeFormat: 'mmss' | 'm_ss' | 'ss'
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

export const DEFAULT_ROUNDS_SETTINGS: RoundsSettings = {
  prepare: 15,
  round: 109,
  rest: 60,
  rounds: 4,
  warning: 10,
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  soundEffect: true,
  soundType: 'censor',
  volume: 0.85,
  voiceAssistant: true,
  voice: 'luciana',
  ducking: true,
  ticking: true,
  vibration: true,
  flashlight: false,
  screenFlash: true,
  rotation: true,
  lightColors: false,
  timeFormat: 'mmss',
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
