/**
 * WHY A VIDEO DIDN'T FINISH — in plain words, for the admin.
 *
 * The real cause is saved on the row in `progress_detail` as "[fail] <stage>:
 * <technical message>" (render service + the start routes), and a short
 * customer line in `error_message`. The owner is not technical, so the admin
 * shows ONE plain sentence first and keeps the technical text folded away.
 * Pure — no imports — so the admin page, the "What needs you" card and the
 * daily email all use the same words.
 */

export interface FailReason {
  /** One plain sentence: what went wrong. */
  plain: string
  /** The saved technical text (without the "[fail]" tag), or null. */
  technical: string | null
}

const RULES: { test: RegExp; plain: string }[] = [
  { test: /not enough credits|insufficient credits|credit deduction failed/i, plain: 'The customer did not have enough credits, or the charge did not go through.' },
  { test: /daily usage limit/i, plain: 'The customer hit the daily limit.' },
  { test: /script validation|validat(e|ion) failed/i, plain: 'The script did not pass our checks (missing parts or wrong numbers), so it was stopped before making anything.' },
  { test: /stuck|no progress|timed out|timeout|etimedout|took too long/i, plain: 'It took too long and was stopped automatically. Credits were given back.' },
  { test: /\btrigger\b|could not start|kickoff failed|unavailable|offline|econnrefused|fetch failed/i, plain: 'The video maker could not be reached to start it. Usually fixed by trying again.' },
  { test: /429|rate.?limit|quota|too many requests/i, plain: 'An AI service said “too many requests” or ran out of quota.' },
  { test: /elevenlabs|tts|voice|audio|narrat/i, plain: 'The voice could not be made.' },
  { test: /anthropic|claude|script/i, plain: 'The script could not be written.' },
  { test: /gemini|fal\b|image|slide|draw/i, plain: 'The pictures for the slides could not be drawn.' },
  { test: /render|ffmpeg|remotion|exit \d|lambda|assembl/i, plain: 'The video maker crashed while putting the video together. Credits were given back.' },
  { test: /restarted by you|dismissed by user/i, plain: 'The customer stopped it themselves.' },
]

export function failReason(progressDetail: string | null | undefined, errorMessage: string | null | undefined): FailReason {
  const detail = (progressDetail || '').trim()
  const technical = detail.startsWith('[fail]') ? detail.replace(/^\[fail\]\s*/, '') : null
  const haystack = `${technical ?? ''} ${errorMessage ?? ''}`
  for (const r of RULES) {
    if (r.test.test(haystack)) return { plain: r.plain, technical: technical || errorMessage || null }
  }
  if (errorMessage) return { plain: errorMessage, technical }
  return { plain: 'No reason was saved for this one.', technical }
}

/** A review-held video's saved note ("Unusual values flagged for review: …"). */
export function reviewReason(progressDetail: string | null | undefined): string {
  const d = (progressDetail || '').trim()
  if (/^Extraction errors detected/i.test(d)) return 'Some numbers read from the document look impossible (likely a bad read).'
  if (/^Unusual values flagged/i.test(d)) return 'Some numbers in the policy look unusual and need a person to check them.'
  return d || 'Held for a person to check before it is made.'
}
