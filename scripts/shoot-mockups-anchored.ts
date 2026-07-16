/**
 * Screenshot each feature mockup AND extract the real bounding box of every
 * [data-anchor] element from the DOM — normalized to 0..1 of the shot. This is
 * the content-aware camera data: the director targets an anchor by NAME and the
 * camera frames the ACTUAL element, never a guessed coordinate.
 */
import path from 'path'
import { writeFileSync } from 'fs'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require(path.join('C:/dev/1 - PrismGraphs', 'node_modules/playwright'))

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 })
  const file = 'file://' + path.join(__dirname, 'mockups', 'mockups.html').replace(/\\/g, '/')
  await page.goto(file, { waitUntil: 'networkidle' })
  const out = path.join(__dirname, '..', 'remotion', 'public')

  const anchors: Record<string, Record<string, { x: number; y: number; w: number; h: number }>> = {}
  for (let i = 1; i <= 5; i++) {
    const sel = `#s${i}`
    await page.locator(sel).screenshot({ path: path.join(out, `ui-${i}.png`) })
    // shot's own box, and each anchor's box, → normalize anchor into shot space
    const data = await page.evaluate((s) => {
      const shot = document.querySelector(s)!.getBoundingClientRect()
      const res: Record<string, { x: number; y: number; w: number; h: number }> = {}
      document.querySelectorAll(`${s} [data-anchor]`).forEach((el) => {
        const r = el.getBoundingClientRect()
        const name = (el as HTMLElement).dataset.anchor!
        res[name] = {
          x: (r.left + r.width / 2 - shot.left) / shot.width,   // center x, 0..1
          y: (r.top + r.height / 2 - shot.top) / shot.height,   // center y, 0..1
          w: r.width / shot.width,
          h: r.height / shot.height,
        }
      })
      return res
    }, sel)
    anchors[`ui-${i}`] = data
    console.log(`ui-${i}.png  anchors: ${Object.keys(data).join(', ')}`)
  }
  writeFileSync(path.join(out, 'ui-anchors.json'), JSON.stringify(anchors, null, 2))
  console.log('wrote ui-anchors.json')
  await browser.close()
}
main().catch(e => { console.error(e); process.exit(1) })
