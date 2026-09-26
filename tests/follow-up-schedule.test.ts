import { describe, it, expect } from 'vitest'
import { pickFollowUpStage, type FollowUpFacts } from '../app/_lib/follow-up-schedule'

// The rules the automatic follow-up cron sends by (audit C5). Each case below
// is a way the OLD job emailed a client it shouldn't have.

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-09-26T09:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY).toISOString()

function facts(over: Partial<FollowUpFacts> = {}): FollowUpFacts {
  return {
    status: 'sent',
    autoFollowUp: true,
    clientEmail: 'jane@example.com',
    sentAt: daysAgo(4),
    now,
    alreadySent: [],
    unsubscribed: false,
    clientConverted: false,
    ...over,
  }
}

describe('pickFollowUpStage', () => {
  it('sends the day-3 reminder once it is due', () => {
    expect(pickFollowUpStage(facts())).toBe('follow_up_3day')
  })

  it('sends nothing before day 3', () => {
    expect(pickFollowUpStage(facts({ sentAt: daysAgo(2) }))).toBeNull()
  })

  it('never emails unless the agent opted in', () => {
    expect(pickFollowUpStage(facts({ autoFollowUp: false }))).toBeNull()
  })

  it.each(['paid', 'accepted', 'declined', 'draft'])('never chases a %s quote', (status) => {
    expect(pickFollowUpStage(facts({ status }))).toBeNull()
  })

  it('still follows up a quote the client has viewed but not paid', () => {
    expect(pickFollowUpStage(facts({ status: 'viewed' }))).toBe('follow_up_3day')
  })

  it('honors an unsubscribe', () => {
    expect(pickFollowUpStage(facts({ unsubscribed: true }))).toBeNull()
  })

  it('stops once the client is converted', () => {
    expect(pickFollowUpStage(facts({ clientConverted: true }))).toBeNull()
  })

  it('needs an email address', () => {
    expect(pickFollowUpStage(facts({ clientEmail: null }))).toBeNull()
  })

  it('never repeats a stage that already went', () => {
    expect(pickFollowUpStage(facts({ alreadySent: [{ type: 'follow_up_3day', at: daysAgo(1) }] }))).toBeNull()
  })

  it('sends day 7 after day 3, with enough gap', () => {
    expect(pickFollowUpStage(facts({
      sentAt: daysAgo(8),
      alreadySent: [{ type: 'follow_up_3day', at: daysAgo(5) }],
    }))).toBe('follow_up_7day')
  })

  it('waits for the minimum gap between follow-ups', () => {
    expect(pickFollowUpStage(facts({
      sentAt: daysAgo(8),
      alreadySent: [{ type: 'follow_up_3day', at: daysAgo(1) }],
    }))).toBeNull()
  })

  it('opted in late: sends only the LATEST due stage, not two in a row', () => {
    expect(pickFollowUpStage(facts({ sentAt: daysAgo(10) }))).toBe('follow_up_7day')
  })

  it('never sends an earlier stage after a later one went', () => {
    expect(pickFollowUpStage(facts({
      sentAt: daysAgo(20),
      alreadySent: [{ type: 'follow_up_7day', at: daysAgo(10) }],
    }))).toBeNull()
  })

  it('is done after the last stage', () => {
    expect(pickFollowUpStage(facts({
      sentAt: daysAgo(30),
      alreadySent: [{ type: 'follow_up_3day', at: daysAgo(27) }, { type: 'follow_up_7day', at: daysAgo(23) }],
    }))).toBeNull()
  })
})
