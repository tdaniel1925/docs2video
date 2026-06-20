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
