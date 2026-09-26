import { redirect } from 'next/navigation'
import { getBrand } from '../../_lib/brand-server'

// RETIRED TOOL — redirects before the page renders, so it can't spend credits.
// The product was narrowed to video + slide decks (owner decision 2026-06-11;
// see BUILD-STATE.md "Product Focus"). /brand-kit was hidden from every menu but
// stayed live by URL, still charging credits (audit 2026-09-26). The page code
// is left in place: delete this layout to bring the tool back.
export default async function RetiredToolLayout() {
  const brand = await getBrand()
  redirect(brand.home)
}
