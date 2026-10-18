// Pure helpers for the data cards (no React, no Remotion) so tests can import them.

// "vs" only belongs between two things that are really being compared: two
// numbers of the same kind and roughly the same size ("$184/mo" vs "$212/mo"),
// or two labels that are a pair ("Before" / "After", "Plan A" / "Plan B").
// "$184/month" vs "Age 95" — two unrelated facts side by side — gets no "vs".
const UNIT = (s: string) => ({ '/month': '/mo', '/year': '/yr' } as Record<string, string>)[s] ?? s.toLowerCase()
const PAIRS: [RegExp, RegExp][] = [
  [/\bbefore\b/i, /\bafter\b/i], [/\b(today|now|current|currently)\b/i, /\b(later|future|new|then|proposed)\b/i],
  [/\bwith(out)?\b/i, /\bwith(out)?\b/i], [/\b(old|existing)\b/i, /\bnew\b/i], [/\b(option|plan|scenario)\s*[a1]\b/i, /\b(option|plan|scenario)\s*[b2]\b/i],
  [/\b(you|yours?)\b/i, /\b(them|theirs|others?|average)\b/i],
]
const WORDS = (s: string) => new Set(String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3))
export function isRealComparison(cards: { label?: string; value?: string }[]): boolean {
  if (!Array.isArray(cards) || cards.length !== 2) return false
  const [a, b] = cards
  const la = String(a.label || ''), lb = String(b.label || '')
  const paired = PAIRS.some(([x, y]) => (x.test(la) && y.test(lb)) || (y.test(la) && x.test(lb)))
  const na = parseNum(String(a.value ?? '')), nb = parseNum(String(b.value ?? ''))
  if (na && nb) {
    if (na.prefix.replace('~', '') !== nb.prefix.replace('~', '') || UNIT(na.suffix) !== UNIT(nb.suffix)) return false
    const hi = Math.max(Math.abs(na.value), Math.abs(nb.value)), lo = Math.min(Math.abs(na.value), Math.abs(nb.value))
    return paired || (lo > 0 && hi / lo <= 10)
  }
  if (na || nb) return false
  // two words/phrases (e.g. "Term" vs "Whole life"): only a labelled pair, or
  // labels that name the same thing ("Monthly cost" / "Monthly cost later")
  const wa = WORDS(la), wb = WORDS(lb)
  return paired || [...wa].some((w) => wb.has(w))
}

// "$399/mo" | "$15,000" | "15s" | "10" → { value, prefix, suffix } for the odometer.
// ONLY when the whole value IS a number: "$100–$200/mo", "Oct 10, 2026 – Oct 10,
// 2027", "8–12%" or "100% High Cap Rate Acct" used to become "$100/mo", "10",
// "8%", "100%" — the rest silently dropped. Those now show as written.
export function parseNum(raw: string): { value: number; prefix: string; suffix: string; decimals: number } | null {
  const m = String(raw ?? '').trim().match(/^(~?\$?)\s?(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?)\s?(%|\/mo|\/yr|\/year|\/month|k|K|M|s|x|\+)?$/)
  if (!m) return null
  const value = parseFloat(m[2].replace(/,/g, ''))
  if (!Number.isFinite(value)) return null
  return { value, prefix: m[1] || '', suffix: m[4] || '', decimals: m[3] ? Math.min(2, m[3].length) : 0 }
}
