import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

await page.getByRole('button', { name: 'RONDAS', exact: true }).click()
await page.waitForTimeout(300)

// Open configure from banner
await page.getByRole('button', { name: /CONFIGURAR RONDAS/i }).click()
await page.getByRole('heading', { name: /Configurar Rondas/i }).waitFor()

// Increase number of rounds with stepper
const roundsCard = page.locator('#settings-field-rounds')
const before = await roundsCard.locator('.stepper-value').textContent()
await roundsCard.getByRole('button', { name: /Aumentar Número de rondas/i }).click()
await page.waitForTimeout(100)
const after = await roundsCard.locator('.stepper-value').textContent()
if (before === after) throw new Error('Rounds stepper did not change value')

await page.getByRole('button', { name: 'Salvar', exact: true }).click()
await page.waitForTimeout(200)

const shown = await page.locator('.stat-blue').first().textContent()
if (shown !== after) {
  throw new Error(`Expected saved rounds ${after} on screen, got ${shown}`)
}

// Tap prepare block opens settings focused
await page.locator('.phase-primary').click()
await page.getByRole('heading', { name: /Configurar Rondas/i }).waitFor()
const focused = page.locator('#settings-field-prepare.is-focused')
await focused.waitFor()
await page.getByRole('button', { name: 'Fechar' }).click()

console.log(JSON.stringify({ before, after, shown }))
console.log('PASS')
await browser.close()
