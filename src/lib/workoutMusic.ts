import type { GeneralSettings, Phase, PhaseKind, WorkoutMusicTrack } from '../types'

export type WorkoutTrack = WorkoutMusicTrack

type MusicIntensity = 'off' | 'low' | 'high'

interface TrackProfile {
  label: string
  bpm: number
  swing: number
}

/** Trilhas próprias do Timer Plus — geradas no aparelho (Web Audio). */
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
let intensity: MusicIntensity = 'off'
let running = false
let timerId = 0
let nextNoteTime = 0
let step = 0
let externalBlocked = false

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
  master.gain.setTargetAtTime(level, t, 0.05)
}

function intensityForPhase(kind: PhaseKind | undefined): MusicIntensity {
  if (!kind) return 'off'
  if (kind === 'work') return 'high'
  if (kind === 'prepare' || kind === 'rest' || kind === 'cycleRest' || kind === 'cooldown') {
    return 'low'
  }
  return 'off'
}

function targetGain(level: MusicIntensity): number {
  const vol = Math.max(0.05, settings?.volume ?? 0.8)
  if (level === 'high') return 0.24 * vol
  if (level === 'low') return 0.08 * vol
  return 0
}

function playKick(ctx: AudioContext, time: number, gain: GainNode, hard: boolean): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(hard ? 170 : 140, time)
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.14)
  g.gain.setValueAtTime(hard ? 1 : 0.75, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + (hard ? 0.2 : 0.15))
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
  playNoiseHit(ctx, time, gain, { dur: 0.11, freq: 1800, vol: 0.5, type: 'bandpass' })
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(220, time)
  g.gain.setValueAtTime(0.22, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.08)
  osc.connect(g)
  g.connect(gain)
  osc.start(time)
  osc.stop(time + 0.09)
}

function playHat(ctx: AudioContext, time: number, gain: GainNode, open: boolean): void {
  playNoiseHit(ctx, time, gain, {
    dur: open ? 0.07 : 0.025,
    freq: 7500,
    vol: open ? 0.2 : 0.11,
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
  filter.frequency.setValueAtTime(420, time)
  filter.frequency.exponentialRampToValueAtTime(120, time + 0.18)
  g.gain.setValueAtTime(0.18, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.2)
  osc.connect(filter)
  filter.connect(g)
  g.connect(gain)
  osc.start(time)
  osc.stop(time + 0.22)
}

function playStab(ctx: AudioContext, time: number, gain: GainNode, freq: number): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(freq, time)
  g.gain.setValueAtTime(0.08, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.09)
  osc.connect(g)
  g.connect(gain)
  osc.start(time)
  osc.stop(time + 0.1)
}

function scheduleStep(ctx: AudioContext, time: number, currentStep: number): void {
  if (intensity === 'off') return
  const profile = PROFILES[track]
  const dest = ensureMaster(ctx)
  const beat = currentStep % 16
  const swung = time + ((beat % 2 === 1 ? profile.swing : 0) * (60 / profile.bpm) * 0.25)
  const work = intensity === 'high'

  if (track === 'pulse') {
    // Classic Tabata four-on-the-floor @ 160
    if (beat % 4 === 0) playKick(ctx, swung, dest, work && beat === 0)
    if (beat === 4 || beat === 12) playSnare(ctx, swung, dest)
    if (work || beat % 2 === 0) playHat(ctx, swung, dest, beat % 8 === 6)
    if (beat % 8 === 0) playBass(ctx, swung, dest, beat % 16 === 0 ? 55 : 73)
    if (work && (beat === 0 || beat === 8)) playStab(ctx, swung, dest, beat === 0 ? 220 : 247)
  } else if (track === 'drive') {
    if (beat === 0 || beat === 6 || beat === 10) playKick(ctx, swung, dest, beat === 0)
    if (beat === 4 || beat === 12) playSnare(ctx, swung, dest)
    playHat(ctx, swung, dest, work && beat % 4 === 3)
    if (beat === 0 || beat === 8) playBass(ctx, swung, dest, beat === 0 ? 49 : 65)
    if (work && beat % 4 === 2) playStab(ctx, swung, dest, 165)
  } else {
    // storm / power
    if (beat % 4 === 0 || (work && beat === 6)) playKick(ctx, swung, dest, beat % 8 === 0)
    if (beat === 4 || beat === 12) playSnare(ctx, swung, dest)
    if (beat % 2 === 1 || work) playHat(ctx, swung, dest, false)
    if (beat % 4 === 0) playBass(ctx, swung, dest, beat % 8 === 0 ? 61 : 82)
    if (work && beat === 0) playStab(ctx, swung, dest, 277)
  }
}

function scheduler(): void {
  const ctx = getCtx()
  if (!ctx || !running || intensity === 'off') return
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
    step = 0
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
  intensity = 'off'
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

/** Só chama quando o Tabata está a correr. */
export function syncWorkoutMusic(phase: Phase | null, isRunning: boolean): void {
  if (!settings?.workoutMusic || !isRunning) {
    stopWorkoutMusic()
    return
  }
  if (externalBlocked) {
    pauseWorkoutMusic()
    return
  }

  track = settings.workoutMusicTrack
  const next = intensityForPhase(phase?.kind)
  intensity = next
  if (next === 'off') {
    stopWorkoutMusic()
    return
  }

  startScheduler()
  setMasterGain(targetGain(next))
}

export function previewWorkoutTrack(nextTrack: WorkoutTrack): void {
  track = nextTrack
  intensity = 'high'
  externalBlocked = false
  startScheduler()
  setMasterGain(targetGain('high'))
  window.setTimeout(() => {
    stopWorkoutMusic()
  }, 2000)
}

export function isWorkoutMusicAudible(): boolean {
  return Boolean(
    settings?.workoutMusic && running && intensity !== 'off' && !externalBlocked,
  )
}
