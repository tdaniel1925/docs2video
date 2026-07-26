// Screenshot every page of the built deck for review.
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const HERE = dirname(fileURLToPath(import.meta.url))
const FILE = join(HERE, '..', 'out', 'ai-in-medicine.html')
const SHOTS = join(HERE, '..', 'out', '_aimed-shots')
mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2 })
await page.goto('file://' + FILE.replace(/\\/g, '/'))
await page.waitForTimeout(1800)

for (let i = 0; i < 12; i++) {
  // Let count-ups and entrances settle before the shot.
  await page.waitForTimeout(2000)
  await page.screenshot({ path: join(SHOTS, `${String(i + 1).padStart(2, '0')}.png`) })
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollHeight > window.innerHeight + 2 ||
    document.documentElement.scrollWidth > window.innerWidth + 2)
  if (overflow) console.log(`  !! page ${i + 1} overflows one window`)
  if (i < 11) await page.keyboard.press('ArrowRight')
}
await browser.close()
console.log('wrote', SHOTS)
