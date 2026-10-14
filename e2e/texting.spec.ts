import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { guardRealWorld, expectNoBlockedCalls, type Guard } from './helpers/guard'

/**
 * HOT-CLIENT ALERTS + SEND BY TEXT.
 *
 * The texting API is MOCKED here (the migration may not be in this database,
 * and nothing may text a real phone): the guard blocks /api/texting/send and
 * /api/texting/verify unless a test answers them itself. What is checked:
 *   - Settings → Email & sending shows "Tell me when a client is ready";
 *     Text stays unavailable until the mobile number is confirmed;
 *   - the send panel's Text tab shows the phone preview and REQUIRES the
 *     consent box (no request leaves without it), then posts phone + consent;
 *   - a client's text reply shows in Who watched;
 *   - with texting not set up (available: false) there are no tabs at all.
 * SHOTS=1 also saves screenshots to .shots/text-alerts/.
 */
let guard: Guard
test.beforeEach(async ({ page }) => { guard = await guardRealWorld(page) })
test.afterEach(() => expectNoBlockedCalls(guard))

const SHOTS = process.env.SHOTS === '1'
const DIR = '.shots/text-alerts'

const SETTINGS = {
  available: true,
  settings: { channel: 'email', triggers: { finished: true, twice: true, pdf: false, booking: true }, phone: null, phoneVerified: false, timeZone: 'America/Chicago' },
  phoneDisplay: null,
  email: 'you@example.com',
  health: { agentTexts: true, clientTexts: true, state: 'ok', detail: 'ok' },
}

async function shoot(page: Page, name: string, locator?: string) {
  if (!SHOTS) return
  fs.mkdirSync(DIR, { recursive: true })
  const gotIt = page.getByRole('button', { name: 'Got it' })
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click()
  for (const theme of ['dark', 'light'] as const) {
    await page.evaluate((t) => { try { localStorage.setItem('d2v.theme', t) } catch {} document.documentElement.setAttribute('data-theme', t) }, theme)
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
      await page.waitForTimeout(250)
      const target = locator ? page.locator(locator).first() : page
      await target.screenshot({ path: `${DIR}/${name}-${width}-${theme}.png`, ...(locator ? {} : { fullPage: false }) })
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
}

async function finishedVideoId(page: Page): Promise<string | null> {
  const res = await page.request.get('/api/videos')
  if (!res.ok()) return null
  const rows = (await res.json()) as { id: string; status: string; video_url: string | null }[]
  return (Array.isArray(rows) ? rows.find((v) => v.status === 'completed' && v.video_url) : undefined)?.id ?? null
}

test('settings: hot-client alerts — text needs a confirmed mobile first', async ({ page }) => {
  let puts = 0
  await page.route('**/api/texting/settings', (r) => {
    if (r.request().method() === 'PUT') { puts++; return r.fulfill({ json: { settings: { ...SETTINGS.settings, channel: 'off' } } }) }
    return r.fulfill({ json: SETTINGS })
  })
  await page.goto('/settings?tab=email')
  const box = page.locator('#hot-alerts')
  await expect(box.getByRole('heading', { name: 'Tell me when a client is ready' })).toBeVisible({ timeout: 30000 })
  await expect(box.getByRole('radio', { name: /^Text (Confirm|To)/ })).toBeDisabled()
  await expect(box.getByRole('radio', { name: /^Email\b/ })).toBeChecked()
  await expect(box.getByRole('checkbox', { name: /Opened the PDF/ })).not.toBeChecked()
  await expect(box.getByRole('button', { name: 'Send code' })).toBeVisible()
  await box.scrollIntoViewIfNeeded()
  await shoot(page, 'settings', '#hot-alerts')
  await box.getByRole('radio', { name: /^Off\b/ }).check()
  await expect(box.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible()
  expect(puts).toBe(1)
})

test('send panel: Text tab needs the consent box, then sends phone + consent', async ({ page }) => {
  const id = await finishedVideoId(page)
  test.skip(!id, 'no completed video on this account')
  await page.route('**/api/texting/status**', (r) => r.fulfill({ json: {
    available: true, clientTexts: true, detail: 'ok', cost: 50, agentName: 'Dana Agent', clientPhone: null, phone: null, consent: false, optedOut: false,
  } }))
  let sent: Record<string, unknown> | null = null
  await page.route('**/api/texting/send', async (r) => {
    sent = r.request().postDataJSON()
    await r.fulfill({ json: { success: true, to: '+15125550147', withPicture: true, credits: 50 } })
  })
  // The note saves through the real video PATCH — answer it here instead.
  await page.route(`**/api/videos/${id}`, (r) => r.request().method() === 'PATCH'
    ? r.fulfill({ json: { success: true, agent_note: (r.request().postDataJSON() as { agent_note?: string }).agent_note ?? '' } })
    : r.fallback())
  await page.route(`**/api/videos/${id}/viewing`, (r) => r.fulfill({ json: {
    shares: [{ id: '0f0e0d0c-0b0a-4000-8000-000000000001', to: '+15125550147', name: 'Maria Lopez', sentAt: new Date(Date.now() - 3600_000).toISOString(), emailOpenedAt: null, channel: 'text',
      viewer: { device: 'iPhone · Safari', firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(), visits: 2, played: true, furthest: 100, reached: [true, true, true, true], clicked: { booking: true, payment: false, download: false } } }],
    others: [], totals: { views: 2, plays: 2 }, steps: [25, 50, 75, 100], available: true,
    replies: [{ id: 'r1', from: '+15125550147', body: 'Watched it twice — can we talk Tuesday at 3?', at: new Date().toISOString(), shareId: '0f0e0d0c-0b0a-4000-8000-000000000001' }],
  } }))

  await page.goto(`/videos/${id}`)
  const panel = page.getByRole('region', { name: 'Ready to send' })
  await expect(panel).toBeVisible({ timeout: 30000 })
  await panel.getByRole('tab', { name: 'Text' }).click()
  await panel.getByLabel('Client mobile number').fill('512 555 0147')
  const preview = panel.getByLabel('Text message preview')
  await expect(preview).toContainText('Dana Agent')
  await expect(preview).toContainText('Reply STOP to opt out.')
  const sendBtn = panel.getByRole('button', { name: /· 50 credits/ })
  await expect(sendBtn).toBeVisible()
  await panel.locator('.rts-text').scrollIntoViewIfNeeded()
  await shoot(page, 'text-tab', '.rts-panel')

  await sendBtn.click()
  await expect(panel.getByRole('alert').filter({ hasText: 'agreed to get texts' })).toBeVisible()
  expect(sent).toBeNull() // nothing left without the tick
  await panel.getByRole('checkbox', { name: /This client agreed to get texts from me/ }).check()
  await shoot(page, 'consent', '.rts-text')
  await sendBtn.click()
  await expect(panel.getByRole('status').filter({ hasText: 'Texted to' })).toBeVisible()
  expect(sent).toMatchObject({ videoId: id, phone: '+15125550147', consent: true })

  const watched = page.getByRole('region', { name: 'Who watched' })
  await expect(watched.getByText('Texted', { exact: false }).first()).toBeVisible()
  await expect(watched.getByRole('list', { name: 'Text replies' })).toContainText('can we talk Tuesday')
  await watched.scrollIntoViewIfNeeded()
  await shoot(page, 'reply-in-activity', 'section[aria-label="Who watched"]')
})

test('send panel: no Text tab when texting is not set up', async ({ page }) => {
  const id = await finishedVideoId(page)
  test.skip(!id, 'no completed video on this account')
  await page.route('**/api/texting/status**', (r) => r.fulfill({ json: { available: false } }))
  await page.goto(`/videos/${id}`)
  const panel = page.getByRole('region', { name: 'Ready to send' })
  await expect(panel).toBeVisible({ timeout: 30000 })
  await expect(panel.getByRole('button', { name: /^Send/ }).first()).toBeVisible()
  await expect(panel.getByRole('tab', { name: 'Text' })).toHaveCount(0)
})
