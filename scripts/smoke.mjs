import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.addInitScript(() => {
  localStorage.setItem('timer-viking:onboarding-v1', '1')
})
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

await page.getByRole('button', { name: 'RONDAS', exact: true }).click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: 'Editar rondas', exact: true }).click()
await page.getByRole('heading', { name: 'EDITAR RONDAS' }).waitFor()

await page.locator('.edit-row', { hasText: 'RONDAS' }).click()
await page.getByRole('dialog', { name: /Ajustar RONDAS/i }).waitFor()

const before = await page.locator('.wheel-card-value').textContent()
const wheel = page.getByRole('listbox', { name: 'RONDAS' })
await wheel.focus()
await page.keyboard.press('ArrowDown')
await page.waitForTimeout(150)
const after = await page.locator('.wheel-card-value').textContent()
if (!before || !after || before === after) throw new Error('Centered wheel did not change')

await page.getByRole('button', { name: 'PRONTO' }).click()
await page.getByRole('button', { name: 'CONCLUÍDO' }).click()
await page.waitForTimeout(150)

const shown = await page.locator('.stat-blue').first().textContent()
if (shown !== after) throw new Error(`Expected ${after}, got ${shown}`)

console.log(JSON.stringify({ before, after, shown }))
console.log('PASS')
await browser.close()
