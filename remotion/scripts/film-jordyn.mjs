/**
 * FILM THE PRODUCT BEING USED.
 *
 * Screenshots proved the app exists. Footage proves it WORKS — a cursor that
 * moves, a click that lands, a panel that answers. The difference between a
 * picture of a thing and a recording of it being used is the difference
 * between a brochure and a demo, and the film has been living on the wrong
 * side of that line.
 *
 * Playwright records video natively. What it does NOT do is show a cursor —
 * the mouse is a real input but an invisible one, so a recording of a click
 * looks like the UI moving on its own. So we inject one, and give it weight:
 * it eases, it arrives, it presses. That injected cursor is the single thing
 * that turns a screen capture into a performance.
 *
 *   node scripts/film-jordyn.mjs            # everything
 *   node scripts/film-jordyn.mjs drag chat  # named shots only
 */

import { chromium } from 'playwright'
import { mkdirSync, readFileSync, renameSync, readdirSync, rmSync } from 'fs'
import path from 'path'

const BASE = process.env.JORDYN_URL || 'http://localhost:2935'
const OUT = path.resolve('public/showcase/jordyn-hire/film')
const RAW = path.resolve('.film-raw')
const JORDYN_REPO = process.env.JORDYN_REPO || 'C:/dev/1 - jordyn 2026'
const SIM_EMAIL = 'sim-battery@selftest.jordyn.app'

const simPassword = () => {
  const env = readFileSync(path.join(JORDYN_REPO, '.env.local'), 'utf8')
  const m = env.match(/^E2E_SIM_PASSWORD=(.*)$/m)
  if (!m) throw new Error("E2E_SIM_PASSWORD not found in the app's .env.local")
  return m[1].trim()
}

/**
 * A CURSOR YOU CAN SEE, WITH WEIGHT.
 *
 * Two parts: a dot that follows the real mouse, and a ring that lags behind
 * it. The lag is the whole trick — a cursor that arrives exactly with the
 * pointer reads as a graphic, and one that catches up a few frames later
 * reads as a hand. The ring also flares on a press, so a click is visible as
 * an event rather than inferred from what happens next.
 */
const CURSOR = `
(() => {
  const dot = document.createElement('div')
  const ring = document.createElement('div')
  const S = 'position:fixed;z-index:2147483647;pointer-events:none;left:0;top:0;'
  dot.style.cssText = S + 'width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#B5563A;box-shadow:0 2px 10px rgba(0,0,0,.35);'
  ring.style.cssText = S + 'width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:2.5px solid rgba(181,86,58,.55);transition:width .12s,height .12s,margin .12s,border-color .12s;'
  document.documentElement.append(ring, dot)
  let rx = -100, ry = -100, mx = -100, my = -100
  window.__cursor = (x, y) => { mx = x; my = y; dot.style.transform = 'translate(' + x + 'px,' + y + 'px)' }
  window.__press = (down) => {
    ring.style.width = down ? '20px' : '34px'
    ring.style.height = down ? '20px' : '34px'
    ring.style.margin = down ? '-10px 0 0 -10px' : '-17px 0 0 -17px'
    ring.style.borderColor = down ? 'rgba(181,86,58,.95)' : 'rgba(181,86,58,.55)'
  }
  const tick = () => {
    /* the ring chases the dot — the lag is what gives it weight */
    rx += (mx - rx) * 0.22; ry += (my - ry) * 0.22
    ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)'
    requestAnimationFrame(tick)
  }
  tick()
})()
`

/** Where a thing is on screen, as a point we can drive the mouse to. */
const centerOf = async (page, selector) => {
  const box = await page.locator(selector).first().boundingBox()
  if (!box) throw new Error('no box for ' + selector)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/**
 * MOVE LIKE A HAND, NOT LIKE A TELEPORT.
 *
 * Playwright's mouse.move jumps unless told otherwise, and even its `steps`
 * option moves at a constant speed, which reads as robotic. This eases in and
 * out and slightly overshoots the target before settling — the same
 * anticipation that makes animation feel physical.
 */
const glide = async (page, to, { ms = 700 } = {}) => {
  const from = page.__pt || { x: 960, y: 900 }
  const steps = Math.max(12, Math.round((ms / 1000) * 40))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    /* ease-in-out cubic, with a touch of overshoot near the end */
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    const over = Math.sin(t * Math.PI) * 0.06
    const x = from.x + (to.x - from.x) * (e + over * (1 - e))
    const y = from.y + (to.y - from.y) * (e + over * (1 - e))
    await page.mouse.move(x, y)
    await page.evaluate(([x, y]) => window.__cursor?.(x, y), [x, y])
    await page.waitForTimeout(ms / steps)
  }
  page.__pt = to
}

const press = async (page, { hold = 90 } = {}) => {
  await page.evaluate(() => window.__press?.(true))
  await page.mouse.down()
  await page.waitForTimeout(hold)
  await page.mouse.up()
  await page.evaluate(() => window.__press?.(false))
}

const clickAt = async (page, selector, opts = {}) => {
  const pt = await centerOf(page, selector)
  await glide(page, pt, opts)
  await page.waitForTimeout(160)   // the beat before a click — it reads as intent
  await press(page)
}

/* ────────────────────────────────────────────────────────────────────────
 * THE SHOTS. Each returns after the action has visibly finished, and the
 * recording is cut at that point — a clip that runs on after its event is
 * dead air the edit has to trim.
 * ──────────────────────────────────────────────────────────────────────── */

const PUBLIC = new Set(['brain'])

const SHOTS = {
  /**
   * THE HERO SHOT — an email dragged into the dock, which flips itself to
   * Calendar mid-drag and builds the appointment from what it reads.
   *
   * Filmed as ONE continuous move because that is what makes it persuasive:
   * a cut anywhere in the middle and the viewer assumes the good part was
   * faked between frames.
   */
  drag: async (page) => {
    await page.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1600)
    const row = page.locator('[id^="inbox-row-"]').first()
    await row.waitFor({ timeout: 15000 })
    const box = await row.boundingBox()
    const from = { x: box.x + 260, y: box.y + box.height / 2 }
    const dock = await centerOf(page, 'text=Jordyn').catch(() => ({ x: 1760, y: 420 }))

    await glide(page, from, { ms: 800 })
    await page.waitForTimeout(300)
    await page.evaluate(() => window.__press?.(true))
    await page.mouse.down()
    /* drag slowly enough that the dock's tab-flip is legible */
    await glide(page, { x: dock.x - 80, y: dock.y + 40 }, { ms: 900 })
    await glide(page, dock, { ms: 500 })
    await page.waitForTimeout(420)      // the border lights, the tab flips
    await page.mouse.up()
    await page.evaluate(() => window.__press?.(false))
    await page.waitForTimeout(2600)     // she reads it and the event appears
  },

  /** Typing a question and watching the answer come back. */
  chat: async (page) => {
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    const box = 'textarea, input[placeholder*="Ask" i]'
    await clickAt(page, box, { ms: 700 })
    /* typed at a human speed — the contrast with the instant answer IS the
       pitch, so this must not be hurried */
    await page.keyboard.type('What needs me today?', { delay: 85 })
    await page.waitForTimeout(500)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(6000)     // the answer streams in
  },

  /** The inbox being swept — Declutter opening over a full list. */
  declutter: async (page) => {
    await page.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1600)
    await clickAt(page, 'button:has-text("Declutter")', { ms: 800 })
    await page.waitForTimeout(3200)
  },

  /**
   * THE BRAIN INSTALL. Type a trade, watch the five-step build run.
   * Public — no login, no data — and it IS the claim the film makes.
   */
  brain: async (page) => {
    await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1600)
    /* one of the popular trades, clicked rather than typed: the click is the
       whole point — one choice, and she builds herself around it */
    await clickAt(page, 'text=HVAC services', { ms: 900 }).catch(async () => {
      await clickAt(page, 'input[type="text"]', { ms: 800 })
      await page.keyboard.type('HVAC services', { delay: 80 })
      await page.keyboard.press('Enter')
    })
    /* five steps at 2.2s each, plus the hold before the deck arrives */
    await page.waitForTimeout(13000)
  },

  /**
   * THE INSTALL, AND ITS PAYOFF LINE.
   *
   * Three concentric rings pinging out of a knowledge icon while the stage
   * text swaps, then the card that says "Your assistant now speaks
   * residential real estate." That sentence is a finished commercial beat —
   * it is the product's whole promise in eight words, written by the product.
   */
  install: async (page) => {
    await page.goto(`${BASE}/brain-setup?change=1`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    await clickAt(page, 'input[type="text"], input:not([type])', { ms: 800 })
    await page.keyboard.type('residential real estate', { delay: 70 })
    await page.waitForTimeout(400)
    await clickAt(page, 'button:has-text("Build")', { ms: 700 })
    await page.waitForTimeout(16000)
  },

  /**
   * THE INTELLIGENCE GAUGE. A 270-degree clay-to-sage arc sweeping while a
   * big serif number counts up beside five filling bars — the most
   * expensive-looking second in the app, and it all happens in the first 1.2s
   * after navigation. So: no networkidle wait, or the shot is over before the
   * camera turns.
   */
  score: async (page) => {
    await page.goto(`${BASE}/train`, { waitUntil: 'commit' })
    await page.waitForTimeout(6000)
  },

  /** The populated chat screen — cases — with a slow push. */
  mock_cases: async (page) => {
    await page.goto(`${BASE}/screenshot-mock?scene=cases`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    await page.addStyleTag({ content: '[class*="timezone" i],[id*="intercom" i],[class*="launcher" i]{display:none!important}' }).catch(() => {})
    /* a slow drift down the conversation, so the take is alive */
    for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 5); await page.waitForTimeout(55) }
    await page.waitForTimeout(600)
  },

  /** The populated chat screen — call — with a slow push. */
  mock_call: async (page) => {
    await page.goto(`${BASE}/screenshot-mock?scene=call`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    await page.addStyleTag({ content: '[class*="timezone" i],[id*="intercom" i],[class*="launcher" i]{display:none!important}' }).catch(() => {})
    /* a slow drift down the conversation, so the take is alive */
    for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 5); await page.waitForTimeout(55) }
    await page.waitForTimeout(600)
  },

  /** The populated chat screen — letter — with a slow push. */
  mock_letter: async (page) => {
    await page.goto(`${BASE}/screenshot-mock?scene=letter`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    await page.addStyleTag({ content: '[class*="timezone" i],[id*="intercom" i],[class*="launcher" i]{display:none!important}' }).catch(() => {})
    /* a slow drift down the conversation, so the take is alive */
    for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 5); await page.waitForTimeout(55) }
    await page.waitForTimeout(600)
  },

  /** The populated chat screen — realestate — with a slow push. */
  mock_realestate: async (page) => {
    await page.goto(`${BASE}/screenshot-mock?scene=realestate`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    await page.addStyleTag({ content: '[class*="timezone" i],[id*="intercom" i],[class*="launcher" i]{display:none!important}' }).catch(() => {})
    /* a slow drift down the conversation, so the take is alive */
    for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 5); await page.waitForTimeout(55) }
    await page.waitForTimeout(600)
  },

  /** The populated chat screen — hvac — with a slow push. */
  mock_hvac: async (page) => {
    await page.goto(`${BASE}/screenshot-mock?scene=hvac`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    await page.addStyleTag({ content: '[class*="timezone" i],[id*="intercom" i],[class*="launcher" i]{display:none!important}' }).catch(() => {})
    /* a slow drift down the conversation, so the take is alive */
    for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 5); await page.waitForTimeout(55) }
    await page.waitForTimeout(600)
  },

  /** A slow pan down the real inbox — the establishing shot. */
  inbox: async (page) => {
    await page.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    for (let i = 0; i < 26; i++) {
      await page.mouse.wheel(0, 26)
      await page.waitForTimeout(48)
    }
    await page.waitForTimeout(700)
  },

  /** The calendar, and a real event being moved. */
  calendar: async (page) => {
    await page.goto(`${BASE}/calendar`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2400)
  },

  /** The pipeline board. */
  pipeline: async (page) => {
    await page.goto(`${BASE}/pipeline`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2200)
  },
}

const run = async () => {
  const want = process.argv.slice(2)
  const list = want.length ? want : Object.keys(SHOTS)
  mkdirSync(OUT, { recursive: true })
  rmSync(RAW, { recursive: true, force: true })

  const browser = await chromium.launch()
  const password = simPassword()

  /* one sign-in, no camera, reused by every shot that needs it */
  let storageState
  if (list.some((n) => !PUBLIC.has(n))) {
    const auth = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const ap = await auth.newPage()
    await ap.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    const email = ap.locator('input[type="email"]').first()
    await email.waitFor({ state: 'visible', timeout: 20000 })
    await ap.waitForTimeout(600)
    for (let i = 0; i < 3; i++) {
      await email.fill(SIM_EMAIL)
      await ap.locator('input[type="password"]').first().fill(password)
      if ((await email.inputValue()) === SIM_EMAIL) break
      await ap.waitForTimeout(500)
    }
    await ap.locator('button[type="submit"]').first().click()
    await ap.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45000 })
    storageState = await auth.storageState()
    await auth.close()
    console.log('signed in once, off camera')
  }

  for (const name of list) {
    const shot = SHOTS[name]
    if (!shot) { console.log('skip  ', name, '(no such shot)'); continue }
    const dir = path.join(RAW, name)
    const ctx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ...(PUBLIC.has(name) ? {} : { storageState }),
      /* 1x: the recorder's own scale, and the film is 1920 anyway. A 2x
         capture is recorded at 3840 and downscaled by ffmpeg later, which
         softens it rather than sharpening it. */
      recordVideo: { dir, size: { width: 1920, height: 1080 } },
    })
    /* the cursor has to exist before the first navigation paints */
    await ctx.addInitScript(CURSOR)
    const page = await ctx.newPage()
    page.__pt = { x: 960, y: 980 }

    try {
      /* session chrome that belongs to this browser, not the product */
      await ctx.addInitScript(() => {
        const kill = () => {
          document.querySelectorAll('[class*="timezone" i],[id*="intercom" i],[class*="intercom" i],[class*="launcher" i]')
            .forEach((n) => { n.style.display = 'none' })
        }
        window.addEventListener('DOMContentLoaded', kill)
        setInterval(kill, 400)
      })

      await shot(page)
      console.log('ok   ', name)
    } catch (e) {
      console.log('FAIL ', name, '-', e.message.split('\n')[0])
    }

    await ctx.close()   // the video is only written on close
    const files = readdirSync(dir).filter((f) => f.endsWith('.webm'))
    if (files[0]) {
      renameSync(path.join(dir, files[0]), path.join(OUT, `${name}.webm`))
      console.log('     ->', path.join('public/showcase/jordyn-hire/film', `${name}.webm`))
    }
  }

  await browser.close()
  rmSync(RAW, { recursive: true, force: true })
}

run().catch((e) => { console.error(e); process.exit(1) })
