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

await new Promise((resolve) => server.listen(5179, '127.0.0.1', resolve))

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:5179/', { waitUntil: 'networkidle' })

// Tabata-only music link on home
const music = page.locator('.tabata-music-link')
await music.waitFor({ state: 'visible', timeout: 3000 })
const musicText = await music.innerText()
if (!musicText.includes('MÚSICA NO YOUTUBE')) throw new Error('Missing Tabata music link')
if (!musicText.includes('TABATA')) throw new Error('Expected curated track label')

// No in-app YouTube dock
if ((await page.locator('.yt-dock').count()) !== 0) throw new Error('yt-dock should be gone')

await page.getByRole('button', { name: 'Configurações', exact: true }).click()
await page.getByRole('heading', { name: 'CONFIGURAÇÕES' }).waitFor()
const body = await page.locator('.native-sheet-body').innerText()
if (!body.includes('SÓ NA ABA TABATA')) throw new Error('Settings should say Tabata-only')
await page.getByRole('button', { name: 'CONCLUÍDO' }).click()

// Rondas must not show the music link
await page.getByRole('button', { name: 'RONDAS', exact: true }).click()
await page.waitForTimeout(200)
if ((await page.locator('.tabata-music-link').count()) !== 0) {
  throw new Error('Music link must not appear on Rondas')
}

console.log(JSON.stringify({ tabataMusic: musicText.replace(/\s+/g, ' ').trim(), rondasClean: true }))
console.log('PASS')
await browser.close()
server.close()
