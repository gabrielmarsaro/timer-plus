/**
 * iPhone Safari UA: with Respeitar música, never call speechSynthesis.speak /
 * HTMLAudio.play / mediaSession playing / playback|transient-solo sessions.
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

await new Promise((resolve) => server.listen(5182, '127.0.0.1', resolve))

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
      workoutMusic: false,
      ticking: true,
      vibration: false,
      flashlight: false,
      screenFlash: false,
      rotation: true,
      lightColors: false,
      timeFormat: 'mmss',
    }),
  )

  window.__safariProbe = {
    speechSpeak: 0,
    htmlPlay: 0,
    sessionTypes: [],
    mediaPlaying: 0,
  }

  const speech = window.speechSynthesis
  if (speech) {
    const original = speech.speak.bind(speech)
    speech.speak = (utter) => {
      window.__safariProbe.speechSpeak += 1
      return original(utter)
    }
  }

  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'play')
  const originalPlay = desc?.value ?? HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function playPatched(...args) {
    window.__safariProbe.htmlPlay += 1
    return originalPlay.apply(this, args)
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
        window.__safariProbe.sessionTypes.push(v)
      },
    },
  })

  if (!navigator.mediaSession) {
    // @ts-expect-error stub
    navigator.mediaSession = {}
  }
  const ms = navigator.mediaSession
  Object.defineProperty(ms, 'playbackState', {
    configurable: true,
    get() {
      return this._ps || 'none'
    },
    set(v) {
      this._ps = v
      if (v === 'playing') window.__safariProbe.mediaPlaying += 1
    },
  })
})

await page.goto('http://127.0.0.1:5182/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
await page.waitForTimeout(1200)

const probe = await page.evaluate(() => ({ ...window.__safariProbe }))
const errors = []
if (probe.speechSpeak > 0) errors.push(`speechSynthesis.speak called ${probe.speechSpeak}×`)
if (probe.htmlPlay > 0) errors.push(`HTMLAudio.play called ${probe.htmlPlay}×`)
if (probe.mediaPlaying > 0) errors.push(`mediaSession playing set ${probe.mediaPlaying}×`)
if (!probe.sessionTypes.includes('transient')) errors.push('expected transient for cues')
if (probe.sessionTypes.includes('playback')) errors.push('playback must not be used (steals Spotify)')
if (!probe.sessionTypes.includes('auto')) errors.push('expected release to auto')

if (errors.length) {
  console.error(JSON.stringify({ probe, errors }, null, 2))
  throw new Error(errors.join('; '))
}

console.log(JSON.stringify({ ok: true, probe }))
console.log('PASS smoke-safari-respect')
await browser.close()
server.close()
