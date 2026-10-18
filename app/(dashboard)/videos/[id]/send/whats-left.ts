// =============================================================================
// "WHAT'S LEFT" — the chips above Send.
//
// Each chip is something that would make the client's share page better and
// is missing right now. Only things the page can really CHECK from data it
// already has are listed — never a guess:
//
//   email    — no client email to send to (the client from step 1 has none,
//              and none was typed)                         → the email box
//   note     — no note to the client (videos.agent_note)  → the note box
//   booking  — no booking link: neither this video's own link nor the one in
//              Settings (the share page shows the first it finds) → Settings
//   photo    — no photo in your profile. The share page shows YOUR photo and
//              name next to the video (it does not show a brand logo).
//                                                           → Settings
//   name     — no name or company in your profile, so the page says
//              "prepared just for you" instead of who it's from → Settings
//   payment  — a quote is on their page but there is no payment link, so it
//              says "contact you to pay" instead of a Pay button → Settings
//
// Not listed on purpose: "no brand on this video". A brand goes into the
// video when it is made; a finished video can't take one without being made
// again, so there is no fix to jump to from here.
// Pure: the guard test calls it directly.
// =============================================================================

export type LeftKey = 'email' | 'note' | 'booking' | 'photo' | 'name' | 'payment'

export interface LeftItem {
  key: LeftKey
  label: string
  /** Where the fix is: an element on this page to focus, or a page to open. */
  fix: { focus: string } | { href: string }
}

export interface LeftInput {
  /** The address Send would use right now ('' when there is none). */
  sendTo: string
  note: string
  /** null while the share page's facts are still loading — nothing about
   *  them is listed until they are known. */
  facts: null | {
    bookingUrl: string
    paymentLink: string
    agent: { photo_url?: string | null; full_name?: string | null; company_name?: string | null } | null
    /** Does their page show an unpaid quote? */
    unpaidQuoteShown: boolean
  }
}

/** Element ids the chips focus. The send panel uses the same ones. */
export const FOCUS_IDS = { email: 'rts-email', note: 'rts-note' } as const

export const SETTINGS_PROFILE = '/settings'
export const SETTINGS_INTEGRATIONS = '/settings?tab=integrations'

export function whatsLeft(i: LeftInput): LeftItem[] {
  const out: LeftItem[] = []
  if (!i.sendTo.trim()) out.push({ key: 'email', label: 'Add your client’s email', fix: { focus: FOCUS_IDS.email } })
  if (!i.note.trim()) out.push({ key: 'note', label: 'Write a short note', fix: { focus: FOCUS_IDS.note } })
  const f = i.facts
  if (f) {
    if (!f.bookingUrl) out.push({ key: 'booking', label: 'Add a booking link', fix: { href: SETTINGS_INTEGRATIONS } })
    // Only judged when the profile was readable — a missing answer is not a
    // missing photo.
    if (f.agent) {
      if (!f.agent.photo_url) out.push({ key: 'photo', label: 'Add your profile photo', fix: { href: SETTINGS_PROFILE } })
      if (!(f.agent.full_name || f.agent.company_name)) out.push({ key: 'name', label: 'Add your name', fix: { href: SETTINGS_PROFILE } })
    }
    if (f.unpaidQuoteShown && !f.paymentLink) out.push({ key: 'payment', label: 'Add a payment link', fix: { href: SETTINGS_INTEGRATIONS } })
  }
  return out
}
