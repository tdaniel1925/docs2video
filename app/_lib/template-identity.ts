import { bookingFor, type SenderProfile, type VideoSender } from './video-sender'

/* ============================================================================
 * WHO A TEMPLATE VIDEO IS FROM — the only thing its cover and closing are
 * built from (One Dollar Decks lib/code-deck/templates/types TemplateIdentity;
 * the same shape, kept here because the apps share no code).
 *
 * It follows the one rule in video-sender.ts: a chosen brand gives
 * everything — a person's name, role and photo, or a company's name — and the
 * contact saved ON it; no brand gives the account's own profile; never both.
 * The render worker checks every page against it, and against the account's
 * own details when the video is from someone else (foreignIdentity).
 * ==========================================================================*/

export type TemplateIdentity = {
  kind: 'person' | 'company' | 'none'
  person?: string
  role?: string
  company?: string
  client?: string
  phone?: string
  email?: string
  website?: string
  booking?: string
  showContact?: boolean
  photoOn?: { cover: boolean; closing: boolean }
}

export function templateIdentity(s: VideoSender, o: {
  profile?: SenderProfile | null
  /** Who it was made for ("the Morales family"). */
  client?: string | null
  /** The customer's "show contact on the closing". */
  showContact: boolean
  /** Where the presenter's photo goes — only when a photo is sent. */
  photoOn?: { cover: boolean; closing: boolean } | null
  /** A person who chose not to show their name on slides. */
  hideName?: boolean
  /** The phone as it is shown on screen (formatted). */
  phoneShown?: string | null
}): TemplateIdentity {
  const put = <K extends keyof TemplateIdentity>(k: K, v: TemplateIdentity[K] | null | undefined) => (v === null || v === undefined || v === '' ? {} : { [k]: v })
  const base = {
    ...put('client', o.client?.trim()),
    ...put('phone', o.phoneShown || s.phone),
    ...put('email', s.email),
    ...put('website', s.website),
    ...put('booking', bookingFor(s, o.profile)),
    showContact: o.showContact,
  }
  if (s.kind === 'person' && s.person && !o.hideName) {
    return { kind: 'person', person: s.person, ...put('role', s.role), ...put('company', s.company), ...base, ...(o.photoOn && (o.photoOn.cover || o.photoOn.closing) ? { photoOn: { cover: o.photoOn.cover, closing: o.photoOn.closing } } : {}) }
  }
  if (s.company) return { kind: 'company', company: s.company, ...base }
  return { kind: 'none', ...base }
}
