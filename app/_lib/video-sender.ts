/* ============================================================================
 * WHO A VIDEO IS FROM — one answer for the video, its share page and its email.
 *
 * The bug (owner, 2026-10-18): the owner picked the Darrell Wolfe brand (a
 * person's brand), and the video's share page showed the ACCOUNT owner's name,
 * photo, phone and email instead — the share page, its tab title, the email
 * that sends it and the interactive presentation all read `profiles`, while
 * the video itself read the brand. One video, two people.
 *
 * THE RULE
 *  - A brand was chosen for the video → everything about who it is from comes
 *    from THAT brand: a person's name, role and photo; a company's name and
 *    logo; the phone, email and website saved on it (brand_guide_data).
 *  - No brand → the account's own profile.
 *  - Never both. A brand with no phone shows no phone; it never borrows the
 *    account's.
 * The account's payment link stays the account's (the money goes there); its
 * booking link is used only when the brand has none and is not another
 * person's (see bookingFor).
 * ==========================================================================*/

export type SenderBrand = {
  id?: string | null
  name?: string | null
  profile_type?: 'company' | 'person' | null
  person_role?: string | null
  photo_url?: string | null
  logo_url?: string | null
  logo_light_url?: string | null
  logo_dark_url?: string | null
  logo_file_url?: string | null
  brand_guide_data?: Record<string, unknown> | null
  show_name_on_slides?: boolean | null
}

export type SenderProfile = {
  full_name?: string | null
  company_name?: string | null
  photo_url?: string | null
  email?: string | null
  phone?: string | null
  calendly_url?: string | null
}

export type VideoSender = {
  source: 'brand' | 'profile' | 'none'
  kind: 'person' | 'company' | null
  /** The person's name (a person's brand, or the account's full name). */
  person: string | null
  /** The company (a company brand, the person brand's saved company, or the account's company). */
  company: string | null
  role: string | null
  /** A person's photo; a company's logo. */
  photo: string | null
  phone: string | null
  email: string | null
  website: string | null
  /** The booking link saved on the brand, if any. */
  booking: string | null
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function videoSender(brand: SenderBrand | null | undefined, profile: SenderProfile | null | undefined): VideoSender {
  if (brand && str(brand.name)) {
    const g = (brand.brand_guide_data ?? {}) as Record<string, unknown>
    const person = brand.profile_type === 'person'
    return {
      source: 'brand',
      kind: person ? 'person' : 'company',
      person: person ? str(brand.name) : null,
      company: person ? str(g.company) || str(g.companyName) : str(brand.name),
      role: person ? str(brand.person_role) : null,
      photo: person ? str(brand.photo_url) : (str(brand.logo_url) || str(brand.logo_light_url) || str(brand.logo_dark_url) || str(brand.logo_file_url)),
      phone: str(g.phone),
      email: str(g.email),
      website: str(g.website),
      booking: str(g.calendly) || str(g.booking_url) || str(g.bookingUrl),
    }
  }
  if (profile && (str(profile.full_name) || str(profile.company_name))) {
    return {
      source: 'profile',
      kind: str(profile.full_name) ? 'person' : 'company',
      person: str(profile.full_name),
      company: str(profile.company_name),
      role: null,
      photo: str(profile.photo_url),
      phone: str(profile.phone),
      email: str(profile.email),
      website: null,
      booking: str(profile.calendly_url),
    }
  }
  return { source: 'none', kind: null, person: null, company: null, role: null, photo: null, phone: null, email: null, website: null, booking: null }
}

/** The name a client reads: the person, else the company. */
export const senderName = (s: VideoSender): string | null => s.person || s.company

/**
 * The booking button's link: the brand's own, else — for the account's own
 * company brand, or no brand — the account's. Never the account's booking
 * link on ANOTHER person's video (it would book a call with the wrong person).
 */
export function bookingFor(s: VideoSender, profile: SenderProfile | null | undefined): string | null {
  if (s.booking) return s.booking
  if (s.source === 'brand' && s.kind === 'person') return null
  return str(profile?.calendly_url)
}

/**
 * The account's own names and contact that must NOT appear in a video made
 * under ANOTHER PERSON's brand (the pre-flight's "foreign" list). Empty when
 * the video is the account's own: no brand, a company brand (the account
 * holder is that company's agent, and may name themself in it), or a person
 * brand that is the account holder.
 */
export function foreignIdentity(s: VideoSender, profile: SenderProfile | null | undefined): string[] {
  if (s.source !== 'brand' || s.kind !== 'person' || !profile) return []
  const same = (x?: string | null) => (x || '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!str(profile.full_name) || same(profile.full_name) === same(s.person)) return []
  const mine = new Set([s.person, s.company, s.phone, s.email].filter(Boolean).map((x) => String(x).toLowerCase()))
  const digits = (x: string) => x.replace(/\D/g, '')
  const myDigits = s.phone ? digits(s.phone) : ''
  // Not the account's company: another person's brand may well work for it.
  return [profile.full_name, profile.email, profile.phone]
    .map(str).filter((x): x is string => !!x)
    .filter((x) => !mine.has(x.toLowerCase()))
    .filter((x) => !(myDigits && digits(x) && digits(x) === myDigits))
    // A name that is part of the brand's own name ("Daniel" inside "Daniel & Co") is not a leak.
    .filter((x) => !(s.person || s.company || '').toLowerCase().includes(x.toLowerCase()))
}

/* ── THE PRE-FLIGHT ─────────────────────────────────────────────────────── */

export type ExplainerJobIdentity = {
  /** Words on the cover and closing (their bullets), and every scene's narration. */
  cover: { bullets: string[]; narration: string }
  closing: { bullets: string[]; narration: string }
  narrations: string[]
  /** What the job sends as the presenter, and the photo it sends. */
  presenter?: { name: string; role?: string; cover: boolean; closing: boolean } | null
  photoUrl?: string | null
  logoUrl?: string | null
}

export type PreflightProblem = { code: string; detail: string }

/**
 * BEFORE A VIDEO IS SENT TO BE MADE: who it says it is from must be the chosen
 * brand, all of it. Returns the problems (empty is good). Deterministic.
 *  - the presenter's name in the job is the brand's;
 *  - the photo is the brand's photo, and is there when the settings put it on
 *    the cover or the closing;
 *  - the closing's contact is the brand's, not the account's;
 *  - no word of the account's own name, phone or email anywhere in it when a
 *    different brand was chosen.
 */
export function preflightIdentity(job: ExplainerJobIdentity, s: VideoSender, o: { placement: { cover: boolean; closing: boolean }; foreign: string[]; showContactClosing: boolean }): PreflightProblem[] {
  const out: PreflightProblem[] = []
  if (s.source === 'brand' && s.kind === 'person') {
    if (!job.presenter) out.push({ code: 'presenter-missing', detail: `the job has no presenter, but ${s.person} is a person’s brand` })
    else if (job.presenter.name !== s.person) out.push({ code: 'presenter-name', detail: `the job presents “${job.presenter.name}”, the brand is “${s.person}”` })
    const wantsPhoto = o.placement.cover || o.placement.closing
    if (s.photo && wantsPhoto) {
      if (!job.photoUrl) out.push({ code: 'photo-missing', detail: `${s.person}’s photo is set to show, but the job has none` })
      else if (job.photoUrl !== s.photo) out.push({ code: 'photo-wrong', detail: 'the job’s photo is not the brand’s photo' })
      if (job.presenter && (job.presenter.cover !== o.placement.cover || job.presenter.closing !== o.placement.closing)) out.push({ code: 'photo-placement', detail: 'the photo’s pages are not the ones chosen' })
    }
    if (!s.photo && job.photoUrl) out.push({ code: 'photo-wrong', detail: 'the job has a photo, the brand has none' })
  } else if (job.presenter || job.photoUrl) {
    out.push({ code: 'presenter-unexpected', detail: 'the job has a presenter or photo, but the video is not a person’s brand' })
  }
  if (o.showContactClosing && s.source !== 'none') {
    const closing = job.closing.bullets.join(' ')
    for (const [k, v] of [['email', s.email], ['website', s.website]] as const) {
      if (v && !closing.toLowerCase().includes(v.toLowerCase())) out.push({ code: 'contact-missing', detail: `the brand’s ${k} is not on the closing` })
    }
  }
  out.push(...foreignIn([...job.cover.bullets, job.cover.narration, ...job.closing.bullets, job.closing.narration], job.narrations, o.foreign, s))
  return out
}

/**
 * The account's NAME on the cover or the closing (who it is from), or its
 * phone or email anywhere. A name inside a content scene may be the
 * document's own (an agency owner's name in a report), so it is not refused.
 * Used by every path (generate-video), and by preflightIdentity.
 */
export function foreignIn(bookendTexts: string[], contentTexts: string[], foreign: string[], s: VideoSender): PreflightProblem[] {
  const out: PreflightProblem[] = []
  const bookends = bookendTexts.join(' \n ').toLowerCase()
  const everything = [...bookendTexts, ...contentTexts].join(' \n ')
  const digits = everything.replace(/\D/g, '')
  const lower = everything.toLowerCase()
  for (const f of foreign) {
    const d = f.replace(/\D/g, '')
    const word = (hay: string) => new RegExp(`(^|[^a-z0-9])${f.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(hay)
    const hit = d.length >= 7 ? digits.includes(d) : f.includes('@') ? lower.includes(f.toLowerCase()) : word(bookends)
    if (hit) out.push({ code: 'foreign-identity', detail: `“${f}” (the account’s, not ${senderName(s) ?? 'the brand'}’s) is in the video` })
  }
  return out
}

/* ── loading it (server) ────────────────────────────────────────────────── */

type Db = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

/** The account columns a sender may use — never the whole row. */
export const SENDER_PROFILE_COLS = 'full_name, company_name, photo_url, email, phone, calendly_url'

/**
 * The brand a video was made with: videos.brand_id, else the draft's
 * brandId. Read in its own query, so an environment without the column
 * never breaks the caller (the share page's rule).
 */
export async function videoBrandId(db: Db, videoId: string): Promise<string | null> {
  try {
    const { data } = await db.from('videos').select('brand_id, draft_data').eq('id', videoId).maybeSingle()
    const d = (data ?? {}) as { brand_id?: string | null; draft_data?: { brandId?: unknown } | null }
    return str(d.brand_id) || str(d.draft_data?.brandId)
  } catch {
    try {
      const { data } = await db.from('videos').select('draft_data').eq('id', videoId).maybeSingle()
      return str((data as { draft_data?: { brandId?: unknown } } | null)?.draft_data?.brandId)
    } catch { return null }
  }
}

/** The brand (scoped to its owner) and the sender it makes; the account's profile when there is no brand. */
export async function loadSender(db: Db, o: { userId: string; brandId?: string | null; profile?: SenderProfile | null }): Promise<{ sender: VideoSender; brand: SenderBrand | null; profile: SenderProfile | null }> {
  let brand: SenderBrand | null = null
  if (o.brandId) {
    // select('*'): the processed-logo columns are not in every environment, and one missing column fails the query.
    try { brand = ((await db.from('brands').select('*').eq('id', o.brandId).eq('user_id', o.userId).maybeSingle()).data as SenderBrand | null) ?? null } catch { brand = null }
  }
  let profile = o.profile ?? null
  if (!profile) {
    try { profile = ((await db.from('profiles').select(SENDER_PROFILE_COLS).eq('id', o.userId).maybeSingle()).data as SenderProfile | null) ?? null } catch { profile = null }
  }
  return { sender: videoSender(brand, profile), brand, profile }
}
