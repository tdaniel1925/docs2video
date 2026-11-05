import { describe, it, expect } from 'vitest'
import { spamReason } from '../contact-spam'

const now = 1_800_000_000_000
const person = { website: '', startedAt: now - 45_000, message: 'Could we book a demo for our office next week?', now }

describe('contact form spam checks', () => {
  it('lets a real message through', () => expect(spamReason(person)).toBeNull())
  it('drops a filled honeypot', () => expect(spamReason({ ...person, website: 'http://spam.example' })).toBe('honeypot'))
  it('drops a post with no form time (a direct POST)', () => expect(spamReason({ ...person, startedAt: undefined })).toBe('no form time'))
  it('drops a form filled in under 3 seconds', () => expect(spamReason({ ...person, startedAt: now - 1200 })).toBe('too fast'))
  it('drops a message that is only a phone number (the 2026-11-05 spam)', () => expect(spamReason({ ...person, message: '5004198828' })).toBe('no words in message'))
  it('keeps a short real message', () => expect(spamReason({ ...person, message: 'Pricing please' })).toBeNull())
  it('keeps non-English words', () => expect(spamReason({ ...person, message: 'Hola, quiero una demostración' })).toBeNull())
})
