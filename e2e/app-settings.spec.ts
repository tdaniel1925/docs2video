import { test, expect, type Page } from '@playwright/test'
import { collectConsoleErrors, expectNoBlockedCalls, guardRealWorld, jsonBody, type Guard } from './helpers/guard'

/*
 * SETTINGS — the account area (round B): every section and button. Saves that would change the real account
 * (profile, links, photos, keys, billing, delete) are intercepted and their
 * requests checked; nothing about the test account changes.
 */

let guard: Guard
let consoleErrors: string[]

test.beforeEach(async ({ page }) => {
  guard = await guardRealWorld(page)
  consoleErrors = collectConsoleErrors(page, [/status of (400|402|500)/])
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible()
})
test.afterEach(() => {
  expectNoBlockedCalls(guard)
  expect(consoleErrors, 'console errors on Settings').toEqual([])
})

/** An item in the account area's own menu (left on a computer). */
const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Your account' }).getByRole('link', { name, exact: true })

/** Intercept the browser's direct profile saves (supabase REST). */
async function mockProfileSave(page: Page, status = 204) {
  const saves: any[] = []
  await page.route('**/rest/v1/profiles?**', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    saves.push(jsonBody(route.request()))
    await route.fulfill(status === 204 ? { status: 204, body: '' } : { status, json: { message: 'nope' } })
  })
  return saves
}

async function mockStripeRedirect(page: Page) {
  await page.route('https://checkout.stripe.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<h1>Stripe (mocked)</h1>' }))
  await page.route('https://billing.stripe.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<h1>Stripe billing (mocked)</h1>' }))
}

test('the menu moves between Profile, Billing & credits, Brand kit and Email & sending', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible()
  await expect(tab(page, 'Profile')).toHaveAttribute('aria-current', 'page')
  await tab(page, 'Email & sending').click()
  await expect(page).toHaveURL(/\/settings\?tab=email$/)
  await expect(page.getByRole('heading', { name: 'Connected email' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your details' })).toHaveCount(0)
  await tab(page, 'Billing & credits').click()
  await expect(page.getByRole('heading', { name: 'Billing & credits', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Current plan' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Credits available' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'This period' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Credit packs' })).toBeVisible()
  await tab(page, 'Brand kit').click()
  await expect(page.getByRole('heading', { name: 'Brand kit', level: 1 })).toBeVisible()
  await tab(page, 'Profile').click()
  await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible()
})

test('old Settings links still land on the right section', async ({ page }) => {
  for (const [url, title] of [
    ['/settings?tab=subscription', 'Billing & credits'],
    ['/settings?tab=integrations', 'Email & sending'],
    ['/settings?email_error=access_denied', 'Email & sending'],
    ['/settings?tab=social', 'AI Social'],
    ['/settings?tab=profile', 'Profile'],
    ['/settings?tab=nonsense', 'Profile'],
  ] as const) {
    await page.goto(url)
    await expect(page.getByRole('heading', { name: title, level: 1 }), url).toBeVisible()
  }
  // Analytics and Affiliate wear the same menu at their own addresses.
  await page.goto('/analytics')
  await expect(tab(page, 'Analytics')).toHaveAttribute('aria-current', 'page')
  await tab(page, 'Affiliate').click()
  await expect(page).toHaveURL(/\/affiliate$/)
  await expect(tab(page, 'Affiliate')).toHaveAttribute('aria-current', 'page')
})

test('"Run the setup again" opens the setup wizard', async ({ page }) => {
  await page.getByRole('link', { name: 'Run the setup again' }).click()
  await expect(page).toHaveURL(/\/setup$/)
})

test('Save changes sends exactly the form’s values; a failed save says so', async ({ page }) => {
  const saves = await mockProfileSave(page)
  const name = page.locator('input[name="full_name"]')
  const original = await name.inputValue()
  await name.fill(`${original} E2E`)
  await page.locator('input[name="phone"]').fill('555-0100')
  await page.locator('select[name="role"]').selectOption('broker')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved!')).toBeVisible()
  expect(saves).toHaveLength(1)
  expect(saves[0]).toMatchObject({ full_name: `${original} E2E`, phone: '555-0100', role: 'broker' })

  await page.unroute('**/rest/v1/profiles?**')
  await mockProfileSave(page, 500)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Could not save your profile. Please try again.')).toBeVisible()
})

test('Security: a short password and a bad email are refused with a reason (nothing changes)', async ({ page }) => {
  await page.getByPlaceholder('New password (min 8 characters)').fill('short')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible()
  const email = page.getByPlaceholder('new@email.com')
  await email.fill('a@b')
  await page.getByRole('button', { name: 'Update email' }).click()
  await expect(page.getByText('Please enter a valid email address.')).toBeVisible()
})

test('Profile photos: Upload sends the picture and shows it; the photo-fixer link opens', async ({ page }) => {
  const uploads: string[] = []
  await page.route('**/api/upload-photo', async (route) => {
    uploads.push(route.request().headers()['content-type'] ?? '')
    await route.fulfill({ json: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' } })
  })
  const slot = page.locator('label', { hasText: /^(Upload|Change)$/ }).nth(1) // Mid-level
  await slot.locator('input[type=file]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') })
  await expect(page.getByRole('img', { name: 'Mid-level' })).toBeVisible()
  expect(uploads[0]).toContain('multipart/form-data')
  await page.getByRole('link', { name: /AI Photo Fixer/ }).click()
  await expect(page).toHaveURL(/\/fix$/)
})

test('Email & sending: mail sign-in links and the SMTP form; AI Social: social connect', async ({ page }) => {
  await tab(page, 'Email & sending').click()
  const ms = page.locator('a[href="/api/auth/microsoft"]')
  if (await ms.count()) await expect(ms).toBeVisible()
  const g = page.locator('a[href="/api/auth/google"]')
  if (await g.count()) await expect(g).toBeVisible()

  // SMTP opens its form and closes again.
  await page.getByRole('button', { name: /SMTP/i }).first().click()
  const smtpHeading = page.getByRole('heading', { name: /SMTP/i })
  await expect(smtpHeading).toBeVisible()
  await page.getByRole('button', { name: /^(Cancel|Close|×)$/ }).last().click()
  await expect(smtpHeading).toHaveCount(0)

  // Social connect (AI Social section) asks the server for the sign-in link.
  await page.goto('/settings?tab=social')
  await expect(page.getByRole('heading', { name: 'Social accounts' })).toBeVisible()
  const connect = page.getByRole('button', { name: /^(twitter|Connect.*)$/i }).first()
  if (await connect.count()) {
    const bodies: any[] = []
    await page.route('**/api/social-accounts', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      bodies.push(jsonBody(route.request()))
      await route.fulfill({ status: 402, json: { code: 'addon_required', error: 'x' } })
    })
    await connect.click()
    await expect(page.getByText('Add the AI Social add-on first', { exact: false })).toBeVisible()
    expect(bodies[0].action).toBe('connect')
  }
})

test('Email & sending: payment and booking links must be https; good ones save', async ({ page }) => {
  const saves = await mockProfileSave(page)
  await tab(page, 'Email & sending').click()
  const payCard = page.locator('.settings-card', { has: page.getByRole('heading', { name: 'Payment link' }) })
  const pay = page.getByPlaceholder('https://buy.stripe.com/...')
  await pay.fill('http://buy.stripe.com/test')
  await payCard.getByRole('button', { name: /^Save/ }).click()
  await expect(page.getByText('Enter a payment link that starts with https://')).toBeVisible()
  expect(saves).toHaveLength(0)
  await pay.fill('https://buy.stripe.com/test_e2e')
  await payCard.getByRole('button', { name: /^Save/ }).click()
  await expect.poll(() => saves.length).toBe(1)
  expect(saves[0]).toEqual({ payment_link_url: 'https://buy.stripe.com/test_e2e' })

  // Booking link: each provider changes the example, and saving checks https too.
  const card = page.locator('.settings-card', { has: page.getByRole('heading', { name: 'Booking link' }) })
  for (const b of await card.getByRole('button').filter({ hasNotText: /Save/ }).all()) await b.click()
  const booking = card.locator('input').first()
  await booking.fill('calendly.com/me')
  await card.getByRole('button', { name: /^Save/ }).click()
  await expect.poll(() => saves.length).toBe(2)
  expect(saves[1].calendly_url).toMatch(/^https:\/\//)
})

test('API keys: Generate shows the new key once, Copy and Done work, Revoke asks the server', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const keys: { id: string; name: string; key_prefix: string; is_active: boolean; created_at: string; last_used_at: null }[] = []
  const calls: string[] = []
  await page.route('**/api/keys**', async (route) => {
    const m = route.request().method()
    calls.push(m)
    if (m === 'GET') return route.fulfill({ json: { keys } })
    if (m === 'POST') {
      keys.push({ id: 'k1', name: jsonBody(route.request()).name, key_prefix: 'd2v_e2e', is_active: true, created_at: new Date().toISOString(), last_used_at: null })
      return route.fulfill({ json: { api_key: 'd2v_e2e_secret_value' } })
    }
    if (m === 'DELETE') { keys.length = 0; return route.fulfill({ json: { success: true } }) }
    return route.fallback()
  })
  // API keys live on Profile now.
  await page.getByPlaceholder("Key name (optional, e.g. 'MCP')").fill('E2E key')
  await page.getByRole('button', { name: 'Generate key' }).click()
  await expect(page.getByText('d2v_e2e_secret_value')).toBeVisible()
  await page.getByRole('button', { name: 'Copy', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('d2v_e2e_secret_value')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('d2v_e2e_secret_value')).toHaveCount(0)
  await expect(page.getByText('E2E key')).toBeVisible()
  await page.getByRole('button', { name: 'Revoke' }).click()
  await expect(page.getByText('No keys yet.')).toBeVisible()
  expect(calls).toContain('DELETE')
})

test('Billing: Buy credits opens the packs and a pack goes to Stripe checkout', async ({ page }) => {
  await mockStripeRedirect(page)
  const buys: any[] = []
  await page.route('**/api/credits/buy', async (route) => { buys.push(jsonBody(route.request())); await route.fulfill({ json: { url: 'https://checkout.stripe.com/c/pay/cs_test_e2e' } }) })
  await tab(page, 'Billing & credits').click()
  await page.getByRole('button', { name: 'Buy credits' }).click()
  await expect(page.getByRole('heading', { name: 'Buy credits' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { name: 'Buy credits' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Buy credits' }).click()
  await page.getByRole('button', { name: /^Buy / }).nth(1).click()
  await expect(page).toHaveURL(/checkout\.stripe\.com/)
  expect(buys).toHaveLength(1)
})

test('Billing: a plan button starts checkout for that plan (or opens billing for the current one)', async ({ page }) => {
  await mockStripeRedirect(page)
  const subs: any[] = []
  await page.route('**/api/subscribe', async (route) => { subs.push(jsonBody(route.request())); await route.fulfill({ json: { url: 'https://checkout.stripe.com/c/pay/cs_test_plan' } }) })
  await page.route('**/api/stripe/portal', (route) => route.fulfill({ json: { url: 'https://billing.stripe.com/p/session/test_e2e' } }))
  await tab(page, 'Billing & credits').click()
  const planBtn = page.getByRole('button', { name: /^(Subscribe to|Switch to) (Pro|Business|Enterprise)$/ }).first()
  const label = (await planBtn.textContent())!.trim()
  await planBtn.click()
  await expect(page).toHaveURL(/checkout\.stripe\.com/)
  expect(subs).toHaveLength(1)
  expect(String(subs[0].tier).toLowerCase()).toBe(label.split(' ').pop()!.toLowerCase())
})

test('Billing: billing portal buttons open Stripe billing', async ({ page }) => {
  await mockStripeRedirect(page)
  await page.route('**/api/stripe/portal', (route) => route.fulfill({ json: { url: 'https://billing.stripe.com/p/session/test_e2e' } }))
  await tab(page, 'Billing & credits').click()
  const portal = page.getByRole('button', { name: /Manage billing|Cancel subscription/ }).first()
  test.skip(!(await portal.count()), 'this account has no Stripe customer, so there is no billing portal button')
  await portal.click()
  await expect(page).toHaveURL(/billing\.stripe\.com/)
})

test('Delete account (bottom of Profile) asks twice; saying no to either sends nothing', async ({ page }) => {
  const seen: string[] = []
  let answers: boolean[] = [false]
  page.on('dialog', (d) => { seen.push(d.message()); void (answers.shift() ? d.accept() : d.dismiss()) })
  await page.getByRole('button', { name: 'Delete account' }).click()
  await expect.poll(() => seen.length).toBe(1)
  expect(seen[0]).toContain('Are you sure you want to delete your account?')

  answers = [true, false] // yes to the first question, no to the final one
  await page.getByRole('button', { name: 'Delete account' }).click()
  await expect.poll(() => seen.length).toBe(3)
  expect(seen[2]).toContain('This is your final confirmation.')
  // The guard fails this test if /api/account/delete was called.
  await expect(page).toHaveURL(/\/settings/)
})
