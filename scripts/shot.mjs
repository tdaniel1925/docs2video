// Take a picture of a signed-in page so it can actually be looked at.
//
// Every layout regression in this project came from shipping something nobody
// had seen. A typecheck cannot see a column, a floor, or a scrollbar.
//
//   TEST_EMAIL=... TEST_PASSWORD=... node scripts/shot.mjs /flyer
//
// Credentials come from the environment and are never written anywhere.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const PATHNAME = process.argv[2] || '/flyer'
const EMAIL = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD
if (!EMAIL || !PASSWORD) { console.log('Set TEST_EMAIL and TEST_PASSWORD.'); process.exit(1) }

mkdirSync('.shots', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.click('button[type="submit"]')
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30_000 })

await page.goto(`${BASE}${PATHNAME}`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)

const out = `.shots${PATHNAME.replace(/\//g, '-') || '-page'}.png`
await page.screenshot({ path: out })

// The numbers that matter, alongside the picture — a screenshot shows you it
// looks wrong, the measurements tell you which box to blame.
const boxes = await page.evaluate(() => {
  const scrollers = [...document.querySelectorAll('div,aside')]
    .filter((d) => {
      const s = getComputedStyle(d)
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && d.clientHeight > 0
    })
    .map((d) => ({
      w: Math.round(d.clientWidth), h: Math.round(d.clientHeight),
      scrollable: d.scrollHeight > d.clientHeight + 2,
      first: (d.textContent || '').trim().slice(0, 40),
    }))
  return { scrollers, pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 2 }
})

console.log(`saved ${out}`)
console.log(`page itself scrolls: ${boxes.pageScrolls}`)
console.log(`${boxes.scrollers.length} scrolling region(s):`)
for (const s of boxes.scrollers) {
  console.log(`  ${String(s.w).padStart(5)}x${String(s.h).padStart(4)}  ${s.scrollable ? 'scrolling' : 'fits    '}  "${s.first}"`)
}

await browser.close()
