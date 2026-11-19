import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

// Tabata start/pause
await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
await page.waitForTimeout(800)
if ((await page.locator('.play-label').textContent()) !== 'PAUSAR') {
  throw new Error('Tabata did not start')
}
await page.getByRole('button', { name: 'PAUSAR', exact: true }).click()
await page.waitForTimeout(200)

// Switch to Rondas
await page.getByRole('button', { name: /RONDAS/i }).click()
await page.waitForTimeout(300)
const title = await page.locator('.header-center h1').textContent()
if (title !== 'RONDAS') throw new Error(`Expected RONDAS title, got ${title}`)

await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
await page.waitForTimeout(800)
const roundsLabel = await page.locator('.play-label').textContent()
const primary = await page.locator('.phase-primary .phase-label').textContent()
console.log(JSON.stringify({ roundsLabel, primary }))
if (roundsLabel !== 'PAUSAR') throw new Error('Rounds did not start')
if (!primary?.includes('PREPARAR') && !primary?.includes('RONDA')) {
  throw new Error(`Unexpected primary phase: ${primary}`)
}

await page.getByRole('button', { name: 'Configurações' }).click()
await page.getByRole('heading', { name: /Configurações Rondas/i }).waitFor()
await page.getByRole('button', { name: 'Fechar' }).click()

console.log('PASS')
await browser.close()
