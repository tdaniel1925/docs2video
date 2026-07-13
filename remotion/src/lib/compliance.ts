/* ============================================================================
 * COMPLIANCE — shared rules layer for regulated video types (insurance, etc).
 * A SYSTEM module: any illustration/financial video imports these so the rule
 * is enforced in ONE place, not re-derived per video.
 *
 * INSURANCE ILLUSTRATION RULE (client-facing summary the AGENT sends):
 *   · NEVER name the carrier or the branded product (so the carrier can't be
 *     claimed as the representation's source — it's the agent's summary).
 *   · NEVER state the specific product TYPE as a branded claim. Keep it a
 *     GENERIC benefits summary: "your policy" / "your plan".
 *   · Non-guaranteed values must be flagged.
 *   · Point the client to the actual illustration doc for specific details.
 *   · Disclaimer is AGENT-attributed, not carrier-attributed.
 * ==========================================================================*/

// terms that must never appear in a compliant illustration summary
const BANNED = [
  // carriers
  'american general', 'aig', 'corebridge', 'national western', 'nlg',
  'mutual of omaha', 'north american', 'columbus', 'f&g', 'meridian',
  // branded products
  'qol', 'max accumulator', 'select choice', 'accumulator+',
  'select choice ii',
]

/** Scrub any carrier/product names from a string (dev-time safety check). */
export function scrubCompliance(text: string): { clean: string; hits: string[] } {
  const hits: string[] = []
  let clean = text
  for (const term of BANNED) {
    const re = new RegExp(term, 'ig')
    if (re.test(clean)) { hits.push(term); clean = clean.replace(re, '') }
  }
  return { clean: clean.replace(/\s{2,}/g, ' ').trim(), hits }
}

/** True if a string is compliant (no banned carrier/product references). */
export function isCompliant(text: string): boolean {
  return scrubCompliance(text).hits.length === 0
}

// The standard agent-attributed disclaimer for an illustration summary.
// Names NO carrier/product; frames it as the advisor's benefits summary and
// points to the full illustration document below.
export const AGENT_DISCLAIMER =
  'A general summary of policy benefits prepared by your advisor — not a ' +
  'representation from the issuing insurer. Values marked * are non-guaranteed ' +
  'and assume current assumptions continue, which is not likely to occur. This ' +
  'is a hypothetical illustration summary, not a contract or a guarantee. For ' +
  'specific policy details, please see the full illustration document below.'

// Short on-screen line telling the client where the real details live.
export const SEE_ILLUSTRATION_BELOW =
  'Specific details are in the full illustration document below.'
