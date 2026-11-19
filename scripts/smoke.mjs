import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

await page.getByRole('button', { name: 'RONDAS', exact: true }).click()
await page.waitForTimeout(200)

await page.getByRole('button', { name: 'Editar rondas', exact: true }).click()
await page.getByRole('heading', { name: 'EDITAR RONDAS' }).waitFor()

await page.getByRole('button', { name: /RONDAS/ }).filter({ hasText: /^\d+$/ }).or(
  page.locator('.edit-row', { hasText: 'RONDAS' }),
).first().click()

await page.locator('.edit-row', { hasText: 'RONDAS' }).click()
await page.waitForTimeout(100)

const wheel = page.getByRole('listbox', { name: 'RONDAS' })
await wheel.waitFor()
const before = await page.locator('.edit-row.is-selected strong').textContent()

await wheel.evaluate((node) => {
  node.scrollTop += 40
})
await page.waitForTimeout(250)
await wheel.dispatchEvent('touchend')
await page.waitForTimeout(200)

const after = await page.locator('.edit-row.is-selected strong').textContent()
if (!before || !after || before === after) {
  // fallback: arrow key
  await wheel.focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(150)
}
const finalValue = await page.locator('.edit-row.is-selected strong').textContent()
if (!finalValue || finalValue === before) throw new Error('Wheel did not change value')

await page.getByRole('button', { name: 'CONCLUÍDO' }).click()
await page.waitForTimeout(150)
const shown = await page.locator('.stat-blue').first().textContent()
if (shown !== finalValue) throw new Error(`Expected ${finalValue} on screen, got ${shown}`)

console.log(JSON.stringify({ before, finalValue, shown }))
console.log('PASS')
await browser.close()
