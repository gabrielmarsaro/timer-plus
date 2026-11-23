import type { GeneralSettings, Phase, PhaseKind, WorkoutMusicTrack } from '../types'

export type WorkoutTrack = WorkoutMusicTrack

/** Intensidade musical por fase do protocolo Tabata. */
type MusicFeel = 'off' | 'prepare' | 'work' | 'rest' | 'recover' | 'cooldown'

interface TrackProfile {
  label: string
  bpm: number
  swing: number
}

/** Trilhas próprias — batida muda em PREPARAR / EXERCÍCIO / DESCANSO / CICLO / COOLDOWN. */
export const WORKOUT_TRACKS: Array<{ id: WorkoutTrack; label: string }> = [
  { id: 'pulse', label: 'TABATA 160' },
  { id: 'drive', label: 'HIIT 140' },
  { id: 'storm', label: 'POWER 150' },
]

const PROFILES: Record<WorkoutTrack, TrackProfile> = {
  pulse: { label: 'TABATA', bpm: 160, swing: 0 },
  drive: { label: 'HIIT', bpm: 140, swing: 0.06 },
  storm: { label: 'POWER', bpm: 150, swing: 0.02 },
}

const AudioCtxCtor =
  typeof window !== 'undefined'
    ? window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined

let sharedCtx: AudioContext | null = null
let master: GainNode | null = null
let settings: GeneralSettings | null = null
let track: WorkoutTrack = 'pulse'
let feel: MusicFeel = 'off'
let running = false
let timerId = 0
let nextNoteTime = 0
let step = 0
let externalBlocked = false
let currentKind: PhaseKind | null = null
let lastCountdown = -1

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.12

export function configureWorkoutMusic(next: GeneralSettings): void {
  settings = next
  track = next.workoutMusicTrack
  if (!next.workoutMusic) stopWorkoutMusic()
}

export function bindWorkoutAudioContext(ctx: AudioContext): void {
  sharedCtx = ctx
}

function getCtx(): AudioContext | null {
  if (!AudioCtxCtor) return null
  if (!sharedCtx) {
    try {
      sharedCtx = new AudioCtxCtor()
    } catch {
      return null
    }
  }
  return sharedCtx
}

function ensureMaster(ctx: AudioContext): GainNode {
  if (!master || master.context !== ctx) {
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
  }
  return master
}

function setMasterGain(level: number, when = 0): void {
  const ctx = getCtx()
  if (!ctx || !master) return
  const t = Math.max(ctx.currentTime, when)
  master.gain.cancelScheduledValues(t)
  master.gain.setTargetAtTime(level, t, 0.045)
}

function feelForPhase(kind: PhaseKind | undefined): MusicFeel {
  if (!kind) return 'off'
  if (kind === 'work') return 'work'
  if (kind === 'rest') return 'rest'
  if (kind === 'cycleRest') return 'recover'
  if (kind === 'prepare') return 'prepare'
  if (kind === 'cooldown') return 'cooldown'
  return 'off'
}

function targetGain(level: MusicFeel): number {
  const vol = Math.max(0.05, settings?.volume ?? 0.8)
  switch (level) {
    case 'work':
      return 0.26 * vol
    case 'prepare':
      return 0.12 * vol
    case 'rest':
      return 0.1 * vol
    case 'recover':
      return 0.07 * vol
    case 'cooldown':
      return 0.06 * vol
    default:
      return 0
  }
}

function playKick(ctx: AudioContext, time: number, gain: GainNode, hard: boolean): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(hard ? 175 : 135, time)
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.14)
  g.gain.setValueAtTime(hard ? 1 : 0.7, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + (hard ? 0.2 : 0.14))
  osc.connect(g)
  g.connect(gain)
  osc.start(time)
  osc.stop(time + 0.22)
}

function playNoiseHit(
  ctx: AudioContext,
  time: number,
  gain: GainNode,
  opts: { dur: number; freq: number; vol: number; type: BiquadFilterType },
): void {
  const size = Math.floor(ctx.sampleRate * opts.dur)
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < size; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / size, 1.8)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = opts.type
  filter.frequency.value = opts.freq
  const g = ctx.createGain()
  g.gain.setValueAtTime(opts.vol, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + opts.dur)
  noise.connect(filter)
  filter.connect(g)
  g.connect(gain)
  noise.start(time)
  noise.stop(time + opts.dur + 0.01)
}

function playSnare(ctx: AudioContext, time: number, gain: GainNode): void {
  playNoiseHit(ctx, time, gain, { dur: 0.1, freq: 1800, vol: 0.48, type: 'bandpass' })
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(210, time)
  g.gain.setValueAtTime(0.2, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.07)
  osc.connect(g)
  g.connect(gain)
  osc.start(time)
  osc.stop(time + 0.08)
}

function playHat(ctx: AudioContext, time: number, gain: GainNode, open: boolean): void {
  playNoiseHit(ctx, time, gain, {
    dur: open ? 0.07 : 0.022,
    freq: 7600,
    vol: open ? 0.18 : 0.1,
    type: 'highpass',
  })
}

function playBass(ctx: AudioContext, time: number, gain: GainNode, freq: number): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(freq, time)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(400, time)
  filter.frequency.exponentialRampToValueAtTime(110, time + 0.16)
  g.gain.setValueAtTime(0.16, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.18)
  osc.connect(filter)
  filter.connect(g)
  g.connect(gain)
  osc.start(time)
  osc.stop(time + 0.2)
}

function playStab(ctx: AudioContext, time: number, gain: GainNode, freq: number, vol = 0.09): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(freq, time)
  g.gain.setValueAtTime(vol, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.1)
  osc.connect(g)
  g.connect(gain)
  osc.start(time)
  osc.stop(time + 0.11)
}

/** Cue de transição estilo Tabata Songs: GO / REST / RECOVER / etc. */
function playPhaseCue(kind: PhaseKind): void {
  const ctx = getCtx()
  if (!ctx) return
  const dest = ensureMaster(ctx)
  const now = ctx.currentTime + 0.02

  if (kind === 'work') {
    // GO — dois stabs ascendentes
    playKick(ctx, now, dest, true)
    playStab(ctx, now, dest, 330, 0.16)
    playStab(ctx, now + 0.09, dest, 440, 0.14)
    playSnare(ctx, now + 0.05, dest)
    return
  }
  if (kind === 'rest') {
    // REST / pausa — tom grave
    playKick(ctx, now, dest, false)
    playStab(ctx, now, dest, 165, 0.12)
    playStab(ctx, now + 0.12, dest, 130, 0.1)
    return
  }
  if (kind === 'cycleRest') {
    playKick(ctx, now, dest, false)
    playStab(ctx, now, dest, 110, 0.1)
    return
  }
  if (kind === 'prepare') {
    playHat(ctx, now, dest, true)
    playStab(ctx, now, dest, 260, 0.1)
    return
  }
  if (kind === 'cooldown') {
    playKick(ctx, now, dest, false)
    playBass(ctx, now, dest, 55)
  }
}

function playCountdownBeep(n: number): void {
  const ctx = getCtx()
  if (!ctx) return
  const dest = ensureMaster(ctx)
  const now = ctx.currentTime
  const freq = n === 1 ? 880 : n === 2 ? 740 : 660
  playStab(ctx, now, dest, freq, 0.14)
  if (n === 1) playKick(ctx, now, dest, true)
}

function scheduleStep(ctx: AudioContext, time: number, currentStep: number): void {
  if (feel === 'off') return
  const profile = PROFILES[track]
  const dest = ensureMaster(ctx)
  const beat = currentStep % 16
  const swung = time + ((beat % 2 === 1 ? profile.swing : 0) * (60 / profile.bpm) * 0.25)

  if (feel === 'work') {
    // Intervalo de exercício — full push
    if (beat % 4 === 0) playKick(ctx, swung, dest, beat === 0)
    if (beat === 4 || beat === 12) playSnare(ctx, swung, dest)
    playHat(ctx, swung, dest, beat % 8 === 6)
    if (beat % 8 === 0) playBass(ctx, swung, dest, beat % 16 === 0 ? 55 : 73)
    if (beat === 0 || beat === 8) playStab(ctx, swung, dest, beat === 0 ? 220 : 247)
    return
  }

  if (feel === 'rest') {
    // Pausa curta 10s — half-time, sem snare (respiro)
    if (beat === 0 || beat === 8) playKick(ctx, swung, dest, false)
    if (beat % 4 === 0) playHat(ctx, swung, dest, false)
    if (beat === 0) playBass(ctx, swung, dest, 49)
    return
  }

  if (feel === 'recover') {
    // Descanso entre ciclos — quase silêncio rítmico
    if (beat === 0) playKick(ctx, swung, dest, false)
    if (beat === 8) playHat(ctx, swung, dest, true)
    return
  }

  if (feel === 'prepare') {
    // Contagem pré-treino — metrônomo subindo
    if (beat % 4 === 0) playKick(ctx, swung, dest, beat === 0)
    if (beat % 2 === 0) playHat(ctx, swung, dest, beat % 8 === 6)
    if (beat === 12) playStab(ctx, swung, dest, 300, 0.08)
    return
  }

  if (feel === 'cooldown') {
    if (beat === 0 || beat === 8) playKick(ctx, swung, dest, false)
    if (beat === 0) playBass(ctx, swung, dest, 41)
    if (beat === 8) playHat(ctx, swung, dest, true)
  }
}

function scheduler(): void {
  const ctx = getCtx()
  if (!ctx || !running || feel === 'off') return
  if (externalBlocked) return
  const profile = PROFILES[track]
  const secondsPerStep = 60 / profile.bpm / 4

  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(ctx, nextNoteTime, step)
    nextNoteTime += secondsPerStep
    step = (step + 1) % 16
  }
}

function startScheduler(): void {
  const ctx = getCtx()
  if (!ctx) return
  ensureMaster(ctx)
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  if (!running) {
    running = true
    nextNoteTime = ctx.currentTime + 0.05
  }
  if (!timerId) {
    timerId = window.setInterval(scheduler, LOOKAHEAD_MS)
  }
  scheduler()
}

function stopScheduler(): void {
  running = false
  if (timerId) {
    window.clearInterval(timerId)
    timerId = 0
  }
}

export function stopWorkoutMusic(): void {
  stopScheduler()
  feel = 'off'
  currentKind = null
  lastCountdown = -1
  setMasterGain(0)
}

export function pauseWorkoutMusic(): void {
  stopScheduler()
  setMasterGain(0)
}

export function setExternalMusicBlocked(blocked: boolean): void {
  externalBlocked = blocked
  if (blocked) pauseWorkoutMusic()
}

/**
 * Sincroniza a trilha com a fase Tabata.
 * @param remainingSec — segundos restantes da fase (cues 3-2-1 no fim do intervalo)
 */
export function syncWorkoutMusic(
  phase: Phase | null,
  isRunning: boolean,
  remainingSec = 0,
): void {
  if (!settings?.workoutMusic || !isRunning) {
    stopWorkoutMusic()
    return
  }
  if (externalBlocked) {
    pauseWorkoutMusic()
    return
  }

  track = settings.workoutMusicTrack
  const nextFeel = feelForPhase(phase?.kind)
  feel = nextFeel

  if (nextFeel === 'off' || !phase) {
    stopWorkoutMusic()
    return
  }

  if (phase.kind !== currentKind) {
    currentKind = phase.kind
    step = 0
    lastCountdown = -1
    const ctx = getCtx()
    if (ctx) nextNoteTime = ctx.currentTime + 0.03
    playPhaseCue(phase.kind)
  }

  const whole = Math.ceil(remainingSec)
  // Countdown musical nos últimos 3s de cada intervalo (exceto prepare curto já coberto)
  if (whole >= 1 && whole <= 3 && whole !== lastCountdown) {
    lastCountdown = whole
    playCountdownBeep(whole)
  }
  if (whole > 3) lastCountdown = -1

  startScheduler()
  setMasterGain(targetGain(nextFeel))
}

export function previewWorkoutTrack(nextTrack: WorkoutTrack): void {
  track = nextTrack
  feel = 'work'
  currentKind = 'work'
  lastCountdown = -1
  externalBlocked = false
  step = 0
  playPhaseCue('work')
  startScheduler()
  setMasterGain(targetGain('work'))
  window.setTimeout(() => {
    // Mini demo: GO → rest feel
    feel = 'rest'
    playPhaseCue('rest')
    setMasterGain(targetGain('rest'))
  }, 1200)
  window.setTimeout(() => {
    stopWorkoutMusic()
  }, 2400)
}

export function isWorkoutMusicAudible(): boolean {
  return Boolean(settings?.workoutMusic && running && feel !== 'off' && !externalBlocked)
}
