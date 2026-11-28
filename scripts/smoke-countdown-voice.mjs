/**
 * Voice countdown: “10 segundos” → 3, 2, 1 → “Go” on work start.
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

await new Promise((resolve) => server.listen(5185, '127.0.0.1', resolve))

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

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
      ducking: false,
      workoutMusic: false,
      ticking: false,
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
      prepare: 12,
      work: 5,
      rest: 3,
      rounds: 1,
      cycles: 1,
      cycleRest: 0,
      cooldown: 0,
    }),
  )

  window.__voiceProbe = { spoken: [] }
  if (window.speechSynthesis) {
    const original = window.speechSynthesis.speak.bind(window.speechSynthesis)
    window.speechSynthesis.speak = (u) => {
      window.__voiceProbe.spoken.push(String(u.text || ''))
      return original(u)
    }
  }
})

await page.goto('http://127.0.0.1:5185/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'INICIAR', exact: true }).click()

const seen = new Set()
let sawGo = false
for (let i = 0; i < 80; i += 1) {
  await page.waitForTimeout(250)
  const text = await page
    .locator('.countdown-burst-digit')
    .first()
    .textContent({ timeout: 50 })
    .catch(() => null)
  if (text) {
    const t = text.trim()
    if (t === 'GO') sawGo = true
    const n = Number(t)
    if (n >= 1 && n <= 3) seen.add(n)
  }
  const spoken = await page.evaluate(() => window.__voiceProbe.spoken.slice())
  if (spoken.some((s) => /^go$/i.test(s.trim())) && seen.size >= 3) break
}

const spoken = await page.evaluate(() => window.__voiceProbe.spoken.slice())
const errors = []
if (!spoken.some((s) => /10\s*segundos/i.test(s))) {
  errors.push(`missing “10 segundos”, got ${JSON.stringify(spoken)}`)
}
for (const n of ['3', '2', '1']) {
  if (!spoken.some((s) => s.trim() === n)) errors.push(`missing spoken ${n}`)
}
if (!spoken.some((s) => /^go$/i.test(s.trim()))) {
  errors.push(`missing spoken Go, got ${JSON.stringify(spoken)}`)
}
if (seen.size < 3) errors.push(`missing visual 3-2-1, got ${[...seen]}`)
if (!sawGo) errors.push('missing visual GO')

if (errors.length) {
  console.error(JSON.stringify({ spoken, seen: [...seen], sawGo, errors }, null, 2))
  throw new Error(errors.join('; '))
}

console.log(JSON.stringify({ ok: true, spoken, seen: [...seen], sawGo }))
console.log('PASS smoke-countdown-voice')
await browser.close()
server.close()
