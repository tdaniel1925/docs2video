/**
 * Title-case a person/company name: capitalize the first letter of each word,
 * lowercase the rest. Preserves separators (spaces, hyphens, apostrophes) so
 * "mary-jane o'neil" -> "Mary-Jane O'Neil". Leaves all-caps acronyms the user
 * clearly typed intentionally alone only at word level (we still title-case, so
 * "ACME" -> "Acme"); good enough for presenter/company names.
 */
export function toTitleCase(input: string): string {
  return (input || '').replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

/**
 * True when a "name" is actually a placeholder / sample / generic value rather
 * than a real person's name. These leak onto videos as "Mr. Client" etc. and
 * look unprofessional — we treat them as no-name. Matches whether the document
 * printed it or the AI invented it.
 */
export function isPlaceholderName(name: string | null | undefined): boolean {
  const n = (name || '').trim().toLowerCase()
  if (!n) return true
  if (n.length < 2) return true
  // Whole-string generic values.
  if (/^(n\/?a|none|null|unknown|tbd|test|sample|specimen|example)$/.test(n)) return true
  // Title + generic ("mr. client", "the insured", "valued client", "john doe"…).
  if (/\b(client|customer|insured|policyholder|policy holder|member|prospect|valued|sample|specimen|example|john doe|jane doe|doe|test|recipient|name)\b/.test(n)) return true
  return false
}

/**
 * Return a real recipient name, or '' if it's missing/placeholder. Use this
 * before putting a name on a slide or into a greeting.
 */
export function cleanRecipientName(name: string | null | undefined): string {
  const n = (name || '').trim()
  return isPlaceholderName(n) ? '' : n
}
