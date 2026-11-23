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

// No YouTube chrome on Tabata home
if ((await page.locator('.tabata-music-link').count()) !== 0) {
  throw new Error('YouTube music link should be removed')
}
if ((await page.locator('.yt-dock').count()) !== 0) throw new Error('yt-dock should be gone')

await page.getByRole('button', { name: 'Configurações', exact: true }).click()
await page.getByRole('heading', { name: 'CONFIGURAÇÕES' }).waitFor()
const body = await page.locator('.native-sheet-body').innerText()
if (!body.includes('NOSSA MÚSICA TABATA')) throw new Error('Missing NOSSA MÚSICA TABATA')
if (!body.includes('SEM YOUTUBE')) throw new Error('Settings should say SEM YOUTUBE')
if (!body.includes('TABATA 160') && !body.includes('FAIXA')) {
  throw new Error('Expected FAIXA / TABATA 160')
}

await page.getByText('FAIXA', { exact: true }).click()
await page.waitForTimeout(80)
const track = await page.locator('.native-value').filter({ hasText: /HIIT|POWER|TABATA/ }).first().textContent()
if (!track) throw new Error('Track did not cycle')

await page.getByRole('button', { name: 'CONCLUÍDO' }).click()
await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
await page.waitForTimeout(300)
const pause = page.getByRole('button', { name: 'PAUSAR', exact: true })
await pause.waitFor({ state: 'visible', timeout: 3000 })

console.log(JSON.stringify({ track: track.trim(), tabataRunning: true, noYoutubeUi: true }))
console.log('PASS')
await browser.close()
server.close()
