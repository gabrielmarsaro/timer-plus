import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { GeneralSettings, Phase } from '../types'
import {
  isNativeAudioDuckAvailable,
  nativeBeep,
  nativeSpeak,
} from '../plugins/audioDuck'
import {
  bindWorkoutAudioContext,
  configureWorkoutMusic,
  isWorkoutMusicAudible,
  isWorkoutMusicSessionActive,
  setExternalMusicBlocked,
  stopWorkoutMusic,
} from './workoutMusic'

type SoundKind = 'tick' | 'phase' | 'done' | 'warning' | 'preview'
type SessionType = 'auto' | 'ambient' | 'transient' | 'transient-solo' | 'playback'

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

/** Config “Respeitar música” — não roubar o foco do Spotify/etc. */
export function respectsExternalMusic(): boolean {
  return Boolean(settings?.ducking)
}

/**
 * Best-effort: other music apps holding audio focus.
 * Never create/resume AudioContext just to probe — that pauses Spotify.
 */
export function refreshExternalMusicState(): boolean {
  if (!unlocked) return externalMusic
  // Use existing ctx only — constructing AudioContext can steal focus on Android.
  const ctx = audioCtx
  if (!ctx) {
    setExternalMusicBlocked(false)
    return externalMusic
  }

  const state = ctx.state as string
  if (state === 'interrupted') {
    externalMusic = true
    setExternalMusicBlocked(respectsExternalMusic())
    return true
  }

  if (respectsExternalMusic()) {
    // Suspended while visible usually means another app owns audio. Do not resume.
    if (state === 'suspended' && document.visibilityState === 'visible') {
      externalMusic = true
      setExternalMusicBlocked(true)
      return true
    }
    setExternalMusicBlocked(externalMusic)
    return externalMusic
  }

  if (state === 'suspended' && document.visibilityState === 'visible') {
    void ctx.resume().then(() => {
      const next = ctx.state as string
      if (next === 'suspended' || next === 'interrupted') {
        externalMusic = true
        setExternalMusicBlocked(false)
      } else if (next === 'running') {
        externalMusic = false
        setExternalMusicBlocked(false)
      }
    }).catch(() => {
      externalMusic = true
    })
  }

  setExternalMusicBlocked(false)
  return externalMusic
}

function shouldSilenceAmbient(): boolean {
  // "Ducking" setting = respect background music (mute ticks / chatter).
  if (!respectsExternalMusic()) return false
  return refreshExternalMusicState()
}

/** Prime Web Audio inside a user gesture without HTMLAudio / speech / exclusive session. */
function unlockWebAudioOnly(): void {
  const ctx = getCtx()
  if (!ctx) return
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

/**
 * Unlock audio inside a user gesture. Must NOT await from the UI.
 * With “Respeitar música”: unlock Web Audio only (for later 3-2-1 / phase cues).
 * Skip HTMLAudio + speechSynthesis + audioSession claim (those pause Spotify on Safari).
 */
export function unlockFeedback(): void {
  if (respectsExternalMusic()) {
    unlocked = true
    // Hush continuous ticks / Tabata BGM while Spotify may be playing.
    externalMusic = true
    setExternalMusicBlocked(true)
    // Still unlock Web Audio so 3-2-1 / phase beeps can play (transient duck).
    unlockWebAudioOnly()
    return
  }

  setAudioSession('ambient')
  unlockWebAudioOnly()

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

/**
 * Keep Web Audio awake for ducked cues. Never claim exclusive session on focus.
 */
export function ensureAudioReady(): void {
  if (!unlocked) return
  if (respectsExternalMusic()) {
    refreshExternalMusicState()
    if (audioCtx?.state === 'suspended') void audioCtx.resume().catch(() => undefined)
    return
  }
  const ctx = getCtx()
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined)
  refreshExternalMusicState()
}

/** Resume Web Audio; returns a promise so tones start after unlock. */
function resumeForAlert(): Promise<AudioContext | null> {
  const ctx = getCtx()
  if (!ctx) return Promise.resolve(null)
  if (ctx.state !== 'suspended') return Promise.resolve(ctx)
  return ctx
    .resume()
    .then(() => ctx)
    .catch(() => ctx)
}

/**
 * Safari + Respeitar música.
 * Never use `playback` here — it pauses Spotify and often never gives it back.
 * Use `transient` (notification): plays over / ducks other audio; then release to
 * `auto` so Now Playing / Spotify can continue (playback permanently steals focus).
 * Note: with the hardware mute switch ON, iOS may silence transient Web Audio —
 * screen flash + vibration still signal the countdown.
 */
let safariCueReleaseTimer = 0

function releaseSafariCueSession(): void {
  setAudioSession('auto')
  try {
    void audioCtx?.suspend?.()
  } catch {
    // ignore
  }
}

function runSafariAudibleCue(durationMs: number, play: () => void): void {
  // Notification-style session: should duck/mix rather than steal Spotify forever.
  setAudioSession('transient')
  void resumeForAlert().then((ctx) => {
    if (ctx?.state === 'suspended') {
      void ctx.resume().catch(() => undefined)
    }
    try {
      play()
    } catch {
      // ignore
    }
    // Debounce across 3-2-1 so we only release once after the last cue.
    window.clearTimeout(safariCueReleaseTimer)
    safariCueReleaseTimer = window.setTimeout(() => {
      releaseSafariCueSession()
    }, Math.max(400, durationMs) + 280)
  })
}

/** Web Audio stand-in for spoken cues (Safari cannot TTS without killing Spotify forever). */
function playSafariVoiceCue(text: string): void {
  const lower = text.toLowerCase().trim()
  let freqs = [880, 1175]
  let osc: OscillatorType = 'square'
  if (/^go\b/.test(lower)) {
    freqs = [784, 988, 1319]
    osc = 'square'
  } else if (/10\s*segundos|\bdez\b/.test(lower)) {
    freqs = [660, 660]
    osc = 'square'
  } else if (/exerc|esfor|work|ronda/.test(lower)) {
    freqs = [659, 880, 1175]
    osc = 'square'
  } else if (/descanso|rest|pausa/.test(lower)) {
    freqs = [784, 523]
    osc = 'triangle'
  } else if (/prepar/.test(lower)) {
    freqs = [523, 659, 784]
    osc = 'square'
  } else if (/conclu|done|fim/.test(lower)) {
    freqs = [523, 659, 784, 1046]
    osc = 'square'
  } else if (/^\d+$/.test(lower)) {
    const n = Number(lower)
    freqs = n === 1 ? [1320] : n === 2 ? [1100] : n === 3 ? [990] : [880]
    osc = 'square'
  }

  const vol = Math.min(1, volume() * 1.15)
  const totalMs = freqs.length * 180 + 100
  runSafariAudibleCue(totalMs, () => {
    freqs.forEach((freq, index) => {
      window.setTimeout(() => {
        void resumeForAlert().then(() => {
          tone([freq], 0.16, osc, vol * 0.42)
        })
      }, index * 170)
    })
  })
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

function alertTonePlan(
  kind: Exclude<SoundKind, 'tick'>,
  soundType: NonNullable<GeneralSettings>['soundType'],
): { freqs: number[]; duration: number; osc: OscillatorType; gain: number } {
  const vol = volume()
  if (soundType === 'bell') {
    if (kind === 'done') return { freqs: [523, 659, 784], duration: 0.55, osc: 'sine', gain: vol * 0.28 }
    if (kind === 'warning') return { freqs: [880, 660], duration: 0.28, osc: 'sine', gain: vol * 0.26 }
    return { freqs: [784, 988], duration: 0.28, osc: 'sine', gain: vol * 0.26 }
  }
  if (soundType === 'censor') {
    if (kind === 'done') return { freqs: [180, 140], duration: 0.5, osc: 'sawtooth', gain: vol * 0.24 }
    if (kind === 'warning') return { freqs: [220], duration: 0.22, osc: 'sawtooth', gain: vol * 0.22 }
    return { freqs: [160], duration: 0.2, osc: 'sawtooth', gain: vol * 0.22 }
  }
  if (kind === 'done') return { freqs: [880, 1175], duration: 0.45, osc: 'square', gain: vol * 0.2 }
  if (kind === 'warning') return { freqs: [990], duration: 0.18, osc: 'square', gain: vol * 0.2 }
  return { freqs: [760], duration: 0.16, osc: 'square', gain: vol * 0.2 }
}

/**
 * With “Respeitar música” on Android: native duck + beep (no WebView media focus).
 * On web: transient session + Web Audio only (skip HTMLAudio, which pauses Spotify).
 */
function playSound(kind: SoundKind): void {
  if (!settings) return
  if (kind === 'tick' && !settings.ticking) return
  if (kind !== 'tick' && !settings.soundEffect && kind !== 'preview') return

  // Spotify/etc. ou sessão Tabata com música: sem tic-tac (a trilha marca o tempo).
  if (kind === 'tick' && (shouldSilenceAmbient() || isWorkoutMusicSessionActive())) return

  const vol = volume()
  const soundType = settings.soundType
  const respect = respectsExternalMusic()

  if (kind === 'tick') {
    if (respect) return
    setAudioSession('ambient')
    resumeForAlert()
    playHtml(getHtmlTick(), vol * 0.55)
    tone([1200], 0.035, 'square', vol * 0.1)
    return
  }

  if (respect && isNativeAudioDuckAvailable()) {
    const plan = alertTonePlan(kind, soundType)
    const primary = plan.freqs[0] ?? 880
    void nativeBeep(primary, Math.round(plan.duration * 1000), Math.min(1, vol))
    // Stack a second partial for chords without a second focus grab if first still holds.
    if (plan.freqs[1]) {
      window.setTimeout(() => {
        void nativeBeep(plan.freqs[1]!, 90, Math.min(1, vol * 0.85))
      }, 40)
    }
    return
  }

  // HTMLAudio defaults to “playback” on Safari and pauses Spotify — skip when respecting.
  if (!respect) {
    setAudioSession('transient')
    resumeForAlert()
    playHtml(getHtmlAlert(), vol * (kind === 'done' ? 1 : 0.85))
    try {
      const plan = alertTonePlan(kind, soundType)
      tone(plan.freqs, plan.duration, plan.osc, plan.gain)
    } catch {
      // ignore
    } finally {
      window.setTimeout(() => setAudioSession('ambient'), 700)
    }
    return
  }

  // Respect music on Safari/web: transient Web Audio beeps + visual 3-2-1 backup.
  const plan = alertTonePlan(kind, soundType)
  const boost = Math.min(1, plan.gain * 1.45)
  runSafariAudibleCue(Math.round(plan.duration * 1000) + 220, () => {
    tone(plan.freqs, plan.duration, plan.osc, boost)
  })
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

  const normalized = text.trim()
  if (!normalized) return
  if (!force && normalized === lastSpoken) return
  lastSpoken = normalized

  const respect = respectsExternalMusic()

  // Android APK: native TTS + AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK, then unduck.
  if (respect && isNativeAudioDuckAvailable()) {
    speakChain = speakChain
      .catch(() => undefined)
      .then(async () => {
        await nativeSpeak(normalized)
      })
    return
  }

  // Safari / web + Respeitar música: beep callouts (not speechSynthesis — that kills Spotify).
  if (respect) {
    speakChain = speakChain
      .catch(() => undefined)
      .then(
        () =>
          new Promise<void>((resolve) => {
            playSafariVoiceCue(normalized)
            window.setTimeout(resolve, 700)
          }),
      )
    return
  }

  if (!('speechSynthesis' in window)) return

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

  const musicOwnsTempo = isWorkoutMusicSessionActive() || isWorkoutMusicAudible()
  // Com a música Tabata, GO/REST já vêm na trilha — não empilha bip de fase.
  if (!musicOwnsTempo) playSound('phase')

  // Contagem 3-2-1 → Go no início do esforço.
  if (phase.kind === 'work') {
    speak('Go', true)
  } else {
    speak(phase.label.toLowerCase())
  }

  // Sem “em seguida…” por cima da batida (dois tempos ao mesmo tempo).
  if (next && !shouldSilenceAmbient() && !musicOwnsTempo) {
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

  // Respeitar música / trilha Tabata: só corta o tic-tac contínuo.
  // Voz: “10 segundos” → 3, 2, 1 → (Go no início da fase de esforço).
  const hushTicks = shouldSilenceAmbient() || isWorkoutMusicSessionActive()

  if (settings?.ticking && whole > 0 && !hushTicks) {
    playSound('tick')
    void vibrate('tick')
  }

  // Aviso aos 10s (fase precisa ser > 10 para não falar no primeiro segundo).
  if (whole === 10 && phase.duration > 10) {
    playSound('warning')
    void vibrate('warning')
    speak('10 segundos', true)
  } else if (warning > 0 && whole === warning && warning !== 10) {
    playSound('warning')
    void vibrate('warning')
    speak(`${warning} segundos`, true)
  }

  // Contagem regressiva falada: 3, 2, 1.
  if (whole <= 3 && whole >= 1) {
    void vibrate('warning')
    speak(String(whole), true)
  }
}

export function feedbackPhaseStart(phase: Phase | null, next?: Phase | null): void {
  announcePhase(phase, next)
  void pulseTorch()
}
