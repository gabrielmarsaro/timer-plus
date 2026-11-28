/**
 * iPhone Safari: opening the app must not create AudioContext, set audioSession,
 * call speechSynthesis, or play HTMLAudio.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join } from 'node:path'

const root = new URL('../dist', import.meta.url).pathname
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.wav': 'audio/wav',
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  let path = join(root, url.pathname === '/' ? 'index.html' : url.pathname)
  if (!existsSync(path)) {
    res.writeHead(404)
    res.end('missing')
    return
  }
  res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' })
  res.end(readFileSync(path))
})

await new Promise((resolve) => server.listen(5183, '127.0.0.1', resolve))

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  hasTouch: true,
  isMobile: true,
})
const page = await context.newPage()

await page.addInitScript(() => {
  localStorage.setItem('timer-viking:onboarding-v1', '1')
  localStorage.setItem(
    'timer-plus:general-settings',
    JSON.stringify({
      soundEffect: true,
      soundType: 'censor',
      volume: 0.85,
      voiceAssistant: true,
      voice: 'luciana',
      ducking: true,
      workoutMusic: true,
      workoutMusicTrack: 'pulse',
      ticking: true,
      vibration: false,
      flashlight: false,
      screenFlash: false,
      rotation: true,
      lightColors: false,
      timeFormat: 'mmss',
    }),
  )

  window.__openProbe = {
    audioContextNew: 0,
    sessionTypes: [],
    speechGetVoices: 0,
    htmlPlay: 0,
    mediaPlaying: 0,
  }

  const OriginalAC = window.AudioContext || window.webkitAudioContext
  if (OriginalAC) {
    const Patched = function AudioContextPatched(...args) {
      window.__openProbe.audioContextNew += 1
      return new OriginalAC(...args)
    }
    Patched.prototype = OriginalAC.prototype
    Object.setPrototypeOf(Patched, OriginalAC)
    window.AudioContext = Patched
    window.webkitAudioContext = Patched
  }

  Object.defineProperty(navigator, 'audioSession', {
    configurable: true,
    value: {
      _type: 'auto',
      get type() {
        return this._type
      },
      set type(v) {
        this._type = v
        window.__openProbe.sessionTypes.push(v)
      },
    },
  })

  if (window.speechSynthesis) {
    const original = window.speechSynthesis.getVoices.bind(window.speechSynthesis)
    window.speechSynthesis.getVoices = (...args) => {
      window.__openProbe.speechGetVoices += 1
      return original(...args)
    }
  }

  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'play')
  const originalPlay = desc?.value ?? HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function playPatched(...args) {
    window.__openProbe.htmlPlay += 1
    return originalPlay.apply(this, args)
  }

  if (!navigator.mediaSession) {
    // @ts-expect-error stub
    navigator.mediaSession = {}
  }
  Object.defineProperty(navigator.mediaSession, 'playbackState', {
    configurable: true,
    get() {
      return this._ps || 'none'
    },
    set(v) {
      this._ps = v
      if (v === 'playing') window.__openProbe.mediaPlaying += 1
    },
  })
})

await page.goto('http://127.0.0.1:5183/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const probe = await page.evaluate(() => ({ ...window.__openProbe }))
const errors = []
if (probe.audioContextNew > 0) errors.push(`AudioContext created on open (${probe.audioContextNew})`)
if (probe.sessionTypes.length > 0) errors.push(`audioSession set on open: ${probe.sessionTypes}`)
if (probe.speechGetVoices > 0) errors.push(`getVoices on open (${probe.speechGetVoices})`)
if (probe.htmlPlay > 0) errors.push(`HTMLAudio.play on open (${probe.htmlPlay})`)
if (probe.mediaPlaying > 0) errors.push(`mediaSession playing on open`)

if (errors.length) {
  console.error(JSON.stringify({ probe, errors }, null, 2))
  throw new Error(errors.join('; '))
}

console.log(JSON.stringify({ ok: true, probe }))
console.log('PASS smoke-safari-open')
await browser.close()
server.close()
