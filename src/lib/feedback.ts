import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { GeneralSettings, Phase } from '../types'
import {
  bindWorkoutAudioContext,
  configureWorkoutMusic,
  isWorkoutMusicAudible,
  setExternalMusicBlocked,
  stopWorkoutMusic,
} from './workoutMusic'

type SoundKind = 'tick' | 'phase' | 'done' | 'warning' | 'preview'
type SessionType = 'auto' | 'ambient' | 'transient' | 'playback'

let audioCtx: AudioContext | null = null
let settings: GeneralSettings | null = null
let lastSpoken = ''
let torchTrack: MediaStreamTrack | null = null
let unlocked = false
let htmlAlert: HTMLAudioElement | null = null
let htmlTick: HTMLAudioElement | null = null
let speakChain: Promise<void> = Promise.resolve()
let externalMusic = false
let mediaWatchBound = false

const AudioCtxCtor =
  typeof window !== 'undefined'
    ? window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined

export function isAppleTouchWeb(): boolean {
  if (typeof navigator === 'undefined') return false
  if (Capacitor.isNativePlatform()) return false
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function configureFeedback(next: GeneralSettings): void {
  settings = next
  configureWorkoutMusic(next)
}

function getCtx(): AudioContext | null {
  if (!AudioCtxCtor) return null
  if (!audioCtx) {
    try {
      audioCtx = new AudioCtxCtor()
      bindMediaWatch(audioCtx)
      bindWorkoutAudioContext(audioCtx)
    } catch {
      return null
    }
  }
  return audioCtx
}

function bindMediaWatch(ctx: AudioContext): void {
  if (mediaWatchBound) return
  mediaWatchBound = true
  ctx.addEventListener('statechange', () => {
    const state = ctx.state as string
    if (state === 'interrupted') {
      externalMusic = true
      setExternalMusicBlocked(Boolean(settings?.ducking))
      return
    }
    if (state === 'running' && document.visibilityState === 'visible') {
      // Other music often keeps us interrupted/suspended; running again → clear.
      externalMusic = false
      setExternalMusicBlocked(false)
    }
  })
}

/** Build a short real tick/beep WAV (done once, lazily). */
function buildToneDataUri(freq: number, ms: number, volumeLevel = 0.4): string {
  const sampleRate = 22050
  const samples = Math.max(1, Math.floor((sampleRate * ms) / 1000))
  const data = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(data)
  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate
    const env = Math.min(1, i / 120) * Math.min(1, (samples - i) / 250)
    const sample = Math.sin(2 * Math.PI * freq * t) * env * volumeLevel
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true)
  }
  const bytes = new Uint8Array(data)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
  return `data:audio/wav;base64,${btoa(binary)}`
}

function getHtmlAlert(): HTMLAudioElement {
  if (!htmlAlert) {
    htmlAlert = new Audio(buildToneDataUri(880, 90, 0.45))
    htmlAlert.preload = 'auto'
    htmlAlert.setAttribute('playsinline', 'true')
  }
  return htmlAlert
}

function getHtmlTick(): HTMLAudioElement {
  if (!htmlTick) {
    htmlTick = new Audio(buildToneDataUri(1350, 35, 0.28))
    htmlTick.preload = 'auto'
    htmlTick.setAttribute('playsinline', 'true')
  }
  return htmlTick
}

function playHtml(audio: HTMLAudioElement, volumeLevel: number): void {
  try {
    audio.volume = Math.max(0.05, Math.min(1, volumeLevel))
    audio.currentTime = 0
    void audio.play().catch(() => undefined)
  } catch {
    // ignore
  }
}

function setAudioSession(type: SessionType): void {
  try {
    const session = (
      navigator as Navigator & { audioSession?: { type: string } }
    ).audioSession
    if (session) session.type = type
  } catch {
    // ignore — unsupported browsers
  }
}

/**
 * Best-effort: other music apps (Spotify/Deezer/YouTube) holding audio focus.
 * Web cannot read other apps directly; we use AudioContext interruption +
 * suspended-while-visible after a resume attempt.
 */
export function refreshExternalMusicState(): boolean {
  if (!unlocked) return externalMusic
  const ctx = getCtx()
  if (!ctx) return externalMusic

  const state = ctx.state as string
  if (state === 'interrupted') {
    externalMusic = true
    setExternalMusicBlocked(Boolean(settings?.ducking))
    return true
  }

  if (state === 'suspended' && document.visibilityState === 'visible') {
    void ctx.resume().then(() => {
      const next = ctx.state as string
      if (next === 'suspended' || next === 'interrupted') {
        externalMusic = true
        setExternalMusicBlocked(Boolean(settings?.ducking))
      } else if (next === 'running') {
        externalMusic = false
        setExternalMusicBlocked(false)
      }
    }).catch(() => {
      externalMusic = true
      setExternalMusicBlocked(Boolean(settings?.ducking))
    })
  }

  setExternalMusicBlocked(externalMusic && Boolean(settings?.ducking))
  return externalMusic
}

function shouldSilenceAmbient(): boolean {
  // "Ducking" setting = respect background music (mute ticks / chatter).
  if (!settings?.ducking) return false
  return refreshExternalMusicState()
}

/**
 * Unlock audio inside a user gesture. Must NOT await from the UI.
 */
export function unlockFeedback(): void {
  setAudioSession('ambient')
  const ctx = getCtx()
  if (ctx) {
    try {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
      const source = ctx.createBufferSource()
      const gain = ctx.createGain()
      gain.gain.value = 0.0001
      source.buffer = buffer
      source.connect(gain)
      gain.connect(ctx.destination)
      source.start(0)
    } catch {
      // ignore
    }
  }

  try {
    const tick = getHtmlTick()
    const alert = getHtmlAlert()
    tick.volume = 0.01
    alert.volume = 0.01
    void tick.play().then(() => {
      try {
        tick.pause()
        tick.currentTime = 0
      } catch {
        // ignore
      }
    }).catch(() => undefined)
    void alert.play().then(() => {
      try {
        alert.pause()
        alert.currentTime = 0
      } catch {
        // ignore
      }
    }).catch(() => undefined)
  } catch {
    // ignore
  }

  try {
    window.speechSynthesis?.getVoices?.()
  } catch {
    // ignore
  }

  unlocked = true
  refreshExternalMusicState()
}

export function ensureAudioReady(): void {
  if (!unlocked) return
  const ctx = getCtx()
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined)
  refreshExternalMusicState()
}

function volume(): number {
  const base = Math.max(0.05, settings?.volume ?? 0.75)
  return isAppleTouchWeb() ? Math.min(1, base * 1.25) : base
}

async function vibrate(kind: SoundKind): Promise<void> {
  if (!settings?.vibration) return
  if (kind === 'tick' && shouldSilenceAmbient()) return

  const pattern =
    kind === 'done' ? [40, 60, 80] : kind === 'warning' ? [30, 40, 30] : kind === 'tick' ? [12] : [35]

  try {
    if (Capacitor.isNativePlatform()) {
      if (kind === 'done') {
        await Haptics.notification({ type: NotificationType.Success })
        return
      }
      await Haptics.impact({
        style: kind === 'tick' ? ImpactStyle.Light : ImpactStyle.Medium,
      })
      return
    }
  } catch {
    // fall through
  }

  try {
    navigator.vibrate?.(pattern)
  } catch {
    // ignore
  }
}

function tone(
  freqs: number[],
  duration: number,
  type: OscillatorType,
  gainLevel: number,
): void {
  try {
    const ctx = getCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)

    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = gainLevel
    master.connect(ctx.destination)

    freqs.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(1, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      osc.connect(gain)
      gain.connect(master)
      osc.start(now + index * 0.02)
      osc.stop(now + duration + 0.03)
    })
  } catch {
    // ignore
  }
}

function playSound(kind: SoundKind): void {
  if (!settings) return
  if (kind === 'tick' && !settings.ticking) return
  if (kind !== 'tick' && !settings.soundEffect && kind !== 'preview') return

  // With background music: keep only start/end (and warning) alerts — no ticks.
  if (kind === 'tick' && shouldSilenceAmbient()) return
  // Our Tabata beat already fills the work phase — skip competing ticks.
  if (kind === 'tick' && isWorkoutMusicAudible()) return

  const vol = volume()
  const soundType = settings.soundType

  if (kind === 'tick') {
    setAudioSession('ambient')
    playHtml(getHtmlTick(), vol * 0.55)
    tone([1200], 0.035, 'square', vol * 0.1)
    return
  }

  // Alerts (start/end/warning) use transient session so they still cut through music.
  setAudioSession('transient')
  playHtml(getHtmlAlert(), vol * (kind === 'done' ? 1 : 0.85))

  try {
    if (soundType === 'bell') {
      if (kind === 'done') tone([523, 659, 784], 0.55, 'sine', vol * 0.28)
      else if (kind === 'warning') tone([880, 660], 0.28, 'sine', vol * 0.26)
      else tone([784, 988], 0.28, 'sine', vol * 0.26)
      return
    }

    if (soundType === 'censor') {
      if (kind === 'done') tone([180, 140], 0.5, 'sawtooth', vol * 0.24)
      else if (kind === 'warning') tone([220], 0.22, 'sawtooth', vol * 0.22)
      else tone([160], 0.2, 'sawtooth', vol * 0.22)
      return
    }

    if (kind === 'done') tone([880, 1175], 0.45, 'square', vol * 0.2)
    else if (kind === 'warning') tone([990], 0.18, 'square', vol * 0.2)
    else tone([760], 0.16, 'square', vol * 0.2)
  } catch {
    // ignore
  } finally {
    // Return to ambient so ticks can be auto-silenced by the OS when music plays.
    window.setTimeout(() => setAudioSession('ambient'), 700)
  }
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  const pt = voices.filter((voice) => /pt(-|_)?BR|Portuguese/i.test(`${voice.lang} ${voice.name}`))
  const pool = pt.length ? pt : voices

  if (settings?.voice === 'luciana') {
    return (
      pool.find((voice) => /luciana|maria|francisca|female|mulher/i.test(voice.name)) ??
      pool[0] ??
      null
    )
  }

  return pool.find((voice) => /pt(-|_)?BR/i.test(voice.lang)) ?? pool[0] ?? null
}

export function speak(text: string, force = false): void {
  if (!settings?.voiceAssistant && !force) return
  if (!('speechSynthesis' in window)) return

  const normalized = text.trim()
  if (!normalized) return
  if (!force && normalized === lastSpoken) return
  lastSpoken = normalized

  const utter = new SpeechSynthesisUtterance(normalized)
  utter.lang = 'pt-BR'
  utter.rate = isAppleTouchWeb() ? 1 : 1.05
  utter.pitch = settings?.voice === 'luciana' ? 1.05 : 1
  utter.volume = Math.max(0.6, volume())
  const voice = pickVoice()
  if (voice) utter.voice = voice

  speakChain = speakChain
    .catch(() => undefined)
    .then(
      () =>
        new Promise<void>((resolve) => {
          const done = () => resolve()
          utter.onend = done
          utter.onerror = done
          try {
            if (!isAppleTouchWeb()) {
              try {
                window.speechSynthesis.cancel()
              } catch {
                // ignore
              }
            }
            window.speechSynthesis.resume?.()
            window.speechSynthesis.speak(utter)
          } catch {
            done()
          }
          window.setTimeout(done, Math.max(2500, normalized.length * 180))
        }),
    )
}

export function previewSound(): void {
  unlockFeedback()
  void vibrate('phase')
  const previous = settings
  if (previous) {
    const enabled = { ...previous, soundEffect: true }
    settings = enabled
    playSound('phase')
    settings = previous
  } else {
    playSound('phase')
  }
}

export function previewVoice(): void {
  unlockFeedback()
  speak('Preparar. Exercício. Descanso.', true)
}

export async function setTorch(enabled: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  if (!enabled) {
    try {
      torchTrack?.stop()
    } catch {
      // ignore
    }
    torchTrack = null
    return
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    })
    const track = stream.getVideoTracks()[0]
    const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined
    if (!capabilities?.torch) {
      track.stop()
      return
    }
    await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] })
    torchTrack = track
  } catch {
    torchTrack = null
  }
}

export async function pulseTorch(): Promise<void> {
  if (!settings?.flashlight) return
  if (!Capacitor.isNativePlatform()) return
  await setTorch(true)
  window.setTimeout(() => {
    void setTorch(false)
  }, 220)
}

export function announcePhase(phase: Phase | null, next?: Phase | null): void {
  if (!phase) return
  ensureAudioReady()
  void vibrate('phase')
  playSound('phase')

  // Voice for phase start/end alerts always (even with music) — user asked for start/end alerts.
  const label = phase.label.toLowerCase()
  if (phase.kind === 'work' && phase.round) {
    speak(`${label}. Ronda ${phase.round}`)
  } else {
    speak(label)
  }

  if (next && !shouldSilenceAmbient()) {
    window.setTimeout(() => {
      speak(`Em seguida, ${next.label.toLowerCase()}`)
    }, 1100)
  }
}

export function announceDone(): void {
  ensureAudioReady()
  stopWorkoutMusic()
  void vibrate('done')
  playSound('done')
  speak('Treino concluído')
  void pulseTorch()
}

export function onCountdownSecond(remaining: number, phase: Phase | null, warning = 0): void {
  if (!phase) return
  const whole = Math.ceil(remaining)
  ensureAudioReady()

  // External YouTube/Spotify: hush ticks when ducking detects other audio.
  const hush = shouldSilenceAmbient()

  if (settings?.ticking && whole > 0 && !hush) {
    playSound('tick')
    void vibrate('tick')
  }

  if (warning > 0 && whole === warning) {
    playSound('warning')
    void vibrate('warning')
    speak(`${warning} segundos`)
  }

  // Countdown chatter stays off while music plays — only start/end alerts remain.
  if (!hush && whole <= 3 && whole >= 1) {
    speak(String(whole))
  }
}

export function feedbackPhaseStart(phase: Phase | null, next?: Phase | null): void {
  announcePhase(phase, next)
  void pulseTorch()
}
