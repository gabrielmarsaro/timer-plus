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
let speakChain: Promise<void> = Promise.resolve()

const AudioCtxCtor =
  typeof window !== 'undefined'
    ? window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined

/** Prebuilt tiny WAV (~60ms @ 760Hz) — avoids building audio on the INICIAR tap. */
const BEEP_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

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
}

function getCtx(): AudioContext | null {
  if (!AudioCtxCtor) return null
  if (!audioCtx) {
    try {
      audioCtx = new AudioCtxCtor()
    } catch {
      return null
    }
  }
  return audioCtx
}

function getHtmlBeep(): HTMLAudioElement {
  if (!htmlBeep) {
    htmlBeep = new Audio(BEEP_DATA_URI)
    htmlBeep.preload = 'auto'
    htmlBeep.setAttribute('playsinline', 'true')
  }
  return htmlBeep
}

function playHtmlBeep(volumeLevel: number): void {
  try {
    const audio = getHtmlBeep()
    audio.volume = Math.max(0.05, Math.min(1, volumeLevel))
    audio.currentTime = 0
    void audio.play().catch(() => undefined)
  } catch {
    // ignore
  }
}

/**
 * Unlock audio inside a user gesture. Must NOT await from the UI —
 * awaiting play()/resume() hangs Safari on iPhone and freezes INICIAR.
 */
export function unlockFeedback(): void {
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
    const audio = getHtmlBeep()
    audio.volume = 0.01
    audio.currentTime = 0
    void audio.play().then(() => {
      try {
        audio.pause()
        audio.currentTime = 0
      } catch {
        // ignore
      }
    }).catch(() => undefined)
  } catch {
    // ignore
  }

  // Do NOT call speechSynthesis.speak/cancel here — that freezes iOS Safari.
  try {
    window.speechSynthesis?.getVoices?.()
  } catch {
    // ignore
  }

  unlocked = true
}

export function ensureAudioReady(): void {
  if (!unlocked) return
  const ctx = getCtx()
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined)
}

function volume(): number {
  const base = Math.max(0.05, settings?.volume ?? 0.75)
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

  const vol = volume()
  const soundType = settings.soundType

  if (isAppleTouchWeb() && kind !== 'tick') {
    playHtmlBeep(vol * (kind === 'done' ? 1 : 0.85))
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

  const utter = new SpeechSynthesisUtterance(normalized)
  utter.lang = 'pt-BR'
  utter.rate = isAppleTouchWeb() ? 1 : 1.05
  utter.pitch = settings?.voice === 'luciana' ? 1.05 : 1
  utter.volume = Math.max(0.6, volume())
  const voice = pickVoice()
  if (voice) utter.voice = voice

  // Queue speaks; avoid cancel() on iOS — it can freeze Safari.
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
          // Safety: never leave the chain stuck
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
  // Camera torch prompt freezes/hangs iPhone Safari web — native only.
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

export function applyDucking(active: boolean): void {
  if (!settings?.ducking) return
  try {
    const ctx = getCtx()
    if (!ctx) return
    if (!duckGain) {
      duckGain = ctx.createGain()
      duckGain.connect(ctx.destination)
    }
    duckGain.gain.setTargetAtTime(active ? 0.15 : 1, ctx.currentTime, 0.05)
  } catch {
    // ignore
  }
}

export function announcePhase(phase: Phase | null, next?: Phase | null): void {
  if (!phase) return
  ensureAudioReady()
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
  ensureAudioReady()
  void vibrate('done')
  playSound('done')
  speak('Treino concluído')
  void pulseTorch()
}

export function onCountdownSecond(remaining: number, phase: Phase | null, warning = 0): void {
  if (!phase) return
  const whole = Math.ceil(remaining)
  ensureAudioReady()

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
