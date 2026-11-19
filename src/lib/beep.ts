import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { GeneralSettings } from '../types'

let audioCtx: AudioContext | null = null
let currentSettings: Pick<
  GeneralSettings,
  'soundEffect' | 'volume' | 'vibration' | 'ticking'
> = {
  soundEffect: true,
  volume: 0.75,
  vibration: false,
  ticking: false,
}

export function setAudioPreferences(
  settings: Pick<GeneralSettings, 'soundEffect' | 'volume' | 'vibration' | 'ticking'>,
): void {
  currentSettings = settings
}

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

export async function unlockAudio(): Promise<void> {
  try {
    const ctx = getCtx()
    if (ctx.state === 'suspended') {
      await Promise.race([
        ctx.resume(),
        new Promise<void>((resolve) => setTimeout(resolve, 300)),
      ])
    }
  } catch {
    // Audio may be blocked until a trusted user gesture; timer still runs.
  }
}

async function vibrate(kind: 'tick' | 'phase' | 'done'): Promise<void> {
  if (!currentSettings.vibration) return
  if (!Capacitor.isNativePlatform()) return
  try {
    if (kind === 'done') {
      await Haptics.notification({ type: NotificationType.Success })
      return
    }
    await Haptics.impact({
      style: kind === 'tick' ? ImpactStyle.Light : ImpactStyle.Medium,
    })
  } catch {
    // Haptics may be unavailable on some devices/emulators.
  }
}

export function playBeep(kind: 'tick' | 'phase' | 'done' = 'phase'): void {
  void vibrate(kind)

  if (kind === 'tick' && !currentSettings.ticking) return
  if (kind !== 'tick' && !currentSettings.soundEffect) return

  try {
    const ctx = getCtx()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const vol = Math.max(0.02, currentSettings.volume * 0.28)

    const config = {
      tick: { freq: 880, duration: 0.06, gain: vol * 0.35 },
      phase: { freq: 660, duration: 0.22, gain: vol },
      done: { freq: 523.25, duration: 0.45, gain: vol },
    }[kind]

    osc.type = 'sine'
    osc.frequency.setValueAtTime(config.freq, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(config.gain, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + config.duration + 0.02)

    if (kind === 'done') {
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(784, now + 0.18)
      gain2.gain.setValueAtTime(0.0001, now + 0.18)
      gain2.gain.exponentialRampToValueAtTime(vol, now + 0.2)
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.18)
      osc2.stop(now + 0.55)
    }
  } catch {
    // Ignore audio failures; countdown continues without sound.
  }
}
