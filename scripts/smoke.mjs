import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

await page.getByRole('button', { name: 'RONDAS', exact: true }).click()
await page.waitForTimeout(200)

await page.getByRole('button', { name: 'Configurações', exact: true }).click()
await page.getByRole('heading', { name: 'CONFIGURAÇÕES' }).waitFor()
await page.getByText('EFEITO SONORO').waitFor()
await page.getByRole('button', { name: /TIPO DE SOM/i }).click()
await page.getByRole('button', { name: /VOZ LUCIANA|VOZ SISTEMA/i }).click()
await page.getByRole('button', { name: /FORMATO DE TEMPO/i }).click()
await page.getByRole('button', { name: 'CONCLUÍDO' }).click()

await page.getByRole('button', { name: 'Editar rondas', exact: true }).click()
await page.getByRole('heading', { name: 'EDITAR RONDAS' }).waitFor()

const roundsValue = page.locator('.edit-field').filter({ has: page.locator('.edit-field-label', { hasText: 'RONDAS' }) }).locator('.stepper-value')
const before = await roundsValue.textContent()
await page.getByRole('button', { name: 'Aumentar RONDAS' }).click()
const after = await roundsValue.textContent()
if (before === after) throw new Error('Rounds stepper failed')
await page.getByRole('button', { name: 'CONCLUÍDO' }).click()

await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
await page.waitForTimeout(1200)
const label = await page.locator('.play-label').textContent()
if (label !== 'PAUSAR') throw new Error('Timer did not start')
await page.getByRole('button', { name: 'PAUSAR', exact: true }).click()

console.log(JSON.stringify({ before, after, label }))
console.log('PASS')
await browser.close()
