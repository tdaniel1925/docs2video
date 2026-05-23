import { describe, it, expect } from 'vitest'
import { PHONE_REGEX, extractPhones, isPhoneInSource, phoneToSpoken } from '../app/_lib/phone-utils'

function matchAll(text: string): string[] {
  const re = new RegExp(PHONE_REGEX.source, PHONE_REGEX.flags)
  return [...text.matchAll(re)].map(m => m[0])
}

describe('PHONE_REGEX', () => {
  it('matches 1-800-441-1417', () => {
    expect(matchAll('Call 1-800-441-1417 now')).toEqual(['1-800-441-1417'])
  })

  it('matches (800) 441-1417', () => {
    expect(matchAll('Call (800) 441-1417 now')).toEqual(['(800) 441-1417'])
  })

  it('matches 800.441.1417', () => {
    expect(matchAll('Call 800.441.1417 now')).toEqual(['800.441.1417'])
  })

  it('matches +1 800 441 1417', () => {
    expect(matchAll('Call +1 800 441 1417 now')).toEqual(['+1 800 441 1417'])
  })

  it('does NOT match SSN format 123-45-6789', () => {
    expect(matchAll('SSN: 123-45-6789')).toEqual([])
  })

  it('does NOT match bare digits 8004411417', () => {
    expect(matchAll('Number is 8004411417')).toEqual([])
  })
})

describe('phoneToSpoken', () => {
  it('converts 1-800-441-1417 to spoken form', () => {
    expect(phoneToSpoken('1-800-441-1417')).toBe(
      'one, eight zero zero, four four one, one four one seven'
    )
  })

  it('converts (555) 123-4567 to spoken form', () => {
    expect(phoneToSpoken('(555) 123-4567')).toBe(
      'five five five, one two three, four five six seven'
    )
  })
})

describe('isPhoneInSource', () => {
  it('returns true when phone digits exist in source', () => {
    expect(isPhoneInSource('(800) 441-1417', 'Call us at 800-441-1417')).toBe(true)
  })

  it('returns false when phone digits are not in source', () => {
    expect(isPhoneInSource('(999) 999-9999', 'Call us at 800-441-1417')).toBe(false)
  })
})

describe('extractPhones', () => {
  it('returns array of digit-only strings', () => {
    const result = extractPhones('Call (800) 441-1417 or 555.123.4567')
    expect(result).toEqual(['8004411417', '5551234567'])
  })

  it('returns empty array when no phones found', () => {
    expect(extractPhones('No phone numbers here')).toEqual([])
  })
})
