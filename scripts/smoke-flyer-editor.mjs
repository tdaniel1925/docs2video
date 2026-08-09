// Sign in and actually USE the two new pages, the way a customer would.
//
//   D2V_USER=... D2V_PASS=... node scripts/smoke-flyer-editor.mjs
//
// Credentials come from the environment and are never written down. The site
// rejects API calls that lack a real browser session, so poking the endpoints
// from a script proves nothing — the only honest check is to drive the UI.
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

  // ── the flyer maker ──────────────────────────────────────────────────
  log('\n--- FLYER MAKER ---')
  await page.goto(`${BASE}/flyer`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  const tiles = await page.locator('img[src^="/flyer-templates/"]').count()
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll('img[src^="/flyer-templates/"]')].filter((i) => !i.naturalWidth).length)
  log(`  template tiles: ${tiles} shown, ${broken} failed to load`)

  // Pick Neon Club, then describe the job.
  await page.getByTitle('Neon Club').click().catch(() => log('  ! could not click Neon Club'))
  await page.fill('input[placeholder*="doors at 9"]', 'Saturday club night at The Foundry, doors 9pm, $20 cover, DJ Sable headlining')
  await page.getByRole('button', { name: 'Send' }).click()
  log('  sent the brief, waiting for the chat…')
  await page.waitForTimeout(20000)

  const chatText = await page.locator('body').innerText()
  const gotReply = /Foundry|tick|sizes|Got it|Updated/i.test(chatText)
  log(`  chat replied: ${gotReply ? 'yes' : 'NO'}`)
  await page.screenshot({ path: 'smoke-1-flyer-chat.png' })

  // Only one size, to keep the run short.
  const makeBtn = page.getByRole('button', { name: /^Make \d+ design/ })
  const label = await makeBtn.textContent().catch(() => '?')
  const disabled = await makeBtn.isDisabled().catch(() => true)
  log(`  make button: "${label?.trim()}" ${disabled ? '(DISABLED)' : '(enabled)'}`)

  if (!disabled) {
    await makeBtn.click()
    log('  generating… (waiting up to 4.5 min)')
    const t0 = Date.now()
    // Photograph the meter mid-flight; a progress bar can only be judged while
    // something is in progress.
    await page.waitForTimeout(25000)
    const mid = await page.locator('body').innerText()
    const m = mid.match(/\d+ of \d+ designed[^\n]*/)
    log('  meter says: ' + (m ? m[0] : 'NOT FOUND'))
    await page.screenshot({ path: 'smoke-progress.png' })
    await page.waitForSelector('a[download$=".png"]', { timeout: 280000 }).catch(() => {})
    const made = await page.locator('a[download$=".png"]').count()
    log(`  designs produced: ${made} after ${Math.round((Date.now()-t0)/1000)}s`)
    await page.screenshot({ path: 'smoke-2-flyer-result.png', fullPage: true })

    // Save the ACTUAL designs, full size. A count of download links only proves
    // something arrived — it says nothing about whether the flyer is any good,
    // spelled right, or clipped at the edge.
    const { writeFileSync } = await import('fs')
    for (let i = 0; i < made; i++) {
      const a = page.locator('a[download$=".png"]').nth(i)
      const name = (await a.getAttribute('download')) || `design-${i}.png`
      const data = await a.getAttribute('href')
      if (data?.startsWith('data:image')) {
        writeFileSync(`out-${name}`, Buffer.from(data.split(',')[1], 'base64'))
        log(`    saved out-${name}`)
      }
    }
  }

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
