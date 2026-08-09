// Sign in and actually USE the slide editor, the way a customer would.
//
//   D2V_USER=... D2V_PASS=... node scripts/smoke-flyer-editor.mjs
//
// Credentials come from the environment and are never written down. The site
// rejects API calls that lack a real browser session, so poking the endpoints
// from a script proves nothing — the only honest check is to drive the UI.
//
// The flyer half of this script has been removed: the maker was rebuilt as a
// chat-first timeline and every selector here was written for the old four-
// panel layout. A stale script that fails for the wrong reason is worse than
// no script — see scripts/smoke-flyer.mjs for the current one.
import { chromium } from 'playwright'

const EMAIL = process.env.D2V_USER
const PASS = process.env.D2V_PASS
const BASE = process.env.D2V_BASE || 'https://docs2video.com'
if (!EMAIL || !PASS) { console.error('set D2V_USER and D2V_PASS'); process.exit(2) }

const log = (s) => console.log(s)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

const errors = []
page.on('pageerror', (e) => errors.push('JS: ' + e.message))
page.on('response', (r) => {
  if (r.status() >= 400 && r.url().includes('/api/')) errors.push(`${r.status()} ${r.url().replace(BASE, '')}`)
})

try {
  // ── sign in ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASS)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 45000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(3000)
  if (page.url().includes('/login')) throw new Error('login failed: ' + (await page.locator('body').innerText()).slice(0, 200).replace(/\s+/g, ' '))
  log(`signed in → ${page.url().replace(BASE, '')}`)

  // ── the slide editor ─────────────────────────────────────────────────
  log('\n--- SLIDE EDITOR ---')
  // A presentation this account owns. The library listing uses a different
  // markup than a plain /videos/ link, so go straight to a known one.
  const href = '/videos/' + (process.env.D2V_VIDEO || '1819bc29-720c-4f4c-9869-b7e0b3fcbaa3')
  {
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    const hasEdit = await page.getByText('Edit slides').count()
    log(`  "Edit slides" button on ${href}: ${hasEdit ? 'present' : 'NOT FOUND'}`)
    if (hasEdit) {
      await page.goto(`${BASE}${href}/edit`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(3500)
      const body = await page.locator('body').innerText()
      const slides = await page.locator('textarea').count()
      log(`  editor loaded: ${/Edit slides/i.test(body) ? 'yes' : 'NO'} — ${slides} text boxes`)
      log(`  price shown: ${/Rebuild/i.test(body) ? (body.match(/Rebuild[^\n]*/) ?? [''])[0].slice(0, 60) : 'not visible'}`)
      await page.screenshot({ path: 'smoke-3-editor.png', fullPage: true })
    }
  }
} catch (e) {
  log('\nFAILED: ' + String(e.message).split('\n')[0])
  await page.screenshot({ path: 'smoke-error.png' }).catch(() => {})
} finally {
  if (errors.length) {
    log('\nerrors seen:')
    ;[...new Set(errors)].slice(0, 10).forEach((e) => log('  ' + e))
  } else log('\nno page errors or failed API calls')
  await browser.close()
}
