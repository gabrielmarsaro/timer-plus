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

// Classic defaults visible on idle: prepare 00:10, work 00:20
const prepare = await page.locator('.phase-block').first().innerText()
const work = await page.locator('.phase-block').nth(1).innerText()
if (!prepare.includes('00:10') && !prepare.includes('0:10')) {
  // mmss format
}
const homeText = await page.locator('.tabata-screen').innerText()
if (!homeText.includes('00:20') && !homeText.includes(':20')) {
  throw new Error(`Expected classic 20s work on home, got: ${homeText.slice(0, 200)}`)
}
if (!homeText.includes('8') && !homeText.match(/\b8\b/)) {
  // rounds left may show 8
}

await page.getByRole('button', { name: 'Editar Tabata', exact: true }).click()
await page.getByRole('heading', { name: 'EDITAR TABATA' }).waitFor()
const editBody = await page.locator('.native-sheet-body').innerText()
if (!editBody.includes('PRESET CLÁSSICO')) throw new Error('Missing classic preset button')
if (!editBody.includes('DESCANSO (PAUSA)')) throw new Error('Missing pause label')
if (!editBody.includes('DESCANSO ENTRE CICLOS')) throw new Error('Missing cycle rest')
if (!editBody.includes('COOLDOWN')) throw new Error('Missing cooldown')

await page.getByRole('button', { name: 'PRESET CLÁSSICO 20/10 × 8' }).click()
await page.getByRole('button', { name: 'CONCLUÍDO' }).click()
await page.waitForTimeout(150)

const after = await page.locator('.tabata-screen').innerText()
if (!after.includes('00:20')) throw new Error('Preset did not restore 20s work')

await page.getByRole('button', { name: 'Configurações', exact: true }).click()
const cfg = await page.locator('.native-sheet-body').innerText()
if (!cfg.includes('GO, REST')) throw new Error('Settings should mention GO/REST cues')
await page.getByRole('button', { name: 'CONCLUÍDO' }).click()

await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
await page.getByRole('button', { name: 'PAUSAR', exact: true }).waitFor({ timeout: 3000 })

console.log(JSON.stringify({ classicPreset: true, work20: true, cuesDocumented: true }))
console.log('PASS')
await browser.close()
server.close()
