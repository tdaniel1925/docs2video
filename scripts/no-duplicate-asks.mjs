// =============================================================================
// Is the page asking you the same thing twice?
//
// The right rail had "What are you making?" as row 1 of the steps, AND a card
// in the chat headed "What would you like to make?" with the identical four
// buttons, AND a greeting bubble asking it a third time — all on screen at
// once. Each piece was reasonable on its own; nothing was watching the screen
// as a whole. That is exactly what a person sees, so that is what this checks.
//
//   TEST_EMAIL=... TEST_PASSWORD=... node scripts/no-duplicate-asks.mjs
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
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60_000 })
  await page.goto(`${BASE}/flyer`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  // START CLEAN. The page reopens your last conversation, and old threads have
  // the old greeting saved inside them word for word — a record of what was
  // said, not something this page decides today. Testing against one measured
  // history, not layout. Found by running it and reading the failure properly.
  await page.getByRole('button', { name: '+ New chat' }).click()
  await page.waitForTimeout(1200)

  // ONE ASK. Any wording of "what are you making" counts as the same question,
  // because to a person it IS the same question.
  const asks = await page.evaluate(() => {
    const re = /what (are you|would you like to) mak/i
    return [...document.querySelectorAll('p,h1,h2,h3,span,div,button')]
      .filter((el) => ![...el.children].some((c) => re.test(c.textContent || '')))
      .map((el) => (el.textContent || '').trim())
      .filter((t) => re.test(t) && t.length < 120)
  })
  check('the page asks what you are making exactly once', asks.length === 1,
    asks.length ? asks.map((a) => `"${a}"`).join(' + ') : 'not asked at all')

  // EVERY QUESTION, ONCE — not just the one that was complained about.
  //
  // Fixing "what are you making?" on its own and shipping is how this page got
  // three duplicated pickers in the first place. The chat used to push a look
  // picker, a sizes picker and a photos picker into the conversation while the
  // steps rail showed all three a few inches away — the look one under the
  // very same heading. So the whole rail gets counted, every time.
  const HEADINGS = [
    /how should it look/i,
    /what sizes|which formats/i,
    /(your logo and photos|any photos or a logo)/i,
    /what'?s it about/i,
  ]
  // Every row OPENED, because a collapsed row hides its copy of the picker —
  // and collapsed is exactly the state a lazy check would pass in.
  const rows = page.locator('[data-step-row]')
  for (let i = 0; i < await rows.count(); i++) {
    await rows.nth(i).click()
    await page.waitForTimeout(300)
  }

  for (const re of HEADINGS) {
    const hits = await page.evaluate((src) => {
      const r = new RegExp(src.slice(1, src.lastIndexOf('/')), 'i')
      return [...document.querySelectorAll('p,h1,h2,h3,span,div,button')]
        .filter((el) => ![...el.children].some((c) => r.test(c.textContent || '')))
        .map((el) => (el.textContent || '').trim())
        .filter((t) => r.test(t) && t.length < 120)
    }, re.toString())
    check(`asked once: ${re.source.slice(0, 26)}`, hits.length <= 1, hits.map((h) => `"${h}"`).join(' + '))
  }

  // ONE PICKER, NOT TWO. The middle is a preview stage now; the picking lives
  // in step 3 in the rail. So there must be exactly one GRID of clickable look
  // tiles — count only thumbnails that sit inside a <button> (a picker tile),
  // which excludes the single preview image in the middle (not a button).
  // Those picker tiles must all live in one column.
  //
  // By ancestry, NOT by x-coordinate. An earlier version asked "past 1000px?"
  // — the rail starts at 931, so it always said "middle" and passed for the
  // wrong reason. Proven by putting a tile back in the wrong column and
  // watching it still say ok.
  // Measure with the LOOK row open, or the assertion is vacuous — the row
  // sweep above ends on row 5, tiles unmounted, and "0 tiles in 0 columns"
  // passes without testing anything. (Caught by reading the pass detail.)
  await rows.nth(2).click()
  await page.waitForTimeout(400)
  const grids = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('button img')].filter((i) => /flyer-templates/.test(i.src))
    const cols = new Set(tiles.map((i) => (i.closest('[data-rail]') ? 'rail' : 'middle')))
    return { count: tiles.length, where: [...cols] }
  })
  check('look picker lives in one column only', grids.where.length <= 1,
    `${grids.count} picker tiles in ${grids.where.join(' + ') || 'none'}`)

  // Back to row 1, which the sweep above left collapsed — its buttons are the
  // subject of everything below. (Caught by running it: 0 buttons found.)
  await rows.nth(0).click()
  await page.waitForTimeout(400)

  // ONE SET OF STARTER BUTTONS. The duplicate card carried its own copy, so
  // "Make a slide deck" appeared twice and picking either did different things.
  const deck = await page.getByRole('button', { name: 'Make a slide deck' }).count()
  check('there is one "Make a slide deck" button', deck === 1, `found ${deck}`)

  // AND IT STILL WORKS. Deleting a duplicate must not delete the feature —
  // picking a kind should answer row 1 and move on to the next question.
  await page.getByRole('button', { name: 'Make a slide deck' }).click()
  await page.waitForTimeout(700)
  const answered = await page.locator('[data-step-row]').first().innerText()
  check('picking one answers row 1', /slide deck/i.test(answered), answered.replace(/\n/g, ' · '))
  const moved = await page.locator('[data-step-row][aria-expanded="true"]').innerText().catch(() => '')
  check('and opens the next question', /about/i.test(moved), moved.replace(/\n/g, ' · '))
  const replied = await page.getByText(/what is the deck about/i).first().isVisible().catch(() => false)
  check('and the chat answers back', replied)
} catch (e) {
  check('ran at all', false, String(e).slice(0, 160))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
