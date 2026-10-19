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

/**
 * Strip placeholder/sample names that appear INSIDE prose (brief summary, key
 * points, etc.) and read unprofessionally — e.g. "Mr. Client", "Valued Client",
 * "John Doe". Replaces possessives ("Mr. Client's") with "your" and plain
 * references with "you", then tidies spacing. Leaves real names untouched.
 */
export function scrubPlaceholderNamesInText(text: string): string {
  if (!text) return text
  return text
    // possessive: "Mr. Client's loved ones" → "your loved ones"
    .replace(/\b(?:mr\.?|mrs\.?|ms\.?|dr\.?)\s+(?:valued\s+)?(?:client|customer|insured|policyholder|policy holder|member|doe|john doe|jane doe)['’]s\b/gi, 'your')
    .replace(/\b(?:the\s+)?(?:valued\s+client|insured|policyholder|policy holder)['’]s\b/gi, 'your')
    // plain reference: "walks Mr. Client through" → "walks you through"
    .replace(/\b(?:mr\.?|mrs\.?|ms\.?|dr\.?)\s+(?:valued\s+)?(?:client|customer|insured|policyholder|policy holder|member|doe|john doe|jane doe)\b/gi, 'you')
    .replace(/\bvalued client\b/gi, 'you')
    .replace(/\bjohn doe\b|\bjane doe\b/gi, 'you')
    // tidy: double spaces + "for you," artifacts
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

/** A scene title without the script writer's beat label: "Opening: X", "Opening — X", "Intro - X", "Closing: X" → "X". */
export function cleanSceneTitle(title: string | null | undefined): string {
  const t = String(title ?? '').trim()
  const stripped = t.replace(/^(opening|intro(duction)?|hook|closing|outro)\s*[:\-–—]\s*/i, '').trim()
  return stripped || t
}

const COMPANY_RE =/\b(inc|llc|l\.l\.c|corp|corporation|co|company|group|partners|ltd|llp|agency|associates|foundation|trust|holdings|enterprises|church|school|district|clinic|hospital)\.?$/i
/** A business named for what it does ("Harbor Street Bakery" was greeted "Harbor"): its last word is a trade. */
const TRADE_RE = /\b(bakery|cafe|café|coffee|restaurant|grill|kitchen|bistro|pizza|pizzeria|deli|bar|pub|brewery|winery|salon|spa|barbershop|studio|studios|gallery|shop|store|boutique|market|mart|outlet|realty|properties|homes|builders|construction|contractors|roofing|plumbing|electric|hvac|landscaping|motors|auto|garage|dental|dentistry|orthodontics|pharmacy|vet|veterinary|fitness|gym|yoga|academy|institute|university|college|insurance|financial|wealth|capital|advisors|advisers|bank|lending|mortgage|consulting|solutions|services|systems|labs|media|marketing|design|logistics|transport|farms|farm|ranch|hotel|inn|resort|law|legal|firm|ministries|center|centre)$/i
const TITLE_RE = /^(mr|mrs|ms|miss|mx|dr|prof|rev|hon)\.?\s+/i

/**
 * HOW THE NARRATOR GREETS THE CLIENT ("___, thank you for letting…").
 * The first word of the name was used, so "The Smith Family" became "The,",
 * "Mr. John Smith" became "Mr.," and "SMITH, JOHN" became "SMITH,," (script
 * edge-case review, 2026-10-18). Now:
 *   a family     "The Smith Family"     → "Smith family"
 *   a couple     "John and Mary Smith"  → "John and Mary"
 *   a title      "Mr. John Smith"       → "Mr. Smith"
 *   a company    "Acme Corp"            → "Acme Corp"
 *   last, first  "SMITH, JOHN"          → "John"
 *   a person     "jane smith"           → "Jane"
 * Returns '' for no name / a placeholder.
 */
export function salutationFor(name: string | null | undefined): string {
  let n = cleanRecipientName(name).replace(/\s+/g, ' ').trim()
  if (!n) return ''
  const shouting = n === n.toUpperCase() || n === n.toLowerCase()
  if (shouting) n = toTitleCase(n)
  const fam = n.match(/^(?:the\s+)?([A-Za-z][\w'’-]*)\s+family$/i)
  if (fam) return `${fam[1]} family`
  if (COMPANY_RE.test(n)) return n
  if (n.includes(' ') && TRADE_RE.test(n)) return n
  const lastFirst = n.match(/^([^,]+),\s*([^,]+)$/)
  if (lastFirst) n = `${lastFirst[2]} ${lastFirst[1]}`.trim()
  const title = n.match(TITLE_RE)
  if (title) {
    const rest = n.slice(title[0].length).trim().split(' ')
    const t = title[1].charAt(0).toUpperCase() + title[1].slice(1).toLowerCase()
    return rest[rest.length - 1] ? `${t}. ${rest[rest.length - 1]}`.replace('Miss.', 'Miss') : ''
  }
  const couple = n.match(/^([A-Za-z][\w'’-]*)\s+(?:and|&)\s+([A-Za-z][\w'’-]*)\b/i)
  if (couple) return `${couple[1]} and ${couple[2]}`
  return n.split(' ')[0]
}
