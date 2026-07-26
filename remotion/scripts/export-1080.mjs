// Export generated pages as true 1920x1080 PNGs.
//
// The image API caps out at 1376x768 no matter what imageSize you ask for, so
// full-HD slides need an upsample. Source is 1.7917 and the target is 1.7778 —
// close but not equal. We scale to fill rather than crop: an 0.8% horizontal
// squash is imperceptible, whereas cropping would eat into the corner badges
// and the full-width footer bar that every page ends with.
import { mkdirSync, readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', process.env.SLIDES_DIR || '.illus-flyer')
const OUT = join(HERE, '..', 'out', process.env.OUT_DIR || 'illustration-1080')
mkdirSync(OUT, { recursive: true })

const W = Number(process.env.W || 1920), H = Number(process.env.H || 1080)
const files = readdirSync(SRC).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
for (const f of files) {
  // Inline as a data URI: setContent runs on an about:blank origin, which
  // blocks file:// subresources and silently yields a black frame.
  const src = 'data:image/jpeg;base64,' + readFileSync(join(SRC, f)).toString('base64')
  await page.setContent(
    `<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}
     img{width:${W}px;height:${H}px;object-fit:fill;display:block;image-rendering:auto}</style>
     <img src="${src}">`)
  await page.waitForSelector('img')
  await page.evaluate(() => { const i = document.querySelector('img'); return i.complete || i.decode() })
  await page.screenshot({ path: join(OUT, f.replace(/\.\w+$/, '.png')) })
  console.log('[1080]', f)
}
await browser.close()
console.log('\nwrote', OUT, `(${files.length} × ${W}x${H})`)
