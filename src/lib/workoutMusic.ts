import type { GeneralSettings, Phase, PhaseKind, WorkoutMusicTrack } from '../types'

export type WorkoutTrack = WorkoutMusicTrack

type MusicIntensity = 'off' | 'low' | 'high'

interface TrackProfile {
  label: string
  bpm: number
  swing: number
}

export const WORKOUT_TRACKS: Array<{ id: WorkoutTrack; label: string }> = [
  { id: 'pulse', label: 'PULSE 160' },
  { id: 'drive', label: 'DRIVE 140' },
  { id: 'storm', label: 'STORM 150' },
  { id: 'off', label: 'DESLIGADA' },
]

const PROFILES: Record<Exclude<WorkoutTrack, 'off'>, TrackProfile> = {
  pulse: { label: 'PULSE', bpm: 160, swing: 0 },
  drive: { label: 'DRIVE', bpm: 140, swing: 0.08 },
  storm: { label: 'STORM', bpm: 150, swing: 0.03 },
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
  if (!next.workoutMusic || next.workoutMusicTrack === 'off') {
    stopWorkoutMusic()
  }
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
  master.gain.setTargetAtTime(level, t, 0.04)
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
  if (level === 'high') return 0.2 * vol
  if (level === 'low') return 0.07 * vol
  return 0
}

function playKick(ctx: AudioContext, time: number, gain: GainNode): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, time)
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.12)
  g.gain.setValueAtTime(1, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.18)
  osc.connect(g)
  g.connect(gain)
  osc.start(time)
  osc.stop(time + 0.2)
}

function playSnare(ctx: AudioContext, time: number, gain: GainNode, bright: boolean): void {
  const size = Math.floor(ctx.sampleRate * 0.12)
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < size; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / size, 2.2)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = bright ? 2200 : 1400
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.55, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.12)
  noise.connect(filter)
  filter.connect(g)
  g.connect(gain)
  noise.start(time)
  noise.stop(time + 0.13)
}

function playHat(ctx: AudioContext, time: number, gain: GainNode, open: boolean): void {
  const size = Math.floor(ctx.sampleRate * (open ? 0.08 : 0.03))
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < size; i += 1) data[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 7000
  const g = ctx.createGain()
  g.gain.setValueAtTime(open ? 0.22 : 0.12, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + (open ? 0.08 : 0.03))
  noise.connect(filter)
  filter.connect(g)
  g.connect(gain)
  noise.start(time)
  noise.stop(time + (open ? 0.09 : 0.035))
}

function playBass(ctx: AudioContext, time: number, gain: GainNode, freq: number): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, time)
  g.gain.setValueAtTime(0.28, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.16)
  osc.connect(g)
  g.connect(gain)
  osc.start(time)
  osc.stop(time + 0.18)
}

function scheduleStep(ctx: AudioContext, time: number, currentStep: number): void {
  if (track === 'off' || intensity === 'off') return
  const profile = PROFILES[track]
  const dest = ensureMaster(ctx)
  const beat = currentStep % 16
  const swung =
    time + ((beat % 2 === 1 ? profile.swing : 0) * (60 / profile.bpm) * 0.25)

  // Four-on-the-floor / backbeat depending on track
  if (track === 'pulse') {
    if (beat % 4 === 0) playKick(ctx, swung, dest)
    if (beat === 4 || beat === 12) playSnare(ctx, swung, dest, true)
    if (beat % 2 === 0) playHat(ctx, swung, dest, beat % 8 === 6)
    if (beat % 8 === 0) playBass(ctx, swung, dest, beat % 16 === 0 ? 55 : 73)
  } else if (track === 'drive') {
    if (beat === 0 || beat === 6 || beat === 10) playKick(ctx, swung, dest)
    if (beat === 4 || beat === 12) playSnare(ctx, swung, dest, false)
    playHat(ctx, swung, dest, beat % 4 === 3)
    if (beat === 0 || beat === 8) playBass(ctx, swung, dest, beat === 0 ? 49 : 65)
  } else {
    // storm
    if (beat % 4 === 0 || beat === 6) playKick(ctx, swung, dest)
    if (beat === 4 || beat === 12) playSnare(ctx, swung, dest, true)
    if (beat % 2 === 1) playHat(ctx, swung, dest, false)
    if (beat % 4 === 0) playBass(ctx, swung, dest, beat % 8 === 0 ? 61 : 82)
  }
}

function scheduler(): void {
  const ctx = getCtx()
  if (!ctx || !running || track === 'off' || intensity === 'off') return
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
  if (blocked) {
    pauseWorkoutMusic()
  }
}

export function syncWorkoutMusic(phase: Phase | null, isRunning: boolean): void {
  if (!settings?.workoutMusic || settings.workoutMusicTrack === 'off' || !isRunning) {
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

/** Short preview from settings (must be called after unlockFeedback). */
export function previewWorkoutTrack(nextTrack: WorkoutTrack): void {
  if (nextTrack === 'off') {
    stopWorkoutMusic()
    return
  }
  track = nextTrack
  intensity = 'high'
  externalBlocked = false
  startScheduler()
  setMasterGain(targetGain('high'))
  window.setTimeout(() => {
    stopWorkoutMusic()
  }, 1800)
}

export function isWorkoutMusicAudible(): boolean {
  return Boolean(
    settings?.workoutMusic &&
      settings.workoutMusicTrack !== 'off' &&
      running &&
      intensity !== 'off' &&
      !externalBlocked,
  )
}
