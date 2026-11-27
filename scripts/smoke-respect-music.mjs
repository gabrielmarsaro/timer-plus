/**
 * Ensures “Respeitar música” does not claim exclusive audio on open / INICIAR.
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

await new Promise((resolve) => server.listen(5181, '127.0.0.1', resolve))

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

await page.addInitScript(() => {
  localStorage.setItem('timer-viking:onboarding-v1', '1')
  // Default ducking is true; pin explicitly.
  const raw = localStorage.getItem('timer-plus:general-settings')
  const general = raw ? JSON.parse(raw) : {}
  general.ducking = true
  general.workoutMusic = false
  localStorage.setItem('timer-plus:general-settings', JSON.stringify(general))

  window.__audioProbe = {
    sessionTypes: [],
    htmlPlayCount: 0,
    ctxResumeCount: 0,
  }

  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'play')
  const originalPlay = desc?.value ?? HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function playPatched(...args) {
    window.__audioProbe.htmlPlayCount += 1
    return originalPlay.apply(this, args)
  }

  const OriginalAC = window.AudioContext || window.webkitAudioContext
  if (OriginalAC) {
    const Proto = OriginalAC.prototype
    const originalResume = Proto.resume
    Proto.resume = function resumePatched(...args) {
      window.__audioProbe.ctxResumeCount += 1
      return originalResume.apply(this, args)
    }
  }

  Object.defineProperty(navigator, 'audioSession', {
    configurable: true,
    value: {
      get type() {
        return this._type || 'autoplay'
      },
      set type(v) {
        this._type = v
        window.__audioProbe.sessionTypes.push(v)
      },
    },
  })
})

await page.goto('http://127.0.0.1:5181/', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)

// Simulate returning to the app (visibility) — must not resume AudioContext / play keepalive.
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  })
  document.dispatchEvent(new Event('visibilitychange'))
})
await page.waitForTimeout(200)

const beforeStart = await page.evaluate(() => ({ ...window.__audioProbe }))

await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
await page.waitForTimeout(500)

const afterStart = await page.evaluate(() => {
  const keepalives = document.querySelectorAll('[data-lock-keepalive="true"]')
  let keepalivePlaying = 0
  keepalives.forEach((el) => {
    if (!el.paused) keepalivePlaying += 1
  })
  return {
    ...window.__audioProbe,
    keepalivePlaying,
    sessionTypes: window.__audioProbe.sessionTypes.slice(),
  }
})

const errors = []
if (beforeStart.ctxResumeCount > 0) {
  errors.push(`visibility resumed AudioContext (${beforeStart.ctxResumeCount})`)
}
if (beforeStart.htmlPlayCount > 0) {
  errors.push(`HTMLAudio.play on open/visibility (${beforeStart.htmlPlayCount})`)
}
if (afterStart.htmlPlayCount > 0) {
  errors.push(
    `HTMLAudio.play during alert while respecting music (${afterStart.htmlPlayCount}) — should duck via Web Audio / native only`,
  )
}
if (afterStart.sessionTypes.includes('playback')) {
  errors.push(`audioSession set to playback while respecting music: ${afterStart.sessionTypes}`)
}
if (afterStart.keepalivePlaying > 0) {
  errors.push('silent keepalive playing while respecting music')
}

if (errors.length) {
  console.error(JSON.stringify({ beforeStart, afterStart, errors }, null, 2))
  throw new Error(errors.join('; '))
}

console.log(
  JSON.stringify({
    ok: true,
    beforeStart,
    afterStart: {
      htmlPlayCount: afterStart.htmlPlayCount,
      ctxResumeCount: afterStart.ctxResumeCount,
      keepalivePlaying: afterStart.keepalivePlaying,
      sessionTypes: afterStart.sessionTypes,
    },
  }),
)
console.log('PASS smoke-respect-music')
await browser.close()
server.close()
