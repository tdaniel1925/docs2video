/* ============================================================================
 * PERSONALIZE — the shared "who is this for / who is it from / how does the
 * opening greet them" layer, used by EVERY explainer render path.
 *
 * Before this module, the personalized opening (client-name cover + "thank you
 * [client] for letting [agent] share this summary" VO) lived ONLY in the slides
 * engine (vps/slides.js). Videos rendered by the aurora/V3 or editorial engines
 * had a cold, generic "Hello {name}" opening — or nothing — because each engine
 * re-implemented its own cover/greeting. This is the single source of truth so
 * the same personalization appears no matter which style the user picks.
 *
 * KEEP IN SYNC with the greeting logic in vps/slides.js (the VPS can't import
 * from app/_lib — it carries a mirrored copy). Search "PERSONALIZED OPENING".
 * ==========================================================================*/

import { cleanRecipientName } from './text-format'
import { isRegulated } from './compliance'
import type { Presenter } from './presenter'

/** The person the video is prepared FOR (the client). Fallback chain matches the
 *  one previously inline in generate-video/route.ts. Placeholder names
 *  ("Mr. Client", "Valued Client", …) are scrubbed to '' by cleanRecipientName. */
export function resolveClientName(opts: {
  recipientName?: string | null
  // Accept any extracted-data shape; we only read two optional string fields.
  policyData?: Record<string, unknown> | null
}): string {
  const pd = (opts.policyData || {}) as Record<string, unknown>
  return cleanRecipientName(
    opts.recipientName || (pd.recipientName as string) || (pd.insuredName as string) || ''
  )
}

/** The ONE canonical agent name spoken/shown. Prefer the "prepared by" name the
 *  cover + CTA already use (preparer/brand) over presenter.name, so the greeting
 *  never names a different agent than the rest of the video. */
export function resolveAgentName(opts: {
  preparer?: string | null
  brandName?: string | null
  presenter?: Presenter | null
}): string {
  return (opts.preparer || opts.brandName || opts.presenter?.name || '').trim()
}

/** True when the content is a regulated insurance/financial illustration — used
 *  to pick "illustration summary" vs plain "summary" in the greeting. */
export function isRegulatedContent(...sources: unknown[]): boolean {
  return isRegulated(...sources)
}

/**
 * Build the personalized opening narration. Prepends a greeting that addresses
 * the client by first name and thanks them for letting the agent share this
 * summary, then flows into the writer's opening (`baseNarration`). If a presenter
 * wrote their own intro line, we greet then speak that. De-dupes when the base
 * already opens by naming the client or the agent (drops that redundant sentence)
 * so the opening names the agent exactly once.
 *
 * Compliance-safe: names ONLY the client and the agent, never a carrier/product.
 *
 * Returns the base narration unchanged when there's no client name or no agent.
 */
export function buildOpeningNarration(opts: {
  client: string
  agent: string
  regulated: boolean
  baseNarration?: string
  presenterIntro?: string
}): string {
  const clientFirst = (opts.client || '').trim().split(/\s+/)[0]
  const agent = (opts.agent || '').trim()
  let base = (opts.baseNarration || '').trim()

  // If a presenter wrote their own opening line, that IS the base.
  if (opts.presenterIntro && opts.presenterIntro.trim()) base = opts.presenterIntro.trim()

  if (!clientFirst || !agent) return base

  const doc = opts.regulated ? 'illustration summary' : 'summary'
  const greet = `${clientFirst}, thank you for letting ${agent} share this ${doc} with you.`

  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // base already opens by naming the client → keep it as-is (no double greeting)
  const namesClient = new RegExp(`^\\s*(hi[,!. ]+)?${esc(clientFirst)}\\b`, 'i').test(base)
  if (namesClient) return base

  // base opens with a redundant self-intro that names the agent → drop that
  // leading sentence so the agent isn't named twice.
  const firstSentence = (base.match(/^.*?[.!?](\s|$)/) || [''])[0]
  const selfIntro = agent &&
    new RegExp(esc(agent), 'i').test(firstSentence) &&
    /\b(this is|walkthrough|put together|prepared|here)\b/i.test(firstSentence)
  if (selfIntro) base = base.slice(firstSentence.length).trim()

  return `${greet} ${base}`.trim()
}
