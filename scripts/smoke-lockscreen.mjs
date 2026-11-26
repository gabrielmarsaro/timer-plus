import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.addInitScript(() => {
  localStorage.setItem('timer-viking:onboarding-v1', '1')
})
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
await page.waitForTimeout(600)

const media = await page.evaluate(async () => {
  // Give keep-alive a moment to start.
  await new Promise((r) => setTimeout(r, 200))
  const audio = document.querySelector('audio')
  return {
    hasSession: 'mediaSession' in navigator,
    title: navigator.mediaSession?.metadata?.title ?? null,
    artist: navigator.mediaSession?.metadata?.artist ?? null,
    playback: navigator.mediaSession?.playbackState ?? null,
    audioPaused: audio ? audio.paused : null,
    audioSrc: audio?.currentSrc || audio?.src || null,
    audioVolume: audio?.volume ?? null,
  }
})

if (!media.hasSession) throw new Error('Media Session missing')
if (!media.title || !/\d/.test(media.title)) {
  throw new Error(`Expected time in Now Playing title, got: ${JSON.stringify(media)}`)
}
if (media.playback !== 'playing') {
  throw new Error(`Expected playback playing, got ${media.playback}`)
}
if (media.audioPaused !== false) {
  throw new Error(`Keep-alive audio should be playing: ${JSON.stringify(media)}`)
}
if (!media.audioSrc || !/lock-keepalive\.wav/.test(media.audioSrc)) {
  throw new Error(`Expected lock-keepalive.wav src, got ${media.audioSrc}`)
}
if (media.audioVolume !== 0) {
  throw new Error(`Keep-alive should be silent (volume 0), got ${media.audioVolume}`)
}

const before = await page.evaluate(() => {
  const t = document.querySelector('.phase-time')
  return t?.textContent?.trim() ?? ''
})

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
const dropped = b - a
if (!Number.isFinite(b) || !Number.isFinite(a) || dropped < 1.5 || dropped > 4) {
  throw new Error(`Expected ~2s wall-clock drop, got ${dropped} (${before} → ${after})`)
}

console.log(JSON.stringify({ media, before, after, dropped }))
console.log('PASS')
await browser.close()
