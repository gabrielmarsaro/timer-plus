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

await page.locator('.edit-row', { hasText: 'EXERCÍCIO' }).click()
await page.getByRole('dialog', { name: /Ajustar EXERCÍCIO/i }).waitFor()

const secondsWheel = page.getByRole('listbox', { name: /segundos/i })
const box = await secondsWheel.boundingBox()
if (!box) throw new Error('seconds wheel missing')

const beforeScroll = await secondsWheel.evaluate((el) => ({
  top: el.scrollTop,
  left: el.scrollLeft,
}))
const beforeValue = await page.locator('.wheel-card-value').textContent()

// Diagonal drag: mostly vertical with intentional horizontal drift.
const startX = box.x + box.width / 2
const startY = box.y + box.height / 2
await page.mouse.move(startX, startY)
await page.mouse.down()
await page.mouse.move(startX + 28, startY - 120, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(250)

const afterScroll = await secondsWheel.evaluate((el) => ({
  top: el.scrollTop,
  left: el.scrollLeft,
}))
const afterValue = await page.locator('.wheel-card-value').textContent()

if (afterScroll.left !== 0) {
  throw new Error(`Wheel scrolled horizontally: left=${afterScroll.left}`)
}
if (Math.abs(afterScroll.top - beforeScroll.top) < 20) {
  throw new Error(`Wheel did not scroll vertically: ${JSON.stringify({ beforeScroll, afterScroll })}`)
}
if (!beforeValue || !afterValue || beforeValue === afterValue) {
  throw new Error(`Wheel value did not change: ${beforeValue} -> ${afterValue}`)
}

console.log(JSON.stringify({ beforeValue, afterValue, beforeScroll, afterScroll }))
console.log('PASS')
await browser.close()
