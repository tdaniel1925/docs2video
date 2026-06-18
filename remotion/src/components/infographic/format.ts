/**
 * Parse a human metric value (e.g. "$176,204", "$10,000.00/year", "20 years",
 * "100% S&P 500", "3 Included") into an animatable number plus the prefix/suffix
 * that surround it — so a counter can tick the number while keeping "$" and
 * "/year" fixed. If no number is found, the whole string is treated as a static
 * label (number = null) and rendered as-is (no count-up).
 */
export type ParsedMetric = {
  prefix: string      // text before the number, e.g. "$"
  number: number | null
  suffix: string      // text after the number, e.g. "/year" or " years"
  decimals: number    // significant decimals in the source ("$3,018.18" -> 2)
  grouped: boolean    // had thousands separators -> format with commas
  raw: string
}

export function parseMetric(value: string): ParsedMetric {
  const raw = String(value ?? '').trim()
  // First number token: optional thousands groups + optional decimals.
  const m = raw.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/)
  if (!m) return { prefix: raw, number: null, suffix: '', decimals: 0, grouped: false, raw }
  const token = m[0]
  const start = m.index ?? 0
  const prefix = raw.slice(0, start)
  const suffix = raw.slice(start + token.length)
  const grouped = token.includes(',')
  const dot = token.indexOf('.')
  const decimals = dot === -1 ? 0 : token.length - dot - 1
  const number = parseFloat(token.replace(/,/g, ''))
  return { prefix, number, suffix, decimals, grouped, raw }
}

/** Format a (possibly mid-animation) number the way the source presented it. */
export function formatNumber(n: number, decimals: number, grouped: boolean): string {
  const fixed = n.toFixed(decimals)
  if (!grouped) return fixed
  const [int, frac] = fixed.split('.')
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac != null ? `${withCommas}.${frac}` : withCommas
}

/** Render a parsed metric at animation progress p (0→1). Static labels ignore p. */
export function renderMetric(parsed: ParsedMetric, p: number): string {
  if (parsed.number == null) return parsed.raw
  const current = parsed.number * Math.max(0, Math.min(1, p))
  return `${parsed.prefix}${formatNumber(current, parsed.decimals, parsed.grouped)}${parsed.suffix}`
}
