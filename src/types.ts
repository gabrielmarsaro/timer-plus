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

/** Trilhas próprias do app (Web Audio) — só no Tabata. */
export type WorkoutMusicTrack = 'pulse' | 'drive' | 'storm'

export interface GeneralSettings {
  soundEffect: boolean
  soundType: 'censor' | 'beep' | 'bell'
  volume: number
  voiceAssistant: boolean
  voice: 'luciana' | 'sistema'
  ducking: boolean
  /** Nossa música Tabata (batidas do app). */
  workoutMusic: boolean
  workoutMusicTrack: WorkoutMusicTrack
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

/** Protocolo clássico Izumi Tabata: 20s esforço / 10s pausa × 8 = 4 min (+ preparar/cooldown). */
export const DEFAULT_SETTINGS: TabataSettings = {
  prepare: 10,
  work: 20,
  rest: 10,
  rounds: 8,
  cycles: 1,
  cycleRest: 60,
  cooldown: 20,
}

/** Preset clássico (útil no editor). */
export const CLASSIC_TABATA_PRESET: TabataSettings = { ...DEFAULT_SETTINGS }

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
  workoutMusic: true,
  workoutMusicTrack: 'pulse',
  ticking: true,
  vibration: true,
  flashlight: false,
  screenFlash: true,
  rotation: true,
  lightColors: false,
  timeFormat: 'mmss',
}

/** Timer Viking — ouro no esforço, gelo no descanso (tons limpos). */
export const PHASE_COLORS: Record<PhaseKind, string> = {
  prepare: '#E6D7B0',
  work: '#F0B429',
  rest: '#4EC4D9',
  cycleRest: '#E0703A',
  cooldown: '#8B9AE8',
  done: '#14181F',
}

export const PHASE_LABELS: Record<PhaseKind, string> = {
  prepare: 'PREPARAR',
  work: 'EXERCÍCIO',
  rest: 'DESCANSO',
  cycleRest: 'DESCANSO CICLO',
  cooldown: 'COOLDOWN',
  done: 'CONCLUÍDO',
}
