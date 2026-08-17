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
  'income advantage', 'indexed universal life', 'index universal life', 'iul', 'qol',
  'max accumulator', 'select choice', 'accumulator+', 'select choice ii', 'lapse guard',
  'guaranteed refund option',
]

/**
 * NORMALISE BEFORE MATCHING, so the blocklist can't be dodged with typography.
 *
 * The detection and audit checks used a plain lowercase `includes()`, which is
 * beaten by cheap tricks: unicode look-alikes ("Ｍutual" fullwidth, or a
 * Cyrillic "М") and zero-width characters wedged between letters ("Mu​tual").
 * NFKC folds look-alikes to their plain form; we then strip zero-width marks
 * and collapse runs of whitespace. Now "Ｍutual" and "Mu​tual" both match.
 *
 * NOT covered: deliberately spaced-out letters ("M u t u a l") — collapsing
 * single-letter gaps would mangle legitimate text (initialisms, "M B A"), and
 * this scrub is a backstop, not the only control. This hardens the DETECTION
 * path (whether to scrub, whether a leak survived); the scrub's own replace
 * runs on the real text so character offsets stay intact.
 */
export function normalizeForMatch(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[​-‍﻿]/g, '') // zero-width space/joiner/no-break
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** True when the content is a regulated insurance/financial illustration. */
export function isRegulated(...hays: unknown[]): boolean {
  const hay = normalizeForMatch(hays.map((h) => (typeof h === 'string' ? h : JSON.stringify(h ?? ''))).join(' '))
  return /\b(insuranc|annuit|iul|life policy|indexed universal|premium|underwrit|carrier|policyholder|book of business|licensed agent|financial advisor|retirement|investment|securit|fiduciary|medicare|final expense|death benefit|cash value|surrender)\b/.test(hay)
}

/** Pull branded product tokens (CamelCase / Capitalized) out of free text so a
 *  novel product name not in the blocklist is still caught. */
export function productTokens(...sources: (string | undefined | null)[]): string[] {
  const names = new Set<string>()
  const STOP = /^(The|And|For|Your|With|Ask|Get|How|Why|You|Our|This|That|Plan|Life|Death|Cash|From|Into|When|What|Will|More|Less|Best|Policy|Value|Rate|Index|Living|Benefit|Benefits|Growth|Market|Retirement|Illustration|Insurance|Premium|Fixed|Interest|Flexible|Individual|Universal|Adjustable|Annual|Monthly|Daily|Income|Protection|Coverage|Client|Options|Summary|Overview|Guaranteed|Illustrated|Underwriting|Preferred|Tobacco)$/i
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
      // \b prefix: short tokens (aig, iul, qol) must not mangle the inside of
      // ordinary words ("straight"). Suffix group also eats version numerals
      // so "Accumulator+ III" is removed whole.
      '\\b' + t.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&') +
        '(?:\\s?(?:iul|life insurance company|life insurance|life|insurance company|insurance|company|policy|group|financial|iii|ii|iv|vi|v(?![a-z])|\\u2120|\\u00ae|\\u2122))*',
      'ig'
    )
  )
}

/**
 * ILLUSTRATION TERMS OF ART — never softened.
 *
 * On an illustration, "the guaranteed column / element / basis" is the NAME of
 * the contractual-minimum ledger. It is not a marketing promise, and rewriting
 * it produces the opposite of the truth:
 *   "the guaranteed column is what the contract must do"
 *     → "the projected column is what the contract must do"   ← false, and the
 *       most dangerous sentence you can put in front of a client.
 * Deleting the word instead is also wrong — it understates the floor. So these
 * senses pass through literally, and the softening below only catches the
 * promissory use ("guaranteed returns", "100% guaranteed").
 */
const ILLUSTRATION_SENSE = 'column|columns|element|elements|basis|ledger|scale'

// Positive guarantee promises, softened to compliant wording (deleting them
// outright left dangling fragments like "The & Projections"). Negated
// disclaimers like "non-guaranteed" are ACCURATE and handled separately.
const GUARANTEE_SUBS: [RegExp, string][] = [
  [/\bguaranteed\s+(?=minimum|floor|rate|return|value|income|refund)/gi, ''], // keep the noun, drop the promise
  [new RegExp(`\\b(?:100%\\s+)?guaranteed\\b(?!\\s+(?:${ILLUSTRATION_SENSE})\\b)`, 'gi'), 'projected'],
  [new RegExp(`\\bguarantees?\\b(?!\\s+(?:${ILLUSTRATION_SENSE})\\b)`, 'gi'), 'assurance'],
  [/\brisk[- ]free\b/gi, ''], [/\bno risk\b/gi, ''], [/\bget rich\b/gi, ''],
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
  // Did a NAME get removed from right after a leading article? Only then is the
  // article dangling. Applying this unconditionally mangles ordinary prose —
  // "The guaranteed column shows…" became "Guaranteed column shows…" on every
  // scrubbed sentence that happened to open with an article.
  const article = /^((?:the|a|an|your|our)\s+)/i
  const am = input.match(article)
  const danglingArticle = !!am && out !== input &&
    out.slice(am[0].length).trimStart().length < input.slice(am[0].length).trimStart().length
  // accurate disclaimers survive as "illustrated"; positive promises drop
  out = out.replace(/\bnon[-\s]?guaranteed\b/gi, 'illustrated').replace(/\bnot\s+guaranteed\b/gi, 'illustrated')
  for (const [re, sub] of GUARANTEE_SUBS) out = out.replace(re, sub)
  out = out
    // orphaned version fragments after a name removal ("+ III", "II", "+")
    .replace(/(^|\s)\+?\s*(?:iii|ii|iv|vi)\b/gi, '$1')
    .replace(/(^|\s)\+(?=\s|$)/g, '$1')
    // stranded possessive: removing "Mutual of Omaha" from "Mutual of Omaha's plan"
    // leaves "'s plan" — drop the orphaned "'s" (mirror of vps/slides.js clean()).
    .replace(/(^|[\s([{])['’]s\b/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/([.,!?;:])\1+/g, '$1')
  // a name removed right after a leading article leaves "The gives you..." —
  // drop the now-dangling article so the sentence reads cleanly.
  if (danglingArticle) out = out.replace(article, '')
  return out
    .replace(/^[\s—–\-,;:]+|[\s—–\-,;:]+$/g, '')
    .replace(/^([a-z])/, (m) => m.toUpperCase())
    .trim()
}

/**
 * Repair the prose after a scrub. The blocklist/guarantee substitutions are
 * word-level, so they can leave sentences no advisor would write:
 *   "Coverage illustrated to age 131 under plan assumptions — illustrated"
 *   "Full benefit contractually projected if death occurs before age 67"
 * This runs ONE cheap model pass over just the strings the scrub actually
 * changed, rewriting them into natural English under the same constraints.
 * Never invents figures; on any failure the scrubbed text is returned as-is.
 */
export async function smoothScrubbed(
  pairs: { before: string; after: string }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const changed = pairs.filter(
    (p) => p.after && p.before !== p.after && /[a-z]/i.test(p.after) && p.after.split(/\s+/).length > 1,
  )
  if (!changed.length) return out
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) return out
    const client = new Anthropic({ apiKey: key })
    const list = changed.map((p, i) => `${i}. ${p.after}`).join('\n')
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system:
        'You repair short slide/narration lines for a client-facing insurance illustration explainer. ' +
        'Each line had carrier and product NAMES removed and guarantee wording softened, which left awkward or duplicated phrasing. ' +
        'Rewrite each line so it reads naturally in plain English.\n' +
        'HARD RULES:\n' +
        '- NEVER reintroduce a carrier, company, or branded product name.\n' +
        '- NEVER promise or imply a guaranteed return; keep figures framed as illustrated/projected.\n' +
        '- KEEP every dollar amount, percentage, and age EXACTLY as written. Invent nothing.\n' +
        '- Keep the same meaning and roughly the same length. Fix duplicated words and dangling grammar.\n' +
        '- If a line already reads fine, return it unchanged.\n' +
        'Reply with ONLY a JSON array of strings, in the same order, no prose or code fences.',
      messages: [{ role: 'user', content: list }],
    })
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    const m = text.match(/\[[\s\S]*\]/)
    if (!m) return out
    const arr = JSON.parse(m[0]) as unknown[]
    if (!Array.isArray(arr) || arr.length !== changed.length) return out
    arr.forEach((v, i) => {
      const s = typeof v === 'string' ? v.trim() : ''
      // Reject a rewrite that smuggles a blocked name back in or drops a figure.
      if (!s || complianceLeaks(s).length) return
      const figs = (changed[i].after.match(/\$[\d,]+|\b\d+(?:\.\d+)?%|\b\d{2,}\b/g) ?? [])
      if (figs.some((f) => !s.includes(f))) return
      out.set(changed[i].after, s)
    })
  } catch {
    /* smoothing is best-effort — the scrubbed text still ships */
  }
  return out
}

/** Which blocklisted terms survived a scrub (should be empty). Audit helper. */
export function complianceLeaks(...hays: unknown[]): string[] {
  const hay = normalizeForMatch(hays.map((h) => (typeof h === 'string' ? h : JSON.stringify(h ?? ''))).join(' '))
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
