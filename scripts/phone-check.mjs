// =============================================================================
// Does the builder actually WORK on a phone?
//
// At 390px the page was three fixed columns (216 + flex + 420) inside a row
// with overflow:hidden. They do not fit, so the middle got crushed to a sliver
// and the whole right rail — the steps AND the typing box, i.e. the entire
// working surface — was clipped off the right edge with no way to reach it. A
// person on their phone hit a dead end. A typecheck sees none of that; the DOM
// still "contains" the rail, it is just parked off-screen.
//
//   TEST_EMAIL=... TEST_PASSWORD=... node scripts/phone-check.mjs
//
// The questions that matter, asked the way a thumb asks them: is the typing
// box on screen, are all five steps on screen, and if I aim at the middle of
// each, do I hit IT — or something covering it, or nothing because it is past
// the edge? "Exists in the DOM" is not the same as "reachable", and reachable
// is the whole point on a phone.
//
// Credentials come from the environment and are never written anywhere.
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
// A real phone viewport. 390x844 is an iPhone 12/13/14; give it a hair more
// height so the check is not itself the reason something is below the fold.
const page = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true })

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60_000 })
  await page.goto(`${BASE}/flyer`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const W = 390

  // 1. NOTHING SPILLS SIDEWAYS. If the page is wider than the phone, something
  // is off the edge — the classic three-columns-do-not-fit symptom.
  const overflow = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }))
  check('the page is not wider than the phone', overflow.docW <= overflow.win + 2,
    `page ${overflow.docW}px in a ${overflow.win}px window`)

  // 2. THE TYPING BOX IS ON SCREEN AND YOU CAN TAP IT. Not "is in the DOM" —
  // aim at the middle of it and confirm the tap lands on the box itself.
  const box = await page.evaluate((w) => {
    const el = [...document.querySelectorAll('input,textarea')]
      .find((i) => /describe/i.test(i.placeholder || ''))
    if (!el) return { found: false }
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const onScreen = r.left >= -1 && r.right <= w + 1 && r.top >= 0 && r.bottom <= window.innerHeight + 1
    const hit = document.elementFromPoint(cx, cy)
    return { found: true, onScreen, reachable: el === hit || el.contains(hit), r: { l: Math.round(r.left), rt: Math.round(r.right) } }
  }, W)
  check('the typing box is on screen', box.found && box.onScreen,
    box.found ? `left ${box.r?.l}, right ${box.r?.rt}` : 'no typing box')
  check('the typing box can be tapped', box.reachable === true)

  // THE SEND AND MAKE BUTTONS ARE FULLY ON SCREEN. A box you can type in is no
  // use if the button that sends it is clipped off the right edge — which is
  // exactly what happened to "Make" at 390px, and what an input-only check
  // sailed past. Every button in the composer must sit inside the phone.
  const composerBtns = await page.evaluate((w) => {
    const box = [...document.querySelectorAll('input,textarea')].find((i) => /describe/i.test(i.placeholder || ''))
    if (!box) return { ok: false, note: 'no composer' }
    // The composer is the box's nearest ancestor that also holds buttons.
    let root = box.parentElement
    while (root && !root.querySelector('button')) root = root.parentElement
    const btns = [...(root?.querySelectorAll('button') || [])]
    const off = btns.filter((b) => {
      const r = b.getBoundingClientRect()
      return r.width > 0 && (r.right > w + 1 || r.left < -1)
    }).map((b) => `"${b.textContent.trim().slice(0, 10)}"@${Math.round(b.getBoundingClientRect().right)}`)
    return { ok: off.length === 0, count: btns.length, off }
  }, W)
  check('every composer button is fully on screen', composerBtns.ok,
    composerBtns.off?.length ? `clipped: ${composerBtns.off.join(' ')}` : `${composerBtns.count} buttons fit`)

  // 3. ALL FIVE STEP ROWS ARE ON SCREEN AND TAPPABLE. The rail carries the
  // whole job; a step you cannot reach is a step you cannot answer.
  const rows = page.locator('[data-step-row]')
  const n = await rows.count()
  check('all five step rows are present', n === 5, `found ${n}`)

  let reachable = 0, clipped = []
  for (let i = 0; i < n; i++) {
    // Scroll the row to the MIDDLE of the screen, the way a person reads a row
    // — not letting the browser park it at the very bottom, where the pinned
    // composer and the cookie bar live. `block:'center'` is that: does the row
    // work when it is in the clear middle, which is where you actually tap it.
    await rows.nth(i).evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {})
    await page.waitForTimeout(150)
    const r = await rows.nth(i).evaluate((el, w) => {
      const b = el.getBoundingClientRect()
      const cx = b.left + Math.min(b.width / 2, 30), cy = b.top + b.height / 2
      const withinX = b.left >= -1 && b.right <= w + 1
      const hit = document.elementFromPoint(cx, cy)
      return { withinX, reachable: el === hit || el.contains(hit), l: Math.round(b.left), rt: Math.round(b.right) }
    }, W)
    if (r.reachable && r.withinX) reachable++
    else clipped.push(`#${i + 1}(l${r.l},r${r.rt})`)
  }
  check('every step row is on screen and tappable', reachable === n,
    clipped.length ? `off/covered: ${clipped.join(' ')}` : `${reachable}/${n}`)
} catch (e) {
  check('ran at all', false, String(e).slice(0, 160))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
