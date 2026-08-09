import { redirect } from 'next/navigation'

// The old four-step flyer wizard lived here. It has been replaced by the
// chat-first maker at /flyer, which generates the whole design — artwork and
// lettering together — at each size's own shape, keeps a saved history, and
// also makes business cards.
//
// This file stays as a redirect rather than being deleted outright: /flyers was
// the address in the menu for months, so it is in bookmarks and browser
// history. Flyers made with the old wizard are untouched and still listed
// under My Creations.
export default function RetiredFlyerWizard() {
  redirect('/flyer')
}
