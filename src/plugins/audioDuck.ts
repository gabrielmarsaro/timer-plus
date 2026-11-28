import { Capacitor, registerPlugin } from '@capacitor/core'

export interface AudioDuckPlugin {
  duck(): Promise<{ granted: boolean }>
  unduck(): Promise<void>
  beep(options: {
    frequency?: number
    durationMs?: number
    volume?: number
  }): Promise<{ granted: boolean }>
  speak(options: { text: string }): Promise<void>
}

const AudioDuck = registerPlugin<AudioDuckPlugin>('AudioDuck')

export function isNativeAudioDuckAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

export async function nativeDuck(): Promise<boolean> {
  if (!isNativeAudioDuckAvailable()) return false
  try {
    const result = await AudioDuck.duck()
    return Boolean(result?.granted)
  } catch {
    return false
  }
}

export async function nativeUnduck(): Promise<void> {
  if (!isNativeAudioDuckAvailable()) return
  try {
    await AudioDuck.unduck()
  } catch {
    // ignore
  }
}

export async function nativeBeep(
  frequency: number,
  durationMs: number,
  volume: number,
): Promise<boolean> {
  if (!isNativeAudioDuckAvailable()) return false
  try {
    const result = await AudioDuck.beep({ frequency, durationMs, volume })
    return Boolean(result?.granted)
  } catch {
    return false
  }
}

export async function nativeSpeak(text: string): Promise<boolean> {
  if (!isNativeAudioDuckAvailable()) return false
  try {
    await AudioDuck.speak({ text })
    return true
  } catch {
    return false
  }
}
