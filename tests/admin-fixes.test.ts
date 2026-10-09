import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import {
  summarizeMoney, describePrice, monthlyCents, conversion, isTestAccount, bucketOf, KNOWN_OTHER_PRICES, type MoneySub,
} from '../app/_lib/admin/money'
import { failReason, reviewReason } from '../app/_lib/admin/fail-reason'
import { SECRET_COLUMNS, ADMIN_USER_COLUMNS, ADMIN_USER_DETAIL_COLUMNS, ADMIN_VIDEO_COLUMNS, ADMIN_EMAIL_CONNECTION_COLUMNS } from '../app/_lib/admin/columns'
import { needsYouEmailHtml, needsYouSubject, abs } from '../app/_lib/admin/needs-you-email'
import { ownerAlertEmail, DEFAULT_OWNER_ALERT_EMAIL } from '../app/_lib/owner-inbox'
import { isPartnerKey } from '../app/_lib/admin/partner-key'
import type { NeedsYou } from '../app/_lib/admin/needs-you'

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')
function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...walk(rel))
    else if (/\.tsx?$/.test(name)) out.push(rel)
  }
  return out
}
const ADMIN_FILES = [...walk('app/api/admin'), ...walk('app/(dashboard)/admin'), ...walk('app/_lib/admin')]

// ── 1. One money calculation ────────────────────────────────────────────────

const ctx = {
  tierPrices: { starter: 'price_starter', pro: 'price_pro', business: 'price_business', enterprise: 'price_ent' },
  addonPriceId: 'price_addon',
}
const sub = (o: Partial<MoneySub>): MoneySub => {
  const info = describePrice(o.priceId ?? 'price_pro', o.monthlyCents ?? 7900, ctx)
  return { id: Math.random().toString(36), customerId: 'cus_x', status: 'active', paused: false, cancelAtPeriodEnd: false, priceId: 'price_pro', monthlyCents: 7900, planName: info.name, kind: info.kind, ...o }
}

describe('admin money (fixtures)', () => {
  const fixtures: MoneySub[] = [
    sub({ customerId: 'a' }),                                                     // Pro paying 79
    sub({ customerId: 'b', priceId: 'price_business', monthlyCents: 19900, planName: 'Business' }), // paying 199
    sub({ customerId: 'c', cancelAtPeriodEnd: true }),                            // paying but cancelling 79
    sub({ customerId: 'd', status: 'trialing', priceId: 'price_starter', monthlyCents: 2900, planName: 'Starter' }),
    sub({ customerId: 'e', status: 'past_due' }),
    sub({ customerId: 'f', paused: true }),
    sub({ customerId: 'g', status: 'canceled' }),
    sub({ customerId: 'h', priceId: 'price_addon', monthlyCents: 5000, planName: 'AI Social add-on', kind: 'addon' }),
    // Other products on the shared Stripe account — the old "Unknown" rows.
    sub({ customerId: 'j1', priceId: 'price_1TwT0SFnyKCNDapHIvO3ymPU', monthlyCents: 12900, planName: 'Jordyn Pro ($129)', kind: 'other' }),
    sub({ customerId: 'j2', priceId: 'price_1Tr0FJFnyKCNDapHvVFcdpnv', monthlyCents: 15000, planName: 'Apex API calls ($150)', kind: 'other', status: 'past_due' }),
  ]
  const m = summarizeMoney(fixtures)

  it('separates paying, trialing, past-due and paused', () => {
    expect(m.docs2video.paying).toBe(4) // a, b, c, add-on h
    expect(m.docs2video.trialing).toBe(1)
    expect(m.docs2video.pastDue).toBe(1)
    expect(m.docs2video.paused).toBe(1)
    expect(m.docs2video.cancelling).toBe(1)
  })
  it('MRR counts paying Docs2Video only (no trials, no late, no paused, no other products)', () => {
    expect(m.docs2video.mrrCents).toBe(7900 + 19900 + 7900 + 5000)
    expect(m.docs2video.trialingCents).toBe(2900)
    expect(m.docs2video.pastDueCents).toBe(7900)
    expect(m.other.count).toBe(2)
    expect(m.other.payingMrrCents).toBe(12900) // the past-due Apex one is not "paying"
  })
  it('a cancelled subscription is in no bucket', () => {
    expect(bucketOf({ status: 'canceled', paused: false })).toBeNull()
    expect(bucketOf({ status: 'incomplete_expired', paused: false })).toBeNull()
    expect(bucketOf({ status: 'active', paused: true })).toBe('paused')
  })
  it('names known prices instead of "Unknown" ($129 / $149 / $150)', () => {
    expect(describePrice('price_1TwT0SFnyKCNDapHIvO3ymPU', 12900, ctx)).toEqual({ name: 'Jordyn Pro ($129)', kind: 'other' })
    expect(describePrice('price_1TtyeKFnyKCNDapHBULC2Fuh', 14900, ctx).name).toBe('Jordyn Pro ($149)')
    expect(describePrice('price_1Tr0FJFnyKCNDapHvVFcdpnv', 15000, ctx).name).toBe('Apex API calls ($150)')
    // never-seen ids with those amounts still get a name, never "Unknown"
    for (const c of [12900, 14900, 15000]) expect(describePrice('price_new', c, ctx).name).not.toMatch(/unknown/i)
    expect(describePrice('price_pro', 7900, ctx)).toEqual({ name: 'Pro', kind: 'docs2video' })
    expect(describePrice('price_addon', 5000, ctx).kind).toBe('addon')
    expect(describePrice('price_x', 4000, { ...ctx, productNames: { price_x: 'Docs2Video Pro' } }).kind).toBe('docs2video')
    expect(describePrice('price_y', 4900, { ...ctx, productNames: new Map([['price_y', 'VidWiz Solo']]) })).toEqual({ name: 'VidWiz Solo ($49)', kind: 'other' })
    expect(Object.keys(KNOWN_OTHER_PRICES).length).toBeGreaterThan(2)
  })
  it('turns yearly prices into a monthly amount', () => {
    expect(monthlyCents(120000, 'year')).toBe(10000)
    expect(monthlyCents(7900, 'month', 2)).toBe(15800)
  })
  it('conversion leaves out banned, test and admin accounts', () => {
    const c = conversion([
      { email: 'real1@acme.com', subscription_status: 'pro', stripe_customer_id: 'a' },
      { email: 'real2@acme.com', subscription_status: 'trial', stripe_customer_id: 'd' },
      { email: 'real3@acme.com', subscription_status: null },
      { email: 'bad@acme.com', subscription_status: 'banned', stripe_customer_id: 'b' },
      { email: 'paytest+stripe@docs2video.test', subscription_status: 'pro', stripe_customer_id: 'c' },
      { email: 'owner@acme.com', subscription_status: 'pro', is_admin: true, stripe_customer_id: 'h' },
      { email: 'e2e-login@acme.com', subscription_status: null },
    ], new Set(['a', 'b', 'c', 'h']))
    expect(c).toEqual({ eligible: 3, paying: 1, ratePct: 33.3 })
  })
  it('spots test accounts but not real people', () => {
    for (const e of ['test@acme.com', 'jane+test@gmail.com', 'paytest+stripe@docs2video.test', 'qa.bot@acme.com', 'x@example.com']) expect(isTestAccount(e), e).toBe(true)
    for (const e of ['contest@acme.com', 'latest.news@acme.com', 'aziz@gmail.com', 'testa@gmail.com']) expect(isTestAccount(e), e).toBe(false)
    expect(isTestAccount('me@real.com', ['ME@real.com'])).toBe(true)
  })
  it('Dashboard, Billing and Revenue all read the ONE calculation', () => {
    for (const f of ['app/api/admin/stats/route.ts', 'app/api/admin/billing/route.ts', 'app/api/admin/revenue/route.ts']) {
      const src = read(f)
      expect(src, f).toContain('loadMoneySnapshot')
      expect(src, f).not.toMatch(/mrr\s*\+=/) // no private MRR sums left
    }
    expect(read('app/(dashboard)/admin/page.tsx')).not.toMatch(/planPrices/)
  })
})

// ── 2. Failed videos in plain words ─────────────────────────────────────────

describe('why a video did not finish', () => {
  it('turns the saved [fail] text into a plain sentence and keeps the technical text', () => {
    const r = failReason('[fail] render-v3: render exit 1', 'Video rendering failed. Your credits were refunded.')
    expect(r.plain).toMatch(/crashed while putting the video together/)
    expect(r.technical).toBe('render-v3: render exit 1')
    expect(failReason('[fail] trigger: fetch failed', null).plain).toMatch(/could not be reached/)
    expect(failReason(null, 'Stuck with no progress for 30 minutes').plain).toMatch(/too long/)
    expect(failReason('[fail] generate-slides: ElevenLabs 401', null).plain).toMatch(/voice/)
    expect(failReason(null, null).plain).toMatch(/No reason/)
    expect(reviewReason('Unusual values flagged for review: SV_EXCEEDS_CV')).toMatch(/unusual/)
  })
  it('the Videos tab has "last 24 hours" and "Waiting for your OK" filters', () => {
    const src = read('app/(dashboard)/admin/_components/VideosTab.tsx')
    expect(src).toContain('Last 24 hours')
    expect(src).toContain('Waiting for your OK')
    expect(src).toContain("'review_required'")
    expect(read('app/api/admin/videos/route.ts')).toMatch(/since === '24h'/)
  })
})

// ── 3. No secrets sent to the browser ───────────────────────────────────────

/** Admin selects that could leak: select('*') / select() on a secret table, or a secret column named. */
function leakySelects(src: string): string[] {
  const bad: string[] = []
  const re = /\.from\(['"](profiles|email_connections|api_keys|videos)['"]\)\s*\.select\(\s*(?:(['"`])([^'"`]*)\2)?\s*[,)]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const cols = m[3]
    if (cols === undefined || cols.trim() === '*') bad.push(`${m[1]}: ${cols ?? '(all)'}`)
    else for (const s of SECRET_COLUMNS) if (new RegExp(`\\b${s}\\b`).test(cols)) bad.push(`${m[1]}: ${s}`)
  }
  return bad
}

describe('admin never asks for secret columns', () => {
  it('the checker catches a leaky select (so a pass means something)', () => {
    expect(leakySelects(`admin.from('profiles').select('*').eq('id', id)`)).toHaveLength(1)
    expect(leakySelects(`db.from('email_connections').select('id, access_token')`)).toHaveLength(1)
    expect(leakySelects(`db.from('profiles').select('id, stripe_access_token')`)).toHaveLength(1)
    expect(leakySelects(`db.from('profiles').select('id, email')`)).toHaveLength(0)
  })
  it('no admin route, page or helper selects them', () => {
    const hits = ADMIN_FILES.flatMap((f) => leakySelects(read(f)).map((h) => `${f} → ${h}`))
    expect(hits).toEqual([])
  })
  it('the shared column lists hold no secret', () => {
    for (const cols of [ADMIN_USER_COLUMNS, ADMIN_USER_DETAIL_COLUMNS, ADMIN_VIDEO_COLUMNS, ADMIN_EMAIL_CONNECTION_COLUMNS]) {
      for (const s of SECRET_COLUMNS) expect(new RegExp(`\\b${s}\\b`).test(cols), `${s} in ${cols}`).toBe(false)
    }
  })
  it('users and videos are counted and paged on the server', () => {
    const data = read('app/api/admin/data/route.ts')
    expect(data).toMatch(/count: 'exact'/)
    expect(data).not.toMatch(/limit\(1000\)|limit\(2000\)/)
    expect(read('app/api/admin/users/route.ts')).toMatch(/\.range\(/)
    expect(read('app/api/admin/videos/route.ts')).toMatch(/\.range\(/)
  })
})

// ── 4. Every risky action asks first (kit pop-up, never confirm()) ──────────

/** True when, inside `fnName`'s body, `ask(` comes before `call`. */
function asksBefore(src: string, fnName: string, call: string): boolean {
  const start = src.search(new RegExp(`(async function ${fnName}\\b|const ${fnName} = async)`))
  if (start < 0) return false
  const body = src.slice(start, start + 3000)
  const a = body.indexOf('ask(')
  const c = body.indexOf(call)
  return a >= 0 && c > a
}

describe('risky admin actions ask first', () => {
  it('the checker fails an action that does not ask', () => {
    expect(asksBefore(`async function go() { await post('/api/admin/user-action', {}) }`, 'go', "post('/api/admin/user-action'")).toBe(false)
    expect(asksBefore(`async function go() { const r = await ask({}); await post('/x') }`, 'go', "post('/x'")).toBe(true)
  })
  it('Make admin, beta, Ban/Unban ask before calling the server', () => {
    const src = read('app/(dashboard)/admin/_components/UserMoneyActions.tsx')
    expect(asksBefore(src, 'toggleAdmin', "post('/api/admin/manage-access'")).toBe(true)
    expect(asksBefore(src, 'toggleBeta', "post('/api/admin/manage-access'")).toBe(true)
    expect(asksBefore(src, 'toggleBan', "post('/api/admin/user-action'")).toBe(true)
    expect(src).toMatch(/reasonLabel/) // ban needs a reason
  })
  it('the plan dropdown and credit buttons open a pop-up (no instant change)', () => {
    const src = read('app/(dashboard)/admin/_components/UserMoneyActions.tsx')
    // the dropdown only opens the dialog
    expect(src).toMatch(/onChange=\{\(e\) => \{ if \(e\.target\.value\) setPlan\(e\.target\.value\) \}\}/)
    expect(src).toContain('<PlanChangeDialog')
    expect(src).toContain('Stripe keeps billing.')
    expect(src).toMatch(/CREDIT_AMOUNTS = \[100, 500, 1000\]/)
    expect(src).toMatch(/disabled=\{busy \|\| !amountOk \|\| !reasonOk\}/)
    // the old one-click +10 / +100 buttons are gone everywhere
    for (const f of ADMIN_FILES.filter((x) => x.endsWith('.tsx'))) expect(read(f), f).not.toMatch(/add_credits', (10|100|500)\)/)
  })
  it('the server refuses credits without a reason', () => {
    expect(read('app/api/admin/user-action/route.ts')).toMatch(/Please write a short reason/)
  })
  it('Pause / Resume / Cancel subscription ask first', () => {
    const src = read('app/(dashboard)/admin/billing/page.tsx')
    expect(asksBefore(src, 'act', "fetch('/api/admin/billing'")).toBe(true)
    expect(src).not.toContain('InlineConfirm')
  })
  it('Revoke API key asks first, with an extra step for the Jordyn partner key', () => {
    const src = read('app/(dashboard)/admin/api-keys/page.tsx')
    expect(asksBefore(src, 'revoke', "act({ action: 'revoke'")).toBe(true)
    expect(src).toMatch(/typeToConfirm: k\.is_partner \? 'JORDYN'/)
    expect(isPartnerKey({ name: 'Jordyn platform (partner billing)' })).toBe(true)
    expect(isPartnerKey({ name: 'Agency MCP (commercials)' })).toBe(false)
  })
  it('Retry and Approve say what they will charge before running', () => {
    const src = read('app/(dashboard)/admin/_components/VideoActions.tsx')
    expect(asksBefore(src, 'retry', "fetch('/api/admin/retry-video', { method: 'POST'")).toBe(true)
    expect(src).toMatch(/quoteWords\(videoId\)[\s\S]*ask\(/)
    expect(read('app/_lib/admin/retry.ts')).toMatch(/This will charge \$\{who\} \$\{price\.toLocaleString\('en-US'\)\} credits/)
    expect(read('app/_lib/admin/retry.ts')).toMatch(/videoCreditCost\(videoPriceInputs/)
  })
  it('no browser confirm() anywhere in the admin', () => {
    for (const f of ADMIN_FILES.filter((x) => x.endsWith('.tsx'))) {
      const code = read(f).split('\n').filter((l) => !/^\s*(\*|\/\/)/.test(l)).join('\n')
      expect(code, f).not.toMatch(/(^|[^.\w])confirm\(/)
    }
  })
  it('billing, payout, plan and API-key actions are written to the audit log', () => {
    expect(read('app/api/admin/billing/route.ts')).toMatch(/logAdminAction\(admin\.id, `billing_\$\{action\}`/)
    const aff = read('app/api/admin/affiliates/route.ts')
    for (const a of ['affiliate_mark_paid', 'affiliate_approve_pending', 'affiliate_set_status']) expect(aff).toContain(a)
    const keys = read('app/api/admin/api-keys/route.ts')
    for (const a of ['api_key_create', 'api_key_revoke', 'api_credits_topup']) expect(keys).toContain(a)
    expect(read('app/api/admin/plan-change/route.ts')).toContain("'change_plan_stripe'")
    expect(read('app/api/admin/review-video/route.ts')).toMatch(/review_approve[\s\S]*review_reject/)
  })
  it('the audit log hides test accounts unless asked', () => {
    const src = read('app/(dashboard)/admin/_components/AuditTab.tsx')
    expect(src).toMatch(/useState\(false\)/)
    expect(src).toMatch(/!showTest && e\.is_test/)
  })
})

// ── 5. One inbox + the daily email ──────────────────────────────────────────

describe('one inbox for owner alerts', () => {
  const old = process.env.OWNER_ALERT_EMAIL
  afterEach(() => { if (old === undefined) delete process.env.OWNER_ALERT_EMAIL; else process.env.OWNER_ALERT_EMAIL = old })
  it('uses OWNER_ALERT_EMAIL, else the health-check address', () => {
    delete process.env.OWNER_ALERT_EMAIL
    expect(ownerAlertEmail()).toBe(DEFAULT_OWNER_ALERT_EMAIL)
    expect(DEFAULT_OWNER_ALERT_EMAIL).toBe('tdaniel@botmakers.ai')
    process.env.OWNER_ALERT_EMAIL = 'owner@example.org'
    expect(ownerAlertEmail()).toBe('owner@example.org')
    process.env.OWNER_ALERT_EMAIL = 'nonsense'
    expect(ownerAlertEmail()).toBe(DEFAULT_OWNER_ALERT_EMAIL)
  })
  it('the health alert and the daily email both send to it — and nowhere else', () => {
    const report = read('app/api/internal/error-report/route.ts')
    const digest = read('app/api/cron/daily-digest/route.ts')
    expect(report).toMatch(/to: ownerAlertEmail\(\)/)
    expect(digest).toMatch(/const to = ownerAlertEmail\(\)/)
    expect(digest).not.toMatch(/ADMIN_EMAILS|trenttdaniel/)
    expect(report).not.toMatch(/const ALERT_TO/)
  })
  it('the email links every line to the admin and says the count', () => {
    const n: NeedsYou = {
      at: '', total: 2, sections: [
        { key: 'failed', title: 'Videos that didn’t finish', tone: 'stop', href: '/admin?tab=videos&filter=failed&since=24h', items: [{ id: 'v', title: 'My <video>', detail: 'a@b.com — crashed', href: '/admin/users/u1' }] },
        { key: 'review', title: 'Waiting', tone: 'warn', href: '/admin?tab=videos&filter=review_required', items: [{ id: 'r', title: 'Held', detail: 'x', href: '/admin?tab=videos&filter=review_required', videoId: 'r' }] },
        { key: 'payouts', title: 'Affiliate payouts', tone: 'warn', href: '/admin/affiliates', items: [] },
        { key: 'providers', title: 'AI services', tone: 'info', href: '/admin/system', items: [{ id: 'fal:noperm', title: 'fal', detail: 'cannot read', href: 'https://fal.ai/dashboard/billing' }] },
      ],
    }
    const html = needsYouEmailHtml(n, 'https://docs2video.com', { completed24h: 5, stuck: [] })
    expect(html).toContain('href="https://docs2video.com/admin/users/u1"')
    expect(html).toContain('href="https://docs2video.com/admin?tab=videos&amp;filter=failed&amp;since=24h"')
    expect(html).toContain('href="https://fal.ai/dashboard/billing"')
    expect(html).toContain('My &lt;video&gt;') // escaped
    expect(html).not.toContain('Affiliate payouts') // empty sections left out
    expect(needsYouSubject(n, 1)).toBe('[Docs2Video] 3 things need you today')
    expect(abs('https://x.com', 'admin')).toBe('https://x.com/admin')
  })
  it('the daily digest builds from the same list as the admin card', () => {
    expect(read('app/api/cron/daily-digest/route.ts')).toContain('loadNeedsYou()')
    expect(read('app/api/admin/needs-you/route.ts')).toContain('loadNeedsYou()')
    expect(read('app/(dashboard)/admin/page.tsx')).toContain('<NeedsYouCard />')
  })
})

// ── 6. The Stripe webhook change is ONE call ────────────────────────────────

describe('payment errors are recorded', () => {
  it('the webhook only gained the import + one recordPaymentFailure call', () => {
    const src = read('app/api/webhooks/stripe/route.ts')
    expect(src.match(/recordPaymentFailure/g)?.length).toBe(2)
    expect(src).toMatch(/case 'invoice\.payment_failed': \{[\s\S]{0,400}await recordPaymentFailure\(/)
  })
  it('payment problems are read from the existing error log (no new table)', () => {
    expect(read('app/_lib/admin/payment-alerts.ts')).toMatch(/upsertErrorLog/)
    expect(read('app/_lib/admin/needs-you.ts')).toMatch(/from\('error_logs'\)[\s\S]*PAYMENT_ERROR_ENDPOINTS/)
  })
})

// ── 7. Phone: the side menu is a dropdown ───────────────────────────────────

describe('admin on a phone', () => {
  it('shows one dropdown instead of the long side menu', () => {
    expect(read('app/(dashboard)/admin/_components/AdminSidebar.tsx')).toMatch(/function PhoneNav[\s\S]*<select/)
    const css = read('app/(dashboard)/admin/admin.css')
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.admin-sidebar \{ display: none/)
    // corners ≤ 10px
    for (const m of css.matchAll(/border-radius:\s*(\d+)px/g)) expect(Number(m[1])).toBeLessThanOrEqual(10)
  })
})
