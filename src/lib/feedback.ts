import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { GeneralSettings, Phase } from '../types'

type SoundKind = 'tick' | 'phase' | 'done' | 'warning' | 'preview'

let audioCtx: AudioContext | null = null
let settings: GeneralSettings | null = null
let lastSpoken = ''
let torchTrack: MediaStreamTrack | null = null
let duckGain: GainNode | null = null
let unlocked = false
let htmlBeep: HTMLAudioElement | null = null

const AudioCtxCtor =
  typeof window !== 'undefined'
    ? window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined

export function isAppleTouchWeb(): boolean {
  if (typeof navigator === 'undefined') return false
  if (Capacitor.isNativePlatform()) return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function configureFeedback(next: GeneralSettings): void {
  settings = next
}

function getCtx(): AudioContext {
  if (!AudioCtxCtor) throw new Error('AudioContext unavailable')
  if (!audioCtx) audioCtx = new AudioCtxCtor()
  return audioCtx
}

/** Tiny WAV beep used as an HTMLAudio unlock/fallback on iOS Safari. */
function buildBeepDataUri(freq = 880, ms = 80): string {
  const sampleRate = 22050
  const samples = Math.floor((sampleRate * ms) / 1000)
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
    const env = Math.min(1, i / 200) * Math.min(1, (samples - i) / 400)
    const sample = Math.sin(2 * Math.PI * freq * t) * env * 0.35
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true)
  }
  const bytes = new Uint8Array(data)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
  return `data:audio/wav;base64,${btoa(binary)}`
}

function getHtmlBeep(): HTMLAudioElement {
  if (!htmlBeep) {
    htmlBeep = new Audio(buildBeepDataUri(760, 60))
    htmlBeep.preload = 'auto'
    htmlBeep.setAttribute('playsinline', 'true')
  }
  return htmlBeep
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), ms)
      }),
    ])
  } catch {
    return null
  }
}

async function playHtmlBeep(volumeLevel: number): Promise<void> {
  try {
    const audio = getHtmlBeep()
    audio.volume = Math.max(0.05, Math.min(1, volumeLevel))
    audio.currentTime = 0
    await withTimeout(audio.play(), 400)
  } catch {
    // ignore — may still be blocked by silent switch
  }
}

async function resumeCtx(): Promise<AudioContext | null> {
  try {
    const ctx = getCtx()
    if (ctx.state === 'suspended') await ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** Must run inside a user gesture (INICIAR / preview). Critical on iPhone Safari. */
export async function unlockFeedback(): Promise<void> {
  const ctx = await withTimeout(resumeCtx().then((value) => value), 400)

  if (ctx) {
    try {
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.value = 0.001
      source.connect(gain)
      gain.connect(ctx.destination)
      source.start(0)
    } catch {
      // ignore
    }
  }

  // HTMLAudio unlock path (often more reliable on iOS after a tap)
  try {
    const audio = getHtmlBeep()
    audio.volume = 0.05
    audio.currentTime = 0
    await withTimeout(audio.play(), 400)
    try {
      audio.pause()
      audio.currentTime = 0
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }

  // Prime speechSynthesis during the same gesture (iOS requirement)
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      window.speechSynthesis.resume?.()
      const warm = new SpeechSynthesisUtterance(' ')
      warm.volume = 0.01
      warm.rate = 2
      warm.lang = 'pt-BR'
      window.speechSynthesis.speak(warm)
      window.setTimeout(() => window.speechSynthesis.cancel(), 80)
      window.speechSynthesis.getVoices()
    }
  } catch {
    // ignore
  }

  unlocked = true
}

export async function ensureAudioReady(): Promise<void> {
  if (!unlocked) return
  await resumeCtx()
}

function volume(): number {
  const base = Math.max(0.05, settings?.volume ?? 0.75)
  // iPhone Safari web audio is quieter; nudge it up a bit
  return isAppleTouchWeb() ? Math.min(1, base * 1.25) : base
}

async function vibrate(kind: SoundKind): Promise<void> {
  if (!settings?.vibration) return

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
    // fall through to browser vibrate
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
  void resumeCtx().then((ctx) => {
    if (!ctx) return
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
  })
}

function playSound(kind: SoundKind): void {
  if (!settings) return
  if (kind === 'tick' && !settings.ticking) return
  if (kind !== 'tick' && !settings.soundEffect && kind !== 'preview') return

  const vol = volume()
  const soundType = settings.soundType

  // HTMLAudio fallback first on iPhone (keeps audio session warm)
  if (isAppleTouchWeb() && kind !== 'tick') {
    void playHtmlBeep(vol * (kind === 'done' ? 1 : 0.85))
  }

  try {
    if (kind === 'tick') {
      tone([1200], 0.04, 'square', vol * 0.1)
      return
    }

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

    // beep
    if (kind === 'done') tone([880, 1175], 0.45, 'square', vol * 0.2)
    else if (kind === 'warning') tone([990], 0.18, 'square', vol * 0.2)
    else tone([760], 0.16, 'square', vol * 0.2)
  } catch {
    // ignore
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

  try {
    window.speechSynthesis.cancel()
    window.speechSynthesis.resume?.()
    const utter = new SpeechSynthesisUtterance(normalized)
    utter.lang = 'pt-BR'
    utter.rate = isAppleTouchWeb() ? 1 : 1.05
    utter.pitch = settings?.voice === 'luciana' ? 1.05 : 1
    utter.volume = Math.max(0.6, volume())
    const voice = pickVoice()
    if (voice) utter.voice = voice
    // Slight delay helps iOS after cancel()
    window.setTimeout(() => {
      try {
        window.speechSynthesis.speak(utter)
      } catch {
        // ignore
      }
    }, isAppleTouchWeb() ? 40 : 0)
  } catch {
    // ignore
  }
}

export function previewSound(): void {
  void unlockFeedback().then(() => {
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
  })
}

export function previewVoice(): void {
  void unlockFeedback().then(() => speak('Preparar. Exercício. Descanso.', true))
}

export async function setTorch(enabled: boolean): Promise<void> {
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
  await setTorch(true)
  window.setTimeout(() => {
    void setTorch(false)
  }, 220)
}

export function applyDucking(active: boolean): void {
  if (!settings?.ducking) return
  void resumeCtx().then((ctx) => {
    if (!ctx) return
    if (!duckGain) {
      duckGain = ctx.createGain()
      duckGain.connect(ctx.destination)
    }
    duckGain.gain.setTargetAtTime(active ? 0.15 : 1, ctx.currentTime, 0.05)
  })
}

export function announcePhase(phase: Phase | null, next?: Phase | null): void {
  if (!phase) return
  void ensureAudioReady()
  void vibrate('phase')
  playSound('phase')
  applyDucking(true)
  window.setTimeout(() => applyDucking(false), 900)

  const label = phase.label.toLowerCase()
  if (phase.kind === 'work' && phase.round) {
    speak(`${label}. Ronda ${phase.round}`)
  } else {
    speak(label)
  }

  if (next) {
    window.setTimeout(() => {
      speak(`Em seguida, ${next.label.toLowerCase()}`)
    }, 1100)
  }
}

export function announceDone(): void {
  void ensureAudioReady()
  void vibrate('done')
  playSound('done')
  speak('Treino concluído')
  void pulseTorch()
}

export function onCountdownSecond(remaining: number, phase: Phase | null, warning = 0): void {
  if (!phase) return
  const whole = Math.ceil(remaining)
  void ensureAudioReady()

  if (settings?.ticking && whole > 0) {
    playSound('tick')
    void vibrate('tick')
  }

  if (warning > 0 && whole === warning) {
    playSound('warning')
    void vibrate('warning')
    speak(`${warning} segundos`)
  }

  if (whole <= 3 && whole >= 1) {
    speak(String(whole))
  }
}

export function feedbackPhaseStart(phase: Phase | null, next?: Phase | null): void {
  announcePhase(phase, next)
  void pulseTorch()
}
