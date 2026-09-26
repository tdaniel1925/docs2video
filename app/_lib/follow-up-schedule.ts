// =============================================================================
// Which automatic follow-up (if any) a quote should get today.
//
// Kept pure — no database, no clock of its own — so the rules can be tested
// directly. The cron feeds it facts and sends at most what this returns.
//
// THE RULES (each one is a bug the old cron had):
//   * Only quotes the agent opted in, still open ('sent' or 'viewed'). Paid,
//     accepted and declined quotes are done — never chase a client who paid.
//   * Only if the client has not unsubscribed and is not already converted.
//   * Stages go in order: day 3, then day 7. If a LATER stage already went,
//     an earlier one is never sent afterwards.
//   * If the agent opted in late and two stages are due at once, send only
//     the latest one — not two emails back to back.
//   * At least MIN_GAP_DAYS between any two follow-ups for the same quote.
//   * One email per quote per stage, ever.
// =============================================================================

export const FOLLOW_UP_STAGES = [
  { type: 'follow_up_3day', day: 3 },
  { type: 'follow_up_7day', day: 7 },
] as const

export type FollowUpType = typeof FOLLOW_UP_STAGES[number]['type']
export const FOLLOW_UP_TYPES: FollowUpType[] = FOLLOW_UP_STAGES.map(s => s.type)
export const OPEN_QUOTE_STATUSES = ['sent', 'viewed'] as const
export const MIN_GAP_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000

export interface FollowUpFacts {
  status: string | null
  autoFollowUp: boolean
  clientEmail: string | null
  /** When the quote went out (quotes.created_at). */
  sentAt: string
  now: Date
  /** Follow-ups already sent for THIS quote: type + when. */
  alreadySent: { type: string; at: string }[]
  unsubscribed: boolean
  clientConverted: boolean
}

export function pickFollowUpStage(f: FollowUpFacts): FollowUpType | null {
  if (!f.autoFollowUp) return null
  if (!f.clientEmail) return null
  if (!(OPEN_QUOTE_STATUSES as readonly string[]).includes(String(f.status ?? ''))) return null
  if (f.unsubscribed || f.clientConverted) return null

  const sentMs = new Date(f.sentAt).getTime()
  if (!Number.isFinite(sentMs)) return null
  const ageDays = (f.now.getTime() - sentMs) / DAY_MS

  // Latest stage that is due by age.
  let dueIdx = -1
  FOLLOW_UP_STAGES.forEach((s, i) => { if (ageDays >= s.day) dueIdx = i })
  if (dueIdx < 0) return null

  // Never send a stage that already went, or one EARLIER than a stage that went.
  const sentTypes = new Set(f.alreadySent.map(s => s.type))
  for (let i = dueIdx; i < FOLLOW_UP_STAGES.length; i++) {
    if (sentTypes.has(FOLLOW_UP_STAGES[i].type)) return null
  }

  // Breathing room between follow-ups.
  const lastMs = Math.max(-Infinity, ...f.alreadySent.map(s => new Date(s.at).getTime()).filter(Number.isFinite))
  if (Number.isFinite(lastMs) && f.now.getTime() - lastMs < MIN_GAP_DAYS * DAY_MS) return null

  return FOLLOW_UP_STAGES[dueIdx].type
}
