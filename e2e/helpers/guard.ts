import { expect, type Page, type Request, type Route } from '@playwright/test'

/*
 * SAFETY NET FOR A LIVE DATABASE.
 *
 * The local app talks to the real database and real services. Any request to
 * an endpoint that spends credits, charges a card, sends a real email/SMS or
 * deletes the account is BLOCKED here unless the test mocked it first
 * (page.route() added after guardRealWorld wins — Playwright runs the newest
 * matching route first). A blocked call is recorded and fails the test in
 * expectNoBlockedCalls(), so a missed mock can't quietly spend money.
 */
export const REAL_WORLD_ENDPOINTS: RegExp[] = [
  /\/api\/generate-video(\?|$)/,
  /\/api\/generate-presentation(\?|$)/,
  /\/api\/generate-slides?(\?|$)/,
  /\/api\/generate-commercial/,
  /\/api\/re-render/,
  /\/api\/edit-slide/,
  // The result page's "Ask for a change" bar routes to these editors: a
  // scene fix or a rebuild re-renders (and can charge), an AI edit is a paid
  // AI call on our side.
  /\/api\/fix-scene/,
  /\/api\/reedit-presentation/,
  /\/api\/ai-edit-scenes/,
  /\/api\/videos\/[^/]+\/restart/,
  /\/api\/send-video-email/,
  /\/api\/follow-up\/send/,
  /\/api\/email-connections\/test/,
  /\/api\/contact(\?|$)/,
  /\/api\/subscribe(\?|$)/,
  /\/api\/credits\/buy/,
  /\/api\/stripe\//,
  /\/api\/create-setup-intent/,
  /\/api\/confirm-card/,
  /\/api\/account\/delete/,
  /\/api\/generate-logo-kit/,
  /\/api\/pre-generate-audio/,
  /\/api\/sms/,
  /\/api\/presentation-export/,
  /\/api\/translate-presentation/,
  /\/api\/generate-social-post/,
  /\/api\/social-addon\//,
  /\/api\/watch\/[^/]+\/ask/,   // emails the owner
  /\/api\/capture-lead/,         // saves a lead and alerts the owner
  /\/api\/clients\/import/,
  /\/api\/upload-photo/,         // replaces the owner's real photos
  /\/api\/upload-logo/,
  // Phase 5: the help assistant is a paid AI call; "Add your brand" stores a
  // processed logo and reads someone's website.
  /\/api\/help-chat/,
  /\/api\/brands\/logo/,
  /\/api\/brand-from-url/,
]

/** Only these methods are blocked on these paths (reads stay real). */
export const REAL_WORLD_METHODS: { re: RegExp; methods: string[] }[] = [
  // Deleting a finished project (drafts go through /api/videos/draft).
  { re: /^\/api\/videos\/(?!draft$)[^/]+$/, methods: ['DELETE'] },
  { re: /^\/api\/keys$/, methods: ['POST', 'DELETE'] },
  { re: /^\/api\/social-accounts$/, methods: ['POST', 'DELETE'] },
  // Profile / payment-link / booking-link saves go straight to the database.
  { re: /^\/rest\/v1\/profiles$/, methods: ['PATCH', 'POST', 'DELETE'] },
  { re: /^\/rest\/v1\/brands$/, methods: ['DELETE'] },
  { re: /^\/api\/quotes$/, methods: ['POST', 'PUT', 'DELETE'] },
]

/** Viewer tracking: answered OK without reaching the database, so test
 *  visits never show up as a client watching the owner's page. */
export const QUIET_ENDPOINTS: RegExp[] = [/^\/api\/track-view$/]

export type Guard = { blocked: string[]; tracked: number }

export async function guardRealWorld(page: Page): Promise<Guard> {
  const guard: Guard = { blocked: [], tracked: 0 }
  await page.route(
    (url) => REAL_WORLD_ENDPOINTS.some((re) => re.test(url.pathname))
      || REAL_WORLD_METHODS.some((m) => m.re.test(url.pathname))
      || QUIET_ENDPOINTS.some((re) => re.test(url.pathname)),
    async (route: Route) => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      if (QUIET_ENDPOINTS.some((re) => re.test(path))) {
        guard.tracked++
        return route.fulfill({ json: { success: true } })
      }
      const onlySome = REAL_WORLD_METHODS.find((m) => m.re.test(path))
      if (onlySome && !REAL_WORLD_ENDPOINTS.some((re) => re.test(path)) && !onlySome.methods.includes(method)) return route.fallback()
      guard.blocked.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`)
      await route.fulfill({ status: 418, contentType: 'application/json', body: JSON.stringify({ error: 'blocked by e2e guard' }) })
    },
  )
  return guard
}

export function expectNoBlockedCalls(guard: Guard) {
  expect(guard.blocked, 'a real-world endpoint was called without a mock').toEqual([])
}

/* ── Console errors ─────────────────────────────────────────────────────── */

// Noise that is not the app's fault: the browser's own media autoplay rules,
// aborted requests from navigating away, and resources our own tests abort.
const IGNORED_CONSOLE = [
  /Failed to load resource: the server responded with a status of 418/, // our guard
  /net::ERR_ABORTED/,
  /play\(\) request was interrupted/,
  /The play\(\) request/,
  /Download the React DevTools/,
]

export function collectConsoleErrors(page: Page, extraIgnore: RegExp[] = []): string[] {
  const errors: string[] = []
  const ignore = [...IGNORED_CONSOLE, ...extraIgnore]
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    if (ignore.some((re) => re.test(text))) return
    const at = m.location()?.url
    errors.push(at ? `${text} @ ${at}` : text)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  return errors
}

/* ── Layout ─────────────────────────────────────────────────────────────── */

export async function expectNoSidewaysScroll(page: Page, where: string) {
  const r = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    win: window.innerWidth,
  }))
  expect(Math.max(r.doc, r.body), `${where}: page is wider than the screen (${JSON.stringify(r)})`).toBeLessThanOrEqual(r.win + 1)
}

/* ── Requests ───────────────────────────────────────────────────────────── */

export function jsonBody(req: Request): any {
  const raw = req.postData()
  return raw ? JSON.parse(raw) : null
}

/** Where full-page screenshots of the redesigned screens go. */
export const SHOTS = process.env.E2E_SHOTS_DIR || 'test-results/shots'

/** The page's own alert messages. (Next.js adds an empty route-change
 *  announcer with role=alert; it is never what a test means.) */
export function alertOf(page: Page) {
  return page.getByRole('alert').filter({ hasText: /\S/ })
}
