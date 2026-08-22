import { redirect } from 'next/navigation'

// RETIRED. The old one-page chat builder lived here. It's been replaced by the
// 5-step designer at /design (pick or describe → look → words → sizes → make →
// spot-edit), which is the one flow we maintain now — two builders meant double
// the bugs. Kept as a redirect because /flyer was bookmarked and linked for
// months; every design ever made is still in My Library, untouched.
export default function RetiredFlyerBuilder() {
  redirect('/design')
}
