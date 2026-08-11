// Does the page stay still?
//
//   npx next start -p 3131
//   T2A_EMAIL=... T2A_PASSWORD=... node scripts/layout-check.mjs 3131
//
// Written after three failed attempts at this, all of which typechecked and
// built cleanly and none of which worked. A layout is not verified by tsc; it
// is verified by looking at it.
//
// What it checks, which is exactly what was wrong each time:
//   - the document does not scroll at all
//   - the typing box is inside the window before AND after messages arrive
//   - the typing box does not MOVE when the conversation grows
import { chromium } from 'playwright'

const port = process.argv[2] || 3000
const base = `http://127.0.0.1:${port}`
const email = process.env.T2A_EMAIL
const password = process.env.T2A_PASSWORD
if (!email || !password) {
  console.error('Set T2A_EMAIL and T2A_PASSWORD in the environment (never in a file).')
  process.exit(2)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

let bad = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) bad++
}

try {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', password)
  await page.click('button[type=submit]')
  await page.waitForURL(/dashboard|flyer/, { timeout: 30_000 })

  await page.goto(`${base}/flyer`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const box = () => page.evaluate(() => {
    const input = document.querySelector('input[placeholder^="Describe it"]')
    const r = input?.getBoundingClientRect()
    return {
      docScrolls: document.documentElement.scrollHeight > window.innerHeight + 2,
      inputTop: r ? Math.round(r.top) : null,
      inputBottom: r ? Math.round(r.bottom) : null,
      winH: window.innerHeight,
    }
  })

  const before = await box()
  check(!before.docScrolls, 'the page itself does not scroll',
    before.docScrolls ? 'the document is taller than the window' : '')
  check(before.inputBottom !== null && before.inputBottom <= before.winH,
    'the typing box is inside the window', `bottom ${before.inputBottom} of ${before.winH}`)

  // Fill the thread with enough messages to have overflowed the old layout.
  await page.evaluate(() => {
    const el = document.querySelector('input[placeholder^="Describe it"]')
    if (el) el.scrollIntoView()
  })
  for (let i = 0; i < 6; i++) {
    await page.fill('input[placeholder^="Describe it"]', `test message ${i + 1}`)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(900)
  }
  await page.waitForTimeout(1500)

  const after = await box()
  check(!after.docScrolls, 'STILL does not scroll after six messages')
  check(after.inputTop === before.inputTop,
    'the typing box has not moved', `was ${before.inputTop}, now ${after.inputTop}`)
  check(after.inputBottom <= after.winH, 'the typing box is still inside the window',
    `bottom ${after.inputBottom} of ${after.winH}`)

  // ---- NOTHING IS CHOSEN FOR YOU -------------------------------------------
  //
  // A customer described a birthday flyer and went straight to two finished
  // designs for 400 credits, never having been shown a format, a style, or the
  // photo upload — because two formats and a style were already selected before
  // anyone was asked. Make was live from the first sentence.
  console.log('\nnothing chosen on your behalf\n')

  await page.goto(`${base}/flyer`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const makeState = () => page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const make = btns.find((b) => /^Make/.test(b.textContent?.trim() ?? ''))
    return {
      label: make?.textContent?.trim() ?? null,
      disabled: make ? make.disabled : null,
      // "2 sizes" or "400 cr" on a fresh chat means something was pre-ticked.
      mentionsCost: /\d+\s*cr/.test(make?.textContent ?? ''),
    }
  })

  const fresh = await makeState()
  check(fresh.disabled === true, 'Make is disabled on a fresh chat',
    fresh.disabled ? '' : `it was live and said "${fresh.label}"`)
  check(!fresh.mentionsCost, 'Make does not quote a price before anything is chosen',
    fresh.mentionsCost ? `it said "${fresh.label}"` : '')

  // Describe a job. Content alone must NOT be enough to start spending.
  await page.fill('input[placeholder^="Describe it"]',
    'birthday party flyer for Sam, January 10 2027, 128 Main Street Dallas, BYOB')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(6000)

  const described = await makeState()
  check(described.disabled === true, 'STILL disabled after describing the job',
    described.disabled ? '' : `it went live as "${described.label}" with no format or style chosen`)

  const asked = await page.evaluate(() =>
    /Which formats|What would you like to make/i.test(document.body.innerText))
  check(asked, 'a picker was opened without being asked for')

  // ---- THE STARTER BUTTONS ACTUALLY DO SOMETHING ---------------------------
  //
  // Three of the four led nowhere: the card vanished and the screen went blank,
  // because only "Make a slide deck" had a follow-on question wired to it.
  console.log('\nevery starter leads somewhere\n')

  for (const [label, expect] of [
    ['Make something to print', /Which formats/i],
    ['Make a graphic', /Which formats/i],
    ['Make a set', /Which formats/i],
    ['Make a slide deck', /How many slides/i],
  ]) {
    await page.goto(`${base}/flyer`, { waitUntil: 'networkidle' })
    // A fresh chat, so the starter card is the one on screen.
    await page.click('text=+ New chat')
    await page.waitForTimeout(1200)
    await page.click(`button:has-text("${label}")`)
    await page.waitForTimeout(900)
    const landed = await page.evaluate(() => document.body.innerText)
    check(expect.test(landed), `"${label}" opens the next question`,
      expect.test(landed) ? '' : 'the card vanished and nothing replaced it')
  }

  await page.screenshot({ path: '.layout-check.png' })
  console.log('\nwrote .layout-check.png')
} catch (e) {
  console.error('check could not run:', e.message)
  bad++
} finally {
  await browser.close()
}

console.log(bad ? `\n${bad} problem(s)\n` : '\nthe layout stays put\n')
process.exit(bad ? 1 : 0)
