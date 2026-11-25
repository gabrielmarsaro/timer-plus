import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
await page.waitForTimeout(400)

const before = await page.evaluate(() => {
  const t = document.querySelector('.phase-time')
  return t?.textContent?.trim() ?? ''
})

// Simulate screen lock: mark document hidden for ~2.2s then restore.
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'hidden',
  })
  document.dispatchEvent(new Event('visibilitychange'))
})
await page.waitForTimeout(2200)
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  })
  document.dispatchEvent(new Event('visibilitychange'))
  window.dispatchEvent(new Event('focus'))
})
await page.waitForTimeout(200)

const after = await page.evaluate(() => {
  const t = document.querySelector('.phase-time')
  return t?.textContent?.trim() ?? ''
})

const media = await page.evaluate(() => ({
  hasSession: 'mediaSession' in navigator,
  title: navigator.mediaSession?.metadata?.title ?? null,
  artist: navigator.mediaSession?.metadata?.artist ?? null,
  playback: navigator.mediaSession?.playbackState ?? null,
}))

function toSeconds(text) {
  const parts = text.split(':').map((p) => Number(p))
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
    return parts[0] * 60 + parts[1]
  }
  const n = Number(text)
  return Number.isFinite(n) ? n : NaN
}

const b = toSeconds(before)
const a = toSeconds(after)
if (!Number.isFinite(b) || !Number.isFinite(a)) {
  throw new Error(`Could not parse times before=${before} after=${after}`)
}
const dropped = b - a
if (dropped < 1.5 || dropped > 4) {
  throw new Error(`Expected ~2s wall-clock drop, got ${dropped} (before=${before} after=${after})`)
}
if (!media.hasSession) throw new Error('Media Session missing')
if (!media.title && !media.artist) {
  throw new Error(`Lock screen metadata empty: ${JSON.stringify(media)}`)
}

console.log(JSON.stringify({ before, after, dropped, media }))
console.log('PASS')
await browser.close()
