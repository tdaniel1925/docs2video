import { test, expect, type Page, type Route } from '@playwright/test'
import { alertOf, collectConsoleErrors, expectNoBlockedCalls, guardRealWorld, jsonBody, type Guard } from './helpers/guard'

/*
 * STEP 4 — "Ready to send" at the top of a finished video (/videos/[id]).
 *
 * Uses a real finished video on the test account, but every save and the
 * Send button are mocked: the owner's real note, switches and client are
 * never changed, and no email goes out. The video row and its quote are
 * adjusted in flight so every switch is on screen.
 */

type Row = { id: string; status: string; output_type?: string | null; video_url?: string | null }

let guard: Guard
let consoleErrors: string[]
let videoId: string

const QUOTE = {
  id: '00000000-e2e0-4000-8000-0000000000q1', status: 'sent', client_name: 'Jordan Lee', client_email: 'jordan@example.com',
  auto_follow_up: false, total: 125000, line_items: [{ description: 'Annual premium', amount: 125000 }], created_at: new Date().toISOString(),
}

async function finishedVideo(page: Page): Promise<string | null> {
  const res = await page.request.get('/api/videos')
  if (!res.ok()) return null
  const rows = (await res.json()) as Row[]
  const done = rows.filter((r) => r.status === 'completed')
  return (done.find((r) => (r.output_type ?? 'video') === 'video' && r.video_url) ?? done[0])?.id ?? null
}

type Setup = {
  patches: any[]; patchStatus: number; patchError: string
  quotePuts: any[]; quoteStatus: number
  sends: any[]; sendAnswer: { status: number; json: unknown }
}

async function open(page: Page, opts: { quote?: unknown; mailbox?: boolean; row?: Record<string, unknown> } = {}): Promise<Setup> {
  const s: Setup = { patches: [], patchStatus: 200, patchError: '', quotePuts: [], quoteStatus: 200, sends: [], sendAnswer: { status: 200, json: { success: true } } }
  let saved: Record<string, unknown> = { agent_note: null, allow_source_download: false }

  // The video row as the page reads it from the database, with a source PDF
  // and a known recipient so every switch shows. Real everything else.
  await page.route('**/rest/v1/videos?**', async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const real = await route.fetch()
    const body = await real.json()
    const patch = (v: Record<string, unknown>) => ({ ...v, source_pdf_path: 'e2e/plan.pdf', source_pdf_name: 'plan.pdf', client_id: null, recipient_name: 'Jordan Lee', ...saved, ...(opts.row ?? {}) })
    await route.fulfill({ response: real, json: Array.isArray(body) ? body.map(patch) : patch(body) })
  })
  await page.route('**/rest/v1/quotes?**', (route) => route.request().method() === 'GET'
    ? route.fulfill({ json: opts.quote === undefined ? [QUOTE] : (opts.quote ? [opts.quote] : []) })
    : route.fallback())
  await page.route('**/api/email-connections', (route) => route.fulfill({ json: opts.mailbox === false ? [] : [{ id: 'm1', is_default: true, provider: 'google', email_address: 'agent@example.com' }] }))

  // Saves: the note and the PDF switch.
  await page.route(`**/api/videos/${videoId}`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    const body = jsonBody(route.request())
    s.patches.push(body)
    if (s.patchStatus !== 200) return route.fulfill({ status: s.patchStatus, json: { error: s.patchError } })
    saved = { ...saved, ...body }
    await route.fulfill({ json: { success: true, ...body } })
  })
  await page.route('**/api/quotes', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    const body = jsonBody(route.request())
    s.quotePuts.push(body)
    if (s.quoteStatus !== 200) return route.fulfill({ status: s.quoteStatus, json: { error: 'The quote could not be updated.' } })
    const next = { ...QUOTE, ...(body.status ? { status: body.status } : {}), ...(body.autoFollowUp !== undefined ? { auto_follow_up: body.autoFollowUp } : {}) }
    await route.fulfill({ json: { quote: next } })
  })
  await page.route('**/api/send-video-email', async (route) => {
    s.sends.push(jsonBody(route.request()))
    await new Promise((r) => setTimeout(r, 400))
    await route.fulfill({ status: s.sendAnswer.status, json: s.sendAnswer.json })
  })

  await page.goto(`/videos/${videoId}`)
  await expect(page.getByRole('region', { name: 'Ready to send' })).toBeVisible({ timeout: 20000 })
  return s
}

const rts = (page: Page) => page.getByRole('region', { name: 'Ready to send' })
const sw = (page: Page, name: string | RegExp) => rts(page).getByRole('switch', { name })

test.beforeEach(async ({ page }) => {
  guard = await guardRealWorld(page)
  consoleErrors = collectConsoleErrors(page, [/status of (500|502)/])
  const id = await finishedVideo(page)
  test.skip(!id, 'the test account has no finished video')
  videoId = id!
})
test.afterEach(() => {
  expectNoBlockedCalls(guard)
  expect(consoleErrors, 'console errors on the finished-video page').toEqual([])
})

test('shows the preview of their page, who it goes to and every switch', async ({ page }) => {
  await open(page)
  await expect(rts(page).getByRole('heading', { name: 'Ready to send.' })).toBeVisible()
  await expect(rts(page)).toContainText('This is exactly what Jordan Lee will see.')
  await expect(rts(page).locator('.rts-url')).toHaveText(new RegExp(`/watch/${videoId}$`))
  await expect(rts(page).getByRole('link', { name: 'Open their page ↗' })).toHaveAttribute('href', new RegExp(`/watch/${videoId}$`))
  await expect(rts(page)).toContainText('Hi Jordan —')
  await expect(rts(page).getByText('jordan@example.com')).toBeVisible()
  await expect(sw(page, 'Quote with a pay button')).toHaveAttribute('aria-checked', 'true')
  await expect(sw(page, 'Let them download the original PDF')).toHaveAttribute('aria-checked', 'false')
  await expect(sw(page, /Remind them about the quote on day/)).toHaveAttribute('aria-checked', 'false')
  await expect(rts(page).getByText('Book a call button')).toBeVisible()
  await expect(rts(page).getByRole('button', { name: 'Send to Jordan Lee' })).toBeEnabled()
})

test('the note shows in the preview as you type and saves on its own', async ({ page }) => {
  const s = await open(page)
  const note = rts(page).getByLabel('A short note')
  await note.fill('Here’s your coverage, in 3 minutes.')
  await expect(rts(page).locator('.rts-note')).toContainText('Here’s your coverage, in 3 minutes.')
  await expect(rts(page).getByText('Saved — it’s on their page.')).toBeVisible({ timeout: 5000 })
  expect(s.patches).toEqual([{ agent_note: 'Here’s your coverage, in 3 minutes.' }])
  await expect(rts(page).getByText('35/400')).toBeVisible()
})

test('a note that fails to save says so and keeps the typed text', async ({ page }) => {
  const s = await open(page)
  s.patchStatus = 500
  s.patchError = 'The note was NOT saved.'
  await rts(page).getByLabel('A short note').fill('Try this')
  await expect(alertOf(page).filter({ hasText: 'note' })).toHaveText('The note was NOT saved. Your client still sees the old note.', { timeout: 5000 })
  await expect(rts(page).getByLabel('A short note')).toHaveValue('Try this')
})

test('the PDF switch saves; a failed save leaves it off and shows the error', async ({ page }) => {
  const s = await open(page)
  const pdf = sw(page, 'Let them download the original PDF')
  s.patchStatus = 500
  s.patchError = 'Could not update the share page.'
  // Watch the switch the whole time: it must never show "on" for a change
  // that did not save — not even for a moment before the error comes back.
  await pdf.evaluate((el) => {
    const w = window as unknown as { __flips: string[] }
    w.__flips = []
    new MutationObserver(() => w.__flips.push(el.getAttribute('aria-checked') ?? '')).observe(el, { attributes: true, attributeFilter: ['aria-checked'] })
  })
  await pdf.click()
  await expect(alertOf(page).filter({ hasText: 'Could not update' })).toHaveText('Could not update the share page.')
  await expect(pdf).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate(() => (window as unknown as { __flips: string[] }).__flips), 'the switch flipped on before the save came back').not.toContain('true')
  await expect(rts(page).getByText('Download the original PDF', { exact: true })).toHaveCount(0)

  s.patchStatus = 200
  await pdf.click()
  await expect(pdf).toHaveAttribute('aria-checked', 'true')
  expect(s.patches[s.patches.length - 1]).toEqual({ allow_source_download: true })
  // The preview now shows the download button their page will have.
  await expect(rts(page).getByText('Download the original PDF', { exact: true })).toBeVisible()
  await expect(alertOf(page).filter({ hasText: 'Could not update' })).toHaveCount(0)
})

test('the quote switch hides and shows the quote; a failed save shows the error', async ({ page }) => {
  const s = await open(page)
  const q = sw(page, 'Quote with a pay button')
  s.quoteStatus = 500
  await q.click()
  await expect(alertOf(page).filter({ hasText: 'quote could not' })).toHaveText('The quote could not be updated.')
  await expect(q).toHaveAttribute('aria-checked', 'true')

  s.quoteStatus = 200
  await q.click()
  await expect(q).toHaveAttribute('aria-checked', 'false')
  expect(s.quotePuts[s.quotePuts.length - 1]).toEqual({ quoteId: QUOTE.id, status: 'draft' })
  await expect(rts(page).getByText('Hidden from their page.')).toBeVisible()
  // With the quote hidden, reminders explain why they can't run.
  await expect(rts(page).getByText('Show the quote first — reminders only go while it is on their page.')).toBeVisible()
  await q.click()
  await expect(q).toHaveAttribute('aria-checked', 'true')
  expect(s.quotePuts[s.quotePuts.length - 1]).toEqual({ quoteId: QUOTE.id, status: 'sent' })
})

test('the reminder switch turns reminders on and off', async ({ page }) => {
  const s = await open(page)
  const r = sw(page, /Remind them about the quote on day/)
  await r.click()
  await expect(r).toHaveAttribute('aria-checked', 'true')
  expect(s.quotePuts[0]).toEqual({ quoteId: QUOTE.id, autoFollowUp: true })
  await r.click()
  await expect(r).toHaveAttribute('aria-checked', 'false')
  expect(s.quotePuts[1]).toEqual({ quoteId: QUOTE.id, autoFollowUp: false })
})

test('without a connected mailbox, reminders cannot be switched on and say where to connect', async ({ page }) => {
  await open(page, { mailbox: false })
  await expect(sw(page, /Remind them about the quote on day/)).toBeDisabled()
  await expect(rts(page).getByText('Reminders go from your own email only.', { exact: false })).toBeVisible()
})

test('Send saves the note first, sends once (even on a double-click) and says who it went to', async ({ page }) => {
  const s = await open(page)
  await rts(page).getByLabel('A short note').fill('See you Thursday.')
  await rts(page).getByRole('button', { name: 'Send to Jordan Lee' }).dblclick()
  await expect(rts(page).getByRole('status')).toHaveText('✓ Sent to jordan@example.com.')
  expect(s.sends).toHaveLength(1)
  expect(s.sends[0]).toEqual({ videoId, clientName: 'Jordan Lee', clientEmail: 'jordan@example.com', message: 'See you Thursday.' })
  expect(s.patches[0]).toEqual({ agent_note: 'See you Thursday.' })
  await expect(rts(page).getByRole('button', { name: 'Send again to Jordan Lee' })).toBeVisible()
})

test('a failed send says it did NOT send, with the server’s reason', async ({ page }) => {
  const s = await open(page)
  s.sendAnswer = { status: 502, json: { error: 'Your Gmail connection has expired' } }
  await rts(page).getByRole('button', { name: 'Send to Jordan Lee' }).click()
  await expect(alertOf(page).filter({ hasText: 'did NOT send' })).toHaveText('The email did NOT send — Your Gmail connection has expired. You can try again, or copy the link and send it yourself.')
  await expect(rts(page).getByRole('status')).toHaveCount(0)
})

test('if the note will not save, nothing is sent', async ({ page }) => {
  const s = await open(page)
  s.patchStatus = 500
  s.patchError = 'down'
  await rts(page).getByLabel('A short note').fill('Hello')
  await rts(page).getByRole('button', { name: 'Send to Jordan Lee' }).click()
  await expect(alertOf(page).filter({ hasText: 'nothing was sent' })).toHaveText('Your note did not save, so nothing was sent. Try again.')
  expect(s.sends).toHaveLength(0)
})

test('with no email on file, it asks for one and refuses a bad address', async ({ page }) => {
  const s = await open(page, { quote: null })
  const email = rts(page).getByLabel('Client email')
  await expect(rts(page).getByText('No email is saved for this client yet.')).toBeVisible()
  await email.fill('not-an-email')
  await rts(page).getByRole('button', { name: 'Send to Jordan Lee' }).click()
  await expect(alertOf(page).filter({ hasText: 'email address first' })).toHaveText('Enter your client’s email address first.')
  expect(s.sends).toHaveLength(0)
  await email.fill('Jordan@Example.com ')
  await rts(page).getByRole('button', { name: 'Send to Jordan Lee' }).click()
  await expect(rts(page).getByRole('status')).toHaveText('✓ Sent to jordan@example.com.')
  expect(s.sends[0].clientEmail).toBe('jordan@example.com')
})

test('copy the link puts the share link on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page)
  await rts(page).getByRole('button', { name: 'or copy the link' }).click()
  await expect(rts(page).getByRole('button', { name: '✓ Link copied' })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  // A policy video's link comes with its disclosure; any other is the bare link.
  expect(copied.startsWith(`${new URL(page.url()).origin}/watch/${videoId}`) || copied.includes(`/watch/${videoId}

Important Disclosure`)).toBeTruthy()
})

// ── Phase 4: what's left, someone else, copy the email, who watched, the bar ──

test("what's left lists what's missing, and a chip jumps to the fix", async ({ page }) => {
  await open(page, { quote: null })
  const left = rts(page).getByTestId('whats-left')
  await expect(left.locator('[data-left="email"]')).toBeVisible()
  await expect(left.locator('[data-left="note"]')).toBeVisible()
  await left.locator('[data-left="note"]').click()
  await expect(rts(page).getByLabel('A short note')).toBeFocused()
  await rts(page).getByLabel('A short note').fill('Here you go.')
  await expect(left.locator('[data-left="note"]')).toHaveCount(0)
})

test('send to someone else sends to the typed address, once', async ({ page }) => {
  const s = await open(page)
  await rts(page).getByRole('button', { name: 'Send to someone else' }).click()
  await rts(page).getByLabel('Client email').fill('pat@example.com')
  await rts(page).getByLabel('Their name (optional)').fill('Pat')
  await rts(page).getByRole('button', { name: 'Send to Pat' }).click()
  await expect(rts(page).getByRole('status')).toHaveText('✓ Sent to pat@example.com.')
  expect(s.sends).toHaveLength(1)
  expect(s.sends[0].clientEmail).toBe('pat@example.com')
  expect(s.sends[0].clientName).toBe('Pat')
})

test('copy the email puts the whole email on the clipboard and sends nothing', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const s = await open(page)
  await rts(page).getByLabel('A short note').fill('See you Thursday.')
  await rts(page).getByRole('button', { name: 'Copy the email' }).click()
  await expect(rts(page).getByRole('button', { name: /Email copied/ })).toBeVisible()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain('See you Thursday.')
  expect(text).toContain(`/watch/${videoId}`)
  expect(s.sends).toHaveLength(0)
})

test('who watched shows each email and how far they got', async ({ page }) => {
  await page.route(`**/api/videos/${videoId}/viewing`, (r) => r.fulfill({ json: {
    available: true, steps: [25, 50, 75, 100], totals: { views: 3, plays: 2 },
    shares: [{ id: 's1', to: 'jordan@example.com', name: 'Jordan Lee', sentAt: '2026-10-01T10:00:00Z', emailOpenedAt: '2026-10-01T11:00:00Z',
      viewer: { device: 'iPhone · Safari', firstSeen: '2026-10-01T11:05:00Z', lastSeen: '2026-10-01T11:09:00Z', visits: 1, played: true, furthest: 50, reached: [true, true, false, false], clicked: { booking: true, payment: false, download: false } } }],
    others: [],
  } }))
  await open(page)
  const w = page.getByRole('region', { name: 'Who watched' })
  await expect(w).toContainText('Jordan Lee')
  await expect(w).toContainText('Watched half')
  await expect(w).toContainText('Pressed Book a call')
  await expect(w.locator('.res-q.on')).toHaveCount(2)
  await expect(w.getByRole('link', { name: 'change when' })).toHaveAttribute('href', '/activity#view-alerts')
})

test('the change bar and the More menu are there; nothing re-renders from just looking', async ({ page }) => {
  await open(page)
  const bar = page.getByRole('region', { name: 'Ask for a change' })
  await expect(bar).toBeVisible()
  expect(await bar.getAttribute('data-editor')).toMatch(/^(fix-scene|older-editor|remake|presentation-editor)$/)
  await page.getByTestId('more-menu').getByRole('button', { name: /More/ }).click()
  for (const item of ['Rename', 'Duplicate', 'Social posts', 'Delete']) {
    await expect(page.getByTestId('more-menu').getByRole('menuitem', { name: item })).toBeVisible()
  }
  await page.keyboard.press('Escape')
})
