import { redirect } from 'next/navigation'

// RETIRED TOOL — redirects before the page renders, so it can't spend credits.
// Custom Graphics (/design) now makes these (ad sizes and business cards are
// options on its Sizes step), so old /business-cards links land there instead. The
// product was narrowed to video + decks (BUILD-STATE.md "Product Focus"); this
// page stayed live by URL, still charging credits (audit 2026-09-26). The page
// code is left in place: delete this layout to bring the tool back.
export default function RetiredToolLayout() {
  redirect('/design')
}
