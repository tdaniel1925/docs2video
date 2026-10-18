import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { spendBlockReason, proportionalCredits, CREDIT_COSTS } from '../app/_lib/credits'

/**
 * Money guards added by the 2026-09-26 audit fixes.
 *  - H15: the card-required trial must hold for EVERY product, so the rule
 *    lives in one pure function used by both checkCredits and deductCredits.
 *  - H8/Low: refunds take back credits in proportion, never a whole pack for
 *    a partial refund.
 *  - H5: one-off tools charge before the work and refund on failure.
 */
describe('spendBlockReason (card-required trial, every product)', () => {
  it('lets admins and promo (beta) accounts spend', () => {
    expect(spendBlockReason({ is_admin: true, subscription_status: null, card_on_file: false })).toBeNull()
    expect(spendBlockReason({ is_beta: true, subscription_status: 'past_due', card_on_file: false })).toBeNull()
  })

  it('blocks free and trial users who have no card on file', () => {
    expect(spendBlockReason({ subscription_status: null, card_on_file: false })).toBe('card_required')
    expect(spendBlockReason({ subscription_status: 'free', card_on_file: null })).toBe('card_required')
    expect(spendBlockReason({ subscription_status: 'trial', card_on_file: false })).toBe('card_required')
  })

  it('lets trial users with a card spend', () => {
    expect(spendBlockReason({ subscription_status: 'trial', card_on_file: true })).toBeNull()
  })

  it('lets paying subscribers spend without the card flag (they paid through Checkout)', () => {
    for (const s of ['starter', 'pro', 'business', 'enterprise', 'agency', 'active']) {
      expect(spendBlockReason({ subscription_status: s, card_on_file: false })).toBeNull()
    }
  })

  it('blocks past_due and banned whatever else is true', () => {
    expect(spendBlockReason({ subscription_status: 'past_due', card_on_file: true })).toBe('past_due')
    expect(spendBlockReason({ subscription_status: 'banned', card_on_file: true })).toBe('banned')
  })

  it('fails closed when the profile could not be read', () => {
    expect(spendBlockReason(null)).toBe('no_profile')
    expect(spendBlockReason(undefined)).toBe('no_profile')
  })
})

describe('proportionalCredits (refund clawback)', () => {
  it('a full refund takes back the whole grant', () => {
    expect(proportionalCredits(7500, 4900, 4900)).toBe(7500)
    expect(proportionalCredits(7500, 5000, 4900)).toBe(7500)
  })

  it('a partial refund takes back only its share, never the whole pack', () => {
    expect(proportionalCredits(7500, 2450, 4900)).toBe(3750)
    expect(proportionalCredits(18000, 1000, 9900)).toBeLessThan(18000)
  })

  it('rounds up so any real refund takes back at least a credit', () => {
    expect(proportionalCredits(100, 1, 100000)).toBe(1)
  })

  it('does nothing for zero or bad input', () => {
    expect(proportionalCredits(0, 100, 100)).toBe(0)
    expect(proportionalCredits(100, 0, 100)).toBe(0)
  })

  it('treats an unknown paid amount as a full refund (safe default)', () => {
    expect(proportionalCredits(2500, 100, 0)).toBe(2500)
  })
})

// ── Source-level guards (these routes need live AI/Stripe to run) ──
const ROOT = path.resolve(__dirname, '..')
// Line endings normalized: Windows checkouts turn these files into CRLF.
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n')

describe('one-off tools charge first and refund on failure (audit H5)', () => {
  const ROUTES = [
    'app/api/scene-edit/route.ts',
    'app/api/logo-chat/route.ts',
    'app/api/upscale-logo/route.ts',
    'app/api/social-media/generate/route.ts',
    'app/api/demo-slide-gpt/route.ts',
    'app/api/template-demo/generate/route.ts',
    'app/api/generate-brand-deck/route.ts',
    // app/api/generate (the first infographic maker) was deleted 2026-10-06;
    // tests/retired-tools.test.ts keeps it from coming back.
    'app/api/style-preview-custom/route.ts',
  ]
  for (const r of ROUTES) {
    it(`${r} uses the shared charge/refund helper`, () => {
      const src = read(r)
      expect(src).toMatch(/runCharged|chargeCredits/)
      // No hand-rolled deduction left behind next to the helper.
      expect(src).not.toMatch(/deductCredits\(/)
    })
  }

  it('flyer-edit checks the deduction result', () => {
    expect(read('app/api/flyer-edit/route.ts')).toMatch(/if \(!\(await deductCredits\(/)
  })

  it('no route charges a bare 1 credit through the legacy signature', () => {
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.tsx?$/.test(name) && /deductCredits\(\s*admin\s*,\s*user\.id\s*,\s*[^)]*\)/.test(readFileSync(full, 'utf8'))) hits.push(full)
      }
    }
    walk(path.join(ROOT, 'app', 'api'))
    expect(hits).toEqual([])
  })

  // The other re-priced tools (image remix, ads, campaign post images, email
  // signatures) were deleted with the retired tools, 2026-10.
  it('the re-priced tools have real prices', () => {
    expect(CREDIT_COSTS['brand-deck']).toBeGreaterThanOrEqual(50)
  })
})
