import { speakable } from './tts'
import { PHONE_REGEX, phoneToSpoken } from './phone-utils'

// Moved from app/api/generate-video/route.ts (2026-11-14) so the storyboard (storyboard.ts) formats scene text
// exactly as the video does. Unchanged.
// Format narration for TTS. Money/percent/symbol normalization is owned by the
// canonical `speakable()` in app/_lib/tts.ts (it ALSO runs inside synthesizeSpeech
// right before synthesis, so it's the single source for that). Here we add only
// the CONTACT-specific spelling (phones/emails/URLs) that speakable doesn't do,
// then delegate the rest to speakable — one money/percent implementation.
export function formatForTTS(text: string): string {
  const dw: Record<string, string> = { '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine' }

  // Helper: spell out a string that isn't a real word (e.g. "tdaniel" → "t daniel", "jsmith123" → "j smith one two three")
  function spellUsername(user: string): string {
    // Split camelCase and number boundaries: "tdaniel" → "t daniel", "jsmith123" → "j smith 1 2 3"
    return user
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
      .replace(/([a-zA-Z])(\d)/g, '$1 $2') // letter→digit
      .replace(/(\d)([a-zA-Z])/g, '$1 $2') // digit→letter
      .replace(/\./g, ' dot ')
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .toLowerCase()
  }

  const withContact = text
    // Phone numbers with separators — use unified PHONE_REGEX
    .replace(PHONE_REGEX, (match) => phoneToSpoken(match))
    // Bare 10-digit phone numbers (no separators): 4807254677 → digit by digit
    .replace(/\b(\d{10})\b/g, (match) => {
      // Only convert if it looks like a phone number (not a dollar amount or year)
      return `${match.slice(0, 3).split('').map(d => dw[d]).join(' ')}, ${match.slice(3, 6).split('').map(d => dw[d]).join(' ')}, ${match.slice(6).split('').map(d => dw[d]).join(' ')}`
    })
    // Email addresses FIRST (before URL, since emails contain dots)
    // info@example.com → "info at example dot com"
    .replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})/g, (_, user: string, domain: string) => {
      return `${spellUsername(user)} at ${domain.replace(/\./g, ' dot ')}`
    })
    // URLs: www.example.com → example dot com
    .replace(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})(?:\/\S*)?/g, (_, domain: string) => {
      return domain.replace(/\./g, ' dot ')
    })
  // Delegate money/percent/& to the canonical implementation.
  return speakable(withContact)
}
