// =============================================================================
// Is the bottom row of the design page actually reachable?
//
// Two things went wrong here and only one of them was visible in the code.
// Clear chat sat ABOVE the typing box — a destructive control between you and
// the thing you came to use. And once moved below, it landed underneath the
// cookie bar, which is pinned over the whole window and which nothing made room
// for. A typecheck sees neither.
//
//   TEST_EMAIL=... TEST_PASSWORD=... node scripts/bottom-row-check.mjs
//
// Run it with the cookie bar SHOWING (a fresh browser profile, which is what
// Playwright gives you) — that is the state that was broken.
// =============================================================================

import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const EMAIL = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD
if (!EMAIL || !PASSWORD) { console.log('Set TEST_EMAIL and TEST_PASSWORD.'); process.exit(1) }

const results = []
const check = (name, pass, detail = '') => {
  results.push(pass)
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30_000 })
  await page.goto(`${BASE}/flyer`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const clear = page.getByRole('button', { name: 'Clear chat' })
  const box = page.locator('input:not([type]), input[type="text"], textarea').last()
  // Scoped to the row the typing box lives in. A bare /^Make/ matched five
  // buttons — every "Make a slide deck" starter on the page counts. Found by
  // running it, not by reading it.
  const row = box.locator('xpath=..')
  const send = row.getByRole('button', { name: 'Send' })
  const make = row.getByRole('button', { name: /^Make/ })

  const cb = await clear.boundingBox()
  const bb = await box.boundingBox()
  const sb = await send.boundingBox()
  const mb = await make.boundingBox()

  check('there is a Clear chat button', !!cb)
  check('it is BELOW the typing box', !!cb && !!bb && cb.y > bb.y + bb.height - 2,
    cb && bb ? `clear at ${Math.round(cb.y)}, box ends ${Math.round(bb.y + bb.height)}` : '')
  check('Send and Make stay on the same line as the box',
    !!sb && !!mb && !!bb && Math.abs(sb.y - bb.y) < 12 && Math.abs(mb.y - bb.y) < 12)

  // THE ONE THAT WOULD HAVE CAUGHT THE COOKIE BAR. Not "is it in the DOM" —
  // is the point you would click on it covered by something else?
  const clickable = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Clear chat')
    if (!btn) return 'no button'
    const r = btn.getBoundingClientRect()
    if (r.bottom > window.innerHeight) return 'off the bottom of the window'
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return btn.contains(hit) ? 'yes' : `covered by "${(hit?.textContent || hit?.tagName || '?').trim().slice(0, 40)}"`
  })
  check('nothing is covering it (cookie bar included)', clickable === 'yes', clickable)

  // And the bar itself is still visible — the fix must not hide the notice.
  const barSeen = await page.getByText(/essential cookies/i).first().isVisible().catch(() => false)
  check('the cookie notice is still shown', barSeen)
} catch (e) {
  check('ran at all', false, String(e).slice(0, 140))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
