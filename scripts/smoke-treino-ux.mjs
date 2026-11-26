import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })

const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
await context.addInitScript(() => {
  localStorage.setItem('timer-viking:onboarding-v1', '1')
  localStorage.setItem(
    'timer-plus:tabata-settings',
    JSON.stringify({
      prepare: 3,
      work: 20,
      rest: 10,
      rounds: 4,
      cycles: 1,
      cycleRest: 0,
      cooldown: 0,
    }),
  )
})
const page = await context.newPage()
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

if (await page.locator('.coach-overlay').count()) {
  throw new Error('Onboarding should not show when already completed')
}

await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
await page.waitForSelector('.workout-adjust')

const beforeSkip = await page.locator('.phase-time').first().textContent()
await page.getByRole('button', { name: 'PULAR' }).click()
await page.waitForTimeout(300)
const afterSkip = await page.locator('.phase-time').first().textContent()
if (!beforeSkip || !afterSkip) throw new Error('Missing phase time around skip')

const remainBefore = await page.locator('.phase-time').first().textContent()
await page.getByRole('button', { name: '+15s' }).click()
await page.waitForTimeout(250)
const remainAfter = await page.locator('.phase-time').first().textContent()
if (remainBefore === remainAfter) {
  throw new Error(`+15s did not change remaining (${remainBefore})`)
}

await page.getByRole('button', { name: 'RONDAS', exact: true }).click()
await page.waitForTimeout(150)
await page.getByRole('button', { name: 'TABATA', exact: true }).click()
await page.waitForTimeout(150)
if ((await page.locator('.workout-adjust').count()) === 0) {
  throw new Error('Tabata session was killed by tab switch')
}
const stillLive = await page.getByRole('button', { name: /PAUSAR|CONTINUAR/ }).count()
if (!stillLive) throw new Error('Expected Tabata still running/paused after tab switch')

await context.close()

// Fresh context without onboarding flag → coach must appear
const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } })
await fresh.addInitScript(() => {
  localStorage.removeItem('timer-viking:onboarding-v1')
})
const page2 = await fresh.newPage()
await page2.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page2.locator('.coach-overlay').waitFor()
await page2.getByRole('button', { name: 'COMEÇAR' }).click()
await page2.waitForSelector('.coach-overlay', { state: 'detached' })
const flagged = await page2.evaluate(() => localStorage.getItem('timer-viking:onboarding-v1'))
if (flagged !== '1') throw new Error('Onboarding flag not persisted')

console.log(
  JSON.stringify({
    beforeSkip,
    afterSkip,
    remainBefore,
    remainAfter,
    onboarding: flagged,
  }),
)
console.log('PASS smoke-treino-ux')
await browser.close()
