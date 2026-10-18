import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { messageToHtml, startsWithGreeting, escapeHtml, sendWithResend, safeHttpsUrl } from '../app/_lib/client-email'
import { encodeMimeHeader, createMimeMessage } from '../app/_lib/email'
import { makeUnsubToken, readUnsubToken } from '../app/_lib/unsubscribe-token'
import { shouldSendViewAlert, normalizePref } from '../app/_lib/view-alerts'

// Share emails / client emails (audit H9 + mediums). Nothing here sends a
// real email: sendWithResend is only called with no API key configured.

describe('share email text', () => {
  it('keeps paragraphs instead of running them together', () => {
    const html = messageToHtml('Hi Jane,\n\nFirst paragraph.\nSame paragraph, new line.\n\nSecond paragraph.')
    expect(html.match(/<p /g)?.length).toBe(3)
    expect(html).toContain('First paragraph.<br/>Same paragraph, new line.')
  })

  it('escapes what the agent typed', () => {
    const html = messageToHtml('<script>alert(1)</script> & "quotes"')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
  })

  it('detects an existing greeting so the email does not say "Hi John, Hi John,"', () => {
    expect(startsWithGreeting('Hi John,\n\nHere it is')).toBe(true)
    expect(startsWithGreeting('  hello there')).toBe(true)
    expect(startsWithGreeting('Dear Ms. Smith')).toBe(true)
    expect(startsWithGreeting('Here is your video')).toBe(false)
    expect(startsWithGreeting('Highlights of your plan')).toBe(false)
  })

  it('escapes attribute characters', () => {
    expect(escapeHtml(`a"b'c<d>`)).toBe('a&quot;b&#39;c&lt;d&gt;')
  })

  it('only lets https links become buttons', () => {
    expect(safeHttpsUrl('https://cal.com/jane')).toBe('https://cal.com/jane')
    expect(safeHttpsUrl('javascript:alert(1)')).toBe('')
    expect(safeHttpsUrl('http://example.com')).toBe('')
  })
})

describe('sendWithResend', () => {
  const saved = process.env.RESEND_API_KEY
  beforeAll(() => { delete process.env.RESEND_API_KEY })
  afterAll(() => { if (saved !== undefined) process.env.RESEND_API_KEY = saved })

  it('reports failure (not "sent") when the email service is not set up', async () => {
    const r = await sendWithResend({ from: 'a@b.co', to: 'c@d.co', subject: 's', html: 'h' })
    expect(r.ok).toBe(false)
  })
})

describe('Gmail subject encoding (RFC 2047)', () => {
  it('leaves plain ASCII alone', () => {
    expect(encodeMimeHeader('Your quote is ready')).toBe('Your quote is ready')
  })

  it('encodes emoji and accents so they are not garbled', () => {
    const enc = encodeMimeHeader('Café plan 🎉')
    expect(enc.startsWith('=?UTF-8?B?')).toBe(true)
    const decoded = enc.split('\r\n ').map(w => Buffer.from(w.slice(10, -2), 'base64').toString('utf8')).join('')
    expect(decoded).toBe('Café plan 🎉')
  })

  it('splits long subjects into short words without breaking characters', () => {
    const subject = 'Ünïcödé '.repeat(20)
    const enc = encodeMimeHeader(subject)
    for (const w of enc.split('\r\n ')) expect(w.length).toBeLessThanOrEqual(75)
    const decoded = enc.split('\r\n ').map(w => Buffer.from(w.slice(10, -2), 'base64').toString('utf8')).join('')
    expect(decoded).toBe(subject)
  })

  it('never lets a subject inject extra headers', () => {
    expect(encodeMimeHeader('Hi\r\nBcc: evil@x.com')).not.toContain('\r\nBcc')
  })

  it('builds a message with an encoded subject and base64 body', () => {
    const msg = createMimeMessage('a@b.co', 'c@d.co', 'Olá', '<p>Olá</p>')
    expect(msg).toContain('Subject: =?UTF-8?B?')
    expect(msg).toContain('Content-Transfer-Encoding: base64')
  })
})

describe('signed unsubscribe links', () => {
  const saved = process.env.EMAIL_UNSUBSCRIBE_SECRET
  beforeAll(() => { process.env.EMAIL_UNSUBSCRIBE_SECRET = 'test-secret' })
  afterAll(() => { if (saved === undefined) delete process.env.EMAIL_UNSUBSCRIBE_SECRET; else process.env.EMAIL_UNSUBSCRIBE_SECRET = saved })

  const agent = '11111111-1111-1111-1111-111111111111'

  it('round-trips a client token', () => {
    const t = makeUnsubToken({ k: 'client', id: agent, e: 'Jane@Example.com' })!
    expect(readUnsubToken(t)).toEqual({ k: 'client', id: agent, e: 'jane@example.com' })
  })

  it('rejects an edited token (cannot unsubscribe someone else)', () => {
    const t = makeUnsubToken({ k: 'client', id: agent, e: 'jane@example.com' })!
    const [body, sig] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ k: 'client', id: agent, e: 'bob@example.com' })).toString('base64url')
    expect(readUnsubToken(`${forged}.${sig}`)).toBeNull()
    expect(readUnsubToken(`${body}.${sig.slice(0, -2)}xx`)).toBeNull()
    expect(readUnsubToken('garbage')).toBeNull()
  })

  it('accepts lead and user tokens', () => {
    expect(readUnsubToken(makeUnsubToken({ k: 'lead', id: agent }))?.k).toBe('lead')
    expect(readUnsubToken(makeUnsubToken({ k: 'user', id: agent }))?.k).toBe('user')
  })
})

describe('view alerts', () => {
  it('"all" alerts once per viewer, then waits out the cooldown', () => {
    expect(shouldSendViewAlert({ pref: 'all', viewsFromViewerInCooldown: 1, viewsFromViewerEver: 5 })).toBe(true)
    expect(shouldSendViewAlert({ pref: 'all', viewsFromViewerInCooldown: 2, viewsFromViewerEver: 5 })).toBe(false)
  })
  it('"first" alerts only on the first-ever view', () => {
    expect(shouldSendViewAlert({ pref: 'first', viewsFromViewerInCooldown: 1, viewsFromViewerEver: 1 })).toBe(true)
    expect(shouldSendViewAlert({ pref: 'first', viewsFromViewerInCooldown: 1, viewsFromViewerEver: 2 })).toBe(false)
  })
  it('"off" never alerts', () => {
    expect(shouldSendViewAlert({ pref: 'off', viewsFromViewerInCooldown: 1, viewsFromViewerEver: 1 })).toBe(false)
  })
  it('unknown or missing setting means the default', () => {
    expect(normalizePref(undefined)).toBe('all')
    expect(normalizePref('loud')).toBe('all')
  })
})
