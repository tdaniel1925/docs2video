/* ============================================================================
 * COMPLIANCE — the SINGLE SOURCE OF TRUTH for regulated (insurance/financial)
 * content across EVERY generation path. Before this module, three pipelines
 * (Vercel /api/brief, VPS slides.js, VPS commercial.js) each had their own
 * divergent carrier blocklist and scrub logic — so a fix in one never fixed
 * the others, and the product name leaked in the brief preview even though the
 * final video was clean.
 *
 * THE RULE for a client-facing insurance illustration explainer:
 *   · NEVER name the CARRIER (Mutual of Omaha, etc.) or the branded PRODUCT
 *     (Income Advantage, a specific "IUL" product NAME) — the carrier can't be
 *     claimed as the source; it's the AGENT's summary.
 *   · KEEP dollar figures + percentages — this is a DETAILED explainer of the
 *     client's OWN coverage; they need the real facts.
 *   · SOFTEN guarantee promises; KEEP accurate "non-guaranteed" disclaimers
 *     (rewritten to "illustrated").
 *   · Agent-attributed; point the client to the actual illustration.
 *
 * The client NAME, the AGENT's photo, and the AGENT's logo are the agent's own
 * identity and are NEVER scrubbed — only the carrier/product NAME is.
 *
 * ⚠ KEEP IN SYNC: the VPS services (vps/slides.js, vps/commercial.js) run in a
 * separate deploy and cannot import from app/_lib. They carry a byte-identical
 * copy of CARRIER_BLOCKLIST + the scrub logic. If you edit the blocklist here,
 * mirror it there (search "CARRIER_BLOCKLIST").
 * ==========================================================================*/

// The canonical carrier + branded-product blocklist (merged from all prior
// copies). Lowercase; matched case-insensitively. Longest-first at match time.
export const CARRIER_BLOCKLIST: string[] = [
  // ---- carriers ----
  'mutual of omaha', 'united of omaha', 'north american', 'nationwide', 'transamerica',
  'prudential', 'metlife', 'new york life', 'northwestern mutual', 'lincoln financial',
  'john hancock', 'pacific life', 'principal', 'allianz', 'american general', 'corebridge',
  'aig', 'securian', 'minnesota life', 'symetra', 'protective', 'foresters', 'mass mutual',
  'massmutual', 'guardian', 'ameritas', 'sammons', 'midland national', 'f&g',
  'fidelity & guaranty', 'athene', 'global atlantic', 'brighthouse', 'penn mutual',
  'ohio national', 'aetna', 'cigna', 'humana', 'blue cross', 'blue shield',
  'unitedhealthcare', 'united healthcare', 'national western', 'nlg', 'columbus', 'meridian',
  // ---- branded products ----
  'income advantage', 'indexed universal life', 'iul', 'qol', 'max accumulator',
  'select choice', 'accumulator+', 'select choice ii', 'lapse guard',
  'guaranteed refund option',
]

/** True when the content is a regulated insurance/financial illustration. */
export function isRegulated(...hays: unknown[]): boolean {
  const hay = hays.map((h) => (typeof h === 'string' ? h : JSON.stringify(h ?? ''))).join(' ').toLowerCase()
  return /\b(insuranc|annuit|iul|life policy|indexed universal|premium|underwrit|carrier|policyholder|book of business|licensed agent|financial advisor|retirement|investment|securit|fiduciary|medicare|final expense|death benefit|cash value|surrender)\b/.test(hay)
}

/** Pull branded product tokens (CamelCase / Capitalized) out of free text so a
 *  novel product name not in the blocklist is still caught. */
export function productTokens(...sources: (string | undefined | null)[]): string[] {
  const names = new Set<string>()
  const STOP = /^(The|And|For|Your|With|Ask|Get|How|Why|You|Our|This|That|Plan|Life|Death|Cash|From|Into|When|What|Will|More|Less|Best|Policy|Value|Rate|Index|Living|Benefit|Benefits|Growth|Market|Retirement|Illustration|Insurance)$/i
  const add = (s?: string | null) => {
    if (typeof s !== 'string') return
    for (const w of s.split(/[\s,.—:;()]+/)) {
      const t = w.trim()
      if (t.length >= 4 && /^[A-Z]/.test(t) && !STOP.test(t)) names.add(t)
    }
  }
  const hay = sources.filter(Boolean).join(' ')
  for (const m of hay.matchAll(/\b([A-Z][a-z]+[A-Z][A-Za-z]*|[A-Z][a-zA-Z]{3,})\b/g)) add(m[1])
  return [...names].slice(0, 8)
}

/** Build the carrier/product name-strip regexes (blocklist + detected product
 *  tokens). A trailing optional suffix group eats "IUL", "Life Insurance
 *  Company", "℠/®/™" so "Income Advantage℠ IUL" is removed whole. */
function nameRegexes(extraTokens: string[] = []): RegExp[] {
  const strip = new Set(CARRIER_BLOCKLIST)
  for (const n of extraTokens) if (n && n.length >= 4) strip.add(n.toLowerCase())
  const terms = [...strip].filter(Boolean).sort((a, b) => b.length - a.length)
  return terms.map((t) =>
    new RegExp(
      t.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&') +
        '(?:\\s?(?:iul|life insurance company|life insurance|life|insurance company|insurance|company|policy|group|financial|\\u2120|\\u00ae|\\u2122))*',
      'ig'
    )
  )
}

// Positive guarantee promises (dropped/softened). Negated disclaimers like
// "non-guaranteed" are ACCURATE and handled separately (→ "illustrated").
const GUARANTEE_RE: RegExp[] = [
  /\bguaranteed\s+(?=minimum|floor|rate|return|value|income|refund)/gi, // keep the noun, drop the promise
  /\b(100%\s+)?guaranteed\b/gi, /\bguarantees?\b/gi, /\brisk[- ]free\b/gi, /\bno risk\b/gi, /\bget rich\b/gi,
]

/**
 * Scrub a single string for regulated content: remove carrier/product NAMES,
 * soften guarantee language, but KEEP dollar figures + percentages (they're the
 * coverage facts). `extraTokens` = product names detected from the source.
 */
export function scrubComplianceText(input: string, extraTokens: string[] = []): string {
  if (typeof input !== 'string' || !input) return input
  let out = input
  for (const re of nameRegexes(extraTokens)) out = out.replace(re, '')
  // accurate disclaimers survive as "illustrated"; positive promises drop
  out = out.replace(/\bnon[-\s]?guaranteed\b/gi, 'illustrated').replace(/\bnot\s+guaranteed\b/gi, 'illustrated')
  for (const re of GUARANTEE_RE) out = out.replace(re, '')
  return out
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/([.,!?;:])\1+/g, '$1')
    // a name removed right after a leading article leaves "The gives you..." —
    // drop the now-dangling article so the sentence reads cleanly.
    .replace(/^(the|a|an|your|our)\s+(?=[a-z])/i, '')
    .replace(/^[\s—–\-,;:]+|[\s—–\-,;:]+$/g, '')
    .replace(/^([a-z])/, (m) => m.toUpperCase())
    .trim()
}

/** Which blocklisted terms survived a scrub (should be empty). Audit helper. */
export function complianceLeaks(...hays: unknown[]): string[] {
  const hay = hays.map((h) => (typeof h === 'string' ? h : JSON.stringify(h ?? ''))).join(' ').toLowerCase()
  return CARRIER_BLOCKLIST.filter((t) => hay.includes(t))
}

/** The compliance instruction injected into any LLM prompt for regulated
 *  content — figures ENCOURAGED, only carrier/product NAME banned. */
export const COMPLIANCE_CLAUSE = `

COMPLIANCE (regulated insurance/financial content detected) — STRICT, OVERRIDES ANY CONFLICTING RULE ABOVE:
- This is a DETAILED explainer of the client's OWN coverage — be FACTUAL and COMPLETE so they understand what's available.
- FIGURES ARE ENCOURAGED: DO show and speak the actual dollar amounts, account/cash values, premiums, and rate/return percentages from the illustration. The client needs these facts.
- The ONE hard ban: NEVER name the insurance CARRIER (e.g. Mutual of Omaha, United of Omaha) or the branded PRODUCT (e.g. "Income Advantage", any specific "IUL"/"indexed universal life" product NAME) anywhere. Refer to it generically ("this policy", "your coverage").
- The headline/intro must NOT name the carrier or product — frame it around the benefit, not the brand.
- NEVER promise or imply GUARANTEED returns. Numbers are illustrated/hypothetical — frame them as "illustrated" / "projected".
- Attribute to the AGENT/ADVISOR and point the viewer to the ACTUAL illustration for specifics.`
