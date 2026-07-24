import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'public', 'jordyn'); mkdirSync(OUT, { recursive: true })

const b = await chromium.launch()
const pg = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await pg.goto('https://jordyn.app', { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('nav warn', e.message))
await pg.waitForTimeout(2500)

// full page screenshot
await pg.screenshot({ path: join(OUT, 'full.png'), fullPage: true })
// hero fold
await pg.screenshot({ path: join(OUT, 'hero.png') })

// scroll captures every ~800px
const height = await pg.evaluate(() => document.body.scrollHeight)
let i = 0
for (let y = 0; y < height; y += 800) {
  await pg.evaluate((yy) => window.scrollTo(0, yy), y)
  await pg.waitForTimeout(500)
  await pg.screenshot({ path: join(OUT, `sec-${i}.png`) })
  i++
  if (i > 14) break
}

// pull text content + palette hints
const data = await pg.evaluate(() => {
  const txt = document.body.innerText.slice(0, 8000)
  const grab = (sel) => [...document.querySelectorAll(sel)].map(e => e.innerText.trim()).filter(Boolean).slice(0, 40)
  const title = document.title
  // collect colors from computed styles of key els
  const colors = new Set()
  for (const el of document.querySelectorAll('body,h1,h2,h3,button,a,section,div')) {
    const cs = getComputedStyle(el)
    ;[cs.backgroundColor, cs.color].forEach(c => { if (c && c !== 'rgba(0, 0, 0, 0)') colors.add(c) })
    if (colors.size > 60) break
  }
  return {
    title,
    h1: grab('h1'), h2: grab('h2'), h3: grab('h3'),
    buttons: grab('button, a[class*=btn], a[class*=Button]'),
    text: txt,
    colors: [...colors].slice(0, 40),
    fonts: getComputedStyle(document.body).fontFamily,
  }
})
console.log(JSON.stringify(data, null, 2))
await b.close()
process.exit(0)
