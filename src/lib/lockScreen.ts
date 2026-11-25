import { formatTime } from './format'

/** Minimal silent WAV (0.25s) so Media Session stays alive on lock screen. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

let audio: HTMLAudioElement | null = null
let keepAliveTimer: number | null = null
let lastTitle = ''
let lastArtist = ''

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (audio) return audio
  try {
    const el = new Audio(SILENT_WAV)
    el.loop = true
    el.volume = 0.01
    el.setAttribute('playsinline', 'true')
    el.setAttribute('webkit-playsinline', 'true')
    audio = el
    return el
  } catch {
    return null
  }
}

function setMetadata(title: string, artist: string) {
  if (!('mediaSession' in navigator)) return
  if (title === lastTitle && artist === lastArtist) return
  lastTitle = title
  lastArtist = artist
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: 'Timer Plus',
    })
  } catch {
    // MediaMetadata unsupported
  }
}

export interface LockScreenPayload {
  mode: 'tabata' | 'rounds' | 'stopwatch'
  phaseLabel: string
  /** Remaining seconds for phase timers; elapsed seconds for stopwatch. */
  seconds: number
  /** Total phase / workout length for position state (optional). */
  durationSeconds?: number
  running: boolean
}

export type LockScreenAction = 'pause' | 'resume' | 'stop'

/**
 * Keep a near-silent loop playing and push Media Session metadata so the
 * lock screen / notification shade can show the current timer.
 */
export function syncLockScreen(
  payload: LockScreenPayload | null,
  onAction?: (action: LockScreenAction) => void,
): void {
  if (!payload || !payload.running) {
    stopLockScreen()
    return
  }

  const timeText =
    payload.mode === 'stopwatch'
      ? formatStopwatchSeconds(payload.seconds)
      : formatTime(payload.seconds, 'mmss')

  const title =
    payload.mode === 'stopwatch'
      ? 'Cronómetro'
      : payload.phaseLabel || 'Timer Plus'
  const artist = payload.mode === 'stopwatch' ? timeText : `${timeText} restantes`

  setMetadata(title, artist)

  if ('mediaSession' in navigator) {
    try {
      const duration = Math.max(1, payload.durationSeconds ?? payload.seconds)
      const position =
        payload.mode === 'stopwatch'
          ? Math.min(duration, payload.seconds)
          : Math.max(0, duration - payload.seconds)
      navigator.mediaSession.playbackState = 'playing'
      navigator.mediaSession.setPositionState?.({
        duration,
        position: Math.min(duration, Math.max(0, position)),
        playbackRate: 1,
      })
    } catch {
      // setPositionState can throw if duration < position
    }

    try {
      navigator.mediaSession.setActionHandler('pause', () => onAction?.('pause'))
      navigator.mediaSession.setActionHandler('play', () => onAction?.('resume'))
      navigator.mediaSession.setActionHandler('stop', () => onAction?.('stop'))
    } catch {
      // Some browsers reject handlers
    }
  }

  const el = ensureAudio()
  if (el && el.paused) {
    void el.play().catch(() => {
      // Autoplay may still be blocked until a gesture — caller starts after unlock.
    })
  }

  if (keepAliveTimer === null) {
    keepAliveTimer = window.setInterval(() => {
      const node = ensureAudio()
      if (node && node.paused) {
        void node.play().catch(() => undefined)
      }
    }, 4000)
  }
}

/** Call from a user gesture so the silent keep-alive can start on iOS/Android. */
export function primeLockScreenAudio(): void {
  const el = ensureAudio()
  if (!el) return
  void el.play().catch(() => undefined)
}

export function stopLockScreen(): void {
  lastTitle = ''
  lastArtist = ''
  if (keepAliveTimer !== null) {
    window.clearInterval(keepAliveTimer)
    keepAliveTimer = null
  }
  if (audio) {
    try {
      audio.pause()
      audio.currentTime = 0
    } catch {
      // ignore
    }
  }
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'none'
      navigator.mediaSession.metadata = null
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('stop', null)
    } catch {
      // ignore
    }
  }
}

function formatStopwatchSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
