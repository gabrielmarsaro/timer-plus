import { MediaSession } from '@capgo/capacitor-media-session'
import { formatTime } from './format'

/**
 * iPhone Safari / PWA Now Playing + Android Capgo MediaSession.
 *
 * Safari needs a playing HTMLAudioElement (with audioSession "playback") to
 * keep Now Playing on the lock screen. We loop a true-silent WAV (all zero
 * samples) at volume 0. Do not use a near-silent tone — iOS still bleeds it
 * as a hiss even at volume 0. Avoid muted=true (drops Now Playing on iOS).
 */

/** v2 = true silence (all-zero samples). Bump when replacing the asset. */
const KEEP_ALIVE_SRC = `${import.meta.env.BASE_URL}lock-keepalive.wav?v=silent2`

let audio: HTMLAudioElement | null = null
let metaTimer: number | null = null
let handlersWired = false
let artworkUrl: string | null = null
let lastFingerprint = ''
let latestPayload: LockScreenPayload | null = null
let actionCallback: ((action: LockScreenAction) => void) | null = null
let visibilityWired = false

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

function setPlaybackAudioSession(): void {
  try {
    const nav = navigator as Navigator & { audioSession?: AudioSessionLike }
    if (nav.audioSession) {
      // Safari 17+: keeps audio eligible for lock-screen Now Playing.
      nav.audioSession.type = 'playback'
    }
  } catch {
    // ignore
  }
}

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (audio) return audio
  try {
    const el = new Audio(KEEP_ALIVE_SRC)
    el.loop = true
    el.preload = 'auto'
    // Volume 0 + silent file. Do not set muted=true — that drops Now Playing on iOS.
    el.volume = 0
    el.muted = false
    el.setAttribute('playsinline', 'true')
    el.setAttribute('webkit-playsinline', 'true')
    el.setAttribute('data-lock-keepalive', 'true')
    el.style.display = 'none'
    // Helpful for some WebKit builds.
    ;(el as HTMLAudioElement & { disableRemotePlayback?: boolean }).disableRemotePlayback = false
    // Attaching to DOM improves Now Playing reliability on iOS Safari.
    document.body.appendChild(el)
    // Cache-bust if an older noisy keepalive was cached by Safari.
    el.load()
    audio = el
    return el
  } catch {
    return null
  }
}

function ensureArtwork(): string {
  if (artworkUrl) return artworkUrl
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.fillStyle = '#0B0E12'
    ctx.fillRect(0, 0, 512, 512)
    ctx.fillStyle = '#D4A017'
    ctx.beginPath()
    // Shield silhouette
    ctx.moveTo(256, 64)
    ctx.lineTo(400, 120)
    ctx.lineTo(400, 280)
    ctx.quadraticCurveTo(400, 380, 256, 448)
    ctx.quadraticCurveTo(112, 380, 112, 280)
    ctx.lineTo(112, 120)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#0B0E12'
    ctx.font = 'bold 110px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('TV', 256, 268)
    artworkUrl = canvas.toDataURL('image/png')
    return artworkUrl
  } catch {
    return ''
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
  const timeText =
    payload.mode === 'stopwatch'
      ? formatStopwatchSeconds(payload.seconds)
      : formatTime(payload.seconds, 'mmss')

  if (payload.mode === 'stopwatch') {
    return {
      title: timeText,
      artist: 'Cronómetro · Timer Viking',
      album: 'Timer Viking',
    }
  }

  const phase = payload.phaseLabel || 'Timer Viking'
  // Time first — lock screen Now Playing shows title largest on iPhone.
  return {
    title: `${timeText} · ${phase}`,
    artist: payload.paused ? 'Pausado · Timer Viking' : 'Timer Viking',
    album: payload.mode === 'tabata' ? 'Tabata' : 'Rondas',
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

function pushWebSession(payload: LockScreenPayload): void {
  if (!('mediaSession' in navigator)) return
  const { title, artist, album } = buildLabels(payload)
  try {
    const art = ensureArtwork()
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork: art
        ? [
            { src: art, sizes: '512x512', type: 'image/png' },
            { src: art, sizes: '256x256', type: 'image/png' },
          ]
        : [],
    })
    navigator.mediaSession.playbackState = payload.paused ? 'paused' : 'playing'
    const duration = Math.max(1, payload.durationSeconds ?? Math.max(1, payload.seconds))
    const position =
      payload.mode === 'stopwatch'
        ? Math.min(duration, payload.seconds)
        : Math.max(0, duration - payload.seconds)
    navigator.mediaSession.setPositionState?.({
      duration,
      position: Math.min(duration, Math.max(0, position)),
      playbackRate: 1,
    })
  } catch {
    // ignore
  }
}

async function pushNativeSession(payload: LockScreenPayload): Promise<void> {
  const { title, artist, album } = buildLabels(payload)
  const art = ensureArtwork()
  const fingerprint = `${title}|${artist}|${payload.running}|${payload.paused}`
  await wireHandlers()
  if (fingerprint !== lastFingerprint) {
    lastFingerprint = fingerprint
    await MediaSession.setMetadata({
      title,
      artist,
      album,
      artwork: art
        ? [
            { src: art, sizes: '512x512', type: 'image/png' },
            { src: art, sizes: '256x256', type: 'image/png' },
          ]
        : undefined,
    })
  }
  const duration = Math.max(1, payload.durationSeconds ?? Math.max(1, payload.seconds))
  const position =
    payload.mode === 'stopwatch'
      ? Math.min(duration, payload.seconds)
      : Math.max(0, duration - payload.seconds)
  try {
    await MediaSession.setPositionState({
      duration,
      position: Math.min(duration, Math.max(0, position)),
      playbackRate: 1,
    })
  } catch {
    // ignore
  }
  await MediaSession.setPlaybackState({
    playbackState: payload.paused ? 'paused' : 'playing',
  })
}

function wireVisibilityResume(): void {
  if (visibilityWired) return
  visibilityWired = true
  const resume = () => {
    if (!latestPayload?.running) return
    setPlaybackAudioSession()
    const el = ensureAudio()
    if (el && el.paused) void el.play().catch(() => undefined)
    if (latestPayload) publishMetadata(latestPayload)
  }
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('pageshow', resume)
  window.addEventListener('focus', resume)
}

function publishMetadata(payload: LockScreenPayload): void {
  // Web/Safari path is the critical one for iPhone.
  pushWebSession(payload)
  void pushNativeSession(payload).catch(() => undefined)
}

function startMetaLoop(): void {
  if (metaTimer !== null) return
  // Refresh Now Playing title every second while locked (JS may throttle more,
  // but audio keep-alive keeps the process eligible on iOS).
  metaTimer = window.setInterval(() => {
    if (!latestPayload) return
    if (latestPayload.running || latestPayload.paused) {
      publishMetadata(latestPayload)
      const el = ensureAudio()
      if (el && latestPayload.running && el.paused) {
        void el.play().catch(() => undefined)
      }
    }
  }, 1000)
}

/**
 * Keep media session + keep-alive tone so iPhone lock screen shows the timer.
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

  const el = ensureAudio()
  if (el) {
    // Re-assert silence every sync — some WebKit builds nudge volume up.
    el.volume = 0
    el.muted = false
    if (payload.running && el.paused) {
      void el.play().catch(() => undefined)
    }
    if (payload.paused && !el.paused) {
      el.pause()
    }
  }

  publishMetadata(payload)
}

/** Must run inside a user gesture (INICIAR) so Safari unlocks audio + Now Playing. */
export function primeLockScreenAudio(): void {
  setPlaybackAudioSession()
  const el = ensureAudio()
  if (!el) return
  // Start then keep playing — do NOT pause after prime on iOS or Now Playing never attaches.
  void el.play().catch(() => undefined)
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    void Notification.requestPermission().catch(() => undefined)
  }
}

export async function stopLockScreen(): Promise<void> {
  latestPayload = null
  lastFingerprint = ''
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
  try {
    await MediaSession.setPlaybackState({ playbackState: 'none' })
  } catch {
    // ignore
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
