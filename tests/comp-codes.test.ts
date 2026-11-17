import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { matchCompCode, normCode, type CompCode } from '../app/_lib/comp-codes'

// Comp codes (owner, 2026-11-17): a code in the sign-up box that makes the
// account fully free — no card, no limits.
const list: CompCode[] = [
  { code: 'ZINNIA-PAUL', email: 'paul.tyler@zinnia.com', usesLeft: 1 },
  { code: 'Open-Code', email: null, usesLeft: 2 },
  { code: 'USED-UP', email: null, usesLeft: 0 },
]

describe('matching a comp code', () => {
  it('matches whatever the case or spaces', () => {
    expect(normCode('  zinnia-paul ')).toBe('ZINNIA-PAUL')
    expect(matchCompCode(list, 'zinnia-paul', 'Paul.Tyler@Zinnia.com')?.code).toBe('ZINNIA-PAUL')
  })
  it('a code locked to one email works for no one else', () => {
    expect(matchCompCode(list, 'ZINNIA-PAUL', 'someone@else.com')).toBeNull()
  })
  it('an open code works for anyone, until its uses run out', () => {
    expect(matchCompCode(list, 'open-code', 'a@b.com')?.code).toBe('Open-Code')
    expect(matchCompCode(list, 'USED-UP', 'a@b.com')).toBeNull()
  })
  it('an unknown or empty code is just not a comp code', () => {
    expect(matchCompCode(list, 'NOPE', 'a@b.com')).toBeNull()
    expect(matchCompCode(list, '', 'a@b.com')).toBeNull()
  })
})

describe('sign-up uses it', () => {
  const auth = readFileSync(resolve('app/_actions/auth.ts'), 'utf8')
  const lib = readFileSync(resolve('app/_lib/comp-codes.ts'), 'utf8')
  it('redeems before referral attribution, and a comp code is not a referral', () => {
    const at = auth.indexOf('comped = await redeemCompCode(referredBy,')
    expect(at).toBeGreaterThan(-1)
    expect(at).toBeLessThan(auth.indexOf('if (referredBy && data.user && !comped) {'))
  })
  it('comps the way the admin promo does: no card, no limits', () => {
    expect(lib).toContain("subscription_status: 'enterprise'")
    expect(lib).toContain('is_beta: true')
    expect(lib).toContain('card_on_file: true')
    expect(lib).toContain("ensureCreditBalance(userId, 'enterprise')")
  })
})
