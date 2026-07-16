/** Screenshot each feature mockup as a clean product image for the commercial. */
import path from 'path'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require(path.join('C:/dev/1 - PrismGraphs', 'node_modules/playwright'))

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 })
  const file = 'file://' + path.join(__dirname, 'mockups', 'mockups.html').replace(/\\/g, '/')
  await page.goto(file, { waitUntil: 'networkidle' })
  const out = path.join(__dirname, '..', 'remotion', 'public')
  for (let i = 1; i <= 5; i++) {
    await page.locator(`#s${i}`).screenshot({ path: path.join(out, `ui-${i}.png`) })
    console.log(`ui-${i}.png`)
  }
  await browser.close()
  console.log('done')
}
main().catch(e => { console.error(e); process.exit(1) })
