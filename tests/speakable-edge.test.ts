import { describe, it, expect } from 'vitest'
import { speakable } from '../app/_lib/tts'

/* Read the way a person says it (script edge-case review, 2026-10-18). */
describe('numbers, links and units, as said aloud', () => {
  it('never reads a link’s path or query', () => {
    expect(speakable('Visit https://wolfeplanning.com/plans?id=7 or call us.')).toBe('Visit wolfeplanning dot com or call us.')
    expect(speakable('See wolfe.com.')).toBe('See wolfe dot com.')
  })
  it('says ranges, rates, magnitudes and "about"', () => {
    expect(speakable('From 2025-2030, premiums are $12.50/mo.')).toBe('From 2025 to 2030, premiums are 12.50 dollars per month.')
    expect(speakable('Ages 45-65 pay $100-$200 a year, ~20% less.')).toBe('Ages 45 to 65 pay 100 dollars to 200 dollars a year, about 20 percent less.')
    expect(speakable('The fund holds 1.5M and 2B.')).toBe('The fund holds 1.5 million and 2 billion.')
  })
  it('leaves dates and phone numbers whole', () => {
    expect(speakable('Born 2026-01-05.')).toBe('Born 2026-01-05.')
    expect(speakable('Call 555-201-7788.')).toBe('Call 5 5 5, 2 0 1, 7 7 8 8.')
  })
  it('says retirement accounts and units by name', () => {
    expect(speakable('Your 401(k) and 403(b).')).toBe('Your four oh one k and four oh three b.')
    expect(speakable('It weighs 10 lbs and lasts 1 yr.')).toBe('It weighs 10 pounds and lasts 1 year.')
  })
})
