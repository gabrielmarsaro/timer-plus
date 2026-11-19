import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

await page.getByRole('button', { name: 'RONDAS', exact: true }).click()
await page.waitForTimeout(250)

// Gear → general settings
await page.getByRole('button', { name: 'Configurações', exact: true }).click()
await page.getByRole('heading', { name: 'CONFIGURAÇÕES' }).waitFor()
await page.getByText('EFEITO SONORO').waitFor()
await page.getByText('VIBRAÇÃO').waitFor()
await page.getByRole('button', { name: 'CONCLUÍDO' }).click()

// Right timer icon → edit rounds
await page.getByRole('button', { name: 'Editar rondas', exact: true }).click()
await page.getByRole('heading', { name: 'EDITAR RONDAS' }).waitFor()
const roundsField = page.locator('.edit-field', { hasText: 'RONDAS' })
const before = await roundsField.locator('.stepper-value').textContent()
await roundsField.getByRole('button', { name: /Aumentar RONDAS/i }).click()
const after = await roundsField.locator('.stepper-value').textContent()
if (before === after) throw new Error('Rounds edit stepper failed')
await page.getByRole('button', { name: 'CONCLUÍDO' }).click()
await page.waitForTimeout(200)

const shown = await page.locator('.stat-blue').first().textContent()
if (shown !== after) throw new Error(`Expected ${after} rounds on screen, got ${shown}`)

console.log(JSON.stringify({ before, after, shown }))
console.log('PASS')
await browser.close()
