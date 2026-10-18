import { describe, it, expect } from 'vitest'
import {
  buildActionCards, peopleCount, projectStatus, recipientName, resumeUrl, wizardStep, madeLabel, greetingFor,
  type VideoRow, type SendRow, type EventRow,
} from './derive'

const NOW = Date.parse('2026-09-27T12:00:00Z')
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString()

function video(over: Partial<VideoRow> = {}): VideoRow {
  return {
    id: 'v1', title: 'Your coverage, explained', status: 'completed', output_type: 'video',
    draft_data: null, created_at: ago(10), updated_at: ago(10), client_id: null, progress_pct: null,
    ...over,
  }
}
const noNames = { quotes: [], clients: new Map() }

describe('project status', () => {
  it('drafts say which of the 3 steps they are on', () => {
    expect(projectStatus(video({ status: 'draft', draft_data: { step: 5 } }), [], [], NOW).label).toBe('Draft · step 2 of 3')
    expect(projectStatus(video({ status: 'draft', draft_data: { step: 4 } }), [], [], NOW).label).toBe('Draft · step 2 of 3')
    expect(projectStatus(video({ status: 'draft', draft_data: null }), [], [], NOW).label).toBe('Draft · step 1 of 3')
  })

  it('ready with no send and no views is just "Ready" — never a guessed status', () => {
    expect(projectStatus(video(), [], [], NOW)).toEqual({ label: 'Ready', tone: 'ready' })
  })

  it('sent → watched → clicked to book, each only from a real row', () => {
    const sends: SendRow[] = [{ video_id: 'v1', to_email: 'a@b.co', opened_at: null, created_at: ago(3) }]
    expect(projectStatus(video(), sends, [], NOW).label).toBe('Sent 3 days ago')
    const view: EventRow = { video_id: 'v1', event_type: 'view', created_at: ago(1) }
    expect(projectStatus(video(), sends, [view], NOW).label).toBe('Watched')
    const done: EventRow = { video_id: 'v1', event_type: 'complete', created_at: ago(1) }
    expect(projectStatus(video(), sends, [view, done], NOW).label).toBe('Watched to the end')
    const book: EventRow = { video_id: 'v1', event_type: 'booking_click', created_at: ago(1) }
    expect(projectStatus(video(), sends, [view, book], NOW).tone).toBe('booked')
  })

  it('ignores another video’s events', () => {
    const other: EventRow = { video_id: 'v2', event_type: 'view', created_at: ago(1) }
    expect(projectStatus(video(), [], [other], NOW).label).toBe('Ready')
  })

  it('making and failed', () => {
    expect(projectStatus(video({ status: 'processing', progress_pct: 80 }), [], [], NOW).tone).toBe('making')
    expect(projectStatus(video({ status: 'failed' }), [], [], NOW).tone).toBe('failed')
  })
})

describe('drafts resume where they were', () => {
  it('an early draft reopens itself, not a blank form', () => {
    expect(resumeUrl('x', 1)).toBe('/create?id=x')
    expect(resumeUrl('x', undefined)).toBe('/create?id=x')
    expect(resumeUrl('x', 4)).toBe('/create/script?id=x')
    expect(wizardStep('/create/voice?id=x')).toBe(3)
  })
})

describe('names', () => {
  it('prefers the quote name, then the client, then what was typed, then the email', () => {
    const v = video({ client_id: 'c1', draft_data: { recipientName: 'Typed Name' } })
    const clients = new Map([['c1', { id: 'c1', name: 'Client Record', phone: null }]])
    const quotes = [{ video_id: 'v1', client_email: 'a@b.co', client_name: 'Quote Name', created_at: ago(2) }]
    expect(recipientName(v, 'a@b.co', { quotes, clients })).toBe('Quote Name')
    expect(recipientName(v, 'a@b.co', { quotes: [], clients })).toBe('Client Record')
    expect(recipientName(video({ draft_data: { recipientName: 'Typed Name' } }), null, noNames)).toBe('Typed Name')
    expect(recipientName(video(), 'a@b.co', noNames)).toBe('a@b.co')
    expect(recipientName(video(), null, noNames)).toBeNull()
  })
})

describe('action cards', () => {
  const videos = new Map([['v1', video({ draft_data: { recipientName: 'The Chen family' } })]])

  it('no activity → no cards (a new or quiet account sees nothing invented)', () => {
    expect(buildActionCards({ videos, sends: [], events: [], names: noNames, now: NOW })).toEqual([])
  })

  it('a recent view makes a WATCHED IT card', () => {
    const cards = buildActionCards({
      videos, sends: [], names: noNames, now: NOW,
      events: [{ video_id: 'v1', event_type: 'view', created_at: ago(1) }, { video_id: 'v1', event_type: 'complete', created_at: ago(1) }],
    })
    expect(cards).toHaveLength(1)
    expect(cards[0].eyebrow).toBe('WATCHED IT')
    expect(cards[0].who).toBe('The Chen family')
    expect(cards[0].detail).toContain('to the end')
    expect(peopleCount(cards)).toBe(1)
  })

  it('an old view (over a week) makes no card', () => {
    const cards = buildActionCards({ videos, sends: [], names: noNames, now: NOW, events: [{ video_id: 'v1', event_type: 'view', created_at: ago(9) }] })
    expect(cards).toEqual([])
  })

  it('NOT OPENED only when the email is unopened AND nobody watched since', () => {
    const send: SendRow = { video_id: 'v1', to_email: 'chen@x.co', opened_at: null, created_at: ago(3) }
    const unopened = buildActionCards({ videos, sends: [send], events: [], names: noNames, now: NOW })
    expect(unopened.map(c => c.eyebrow)).toEqual(['NOT OPENED'])
    expect(unopened[0].detail).toBe('Sent 3 days ago. A nudge usually helps.')

    expect(buildActionCards({ videos, sends: [{ ...send, opened_at: ago(2) }], events: [], names: noNames, now: NOW })).toEqual([])
    const watchedAfter = buildActionCards({ videos, sends: [send], names: noNames, now: NOW, events: [{ video_id: 'v1', event_type: 'view', created_at: ago(2) }] })
    expect(watchedAfter.map(c => c.eyebrow)).toEqual(['WATCHED IT'])
    // Sent today — too soon to nag.
    expect(buildActionCards({ videos, sends: [{ ...send, created_at: ago(0.5) }], events: [], names: noNames, now: NOW })).toEqual([])
  })
})

describe('labels', () => {
  it('made + greeting', () => {
    expect(madeLabel('interactive')).toBe('Presentation')
    expect(madeLabel('deck')).toBe('Slide deck')
    expect(madeLabel(null)).toBe('Video')
    expect(greetingFor(8)).toBe('Good morning')
    expect(greetingFor(14)).toBe('Good afternoon')
    expect(greetingFor(21)).toBe('Good evening')
  })
})
