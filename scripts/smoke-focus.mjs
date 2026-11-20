import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

await page.addInitScript(() => {
  localStorage.setItem(
    'timer-plus:tabata-settings',
    JSON.stringify({
      prepare: 2,
      work: 3,
      rest: 2,
      rounds: 2,
      cycles: 1,
      cycleRest: 0,
      cooldown: 0,
    }),
  )
})

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

if (await page.locator('.phase-stack.is-focus').count()) {
  throw new Error('Focus should be off while idle')
}
if ((await page.locator('.phase-secondary').count()) !== 1) {
  throw new Error('Idle should show secondary phase')
}

await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
await page.waitForTimeout(300)

if ((await page.locator('.phase-stack.is-focus').count()) !== 0) {
  throw new Error('Prepare should not enter focus mode')
}

await page.waitForSelector('.phase-stack.is-focus', { timeout: 8000 })
const workLabel = await page.locator('.phase-primary .phase-label').textContent()
if (!workLabel?.includes('EXERC')) {
  throw new Error(`Expected EXERCÍCIO focus, got ${workLabel}`)
}
if ((await page.locator('.phase-secondary').count()) !== 0) {
  throw new Error('Focus mode must hide secondary')
}
if ((await page.locator('.phase-time-hero').count()) !== 1) {
  throw new Error('Hero time missing in focus')
}

await page.waitForFunction(() => {
  const label = document.querySelector('.phase-stack.is-focus .phase-label')?.textContent || ''
  return label.includes('DESCANSO')
}, { timeout: 10000 })

await page.waitForFunction(() => {
  const label = document.querySelector('.phase-stack.is-focus .phase-label')?.textContent || ''
  return label.includes('EXERC')
}, { timeout: 10000 })

console.log('PASS focus: work → rest → work alone')
await browser.close()
