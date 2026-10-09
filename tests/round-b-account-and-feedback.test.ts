import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'

/**
 * ROUND B (2026-10) — the account area, a tighter Home, plain words, and
 * hover + focus feedback on every screen.
 *  - every address the app, emails and Stripe ever sent into Settings still
 *    opens the right section (old ?tab=subscription / integrations / social);
 *  - the menu shows AI Social only with the add-on, and nothing a Text2Art
 *    account can't use;
 *  - Billing reads only the existing routes and the price files;
 *  - the stiff Title Case words are gone from the listed screens;
 *  - kit.css carries the hover lift, the focus ring and the reduced-motion
 *    rule on the shared classes.
 * Each checker is shown to fail on a planted mistake, so a pass means something.
 */

let pathname = '/settings'
let search = new URLSearchParams()
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, prefetch() {} }),
  useSearchParams: () => search,
}))

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

import { sectionFromParams, accountItems, currentItem, ACCOUNT_ITEMS } from '../app/(dashboard)/settings/account-sections'
import AccountShell from '../app/(dashboard)/settings/AccountShell'
import { creditBar } from '../app/(dashboard)/settings/billing-summary'
import { TIER_CREDITS } from '../app/_lib/credits'

const D2V = { showVideoFeatures: true }
const T2A = { showVideoFeatures: false }
const params = (q: string) => { const u = new URLSearchParams(q); return (k: string) => u.get(k) }

// ── 1. OLD SETTINGS ADDRESSES STILL LAND ───────────────────────────────────

describe('old Settings links open the right section', () => {
  it('each old tab word, and the connect-flow returns', () => {
    expect(sectionFromParams(params(''), D2V)).toBe('profile')
    expect(sectionFromParams(params('tab=profile'), D2V)).toBe('profile')
    expect(sectionFromParams(params('tab=subscription'), D2V)).toBe('billing')
    expect(sectionFromParams(params('tab=subscription&plan_changed=pro'), D2V)).toBe('billing')
    expect(sectionFromParams(params('credits=success'), D2V)).toBe('billing')
    expect(sectionFromParams(params('tab=integrations'), D2V)).toBe('email')
    expect(sectionFromParams(params('tab=integrations&email_error=link_expired'), D2V)).toBe('email')
    expect(sectionFromParams(params('email_connected=gmail'), D2V)).toBe('email')
    expect(sectionFromParams(params('stripe_connected=1'), D2V)).toBe('email')
    expect(sectionFromParams(params('tab=social&connect=done'), D2V)).toBe('social')
    expect(sectionFromParams(params('tab=brand'), D2V)).toBe('brand')
    expect(sectionFromParams(params('tab=billing'), D2V)).toBe('billing')
    expect(sectionFromParams(params('tab=email'), D2V)).toBe('email')
    // Junk never breaks the page.
    for (const junk of ['tab=nope', 'tab=__proto__', 'tab=toString', 'tab=']) expect(sectionFromParams(params(junk), D2V), junk).toBe('profile')
  })

  it('Text2Art has no Email & sending: its old integrations links (API keys) open Profile', () => {
    expect(sectionFromParams(params('tab=integrations'), T2A)).toBe('profile')
    expect(sectionFromParams(params('tab=subscription'), T2A)).toBe('billing')
  })

  it('every ?tab= the app itself links to is understood (none falls through to Profile by accident)', () => {
    const found = new Set<string>()
    const walk = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = path.join(dir, n)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(n)) for (const m of readFileSync(p, 'utf8').matchAll(/\/settings\?tab=([a-z_-]+)/g)) found.add(m[1])
      }
    }
    walk(path.join(ROOT, 'app'))
    expect([...found]).toEqual(expect.arrayContaining(['subscription', 'integrations', 'social']))
    for (const tab of found) {
      const s = sectionFromParams(params(`tab=${tab}`), D2V)
      if (tab !== 'profile') expect(s, `?tab=${tab}`).not.toBe('profile')
    }
  })

  it('the checker can fail: an alias table without "subscription" would send billing links to Profile', () => {
    const broken = (q: string) => (params(q)('tab') === 'billing' ? 'billing' : 'profile')
    expect(broken('tab=subscription')).not.toBe(sectionFromParams(params('tab=subscription'), D2V))
  })

  it('the Stripe billing-portal return and the add-on returns still use those words', () => {
    expect(read('app/api/stripe/portal/route.ts')).toContain('/settings?tab=subscription')
  })
})

// ── 2. THE MENU ────────────────────────────────────────────────────────────

describe('the account menu', () => {
  it('Docs2Video: Profile, Billing & credits, Brand kit, Email & sending, Analytics, Affiliate — AI Social only with the add-on', () => {
    expect(accountItems({ ...D2V, hasSocial: false }).map((i) => i.label)).toEqual(['Profile', 'Billing & credits', 'Brand kit', 'Email & sending', 'Analytics', 'Affiliate'])
    expect(accountItems({ ...D2V, hasSocial: true }).map((i) => i.label)).toContain('AI Social')
  })

  it('Text2Art: nothing that needs a share page or video views', () => {
    const labels = accountItems({ ...T2A, hasSocial: false }).map((i) => i.label)
    expect(labels).not.toContain('Email & sending')
    expect(labels).not.toContain('Analytics')
    expect(labels).toContain('Billing & credits')
  })

  it('knows which item is "here" — /analytics and /affiliate included', () => {
    expect(currentItem('/settings', 'billing')).toBe('billing')
    expect(currentItem('/analytics', 'profile')).toBe('analytics')
    expect(currentItem('/affiliate', 'profile')).toBe('affiliate')
    expect(currentItem('/videos', 'profile')).toBeNull()
  })

  it('renders as a labelled menu with icons, marking the current section', () => {
    pathname = '/settings'; search = new URLSearchParams('tab=subscription')
    const html = renderToStaticMarkup(h(AccountShell, { hasSocial: false, children: h('p', null, 'body') }))
    expect(html).toContain('aria-label="Your account"')
    const current = html.match(/<a [^>]*aria-current="page"[^>]*>/g) ?? []
    expect(current).toHaveLength(1)
    expect(current[0]).toContain('href="/settings?tab=billing"')
    expect(html.match(/<svg/g)?.length).toBe(6)
    expect(html).not.toContain('AI Social')
    expect(html).toContain('<p>body</p>')
  })

  it('/analytics, /affiliate and /settings all wear it (their layout.tsx)', () => {
    for (const r of ['settings', 'analytics', 'affiliate']) {
      expect(read(`app/(dashboard)/${r}/layout.tsx`), r).toMatch(/<AccountLayout>\{children\}<\/AccountLayout>/)
    }
    expect(ACCOUNT_ITEMS.find((i) => i.id === 'analytics')?.href).toBe('/analytics')
  })

  it('moving between sections does not reload the profile (it would wipe unsaved typing)', () => {
    // The e2e run caught this: the load ran on every ?tab= change and reset
    // the payment-link box under the person typing in it.
    const page = read('app/(dashboard)/settings/page.tsx').replace(/\r\n/g, '\n')
    expect(page).toMatch(/\n    load\(\)\n[\s\S]{0,300}?\n  \}, \[\]\)/)
  })

  it('the avatar menu keeps shortcuts into it', () => {
    const top = read('app/_lib/top-bar.ts')
    expect(top).toContain("{ href: '/settings?tab=billing', label: 'Billing & credits' }")
  })
})

// ── 3. BILLING ─────────────────────────────────────────────────────────────

describe('Billing & credits', () => {
  it('the credits bar is monthly credits left against the plan’s monthly credits, never past 100%', () => {
    const base = { topup: 0, total: 0, cycleUsed: 0, cycleStart: null, renewsAt: null, cancelsAtPeriodEnd: false }
    expect(creditBar({ ...base, monthly: 12500, cycleGranted: 25000 }, 'pro')).toEqual({ left: 12500, of: TIER_CREDITS.pro, pct: 50 })
    expect(creditBar({ ...base, monthly: 90000, cycleGranted: 0 }, 'pro').pct).toBe(100)
    expect(creditBar(null, 'free')).toEqual({ left: 0, of: TIER_CREDITS.free, pct: 0 })
  })

  it('uses the same routes as before (no new way to pay) and the summary route only reads', () => {
    const billing = read('app/(dashboard)/settings/BillingSection.tsx')
    expect(billing).toContain("fetch('/api/stripe/portal', { method: 'POST' })")
    expect(billing).toContain("fetch('/api/subscribe', {")
    expect(billing).toContain('<BuyCreditsModal')
    expect(billing).toMatch(/from '..\/..\/_lib\/pricing'/)
    expect(billing).toMatch(/from '..\/..\/_lib\/credit-packs'/)
    const summary = read('app/api/billing/summary/route.ts')
    expect(summary).toMatch(/export async function GET/)
    expect(summary).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/)
    expect(summary).not.toMatch(/\.(update|insert|upsert|delete)\(/)
  })

  it('opens with the three summary cards, then plans, then packs, then invoices', () => {
    const b = read('app/(dashboard)/settings/BillingSection.tsx')
    const at = (s: string) => b.indexOf(s)
    expect(at('>Current plan<')).toBeGreaterThan(0)
    expect(at('>Credits available<')).toBeGreaterThan(at('>Current plan<'))
    expect(at('>This period<')).toBeGreaterThan(at('>Credits available<'))
    expect(at('>Plans<')).toBeGreaterThan(at('>This period<'))
    expect(at('>Credit packs<')).toBeGreaterThan(at('>Plans<'))
    expect(at('>Invoices and receipts<')).toBeGreaterThan(at('>Credit packs<'))
  })
})

// ── 4. PLAIN WORDS ─────────────────────────────────────────────────────────

const STIFF = [
  'Video Generation Failed', 'Retry Generation', 'Create New', 'Danger Zone', 'Re-run Setup Wizard',
  'Personal Info', 'Your Library', 'My Library', 'Delete Account', 'Email Connections', 'Calendar Booking',
  'Your Plan', 'Credits &amp; Top-Ups', 'Add Client', 'Save Changes', 'Your Brands', 'Slide Decks',
  'Send Test Email', 'Change Logo', 'Edit Colors', 'Affiliate Program</h1>',
]
const SCREENS = [
  'app/(dashboard)/dashboard', 'app/(dashboard)/create', 'app/(dashboard)/videos', 'app/(dashboard)/settings',
  'app/(dashboard)/brands', 'app/(dashboard)/clients', 'app/(dashboard)/help/page.tsx', 'app/(dashboard)/affiliate',
  'app/_lib/names.ts', 'app/_lib/how-to-use.ts',
]
function stiffHits(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  return STIFF.filter((w) => code.includes(w))
}

describe('plain words on the listed screens', () => {
  it('the checker can fail: planted stiff words are found', () => {
    expect(stiffHits('<p>Video Generation Failed</p>')).toEqual(['Video Generation Failed'])
    expect(stiffHits("<h3>Danger Zone</h3> <button>Delete Account</button>")).toEqual(['Danger Zone', 'Delete Account'])
    expect(stiffHits('// Re-run Setup Wizard was the old label')).toEqual([])
  })

  it('none are left', () => {
    const files: string[] = []
    const walk = (p: string) => {
      const abs = path.join(ROOT, p)
      if (statSync(abs).isDirectory()) for (const n of readdirSync(abs)) walk(path.join(p, n))
      else if (/\.(ts|tsx)$/.test(p)) files.push(p)
    }
    SCREENS.forEach(walk)
    expect(files.length).toBeGreaterThan(40)
    const problems = files.flatMap((f) => stiffHits(read(f)).map((w) => `${f}: ${w}`))
    expect(problems).toEqual([])
  })

  it('a failed project says what happened and what to do, calmly', async () => {
    const { FAILED_WORDS } = await import('../app/(dashboard)/videos/[id]/making/FailedCard')
    expect(FAILED_WORDS.title).toBe('This one didn’t finish.')
    expect(FAILED_WORDS.what).toMatch(/Try again/)
    expect(FAILED_WORDS.retry).toBe('Try again')
  })

  it('one name for the Library (names.ts) on the Library page and the help index', () => {
    expect(read('app/(dashboard)/videos/page.tsx')).toContain('<h1>{activeTab ? activeTab.label : NAMES.library}</h1>')
    expect(read('app/(dashboard)/help/page.tsx')).toContain('title: NAMES.library,')
  })
})

// ── 5. HOVER + FOCUS, IN THE KIT ───────────────────────────────────────────

const kitCss = read('app/kit.css')
/** The body of the first rule whose selector list contains `sel`. */
function ruleFor(css: string, sel: string): string {
  const re = new RegExp(`(^|[},])\\s*([^{}]*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{}]*)\\{([^}]*)\\}`, 'm')
  return css.match(re)?.[3] ?? ''
}

describe('hover and keyboard focus come from the kit', () => {
  it('a clickable card lifts a little and its edge turns the accent', () => {
    const hover = ruleFor(kitCss, '.kit-card--link:hover')
    expect(hover).toMatch(/border-color:\s*var\(--accent-ink\)/)
    expect(hover).toMatch(/transform:\s*translateY\(-\d+px\)/)
    expect(ruleFor(kitCss, '.kit-tile:hover')).toMatch(/translateY/)
  })

  it('everything you can press shows a focus ring — kit parts, old .btn, plain links and buttons', () => {
    // One rule whose selector list holds plain links/buttons AND the old .btn.
    const m = kitCss.match(/([^{}]*\.btn:focus-visible[^{}]*)\{([^}]*)\}/)
    expect(m, 'a .btn:focus-visible rule').toBeTruthy()
    expect(m![1]).toContain(':where(a, button')
    expect(m![1]).toContain('.kit-account-link:focus-visible')
    expect(m![2]).toMatch(/outline:\s*2px solid var\(--link\)/)
  })

  it('respects reduced motion', () => {
    const at = kitCss.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(at).toBeGreaterThan(0)
    const block = kitCss.slice(at, kitCss.indexOf('\n}\n', at))
    expect(block).toMatch(/\.kit-card--link:hover[^{]*\{\s*transform:\s*none/)
    expect(block).toMatch(/transition:\s*none/)
  })

  it('the checker can fail: a hover rule without the lift is caught', () => {
    expect(ruleFor('.kit-card--link:hover { border-color: var(--ink); }', '.kit-card--link:hover')).not.toMatch(/translateY/)
  })

  it('corners stay ≤ 10px in the new rules', () => {
    const radii = [...kitCss.matchAll(/border-radius:\s*([^;]+);/g)].flatMap((m) => [...m[1].matchAll(/(\d+)px/g)].map((n) => Number(n[1])))
    expect(Math.max(...radii)).toBeLessThanOrEqual(10)
  })
})

// ── 6. HOME: ONE JOB PER COLOUR ────────────────────────────────────────────

describe('Home', () => {
  const home = read('app/(dashboard)/dashboard/page.tsx')
  it('no blue info bar — the credits line is a slim line beside the Create label', () => {
    expect(home).not.toMatch(/tone="info"/)
    expect(home).not.toMatch(/tone=\{credits <= 0 \? 'warn' : 'info'\}/)
    expect(home).toContain('className="kit-label">Create<')
  })
  it('tiles, not big cards', () => {
    expect(home).toContain('className="kit-tile"')
    expect(home).not.toMatch(/<CardGo>/)
  })
})
