// =============================================================================
// Does the job actually read as five rows, with one open?
//
// The complaint was that the chat version got confusing and never said when to
// drag, drop or paste. So the things worth proving are not "does it compile" —
// they are: can you see the whole job at once, is exactly one row open, does
// each open row TELL you it takes files, and does the chat stay in one place.
//
// A typecheck sees none of that. This page has already shipped three broken
// screens behind three green builds.
//
//   node scripts/steps-check.mjs
//
// Needs the dev server on http://localhost:3000 and the test login in the
// environment. Credentials are never written to a file.
// =============================================================================

import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const EMAIL = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD
if (!EMAIL || !PASSWORD) {
  console.log('Set TEST_EMAIL and TEST_PASSWORD in the environment.')
  process.exit(1)
}

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30_000 })

  await page.goto(`${BASE}/flyer`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // 1. THE WHOLE JOB IS VISIBLE. Five rows, not a scroll you have to read.
  //
  // Scoped to the rail. A bare [aria-expanded] found six, because a design
  // block on the page carries one too — counting every expandable thing on the
  // screen was my mistake, not the page's.
  const rows = page.locator('[data-step-row]')
  const count = await rows.count()
  check('the job reads as five rows', count === 5, `found ${count}`)

  // 2. EXACTLY ONE OPEN. "One open, rest collapsed" was the choice made.
  const open = await page.locator('[aria-expanded="true"]').count()
  check('exactly one row is open', open === 1, `${open} open`)

  // 3. IT SAYS WHERE TO DROP. The whole second half of the complaint.
  const hint = await page.getByText(/drag it here|press ctrl\+v|press ⌘v/i).first().isVisible().catch(() => false)
  check('the open row says you can drag or paste', hint)

  // 4. CLICKING A ROW OPENS IT AND CLOSES THE OTHER — no two-open muddle.
  await rows.nth(2).click()
  await page.waitForTimeout(400)
  const afterClick = await page.locator('[aria-expanded="true"]').count()
  const thirdOpen = await rows.nth(2).getAttribute('aria-expanded')
  check('clicking a row opens that one and only that one',
    afterClick === 1 && thirdOpen === 'true', `${afterClick} open`)

  // 5. THE CHAT DOES NOT MOVE. It was the one thing that had to stay put.
  // The composer input has no type attribute, so input[type="text"] never
  // matched it and the check timed out looking. Found by running it.
  const box = page.locator('input:not([type]), input[type="text"], textarea').last()
  const before = await box.boundingBox()
  await rows.nth(0).click()
  await page.waitForTimeout(400)
  const after = await box.boundingBox()
  const moved = !before || !after ? 999 : Math.abs(before.y - after.y)
  check('the typing box stays put when rows open and close', moved < 2, `moved ${Math.round(moved)}px`)

  // 6. THE PAGE ITSELF STILL DOES NOT SCROLL.
  const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 2)
  check('the page does not scroll', !scrolls)

  // 7. THE RESULTS AREA IS STILL USABLE.
  //
  // THE ONE THAT WOULD HAVE CAUGHT IT. Adding the rows squeezed the area where
  // designs and answers appear down to about thirty pixels with its own tiny
  // scrollbar — solving one problem by creating a worse one. A region that
  // small is not a smaller version of the feature, it is a broken one.
  //
  // Measured with the tallest row open, because that is the worst case and the
  // one that actually happened.
  await rows.nth(0).click()
  await page.waitForTimeout(400)
  const room = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')]
      .find((d) => d.scrollHeight > 0 && getComputedStyle(d).overflowY === 'auto'
        && d.querySelector('[aria-expanded]') === null && d.clientWidth > 400)
    return el ? el.clientHeight : -1
  })
  check('the results area is still big enough to read', room >= 150, `${room}px tall`)
} catch (e) {
  check('ran at all', false, String(e).slice(0, 140))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
