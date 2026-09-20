/**
 * THE PICK SCREEN, DRIVEN FOR REAL.
 *
 * Types a brief, waits for the shortlist, and checks the things that decide
 * whether the step is actually easy to use:
 *
 *   · the whole tile is the target, not a small button inside it
 *   · ticking shows in more than colour (a tick badge and a border)
 *   · the cap is enforced, and says so rather than silently ignoring a click
 *   · the bar only appears once something is ticked
 *   · every direction says up front whether it gives a real file
 *   · it works at 390px, where most people will meet it
 *
 * Screenshots at each state so the layout can be LOOKED at, not assumed.
 */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.argv[2] || 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/pick-shots'
mkdirSync(OUT, { recursive: true })

const env = Object.fromEntries(
  readFileSync('C:/dev/1 - Restylez/.env.local', 'utf8')
    .split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
)

const BASE = 'http://localhost:3005'
const shot = async (page, name) => { await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true }); console.log(`   shot: ${name}`) }
const ok = (label, pass, detail = '') => console.log(`   ${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
const page = await ctx.newPage()
// Drawing a logo takes minutes. The 30s default silently capped the per-call
// timeouts below, so a working draw looked like a failure.
page.setDefaultTimeout(300_000)
page.on('console', (m) => { if (m.type() === 'error') console.log('   [browser error]', m.text().slice(0, 140)) })

try {
  // ── sign in ────────────────────────────────────────────────────────────
  console.log('signing in…')
  // networkidle, not domcontentloaded: clicking before the form is hydrated
  // fires into a dead button, and the page just reloads /login.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', env.SUPER_ADMIN_EMAIL)
  await page.fill('input[type="password"]', env.SUPER_ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  // Sign-in talks to Supabase directly then does a full page load, so there is
  // no local response to wait on — poll the path.
  for (let i = 0; i < 80 && new URL(page.url()).pathname.startsWith('/login'); i++) await page.waitForTimeout(250)
  if (new URL(page.url()).pathname.startsWith('/login')) throw new Error('still on /login after signing in')
  console.log('   signed in →', new URL(page.url()).pathname)

  // ── the brief ──────────────────────────────────────────────────────────
  console.log('\nfilling the brief…')
  await page.goto(`${BASE}/logo`, { waitUntil: 'networkidle' })
  // A saved project may be offered — start fresh so the test is repeatable.
  const fresh = page.locator('button:has-text("Start a new project")')
  if (await fresh.count()) { await fresh.first().click(); await page.waitForTimeout(400) }

  // The fields carry example placeholders ("e.g. Ridgeline Coffee"), so target
  // them by the example rather than by a name attribute that does not exist.
  await page.fill('input[placeholder*="Ridgeline" i]', 'Hollow Oak')
  await page.fill('input[placeholder*="coffee roaster" i], textarea[placeholder*="coffee roaster" i]',
    'a farm shop selling vegetables, eggs and bread from our own fields')
  await shot(page, '1-brief')

  // ── start → the shortlist ──────────────────────────────────────────────
  console.log('\nstarting — this calls the shortlist…')
  await page.getByRole('button', { name: /Start Logo Studio/i }).click()

  await page.waitForSelector('#picking', { timeout: 90_000 })
  await page.waitForTimeout(600)
  await shot(page, '2-picking')

  const tiles = page.locator('[data-pick]')
  const count = await tiles.count()
  ok('directions offered', count >= 4, `${count} shown`)

  // Every tile says whether it gives a real file, BEFORE choosing.
  const notes = await page.locator('.rz-pick-note').allTextContents()
  ok('each says what you get', notes.length === count && notes.every((n) => /file|artwork/i.test(n)))

  // The whole tile is the target.
  const tag = await tiles.first().evaluate((el) => el.tagName)
  ok('the whole tile is the button', tag === 'BUTTON', tag)

  // The bar is hidden until something is ticked.
  const barBefore = await page.locator('.rz-pick-bar').isVisible()
  ok('no action bar before choosing', !barBefore)

  // Every direction shows a real example, not a grey box with words in it.
  const shots = await page.locator('.rz-pick-shot').count()
  const blanks = await page.locator('.rz-pick-blank').count()
  ok('every direction shows an example picture', shots === count && blanks === 0, `${shots} pictures, ${blanks} blanks`)
  const loaded = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.rz-pick-shot')).every((i) => i.complete && i.naturalWidth > 0))
  ok('the examples actually load', loaded)

  // ── ticking ────────────────────────────────────────────────────────────
  console.log('\nticking directions…')
  await tiles.nth(0).click()
  const pressed = await tiles.nth(0).getAttribute('aria-pressed')
  const hasTick = await tiles.nth(0).locator('.rz-pick-tick').count()
  ok('ticking is announced to screen readers', pressed === 'true')
  ok('ticking shows as more than colour', hasTick === 1, 'tick badge present')
  await shot(page, '3-one-taken')

  await tiles.nth(1).click()
  await tiles.nth(2).click()
  const barText = await page.locator('.rz-pick-bar p').textContent()
  ok('the bar counts what is taken', /3\s*of\s*3/.test(barText ?? ''), (barText ?? '').trim().slice(0, 60))

  // The cap holds: a fourth tile is disabled rather than silently ignored.
  const fourth = tiles.nth(3)
  const disabled = await fourth.isDisabled()
  const title = await fourth.getAttribute('title')
  ok('the cap is enforced', disabled, title ?? '')
  ok('and it explains why', Boolean(title && /untick/i.test(title)))
  await shot(page, '4-cap-reached')

  // Untick to swap.
  await tiles.nth(2).click()
  ok('unticking frees a slot', !(await tiles.nth(3).isDisabled()))

  // ── narrow screen ──────────────────────────────────────────────────────
  console.log('\nat 390px…')
  await page.setViewportSize({ width: 390, height: 900 })
  await page.waitForTimeout(400)
  await shot(page, '5-narrow')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  ok('no sideways scrolling', !overflow)
  const barVisible = await page.locator('.rz-pick-bar').isVisible()
  ok('the action bar is reachable on mobile', barVisible)

  // ── three ways to ask ──────────────────────────────────────────────────
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.waitForTimeout(300)
  const howRows = page.locator('.rz-pick-how')
  ok('taking a card offers a choice of how', await howRows.count() > 0, `${await howRows.count()} shown`)
  const labels = await howRows.first().locator('button').allTextContents()
  ok('both ways are offered', labels.length === 2, labels.join(' / '))
  const firstPressed = await howRows.first().locator('button').first().getAttribute('aria-pressed')
  ok('the exact design is the default', firstPressed === 'true')
  await howRows.first().locator('button').nth(1).click()
  ok('the other way can be chosen', (await howRows.first().locator('button').nth(1).getAttribute('aria-pressed')) === 'true')
  ok('there is a way to skip the styles', await page.locator('button[data-action="free"]').count() === 1)

  // The sticky bar used to float OVER the choices and the skip line, hiding
  // both. Nothing it covers can be clicked, so this checks the real geometry.
  const covered = await page.evaluate(() => {
    const bar = document.querySelector('.rz-pick-bar')
    if (!bar || bar.hidden) return []
    const b = bar.getBoundingClientRect()
    const hit = (el) => { const r = el.getBoundingClientRect(); return r.top < b.bottom && r.bottom > b.top && r.left < b.right && r.right > b.left }
    return Array.from(document.querySelectorAll('.rz-pick-how button, [data-action="free"]'))
      .filter(hit).map((el) => el.textContent.trim().slice(0, 30))
  })
  ok('the action bar covers nothing', covered.length === 0, covered.join(' / '))
  await shot(page, '6-how')

  // ── the copy no longer promises nine ───────────────────────────────────
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.waitForTimeout(300)
  const body = (await page.locator('body').innerText()).toLowerCase()
  ok('no stale promise of nine directions', !/nine directions|of 9 |nine different ideas/.test(body))

  // ── DRAW, if asked: the expensive half, off by default ─────────────────
  if (process.env.RZ_DRAW === '1') {
    console.log('\ndrawing the picked directions (this costs money)…')
    // Earlier checks left tiles ticked. Clear first, then take exactly two —
    // clicking a ticked tile UNTICKS it, which is what left the button dead.
    await page.getByRole('button', { name: /^Clear$/ }).click()
    await page.locator('[data-pick]').nth(0).click()
    await page.locator('[data-pick]').nth(1).click()
    const drawBtn = page.locator('button[data-action="draw"]')
    await drawBtn.waitFor({ state: 'visible' })
    ok('the draw button is live once directions are taken', await drawBtn.isEnabled())
    await drawBtn.click()
    await page.waitForSelector('#directions', { timeout: 60_000 })
    await shot(page, '6-drawing')
    // Wait for both to land, or give up loudly rather than hang.
    await page.waitForFunction(() => document.querySelectorAll(String.fromCharCode(46) + "rz-logo-card img").length >= 2, { timeout: 300_000, polling: 2000 })
    await page.waitForTimeout(800)
    await shot(page, '7-drawn')
    const drawn = await page.locator('.rz-logo-card img').count()
    ok('the picked directions were drawn', drawn >= 2, `${drawn} images`)
    const heading = await page.locator('#directions').innerText()
    ok('the heading counts what was picked', !/of 9/.test(heading), heading.split('\n')[0])
  } else {
    console.log('\n(skipping the draw — set RZ_DRAW=1 to spend money and test it)')
  }

  console.log('\nshots in', OUT)
} catch (e) {
  console.error('\nFAILED:', e.message.slice(0, 300))
  await shot(page, 'error').catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
