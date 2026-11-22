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

await page.getByRole('button', { name: 'Configurações', exact: true }).click()
await page.getByRole('heading', { name: 'CONFIGURAÇÕES' }).waitFor()

const body = await page.locator('.native-sheet-body').innerText()
if (!body.includes('MÚSICA TABATA')) throw new Error('Missing MÚSICA TABATA setting')
if (!body.includes('PULSE') && !body.includes('FAIXA')) throw new Error('Missing FAIXA control')
if (!body.includes('VERSÃO: 1.3.0')) throw new Error('Expected VERSÃO 1.3.0')

await page.getByText('FAIXA', { exact: true }).click()
await page.waitForTimeout(100)
const after = await page.locator('.native-value').filter({ hasText: /DRIVE|STORM|DESLIGADA|PULSE/ }).first().textContent()
if (!after) throw new Error('Track value missing after cycle')

console.log(JSON.stringify({ track: after.trim(), hasMusic: true }))
console.log('PASS')
await browser.close()
server.close()
