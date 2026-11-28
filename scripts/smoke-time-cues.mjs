/**
 * With Respeitar música: visual 3-2-1 + audible Web Audio cues (transient, not playback).
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

await new Promise((resolve) => server.listen(5184, '127.0.0.1', resolve))

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
      soundType: 'beep',
      volume: 0.9,
      voiceAssistant: true,
      voice: 'luciana',
      ducking: true,
      workoutMusic: false,
      ticking: true,
      vibration: false,
      flashlight: false,
      screenFlash: true,
      rotation: true,
      lightColors: false,
      timeFormat: 'mmss',
    }),
  )
  localStorage.setItem(
    'timer-plus:tabata-settings',
    JSON.stringify({
      prepare: 4,
      work: 5,
      rest: 3,
      rounds: 1,
      cycles: 1,
      cycleRest: 0,
      cooldown: 0,
    }),
  )

  window.__cueProbe = {
    speechSpeak: 0,
    htmlPlay: 0,
    sessionTypes: [],
    oscillatorStarts: 0,
  }

  if (window.speechSynthesis) {
    const original = window.speechSynthesis.speak.bind(window.speechSynthesis)
    window.speechSynthesis.speak = (u) => {
      window.__cueProbe.speechSpeak += 1
      return original(u)
    }
  }

  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'play')
  const originalPlay = desc?.value ?? HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...args) {
    window.__cueProbe.htmlPlay += 1
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
        window.__cueProbe.sessionTypes.push(v)
      },
    },
  })

  const OriginalAC = window.AudioContext || window.webkitAudioContext
  if (OriginalAC) {
    const proto = OriginalAC.prototype
    const originalCreate = proto.createOscillator
    proto.createOscillator = function (...args) {
      const osc = originalCreate.apply(this, args)
      const originalStart = osc.start.bind(osc)
      osc.start = (...a) => {
        window.__cueProbe.oscillatorStarts += 1
        return originalStart(...a)
      }
      return osc
    }
  }
})

await page.goto('http://127.0.0.1:5184/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'INICIAR', exact: true }).click()

const seen = new Set()
for (let i = 0; i < 25; i += 1) {
  await page.waitForTimeout(250)
  const text = await page
    .locator('.countdown-burst-digit')
    .first()
    .textContent({ timeout: 50 })
    .catch(() => null)
  if (text) {
    const n = Number(text.trim())
    if (n >= 1 && n <= 3) seen.add(n)
  }
}

const probe = await page.evaluate(() => ({ ...window.__cueProbe }))
const uniqueBursts = [...seen]
const errors = []
if (probe.speechSpeak > 0) errors.push(`speechSynthesis used ${probe.speechSpeak}`)
if (probe.htmlPlay > 0) errors.push(`HTMLAudio.play used ${probe.htmlPlay}`)
if (probe.sessionTypes.includes('playback')) errors.push('playback steals Spotify')
if (!probe.sessionTypes.includes('transient')) {
  errors.push(`expected transient cues, got ${probe.sessionTypes}`)
}
if (probe.oscillatorStarts < 3) {
  errors.push(`expected Web Audio cues, got oscillatorStarts=${probe.oscillatorStarts}`)
}
if (uniqueBursts.length < 3) {
  errors.push(`expected visual 3-2-1, got ${JSON.stringify(uniqueBursts)}`)
}

if (errors.length) {
  console.error(JSON.stringify({ probe, uniqueBursts, errors }, null, 2))
  throw new Error(errors.join('; '))
}

console.log(JSON.stringify({ ok: true, uniqueBursts, probe }))
console.log('PASS smoke-time-cues')
await browser.close()
server.close()
