import { redirect } from 'next/navigation'

// RETIRED TOOL — redirects before the page renders, so it can't spend credits.
// Social content now lives in the AI Social add-on (/social-media, linked from
// the account menu), which shows its own upsell to non-subscribers. /social-kit was
// hidden from every menu but stayed live by URL, still charging credits (audit
// 2026-09-26). The page code is left in place: delete this layout to bring the
// tool back.
export default function RetiredToolLayout() {
  redirect('/social-media')
}
