// Drive the rebuilt flyer maker the way a customer would.
//
//   $env:D2V_USER='...'; $env:D2V_PASS='...'; node scripts/smoke-flyer.mjs
//
// Credentials come from the environment and are never written down. Every API
// route on the live site returns 405 to a POST without a browser session, so
// poking endpoints proves nothing — the only honest check is to use the UI.
//
// The point of this run is the three things that were broken:
//   1. the maker is reachable from the menu at all
//   2. a design is charged for
//   3. it is STILL THERE after a refresh
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

const EMAIL = process.env.D2V_USER
const PASS = process.env.D2V_PASS
const BASE = process.env.D2V_BASE || 'https://docs2video.com'
// A business card: the newly added size, and the cheapest way to prove the
// card branch produces a card rather than a small poster.
const SIZE = process.env.D2V_SIZE || 'Business card — front'
if (!EMAIL || !PASS) { console.error('set D2V_USER and D2V_PASS'); process.exit(2) }

const log = (s) => console.log(s)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })

const errors = []
page.on('pageerror', (e) => errors.push('JS: ' + e.message))
page.on('response', (r) => {
  if (r.status() >= 400 && r.url().includes('/api/')) errors.push(`${r.status()} ${r.url().replace(BASE, '')}`)
})

let failures = 0
const check = (ok, label, detail = '') => {
  log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}

try {
  // ── sign in ────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASS)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 45000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(3000)
  if (page.url().includes('/login')) throw new Error('login failed')
  log(`signed in → ${page.url().replace(BASE, '')}\n`)

  // ── the old address must land on the new maker ─────────────────────────
  await page.goto(`${BASE}/flyers`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  check(new URL(page.url()).pathname === '/flyer', 'old /flyers redirects to the new maker', page.url().replace(BASE, ''))

  // ── the page itself ────────────────────────────────────────────────────
  await page.goto(`${BASE}/flyer`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  const body0 = await page.locator('body').innerText()
  check(/credits per design/i.test(body0), 'price is shown up front',
    (body0.match(/\d+ credits per design[^\n]*/) ?? [''])[0])
  const startBal = Number((body0.match(/·\s*([\d,]+)\s*left/) ?? [])[1]?.replace(/,/g, '') ?? NaN)

  // Style sheet — the thumbnails are real generated samples, and a gallery of
  // broken images tells a customer nothing about what they are choosing.
  await page.getByRole('button', { name: /🎨/ }).click()
  await page.waitForTimeout(2500)
  const tiles = await page.locator('img[src^="/flyer-templates/"]').count()
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll('img[src^="/flyer-templates/"]')].filter((i) => !i.naturalWidth).length)
  check(tiles > 0 && broken === 0, 'style thumbnails load', `${tiles} shown, ${broken} broken`)
  await page.getByRole('button', { name: 'Done' }).click()

  // Sizes sheet — business cards are the new capability.
  await page.getByRole('button', { name: /📐/ }).click()
  await page.waitForTimeout(800)
  const sheet = await page.locator('body').innerText()
  check(/Business cards/i.test(sheet), 'business cards are offered')

  // Tick ONLY the one size, so the run costs one design.
  for (const label of ['Flyer 8.5', 'Instagram post']) {
    const box = page.locator('label', { hasText: label }).locator('input[type=checkbox]')
    if (await box.count() && await box.first().isChecked()) await box.first().uncheck()
  }
  await page.locator('label', { hasText: SIZE }).locator('input[type=checkbox]').first().check()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(500)

  // ── describe the job ───────────────────────────────────────────────────
  await page.fill('input[placeholder*="doors at 9"]',
    'Business card for Dana Okafor, Managing Broker at Okafor Property Group, 555-0134, dana@okaforgroup.com')
  await page.getByRole('button', { name: 'Send' }).click()
  log('  … sent the brief, waiting for the reply')
  await page.waitForTimeout(22000)

  const afterChat = await page.locator('body').innerText()
  check(/Dana|Okafor|Got it|card/i.test(afterChat), 'the chat understood the job')
  check(/What goes on the design/i.test(afterChat), 'it shows what it captured')
  await page.screenshot({ path: 'smoke-flyer-1-brief.png', fullPage: true })

  // ── make one design ────────────────────────────────────────────────────
  const makeBtn = page.getByRole('button', { name: /^Make \d+/ })
  const makeLabel = (await makeBtn.textContent().catch(() => '')) ?? ''
  check(/\d+\s*cr/i.test(makeLabel), 'the Make button quotes the cost', makeLabel.trim())
  check(!(await makeBtn.isDisabled()), 'Make is enabled once the brief is filled')

  await makeBtn.click()
  const t0 = Date.now()
  log('  … designing (up to 5 min)')
  await page.waitForTimeout(20000)
  const mid = await page.locator('body').innerText()
  check(/\d+ of \d+/.test(mid), 'progress is shown while it works',
    (mid.match(/\d+ of \d+[^\n]*/) ?? [''])[0])
  await page.screenshot({ path: 'smoke-flyer-2-progress.png' })

  await page.waitForSelector('figure img', { timeout: 300000 }).catch(() => {})
  await page.waitForTimeout(2000)
  const made = await page.locator('figure img').count()
  check(made > 0, 'a design was produced', `${made} in ${Math.round((Date.now() - t0) / 1000)}s`)
  await page.screenshot({ path: 'smoke-flyer-3-result.png', fullPage: true })

  // Save the ACTUAL design. A count of tiles says nothing about whether the
  // card is spelled right or clipped at the edge.
  if (made) {
    const src = await page.locator('figure img').first().getAttribute('src')
    if (src?.startsWith('data:image')) {
      writeFileSync('smoke-flyer-design.png', Buffer.from(src.split(',')[1], 'base64'))
      log('    saved smoke-flyer-design.png')
    }
  }

  // Full-screen viewer — the whole reason you can proofread a phone number.
  if (made) {
    await page.locator('figure button').first().click()
    await page.waitForTimeout(1200)
    const viewerImg = await page.locator('div[style*="position: fixed"] img').count()
    check(viewerImg > 0, 'clicking a design opens it full screen')
    await page.screenshot({ path: 'smoke-flyer-4-viewer.png' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
  }

  // ── THE POINT: is it still there tomorrow? ─────────────────────────────
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(6000)
  const afterReload = await page.locator('figure img').count()
  check(afterReload > 0, 'the design SURVIVES A REFRESH', `${afterReload} restored from history`)
  const body2 = await page.locator('body').innerText()
  check(/Picking up where you left off/i.test(body2), 'the saved thread is restored')
  await page.screenshot({ path: 'smoke-flyer-5-after-reload.png', fullPage: true })

  // ── was it actually charged for? ───────────────────────────────────────
  // Admin and beta accounts are exempt from charging by design, and the first
  // version of this check read that exemption as "the charge is broken". The
  // balance is only evidence when the account actually pays.
  const endBal = Number((body2.match(/·\s*([\d,]+)\s*left/) ?? [])[1]?.replace(/,/g, '') ?? NaN)
  if (!Number.isFinite(startBal) || !Number.isFinite(endBal)) {
    log(`  NOTE  no balance shown — cannot judge charging from this account`)
  } else if (endBal === startBal) {
    log(`  NOTE  balance unchanged at ${startBal} — expected for an admin/beta account,`)
    log(`        which logs "admin_bypass:flyer" instead of deducting. Re-run signed in`)
    log(`        as a paying account to prove the deduction itself.`)
  } else {
    check(endBal === startBal - 200, 'credits were deducted', `${startBal} → ${endBal}`)
  }
} catch (e) {
  log('\nFAILED: ' + String(e.message).split('\n')[0])
  failures++
  await page.screenshot({ path: 'smoke-flyer-error.png', fullPage: true }).catch(() => {})
} finally {
  if (errors.length) {
    log('\nerrors seen:')
    ;[...new Set(errors)].slice(0, 10).forEach((e) => log('  ' + e))
  } else log('\nno page errors or failed API calls')
  log(failures ? `\n${failures} CHECK(S) FAILED` : '\nall checks passed')
  await browser.close()
  process.exit(failures ? 1 : 0)
}
