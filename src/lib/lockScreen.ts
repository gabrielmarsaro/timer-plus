import { MediaSession } from '@capgo/capacitor-media-session'
import { respectsExternalMusic } from './feedback'
import { formatTime } from './format'

/**
 * iPhone Safari / PWA Now Playing + Android Capgo MediaSession.
 *
 * Keep-alive: silent WAV at volume 0 (never muted — drops Now Playing on iOS).
 * Metadata updates are throttled to whole seconds — regenerating artwork or
 * poking Media Session every rAF frame freezes Safari on iPhone.
 *
 * With “Respeitar música”: never claim exclusive playback / Capgo foreground
 * session / keepalive — those pause Spotify when the app opens or starts.
 */

/** v2 = true silence (all-zero samples). Bump when replacing the asset. */
const KEEP_ALIVE_SRC = `${import.meta.env.BASE_URL}lock-keepalive.wav?v=silent2`

let audio: HTMLAudioElement | null = null
let metaTimer: number | null = null
let handlersWired = false
let artworkCacheKey = ''
let artworkUrl: string | null = null
let lastPublishKey = ''
let lastPlaybackState: 'playing' | 'paused' | 'none' = 'none'
let latestPayload: LockScreenPayload | null = null
let actionCallback: ((action: LockScreenAction) => void) | null = null
let visibilityWired = false
let positionCleared = false

export interface LockScreenPayload {
  mode: 'tabata' | 'rounds' | 'stopwatch'
  phaseLabel: string
  /** Remaining seconds for phase timers; elapsed seconds for stopwatch. */
  seconds: number
  durationSeconds?: number
  running: boolean
  paused?: boolean
}

export type LockScreenAction = 'pause' | 'resume' | 'stop'

type AudioSessionLike = { type: string }

function setAudioSessionType(type: 'playback' | 'ambient'): void {
  try {
    const nav = navigator as Navigator & { audioSession?: AudioSessionLike }
    if (nav.audioSession) {
      nav.audioSession.type = type
    }
  } catch {
    // ignore
  }
}

function setPlaybackAudioSession(): void {
  // Exclusive playback stops other apps — only when user turned off “Respeitar música”.
  setAudioSessionType(respectsExternalMusic() ? 'ambient' : 'playback')
}

function mixWithOthers(): boolean {
  return respectsExternalMusic()
}

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (audio) return audio
  try {
    const el = new Audio(KEEP_ALIVE_SRC)
    el.loop = true
    el.preload = 'auto'
    el.volume = 0
    el.muted = false
    el.setAttribute('playsinline', 'true')
    el.setAttribute('webkit-playsinline', 'true')
    el.setAttribute('data-lock-keepalive', 'true')
    el.style.display = 'none'
    ;(el as HTMLAudioElement & { disableRemotePlayback?: boolean }).disableRemotePlayback = false
    document.body.appendChild(el)
    el.load()
    audio = el
    return el
  } catch {
    return null
  }
}

function wholeSeconds(payload: LockScreenPayload): number {
  // Countdown UIs show ceil-ish remaining; floor is stable enough for lock text.
  return Math.max(0, Math.floor(payload.seconds))
}

function timeTextFor(payload: LockScreenPayload): string {
  if (payload.mode === 'stopwatch') return formatStopwatchSeconds(payload.seconds)
  return formatTime(wholeSeconds(payload), 'mmss')
}

function publishKey(payload: LockScreenPayload): string {
  return [
    payload.mode,
    payload.phaseLabel,
    timeTextFor(payload),
    payload.running ? '1' : '0',
    payload.paused ? '1' : '0',
  ].join('|')
}

/**
 * Compact cover with big digits. JPEG + 256px keeps this cheap enough for
 * once-per-second updates on iPhone Safari.
 */
function artworkFor(payload: LockScreenPayload): string {
  const timeText = timeTextFor(payload)
  const phase = (payload.phaseLabel || 'TIMER').toUpperCase()
  const cacheKey = `${timeText}|${phase}|${payload.paused ? 'p' : 'r'}`
  if (artworkUrl && artworkCacheKey === cacheKey) return artworkUrl

  try {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return artworkUrl ?? ''

    ctx.fillStyle = '#0A0C10'
    ctx.fillRect(0, 0, size, size)

    ctx.fillStyle = '#F0B429'
    ctx.font = '700 22px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(phase.slice(0, 16), size / 2, 64)

    const digitSize = timeText.length > 5 ? 56 : 72
    ctx.fillStyle = '#F5F2EA'
    ctx.font = `800 ${digitSize}px system-ui, sans-serif`
    ctx.fillText(timeText, size / 2, size / 2 + 6)

    ctx.fillStyle = '#8A92A3'
    ctx.font = '600 14px system-ui, sans-serif'
    ctx.fillText(payload.paused ? 'PAUSADO' : 'TIMER VIKING', size / 2, 198)

    artworkCacheKey = cacheKey
    // JPEG is ~10–20× smaller than PNG for this graphic.
    artworkUrl = canvas.toDataURL('image/jpeg', 0.72)
    return artworkUrl
  } catch {
    return artworkUrl ?? ''
  }
}

function clearPositionBar(): void {
  if (positionCleared) return
  positionCleared = true
  try {
    navigator.mediaSession?.setPositionState?.()
  } catch {
    // ignore
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

function buildLabels(payload: LockScreenPayload): { title: string; artist: string; album: string } {
  const timeText = timeTextFor(payload)

  if (payload.mode === 'stopwatch') {
    return {
      title: timeText,
      artist: payload.paused ? 'Pausado · Cronómetro' : 'Cronómetro',
      album: 'Timer Viking',
    }
  }

  const phase = payload.phaseLabel || 'Treino'
  return {
    title: timeText,
    artist: payload.paused ? `${phase} · Pausado` : phase,
    album: payload.mode === 'tabata' ? 'Tabata · Timer Viking' : 'Rondas · Timer Viking',
  }
}

async function wireHandlers(): Promise<void> {
  if (handlersWired) return
  handlersWired = true
  try {
    await MediaSession.setActionHandler({ action: 'pause' }, () => actionCallback?.('pause'))
    await MediaSession.setActionHandler({ action: 'play' }, () => actionCallback?.('resume'))
    await MediaSession.setActionHandler({ action: 'stop' }, () => actionCallback?.('stop'))
  } catch {
    // ignore
  }
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('pause', () => actionCallback?.('pause'))
      navigator.mediaSession.setActionHandler('play', () => actionCallback?.('resume'))
      navigator.mediaSession.setActionHandler('stop', () => actionCallback?.('stop'))
    } catch {
      // ignore
    }
  }
}

function pushWebSession(payload: LockScreenPayload, forceArtwork: boolean): void {
  if (!('mediaSession' in navigator)) return
  // Claiming Now Playing / playbackState "playing" on Safari steals Spotify.
  if (mixWithOthers()) return
  const { title, artist, album } = buildLabels(payload)
  try {
    const art = forceArtwork || !artworkUrl ? artworkFor(payload) : artworkUrl
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork: art
        ? [{ src: art, sizes: '256x256', type: 'image/jpeg' }]
        : [],
    })
    navigator.mediaSession.playbackState = payload.paused ? 'paused' : 'playing'
    clearPositionBar()
  } catch {
    // ignore
  }
}

async function pushNativeSession(payload: LockScreenPayload, forceArtwork: boolean): Promise<void> {
  // Capgo starts a MEDIA_PLAYBACK foreground service + setActive(true), which
  // requests Android audio focus and pauses Spotify. Skip while mixing.
  if (mixWithOthers()) return
  const { title, artist, album } = buildLabels(payload)
  const art = forceArtwork || !artworkUrl ? artworkFor(payload) : artworkUrl
  await wireHandlers()
  await MediaSession.setMetadata({
    title,
    artist,
    album,
    artwork: art ? [{ src: art, sizes: '256x256', type: 'image/jpeg' }] : undefined,
  })
  const nextState = payload.paused ? 'paused' : 'playing'
  if (lastPlaybackState !== nextState) {
    lastPlaybackState = nextState
    nativeSessionEverStarted = true
    await MediaSession.setPlaybackState({ playbackState: nextState })
  }
}

function wireVisibilityResume(): void {
  if (visibilityWired) return
  visibilityWired = true
  const resume = () => {
    if (!latestPayload?.running) return
    if (mixWithOthers()) {
      // Stay ambient — do not restart keepalive (that pauses Spotify).
      setAudioSessionType('ambient')
      if (latestPayload) publishMetadata(latestPayload, true)
      return
    }
    setPlaybackAudioSession()
    const el = ensureAudio()
    if (el && el.paused) void el.play().catch(() => undefined)
    if (latestPayload) publishMetadata(latestPayload, true)
  }
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('pageshow', resume)
  window.addEventListener('focus', resume)
}

function publishMetadata(payload: LockScreenPayload, force = false): void {
  const key = publishKey(payload)
  if (!force && key === lastPublishKey) return
  lastPublishKey = key
  // Refresh cover when the displayed second/phase changes.
  pushWebSession(payload, true)
  void pushNativeSession(payload, true).catch(() => undefined)
}

function startMetaLoop(): void {
  if (metaTimer !== null) return
  // When the tab is backgrounded, React/rAF stalls — keep title fresh cheaply.
  metaTimer = window.setInterval(() => {
    if (!latestPayload) return
    if (!(latestPayload.running || latestPayload.paused)) return
    publishMetadata(latestPayload)
    if (mixWithOthers()) return
    const el = ensureAudio()
    if (el && latestPayload.running && el.paused) {
      void el.play().catch(() => undefined)
    }
  }, 1000)
}

/**
 * Keep media session + keep-alive so iPhone lock screen shows the timer.
 * Safe to call every React render — heavy work only runs once per whole second.
 */
export function syncLockScreen(
  payload: LockScreenPayload | null,
  onAction?: (action: LockScreenAction) => void,
): void {
  if (!payload || (!payload.running && !payload.paused)) {
    void stopLockScreen()
    return
  }

  latestPayload = payload
  actionCallback = onAction ?? null
  setPlaybackAudioSession()
  wireVisibilityResume()
  startMetaLoop()

  if (!mixWithOthers()) {
    const el = ensureAudio()
    if (el) {
      el.volume = 0
      el.muted = false
      if (payload.running && el.paused) {
        void el.play().catch(() => undefined)
      }
      if (payload.paused && !el.paused) {
        el.pause()
      }
    }
  } else if (audio && !audio.paused) {
    // Preference flipped on mid-run — release exclusive keepalive.
    try {
      audio.pause()
      audio.currentTime = 0
    } catch {
      // ignore
    }
  }

  publishMetadata(payload)
}

/** Must run inside a user gesture (INICIAR) so Safari unlocks audio + Now Playing. */
export function primeLockScreenAudio(): void {
  setPlaybackAudioSession()
  if (mixWithOthers()) {
    // Do not play keepalive — HTMLAudio.play pauses other apps on Android/iOS.
    return
  }
  const el = ensureAudio()
  if (!el) return
  void el.play().catch(() => undefined)
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    void Notification.requestPermission().catch(() => undefined)
  }
}

let nativeSessionEverStarted = false

export async function stopLockScreen(): Promise<void> {
  latestPayload = null
  lastPublishKey = ''
  lastPlaybackState = 'none'
  artworkCacheKey = ''
  artworkUrl = null
  positionCleared = false
  actionCallback = null
  if (metaTimer !== null) {
    window.clearInterval(metaTimer)
    metaTimer = null
  }
  if (audio) {
    try {
      audio.pause()
      audio.currentTime = 0
    } catch {
      // ignore
    }
  }
  // Avoid poking Capgo on idle mount — setPlaybackState can bind the media service.
  if (nativeSessionEverStarted || handlersWired) {
    try {
      await MediaSession.setPlaybackState({ playbackState: 'none' })
    } catch {
      // ignore
    }
    nativeSessionEverStarted = false
  }
  setAudioSessionType('ambient')
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'none'
      navigator.mediaSession.metadata = null
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('stop', null)
      try {
        navigator.mediaSession.setPositionState?.()
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }
}
