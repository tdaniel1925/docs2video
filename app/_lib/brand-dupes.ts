// =============================================================================
// SAME-NAME BRANDS — pure, so a test can check it.
//
// Audit 2026-10-09: accounts had the same brand saved several times ("Darrell
// Wolfe" ×4) because nothing said "you already have this one". Now:
//   - making a brand whose name is already used shows a warning first
//     (sameNameBrand);
//   - the Brands page groups same-name brands: one card (the default if it is
//     one of them, else the newest) and "N copies" that opens the rest
//     (groupBrands). Nothing is ever deleted for you.
// =============================================================================

/** "  Darrell   WOLFE " and "darrell wolfe" are the same name. */
export function brandNameKey(name: string | null | undefined): string {
  return String(name ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

type Named = { id: string; name: string | null; created_at?: string | null; is_default?: boolean | null }

/** The existing brand that already has this name (newest), or null. */
export function sameNameBrand<T extends Named>(name: string, brands: T[], exceptId?: string | null): T | null {
  const key = brandNameKey(name)
  if (!key) return null
  const hits = brands.filter((b) => b.id !== exceptId && brandNameKey(b.name) === key)
  if (hits.length === 0) return null
  return hits.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0]
}

export type BrandGroup<T> = {
  key: string
  /** The card shown: the default brand if it is in the group, else the newest. */
  lead: T
  /** The other brands with the same name, newest first. */
  copies: T[]
}

/** Same-name brands folded into groups; groups keep the newest-first order. */
export function groupBrands<T extends Named>(brands: T[]): BrandGroup<T>[] {
  const newestFirst = [...brands].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
  const byKey = new Map<string, T[]>()
  const order: string[] = []
  for (const b of newestFirst) {
    // A brand with no name is never folded with another one.
    const key = brandNameKey(b.name) || `id:${b.id}`
    if (!byKey.has(key)) { byKey.set(key, []); order.push(key) }
    byKey.get(key)!.push(b)
  }
  return order.map((key) => {
    const all = byKey.get(key)!
    const lead = all.find((b) => b.is_default) ?? all[0]
    return { key, lead, copies: all.filter((b) => b !== lead) }
  })
}
