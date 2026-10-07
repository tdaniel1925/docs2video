import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/*
 * LIGHT START (overhaul phase 5): a new person signs up and reaches the free
 * first-scene preview WITHOUT a card; the card is asked for when they press
 * "Make it". These checks keep both halves true:
 *   - nothing on the way in sends a new Docs2Video account to the card page
 *     or the setup wizard, and the reading/writing steps let a cardless
 *     account through (within a daily cap);
 *   - a cardless account still can't spend a single credit — the money rule
 *     in credits.ts is run for real here (database mocked), and every way to
 *     start a real render answers 'card_required'.
 */

const ROOT = path.resolve(__dirname, '..')
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8')

// ── A pretend database: one profile, a wallet, and a log of every write ──
const db = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  wallet: { balance: 2000, topup_balance: 0, cycle_credits_used: 0 } as Record<string, number> | null,
  writes: [] as string[],
  rateAllowed: true,
  rateCalls: [] as string[],
}))

vi.mock('../app/_lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: any = {
        select: () => q, eq: () => q, order: () => q, limit: () => q,
        single: async () => ({ data: table === 'profiles' ? db.profile : table === 'credit_balances' ? db.wallet : null }),
        maybeSingle: async () => ({ data: table === 'profiles' ? db.profile : table === 'credit_balances' ? db.wallet : null }),
        // An update chain ends when awaited: it "changes" one row.
        update: () => { db.writes.push(`update ${table}`); q.then = (ok: (v: unknown) => unknown) => ok({ data: [{ user_id: 'u1' }], error: null }); return q },
        insert: async () => { db.writes.push(`insert ${table}`); return { data: null, error: null } },
        upsert: async () => { db.writes.push(`upsert ${table}`); return { data: null, error: null } },
      }
      return q
    },
    rpc: async () => ({ data: true, error: null }),
  }),
}))
vi.mock('../app/_lib/rate-limit', () => ({
  checkRateLimit: async (key: string) => { db.rateCalls.push(key); return { allowed: db.rateAllowed } },
  rateLimit: () => ({ allowed: true, remaining: 9 }),
  getRateLimitKey: () => 'k',
  LIMITS: {},
}))

import { checkCredits, deductCredits, spendBlockReason } from '../app/_lib/credits'
import { cardlessPrepGate, isCardless } from '../app/_lib/cardless-prep'
import {
  CARDLESS_PREP_PER_DAY, afterSignupPath, cardlessPrepKey, landingAfterEmailLink,
} from '../app/_lib/light-start'

const CARDLESS = { is_admin: false, is_beta: false, subscription_status: 'free', card_on_file: false }
const TRIAL_WITH_CARD = { is_admin: false, is_beta: false, subscription_status: 'trial', card_on_file: true }

beforeEach(() => {
  db.profile = null
  db.wallet = { balance: 2000, topup_balance: 0, cycle_credits_used: 0 }
  db.writes = []
  db.rateAllowed = true
  db.rateCalls = []
})

describe('the way in: no card page, no wizard', () => {
  it('Docs2Video signups land on Home; Text2Art keeps card-first', () => {
    expect(afterSignupPath({ showVideoFeatures: true })).toBe('/dashboard')
    expect(afterSignupPath({ showVideoFeatures: false })).toBe('/setup-payment')
  })

  it('old "confirm your email" links (next=/setup-payment) land on Home; a card page sent from Make it is kept', () => {
    expect(landingAfterEmailLink('/setup-payment', { showVideoFeatures: true })).toBe('/dashboard')
    expect(landingAfterEmailLink('/setup-payment?next=%2Fcreate%2Ftheme', { showVideoFeatures: true })).toBe('/setup-payment?next=%2Fcreate%2Ftheme')
    expect(landingAfterEmailLink('/setup-payment', { showVideoFeatures: false })).toBe('/setup-payment')
    expect(landingAfterEmailLink('/reset-password', { showVideoFeatures: true })).toBe('/reset-password')
  })

  it('signup, the email-link routes, the app layout and the wizard no longer push to the card page', () => {
    const auth = read('app/_actions/auth.ts')
    expect(auth).not.toMatch(/redirect\('\/setup-payment'\)/)
    expect(auth).not.toContain('next=/setup-payment')
    expect(auth).toMatch(/redirect\(landing\)/)
    expect(auth).toContain("jar.get('d2v_ref')") // affiliate cookie still recorded at signup
    for (const f of ['app/(auth)/auth/confirm/route.ts', 'app/(auth)/auth/callback/route.ts']) {
      expect(read(f), f).toContain('landingAfterEmailLink(next, await getBrand())')
    }
    const layout = read('app/(dashboard)/layout.tsx')
    expect(layout).not.toMatch(/redirect\('\/setup'\)/)
    const wizard = read('app/(onboarding)/setup/page.tsx')
    expect(wizard).not.toMatch(/card_on_file[\s\S]{0,80}router\.push\('\/setup-payment'\)/)
    const card = read('app/(auth)/setup-payment/page.tsx')
    expect(card).not.toMatch(/'\/setup' :/)
    expect(card).toContain('Not now, try it first')
  })
})

describe('a cardless account CAN reach the free preview', () => {
  it('the free preview route never checks a card or touches credits', () => {
    const route = read('app/api/preview-first-scene/route.ts')
    expect(route).not.toMatch(/card_on_file|spendBlockReason|checkCredits|deductCredits|_lib\/credits/)
  })

  it('reading a document or website lets card_required through to the daily cap (other blocks still stop)', () => {
    for (const f of ['app/api/extract/route.ts', 'app/api/extract-url/route.ts']) {
      const src = read(f)
      expect(src, f).toMatch(/credit\.blockedReason === 'card_required'\) \{\s*const capped = await cardlessPrepGate\(user\.id, true\)\s*if \(capped\) return capped\s*\} else if \(!credit\.allowed\)/)
    }
  })

  it('every free AI step on the way to the preview counts toward the cardless cap', () => {
    for (const f of ['extract-doc', 'combine-docs', 'brief', 'brief/chat', 'generate-script', 'ai-edit-scenes', 'style-previews']) {
      expect(read(`app/api/${f}/route.ts`), f).toMatch(/const capped = await cardlessPrepGate\(user\.id\)\s*if \(capped\) return capped/)
    }
  })

  it('the cap counts only cardless accounts, per UTC day, and says what to do', async () => {
    db.profile = CARDLESS
    expect(await isCardless('u1')).toBe(true)
    expect(await cardlessPrepGate('u1')).toBeNull()
    expect(db.rateCalls).toEqual([cardlessPrepKey('u1', new Date())])
    expect(cardlessPrepKey('u1', new Date('2026-10-07T23:59:00Z'))).toBe('cardless-prep:u1:2026-10-07')

    db.rateAllowed = false
    const capped = await cardlessPrepGate('u1')
    expect(capped?.status).toBe(429)
    expect(await capped?.json()).toMatchObject({ code: 'cardless_prep_cap' })

    // An account with a card is never counted.
    db.rateCalls = []
    db.profile = TRIAL_WITH_CARD
    expect(await cardlessPrepGate('u2')).toBeNull()
    expect(db.rateCalls).toEqual([])
    expect(CARDLESS_PREP_PER_DAY).toBeGreaterThan(5)
    expect(CARDLESS_PREP_PER_DAY).toBeLessThanOrEqual(50)
  })
})

describe('a cardless account can NOT start a real render (or spend at all)', () => {
  it('the rule: free/trial without a card is card_required; a card, a paid plan or admin is not', () => {
    expect(spendBlockReason(CARDLESS)).toBe('card_required')
    expect(spendBlockReason({ ...CARDLESS, subscription_status: 'trial' })).toBe('card_required')
    expect(spendBlockReason({ ...CARDLESS, subscription_status: null })).toBe('card_required')
    expect(spendBlockReason(TRIAL_WITH_CARD)).toBeNull()
    expect(spendBlockReason({ ...CARDLESS, subscription_status: 'pro' })).toBeNull()
    expect(spendBlockReason({ ...CARDLESS, is_admin: true })).toBeNull()
  })

  it('checkCredits refuses with card_required even with 2,000 credits in the wallet', async () => {
    db.profile = CARDLESS
    const r = await checkCredits('u1', 500)
    expect(r).toMatchObject({ allowed: false, blockedReason: 'card_required' })
  })

  it('deductCredits refuses and writes nothing; the same account with a card is charged', async () => {
    db.profile = CARDLESS
    expect(await deductCredits('u1', 1000, 'video_generation')).toBe(false)
    expect(db.writes).toEqual([])

    db.profile = TRIAL_WITH_CARD
    expect(await deductCredits('u1', 1000, 'video_generation')).toBe(true)
    expect(db.writes).toContain('update credit_balances')
  })

  it('every way to start a real one answers card_required before anything is claimed or charged', () => {
    const video = read('app/api/generate-video/route.ts')
    expect(video).toMatch(/creditCheck\.blockedReason === 'card_required'\) \{\s*return refuse\(402, \{ error: spendBlockMessage\('card_required'\), code: 'card_required' \}\)/)
    const pres = read('app/api/generate-presentation/route.ts')
    expect(pres).toMatch(/checkCredits\(/)
    const commercial = read('app/api/generate-commercial/route.ts')
    expect(commercial).toMatch(/if \(!check\.allowed\) return creditDeniedResponse\(check, COMMERCIAL_COST\)/)
    // Step 3 sends the person to add a card and back (video and presentations).
    const theme = read('app/(dashboard)/create/theme/page.tsx')
    expect(theme).toMatch(/isPres && quote\?\.blockedReason === 'card_required'/)
    expect(theme).toMatch(/g\.code === 'card_required'\) \{\s*router\.push\(`\/setup-payment\?next=/)
    expect(read('app/(dashboard)/create/commercial/page.tsx')).toMatch(/data\?\.code === 'card_required'/)
  })

  it('a cardless account is sent to add a card before buying a credit pack (it could not spend it)', () => {
    const buy = read('app/api/credits/buy/route.ts')
    const at = buy.indexOf('await isCardless(user.id)')
    expect(at).toBeGreaterThan(0)
    expect(at).toBeLessThan(buy.indexOf('stripe.checkout.sessions.create'))
    expect(buy).toMatch(/code: 'card_required'/)
  })

  it('the trial still starts only from a card Stripe confirms (audit C2 untouched)', () => {
    const confirm = read('app/api/confirm-card/route.ts')
    expect(confirm).toContain("si.status === 'succeeded' && siCustomer === customerId")
    expect(confirm).toMatch(/card_on_file: true,\s*free_videos_remaining/)
  })
})
