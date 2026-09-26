import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guards for bugs that tests of pure functions can't reach
// (the routes need a live database). Each one fails if the old bug returns.

const read = (p: string) => readFileSync(path.join(__dirname, '..', p), 'utf8')
// Strip comments so an explanation that NAMES the old bug doesn't trip the guard.
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('public share data', () => {
  const route = code('app/api/public/watch/[id]/route.ts')
  it('never returns the payment intent id', () => {
    expect(route).not.toMatch(/stripe_payment_intent_id/)
  })
  it('does not join the private brand guide or extracted policy data', () => {
    expect(route).not.toMatch(/brand_guide_data/)
    expect(route).not.toMatch(/policy_data/)
  })
})

describe('slide decks on the share page', () => {
  const page = code('app/(public)/watch/[id]/page.tsx')
  it("renders 'deck' output in the HTML frame, not the video player", () => {
    expect(page).toMatch(/isHtmlDeck = [^\n]*=== 'deck'/)
    expect(page).toMatch(/\{isHtmlDeck \? \(/)
  })
  it('does not count an iframe load as a play', () => {
    expect(page).not.toMatch(/onLoad=\{\(\) => \{ if \(!playTracked/)
  })
})

describe('presentation link survives a re-edit', () => {
  it("does not require status 'completed' to serve the last good HTML", () => {
    const route = code('app/api/public/presentation/[id]/route.ts')
    expect(route).not.toMatch(/status !== 'completed'/)
  })
})

describe('sent_emails columns', () => {
  it('no writer or reader uses the non-existent recipient / sent_at columns', () => {
    for (const f of [
      'app/api/send-video-email/route.ts',
      'app/api/email-track/route.ts',
      'app/api/cron/follow-ups/route.ts',
    ]) {
      const src = code(f)
      expect(src, f).not.toMatch(/\brecipient\b/)
      expect(src, f).not.toMatch(/\bsent_at\b/)
    }
  })
})

describe('track-view', () => {
  it('knows question_asked, so it is not recorded as a view', () => {
    expect(code('app/api/track-view/route.ts')).toMatch(/'question_asked'/)
  })
})
