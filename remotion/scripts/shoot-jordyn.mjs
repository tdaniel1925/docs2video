/**
 * CAPTURE THE REAL PRODUCT, FOR THE FILM.
 *
 * The Jordyn video was built from eight illustrations and read as a slide
 * deck, while the Restylez film it was meant to match used 25 real product
 * screenshots — actual flyers, real before-and-afters. That is the whole
 * difference, and no amount of motion code closes it: nobody can judge an
 * illustration of an inbox, and everybody can judge a real one.
 *
 * jordyn.app has a page built for exactly this — /screenshot-mock — a
 * pixel-faithful replica of the chat screen carrying DEMO data (Martinez,
 * Chen, Wilson at harborlifegroup.com), with ?scene= switching the
 * conversation between industries. No login, and no real client ever appears
 * in a marketing film.
 *
 * Captured at 1920x1080 because that is the film's resolution: a 1440-wide
 * shot scaled up is soft, and softness is the one thing a viewer reads as
 * cheap without being able to say why.
 *
 *   node scripts/shoot-jordyn.mjs
 */

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'fs'
import path from 'path'

const BASE = process.env.JORDYN_URL || 'http://localhost:2935'
const OUT = path.resolve('public/showcase/jordyn-hire/real')

/*
 * THE SELF-TEST ACCOUNT, NOT A REAL ONE.
 *
 * /screenshot-mock sits behind the app's auth middleware. The repo already
 * has a dedicated probe account for exactly this — sim-battery@selftest —
 * whose password lives in the app's own .env.local. Signing in as the owner
 * would put real clients and real email addresses into a marketing film.
 */
const JORDYN_REPO = process.env.JORDYN_REPO || 'C:/dev/1 - jordyn 2026'
const SIM_EMAIL = 'sim-battery@selftest.jordyn.app'
const simPassword = () => {
  const env = readFileSync(path.join(JORDYN_REPO, '.env.local'), 'utf8')
  const m = env.match(/^E2E_SIM_PASSWORD=(.*)$/m)
  if (!m) throw new Error('E2E_SIM_PASSWORD not found in the app\'s .env.local')
  return m[1].trim()
}

const signIn = async (page) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.locator('input[type="email"]').first().fill(SIM_EMAIL)
  await page.locator('input[type="password"]').first().fill(simPassword())
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45000 })
}

/*
 * WHAT THE FILM NEEDS, BEAT BY BEAT.
 *
 * Each entry is a shot the story actually asks for, not a tour of the app.
 * The industry scenes matter because the film's claim is that she speaks YOUR
 * business — three visibly different conversations prove it in a way a
 * sentence cannot.
 */
const SHOTS = [
  { name: 'chat-cases', path: '/screenshot-mock?scene=cases' },
  { name: 'chat-call', path: '/screenshot-mock?scene=call' },
  { name: 'chat-letter', path: '/screenshot-mock?scene=letter' },
  { name: 'chat-realestate', path: '/screenshot-mock?scene=realestate' },
  { name: 'chat-law', path: '/screenshot-mock?scene=law' },
  { name: 'chat-hvac', path: '/screenshot-mock?scene=hvac' },
  { name: 'chat-accounting', path: '/screenshot-mock?scene=accounting' },
]

const run = async () => {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  /* deviceScaleFactor 2 so a shot can be pushed into on screen without
     falling apart — the camera moves in on these. */
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  await signIn(page)

  for (const shot of SHOTS) {
    const url = `${BASE}${shot.path}`
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
      /* fonts and any entrance animation settle before the shutter */
      await page.waitForTimeout(1200)
      /*
       * CHROME THAT BELONGS TO THE SESSION, NOT THE PRODUCT.
       *
       * A "set your time zone" banner and the support-chat bubble are true of
       * this browser on this morning, not of the app — on screen at 1920 they
       * read as clutter the viewer has to look past. Hidden rather than
       * clicked away: dismissing the banner writes a preference to the test
       * account, and a screenshot script should not change state.
       */
      await page.addStyleTag({ content: `
        [class*="timezone" i], [class*="tz-banner" i],
        [id*="intercom" i], [class*="intercom" i],
        [class*="support-bubble" i], [aria-label*="help" i],
        [class*="launcher" i] { display: none !important; }
      ` }).catch(() => {})
      await page.waitForTimeout(200)
      const file = path.join(OUT, `${shot.name}.png`)
      await page.screenshot({ path: file })
      console.log('ok   ', shot.name)
    } catch (e) {
      console.log('FAIL ', shot.name, '-', e.message.split('\n')[0])
    }
  }
  await browser.close()
}

run().catch((e) => { console.error(e); process.exit(1) })
