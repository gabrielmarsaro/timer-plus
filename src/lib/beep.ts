import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

export async function unlockAudio(): Promise<void> {
  const ctx = getCtx()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
}

async function vibrate(kind: 'tick' | 'phase' | 'done'): Promise<void> {
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
  const ctx = getCtx()
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  const config = {
    tick: { freq: 880, duration: 0.08, gain: 0.08 },
    phase: { freq: 660, duration: 0.22, gain: 0.18 },
    done: { freq: 523.25, duration: 0.45, gain: 0.22 },
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
    gain2.gain.exponentialRampToValueAtTime(0.18, now + 0.2)
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.18)
    osc2.stop(now + 0.55)
  }
}
