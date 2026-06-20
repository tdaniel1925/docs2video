/**
 * Matches phone formats: 1-800-441-1417, (800) 441-1417, 800.441.1417, +1 800 441 1417
 * Requires at least one separator to reduce false positives on bare 10-digit numbers.
 */
export const PHONE_REGEX =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/g

export function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) || []
  return matches.map((m) => m.replace(/\D/g, ''))
}

export function isPhoneInSource(phone: string, source: string): boolean {
  const phoneDigits = phone.replace(/\D/g, '')
  const sourceDigits = source.replace(/\D/g, '')
  const last10 = phoneDigits.slice(-10)
  return sourceDigits.includes(last10)
}

const DIGIT_WORDS: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
}

/**
 * Normalize a phone number to E.164 (e.g. "9366417130" -> "+19366417130").
 * 10 digits → assume US (+1). 11 digits starting with 1 → +<digits>. A leading
 * "+" is preserved. Anything else is returned trimmed, unchanged (don't mangle
 * partial/odd input). Empty in → empty out.
 */
export function toE164(input: string): string {
  const raw = (input || '').trim()
  if (!raw) return ''
  const hadPlus = raw.startsWith('+')
  const digits = raw.replace(/\D/g, '')
  if (!digits) return raw
  if (hadPlus) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return raw // leave unrecognized lengths as typed
}

export function phoneToSpoken(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    const rest = digits.slice(1)
    return `one, ${rest.slice(0, 3).split('').map(d => DIGIT_WORDS[d]).join(' ')}, ${rest.slice(3, 6).split('').map(d => DIGIT_WORDS[d]).join(' ')}, ${rest.slice(6).split('').map(d => DIGIT_WORDS[d]).join(' ')}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3).split('').map(d => DIGIT_WORDS[d]).join(' ')}, ${digits.slice(3, 6).split('').map(d => DIGIT_WORDS[d]).join(' ')}, ${digits.slice(6).split('').map(d => DIGIT_WORDS[d]).join(' ')}`
  }
  return digits.split('').map(d => DIGIT_WORDS[d] || d).join(' ')
}
