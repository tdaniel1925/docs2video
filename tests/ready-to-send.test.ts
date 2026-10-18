import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  quoteSwitch, reminderSwitch, reminderDaysText, buildPreview, httpsOnly,
} from '../app/(dashboard)/videos/[id]/send/share-options'
import { FOLLOW_UP_STAGES } from '../app/_lib/follow-up-schedule'

const q = (over: Record<string, unknown> = {}) => ({
  id: 'q1', status: 'sent', client_name: 'Dana Chen', client_email: 'dana@example.com',
  auto_follow_up: false, total: 21200, ...over,
})

describe('quote switch', () => {
  it('has nothing to switch without a quote', () => {
    expect(quoteSwitch(null)).toEqual({ kind: 'none' })
  })
  it('a draft is off (the share page skips drafts), an open quote is on', () => {
    expect(quoteSwitch(q({ status: 'draft' }))).toEqual({ kind: 'toggle', on: false })
    expect(quoteSwitch(q({ status: 'sent' }))).toEqual({ kind: 'toggle', on: true })
    expect(quoteSwitch(q({ status: 'viewed' }))).toEqual({ kind: 'toggle', on: true })
  })
  it('never offers to hide a closed deal (that would wipe paid/accepted)', () => {
    for (const status of ['paid', 'accepted', 'declined']) {
      expect(quoteSwitch(q({ status })).kind).toBe('locked')
    }
  })
})

describe('reminder switch — only usable when the cron would really send', () => {
  it('needs an open quote with a client email', () => {
    expect(reminderSwitch(null, true).usable).toBe(false)
    expect(reminderSwitch(q({ status: 'draft' }), true).usable).toBe(false)
    expect(reminderSwitch(q({ status: 'paid' }), true).usable).toBe(false)
    expect(reminderSwitch(q({ client_email: null }), true).usable).toBe(false)
    expect(reminderSwitch(q(), true)).toEqual({ usable: true, on: false, blockedOn: null })
  })
  it('cannot be switched on without a connected mailbox (the cron skips those)', () => {
    const r = reminderSwitch(q(), false)
    expect(r.usable && r.blockedOn).toBeTruthy()
  })
  it('the wording uses the real schedule days', () => {
    const text = reminderDaysText()
    for (const s of FOLLOW_UP_STAGES) expect(text).toContain(`day ${s.day}`)
  })
})

describe('preview matches the share page rules', () => {
  const agent = { full_name: 'Michele Ray', calendly_url: 'https://cal.com/m', payment_link_url: 'javascript:alert(1)' }
  it('greets by first name, falls back to the quote client', () => {
    expect(buildPreview({ recipientName: 'Dana Chen', note: '', allowSourceDownload: false, publicQuote: null, agent }).greetingName).toBe('Dana')
    expect(buildPreview({ recipientName: null, note: '', allowSourceDownload: false, publicQuote: q({ client_name: 'Lee Park' }), agent }).greetingName).toBe('Lee')
  })
  it('only https links make buttons', () => {
    const m = buildPreview({ recipientName: null, note: '', allowSourceDownload: false, publicQuote: q(), agent })
    expect(m.bookingUrl).toBe('https://cal.com/m')
    expect(m.paymentLink).toBe('')
    expect(m.quote?.payable).toBe(false)
    expect(httpsOnly('http://x.com')).toBe('')
  })
  it('a per-video booking link wins over Settings', () => {
    const m = buildPreview({ recipientName: null, note: '', allowSourceDownload: true, publicQuote: null, agent, pipelineBookingUrl: 'https://book.me/x' })
    expect(m.bookingUrl).toBe('https://book.me/x')
    expect(m.sourcePdf).toBe(true)
  })
})

describe('panel has no switch that does nothing', () => {
  const src = readFileSync(path.join(__dirname, '..', 'app/(dashboard)/videos/[id]/send/ReadyToSend.tsx'), 'utf8')
  it('offers no slide-deck or "if unwatched" switch (no setting behind them)', () => {
    expect(src).not.toMatch(/label="Include the slide deck"/)
    expect(src).not.toMatch(/if unwatched/)
  })
  it('sends through the real email route and saves through real routes', () => {
    expect(src).toMatch(/'\/api\/send-video-email'/)
    expect(src).toMatch(/allow_source_download: next/)
    expect(src).toMatch(/autoFollowUp: !rs\.on/)
  })
})
