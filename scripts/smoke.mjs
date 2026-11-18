import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
await page.waitForTimeout(1200)

const label = await page.locator('.play-label').textContent()
const phaseTime = await page.locator('.phase-time-lg').textContent()
console.log(JSON.stringify({ label, phaseTime }, null, 2))

if (label !== 'PAUSAR') throw new Error(`Expected PAUSAR after start, got ${label}`)

const t1 = phaseTime
await page.waitForTimeout(1500)
const t2 = await page.locator('.phase-time-lg').textContent()
console.log(JSON.stringify({ t1, t2 }))
if (t1 === t2) throw new Error('Timer did not tick')

await page.getByRole('button', { name: 'PAUSAR', exact: true }).click()
await page.waitForTimeout(200)
const pausedLabel = await page.locator('.play-label').textContent()
if (pausedLabel !== 'CONTINUAR') throw new Error('Pause failed')

await page.getByRole('button', { name: 'Configurações' }).click()
await page.getByRole('heading', { name: 'Configurações' }).waitFor()
await page.getByRole('button', { name: 'Fechar' }).click()

console.log('PASS')
await browser.close()
