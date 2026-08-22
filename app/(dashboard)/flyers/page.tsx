import { redirect } from 'next/navigation'

// Retired address. Both the old four-step wizard (/flyers) and the one-page
// chat builder (/flyer) are gone; the designer now lives at /design. Kept as a
// redirect because /flyers was in the menu for months. Every design ever made
// is still in My Library.
export default function RetiredFlyerWizard() {
  redirect('/design')
}
