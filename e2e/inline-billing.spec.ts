import { test, expect, type Page, type Route } from '@playwright/test'
import { collectConsoleErrors, expectNoBlockedCalls, guardRealWorld, jsonBody, type Guard } from './helpers/guard'

/*
 * IN-APP BILLING (2026-10-14) — Settings → Billing & credits replaces the
 * Stripe billing portal, and every payment opens in a pop-up on the page.
 * The billing state is mocked (a paying Pro customer with a late payment, two
 * cards, invoices and the AI Social add-on) and every action is intercepted,
 * so nothing reaches Stripe and the test account never changes.
 */

let guard: Guard
let consoleErrors: string[]

const STATE = () => ({
  hasCustomer: true,
  plan: { subscriptionId: 'sub_e2e', tier: 'pro', label: 'Pro', status: 'active', priceCents: 7900, periodEnd: '2026-11-14T18:00:00.000Z', cancelAtPeriodEnd: false, cancelAt: null, trialEnd: null, pendingChange: false },
  nextCharge: { amountCents: 7900, date: '2026-11-14T18:00:00.000Z' },
  addon: { subscriptionId: 'sub_soc', status: 'active', priceCents: 5000, periodEnd: '2026-11-14T18:00:00.000Z', cancelAtPeriodEnd: false },
  pastDue: { invoiceId: 'in_late', amountCents: 7900 },
  cards: [
    { id: 'pm_visa', kind: 'card', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2034, wallet: null, isDefault: true },
    { id: 'pm_mc', kind: 'card', brand: 'Mastercard', last4: '4444', expMonth: 1, expYear: 2031, wallet: 'apple pay', isDefault: false },
  ],
  invoices: [
    { id: 'in_2', number: 'E2E-0002', date: '2026-10-14T18:00:00.000Z', amountCents: 2500, currency: 'usd', status: 'paid', pdf: 'https://files.example.test/in_2.pdf', description: 'Credit pack' },
    { id: 'in_1', number: 'E2E-0001', date: '2026-10-01T18:00:00.000Z', amountCents: 7900, currency: 'usd', status: 'open', pdf: 'https://files.example.test/in_1.pdf', description: 'Docs2Video Pro' },
  ],
  details: { name: 'E2E Agency', email: 'billing@e2e.test', address: { line1: '1 Test St', line2: null, city: 'Austin', state: 'TX', postal_code: '78701', country: 'US' } },
})

async function mockBilling(page: Page, onPost: (body: any) => { status?: number; json: unknown } = () => ({ json: { ok: true } })) {
  const posts: any[] = []
  await page.route('**/api/billing/manage', async (route: Route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: STATE() })
    const body = jsonBody(route.request())
    posts.push(body)
    const r = onPost(body)
    return route.fulfill({ status: r.status ?? 200, json: r.json })
  })
  return posts
}

test.beforeEach(async ({ page }) => {
  guard = await guardRealWorld(page)
  // Stripe's own script/network noise (js.stripe.com) isn't ours to judge here.
  consoleErrors = collectConsoleErrors(page, [/status of (400|402|409|500)/, /Stripe\.js/i, /stripe\.com/])
})
test.afterEach(() => {
  expectNoBlockedCalls(guard)
  expect(consoleErrors, 'console errors on Billing').toEqual([])
})

async function openBilling(page: Page, q = '') {
  await page.goto(`/settings?tab=billing${q}`)
  await expect(page.getByRole('heading', { name: 'Payment methods' })).toBeVisible({ timeout: 60000 })
}

test('shows the plan, next charge, late payment, cards, invoices with PDFs and billing details — all in the app', async ({ page }) => {
  await mockBilling(page)
  await openBilling(page)
  await expect(page.getByTestId('plan-line')).toHaveText('Your last payment didn’t go through.')
  await expect(page.getByRole('alert').filter({ hasText: 'of $79 didn’t go through' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay now with Visa •••• 4242' })).toBeVisible()
  const cards = page.locator('[class*="cardRow"]')
  await expect(cards).toHaveCount(2)
  await expect(cards.first()).toContainText('Default')
  await expect(cards.nth(1)).toContainText('apple pay')
  const pdf = page.getByRole('link', { name: /Download PDF/ }).first()
  await expect(pdf).toHaveAttribute('href', 'https://files.example.test/in_2.pdf')
  await expect(pdf).toHaveAttribute('target', '_blank')
  await expect(page.getByText('Due', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Name or company')).toHaveValue('E2E Agency')
  await expect(page.getByRole('heading', { name: 'AI Social add-on' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Manage billing/ })).toHaveCount(0)
})

test('Update card (late payment) opens the in-app card form — from the dashboard link too', async ({ page }) => {
  const posts = await mockBilling(page, (b) => (b.action === 'setup_card' ? { status: 500, json: { error: 'Mocked: card form unavailable.' } } : { json: { ok: true } }))
  await openBilling(page, '&fix=card')
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByRole('heading', { name: 'Update your card' })).toBeVisible()
  await expect(dlg).toContainText('We’ll pay the late bill of $79')
  await expect(dlg.getByText('Mocked: card form unavailable.')).toBeVisible()
  expect(posts).toEqual([{ action: 'setup_card' }])
  expect(new URL(page.url()).searchParams.get('fix'), 'the one-time ?fix=card is cleared').toBeNull()
})

test('Pay now pays the late bill with the default card', async ({ page }) => {
  const posts = await mockBilling(page, (b) => (b.action === 'retry_payment' ? { json: { status: 'paid' } } : { json: { ok: true } }))
  await openBilling(page)
  await page.getByRole('button', { name: 'Pay now with Visa •••• 4242' }).click()
  await expect(page.getByText(/Paid — thank you/)).toBeVisible()
  expect(posts).toEqual([{ action: 'retry_payment', cardId: 'pm_visa' }])
})

test('cancel asks first, records the reason, and keeping the plan sends nothing', async ({ page }) => {
  const posts = await mockBilling(page, (b) => (b.action === 'cancel' ? { json: { status: 'ends_at_period_end', endsAt: '2026-11-14T18:00:00.000Z' } } : { json: { ok: true } }))
  await openBilling(page)
  // Fix the late-payment state out of the way: the plan card offers cancel only when payments are fine.
  await page.route('**/api/billing/manage', (route) => route.request().method() === 'GET'
    ? route.fulfill({ json: { ...STATE(), pastDue: null } }) : route.fallback())
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Payment methods' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel plan' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByRole('heading', { name: 'Cancel your plan?' })).toBeVisible()
  await expect(dlg).toContainText('You keep your plan and credits until Nov 14, 2026')
  await dlg.getByRole('button', { name: 'Keep my plan' }).click()
  await expect(dlg).toHaveCount(0)
  expect(posts).toEqual([])
  await page.getByRole('button', { name: 'Cancel plan' }).click()
  await dlg.getByLabel('It costs too much').check()
  await dlg.getByLabel('Anything else?').fill('Too many tools')
  await dlg.getByRole('button', { name: 'Cancel plan' }).click()
  await expect(page.getByText(/Cancelled — you keep everything until/)).toBeVisible()
  expect(posts[0]).toEqual({ action: 'cancel', which: 'plan', reason: 'too_expensive', comment: 'Too many tools' })
})

test('switching plan shows the price first and confirms with the same proration moment', async ({ page }) => {
  const posts = await mockBilling(page, (b) => {
    if (b.action === 'preview_plan') return { json: { direction: 'upgrade', from: { tier: 'pro', label: 'Pro', priceCents: 7900 }, to: { tier: 'business', label: 'Business', priceCents: 19900, monthlyCredits: 75000 }, dueNowCents: 6000, nextAmountCents: 19900, nextDate: '2026-11-14T18:00:00.000Z', prorationDate: 1791900000 } }
    if (b.action === 'change_plan') return { status: 402, json: { error: 'Your card was declined, so your plan was not changed. Add or choose another card under Payment methods, then try again.', code: 'declined' } }
    return { json: { ok: true } }
  })
  await page.route('**/api/billing/manage', (route) => route.request().method() === 'GET'
    ? route.fulfill({ json: { ...STATE(), pastDue: null } }) : route.fallback())
  await openBilling(page)
  await page.getByRole('button', { name: 'Switch to Business' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg).toContainText('You pay today')
  await expect(dlg).toContainText('$60')
  await expect(dlg).toContainText('From Nov 14, 2026 you pay $199 a month')
  await dlg.getByRole('button', { name: 'Upgrade — pay $60' }).click()
  await expect(dlg.getByRole('alert')).toContainText('Your card was declined, so your plan was not changed.')
  expect(posts).toEqual([{ action: 'preview_plan', plan: 'business' }, { action: 'change_plan', plan: 'business', prorationDate: 1791900000 }])
})

test('remove a card asks first and names it; set default sends that card', async ({ page }) => {
  const posts = await mockBilling(page)
  await openBilling(page)
  const mc = page.locator('[class*="cardRow"]').filter({ hasText: '4444' })
  await mc.getByRole('button', { name: 'Make default' }).click()
  await expect(page.getByText('That card will be used for your next bills.')).toBeVisible()
  await mc.getByRole('button', { name: /^Remove/ }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByRole('heading', { name: 'Remove this card?' })).toBeVisible()
  await expect(dlg).toContainText('Mastercard •••• 4444')
  await dlg.getByRole('button', { name: 'Remove card' }).click()
  await expect(page.getByText('Card removed.')).toBeVisible()
  expect(posts).toEqual([{ action: 'set_default', cardId: 'pm_mc' }, { action: 'remove_card', cardId: 'pm_mc' }])
})

test('billing details save the name, email and address', async ({ page }) => {
  const posts = await mockBilling(page)
  await openBilling(page)
  await page.getByLabel('City').fill('Dallas')
  await page.getByRole('button', { name: 'Save details' }).click()
  await expect(page.getByText('Billing details saved.')).toBeVisible()
  expect(posts[0]).toMatchObject({ action: 'update_details', name: 'E2E Agency', email: 'billing@e2e.test', address: { line1: '1 Test St', city: 'Dallas', state: 'TX', postal_code: '78701', country: 'US' } })
})

test('the payment pop-up leaves the page usable for the bank check (not modal) and closes with Escape', async ({ page }) => {
  await mockBilling(page)
  await page.route('**/api/credits/buy', (route) => route.fulfill({ status: 500, json: { error: 'Mocked: payment form unavailable.' } }))
  await openBilling(page)
  await page.getByRole('button', { name: 'Buy the Small pack' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByText('Mocked: payment form unavailable.')).toBeVisible()
  // A modal <dialog> would make the rest of the page inert (Stripe's 3D Secure window included).
  expect(await page.evaluate(() => document.querySelector('dialog.kit-dialog--free')?.matches(':modal'))).toBe(false)
  await page.keyboard.press('Escape')
  await expect(dlg).toHaveCount(0)
  expect(new URL(page.url()).pathname).toBe('/settings')
})
