import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.addInitScript(() => {
  localStorage.setItem('timer-viking:onboarding-v1', '1')
})
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

await page.getByRole('button', { name: 'CRONÓMETRO', exact: true }).click()
await page.getByRole('heading', { name: 'CRONÓMETRO' }).waitFor()

await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
await page.getByText('PAUSAR', { exact: true }).waitFor({ timeout: 2000 })

await page.waitForTimeout(350)
await page.getByRole('button', { name: 'Volta', exact: true }).click()
await page.getByText('VOLTA 1').waitFor({ timeout: 2000 })

await page.waitForTimeout(250)
await page.getByRole('button', { name: 'Volta', exact: true }).click()
await page.getByText('VOLTA 2').waitFor({ timeout: 2000 })

await page.getByRole('button', { name: 'PAUSAR', exact: true }).click()
await page.getByText('CONTINUAR', { exact: true }).waitFor()

await page.getByRole('button', { name: 'Zerar', exact: true }).click()
await page.getByText('INICIAR', { exact: true }).waitFor()
await page.getByText('As voltas aparecem aqui.').waitFor()

await page.getByRole('button', { name: 'MAIS', exact: true }).click()
await page.getByRole('heading', { name: 'MAIS' }).waitFor()
await page.getByRole('button', { name: 'CONFIGURAÇÕES' }).click()
await page.getByRole('heading', { name: 'CONFIGURAÇÕES' }).waitFor()

console.log('PASS stopwatch+more')
await browser.close()
