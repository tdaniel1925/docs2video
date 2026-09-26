import { describe, it, expect } from 'vitest'
import {
  ledgerOutstanding, refundableAmount, chargeCount,
  VIDEO_CHARGE_ACTIONS, VIDEO_REFUND_ACTIONS,
  PRESENTATION_CHARGE_ACTIONS, PRESENTATION_REFUND_ACTION,
  IN_PROGRESS_STATUSES,
} from '../app/_lib/video-billing'

// The refund cap is what stops a hand-edited videos row from minting credits
// (audit C1). If any of these fail, the cron can pay out money nobody spent.

describe('ledgerOutstanding', () => {
  const V = [VIDEO_CHARGE_ACTIONS, VIDEO_REFUND_ACTIONS] as const

  it('is zero for a row nobody was ever charged for (the exploit)', () => {
    expect(ledgerOutstanding([], ...V)).toBe(0)
    expect(ledgerOutstanding(null, ...V)).toBe(0)
  })

  it('is the charge when nothing was refunded yet', () => {
    expect(ledgerOutstanding([{ action: 'video_generation', amount: -1000 }], ...V)).toBe(1000)
  })

  it('is zero once the charge was refunded', () => {
    expect(ledgerOutstanding([
      { action: 'video_generation', amount: -1000 },
      { action: 'refund_video', amount: 1000 },
    ], ...V)).toBe(0)
  })

  it('counts a retry charge after a refund', () => {
    expect(ledgerOutstanding([
      { action: 'video_generation', amount: -1000 },
      { action: 'refund_video', amount: 1000 },
      { action: 'video_generation', amount: -1000 },
    ], ...V)).toBe(1000)
  })

  it('ignores unrelated actions and wrong-signed amounts', () => {
    expect(ledgerOutstanding([
      { action: 'admin_bypass:video_generation', amount: 0 },
      { action: 'presentation_video_export', amount: -400 },
      { action: 'video_generation', amount: 500 },  // wrong sign — not a charge
      { action: 'refund_video', amount: -50 },       // wrong sign — not a refund
    ], ...V)).toBe(0)
  })

  it('keeps presentation charges apart from video ones', () => {
    const rows = [
      { action: 'presentation_interactive', amount: -700 },
      { action: PRESENTATION_REFUND_ACTION, amount: 700 },
      { action: 'presentation_interactive', amount: -700 },
    ]
    expect(ledgerOutstanding(rows, PRESENTATION_CHARGE_ACTIONS, [PRESENTATION_REFUND_ACTION])).toBe(700)
    expect(ledgerOutstanding(rows, ...V)).toBe(0)
  })
})

describe('refundableAmount', () => {
  it('never exceeds what the ledger says is owed', () => {
    expect(refundableAmount(1_000_000, 1000)).toBe(1000)
    expect(refundableAmount(1_000_000, 0)).toBe(0)
  })
  it('never exceeds what the row claims', () => {
    expect(refundableAmount(500, 1000)).toBe(500)
  })
  it('never goes negative', () => {
    expect(refundableAmount(-5, 1000)).toBe(0)
    expect(refundableAmount(null, 1000)).toBe(0)
  })
})

describe('chargeCount', () => {
  it('numbers each attempt so a second failure gets its own refund key', () => {
    const rows = [
      { action: 'presentation_deck', amount: -600 },
      { action: PRESENTATION_REFUND_ACTION, amount: 600 },
      { action: 'presentation_deck', amount: -600 },
    ]
    expect(chargeCount(rows, PRESENTATION_CHARGE_ACTIONS)).toBe(2)
  })
})

describe('IN_PROGRESS_STATUSES', () => {
  it('covers every status generate-video writes while a job runs', () => {
    for (const s of ['pending', 'scripting', 'generating_audio', 'generating_slides', 'assembling']) {
      expect(IN_PROGRESS_STATUSES).toContain(s)
    }
  })
  it('never contains a finished status', () => {
    for (const s of ['completed', 'failed', 'draft', 'review_required']) {
      expect(IN_PROGRESS_STATUSES as readonly string[]).not.toContain(s)
    }
  })
})
