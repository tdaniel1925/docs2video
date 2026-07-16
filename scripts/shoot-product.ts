/** Screenshot docs2video.com sections as "product photos" for the commercial. */
import path from 'path'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require(path.join('C:/dev/1 - PrismGraphs', 'node_modules/playwright'))

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 })
  await page.goto('https://docs2video.com/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const out = path.join(__dirname, '..', 'remotion', 'public')
  // Hero / top of page
  await page.screenshot({ path: path.join(out, 'product-1.png') })
  // Mid-page feature section
  await page.evaluate(() => window.scrollTo(0, Math.round(document.body.scrollHeight * 0.35)))
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(out, 'product-2.png') })
  // Lower section (pricing/social proof)
  await page.evaluate(() => window.scrollTo(0, Math.round(document.body.scrollHeight * 0.65)))
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(out, 'product-3.png') })
  await browser.close()
  console.log('product shots saved')
}
main().catch(e => { console.error(e); process.exit(1) })
