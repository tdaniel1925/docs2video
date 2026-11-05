// The contact form's spam checks (2026-11-05: bots posted made-up names like "Anmuxlaj
// Tthoknvci" with a phone number as the whole message). Each check is invisible to a real
// visitor; a caught bot still gets "sent", so it learns nothing, and the message is dropped.
//   honeypot  a hidden "website" field a person never sees or fills in
//   timing    the form's own render time: a person takes more than 3 seconds to fill it in
//   content   the message must contain words, not only a number, a link or a handful of characters

export const MIN_FILL_MS = 3000
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000

export type SpamCheck = { website?: unknown; startedAt?: unknown; message: string; now?: number }

// Why a submission is spam, or null when it looks like a person.
export function spamReason({ website, startedAt, message, now = Date.now() }: SpamCheck): string | null {
  if (typeof website === 'string' && website.trim()) return 'honeypot'
  const started = Number(startedAt)
  if (!Number.isFinite(started) || started <= 0) return 'no form time'
  const took = now - started
  if (took < MIN_FILL_MS) return 'too fast'
  if (took > MAX_FORM_AGE_MS) return 'stale form'
  const words = (message.match(/\p{L}{2,}/gu) || []).length
  if (words < 2) return 'no words in message'
  return null
}
