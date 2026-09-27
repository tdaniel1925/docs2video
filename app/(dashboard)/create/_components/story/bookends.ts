import { isRegulated, productTokens, scrubComplianceText } from '../../../../_lib/compliance'

export interface BookendOpts {
  title?: string
  brandName?: string
  recipientName?: string
  contactLine?: string
  presenterIntro?: string
  showContactClosing?: boolean
}

/** The personal-touch settings on the draft that shape the default cover/closing. */
export function bookendOptsFrom(draft: any): BookendOpts {
  const contactLine = [draft?.contactPhone, draft?.contactEmail, draft?.contactWebsite].filter(Boolean).join(' | ')
  return {
    title: draft?.title || draft?.extractedData?.title || undefined,
    brandName: draft?.inlineBrand?.name || undefined,
    recipientName: draft?.recipientName || undefined,
    contactLine: contactLine || undefined,
    presenterIntro: draft?.presenterIntro || undefined,
    showContactClosing: draft?.showContactClosing,
  }
}

// Build the default cover/closing copy and ensure the editable scene list has an
// editable Cover (first) + Closing (last). Idempotent: if bookends already exist
// (by _role), it leaves them. This makes the front/back slides editable like any
// content scene; generate-video uses the edited versions (by _role) at submit.
//
// The defaults are marked `_auto` with the exact text written (`_autoNarration`).
// generate-video only lets a bookend override the personalized opening/closing
// (presenter intro, client greeting, "show contact on closing") when the user
// actually CHANGED that text — untouched defaults no longer win by accident.
// The defaults themselves follow the presenter intro and the contact choice.
export function addBookends(scenes: any[], opts: BookendOpts): any[] {
  if (!Array.isArray(scenes) || scenes.length === 0) return scenes
  const hasCover = scenes.some(s => s?._role === 'cover')
  const hasClosing = scenes.some(s => s?._role === 'closing')
  let title = opts.title || scenes[0]?.title || 'Presentation'
  // COMPLIANCE: the document title of a regulated illustration IS usually the
  // carrier/product name — it must never seed the cover slide or its narration.
  const regulated = isRegulated(title, scenes)
  if (regulated) {
    title = scrubComplianceText(title, productTokens(title))
    if (title.replace(/[^a-zA-Z]/g, '').length < 6) title = 'Your Personalized Illustration'
  }
  // Existing drafts may carry a cover built before this scrub — clean it in place.
  if (regulated && hasCover) {
    scenes = scenes.map(s => {
      if (s?._role !== 'cover') return s
      const toks = productTokens(s.title)
      const S = (v?: string) => (typeof v === 'string' && v ? scrubComplianceText(v, toks) : v)
      let t = S(s.title) || ''
      if (t.replace(/[^a-zA-Z]/g, '').length < 6) t = title
      return {
        ...s, title: t, narration: S(s.narration) || s.narration,
        // scrub the remembered default the same way, so an untouched default
        // still reads as untouched after cleaning
        ...(s._auto ? { _autoNarration: S(s._autoNarration) || s._autoNarration } : {}),
        slideData: s.slideData ? { ...s.slideData, headline: S(s.slideData.headline) || t } : s.slideData,
      }
    })
  }
  const greeting = opts.recipientName
    ? `Hello ${opts.recipientName}, thank you for your time today.`
    : 'Thank you for your time today.'
  const intro = opts.presenterIntro?.trim()
  const coverNarration = intro ? `${greeting} ${intro}` : `${greeting} ${title}.`
  const cover = {
    _role: 'cover',
    _auto: true,
    _autoNarration: coverNarration,
    title,
    narration: coverNarration,
    slideData: { headline: title },
  }
  const contactSentence = opts.contactLine && opts.showContactClosing !== false ? ` To learn more, reach out: ${opts.contactLine}.` : ''
  const closingNarration = `Thank you for watching.${contactSentence} ${opts.brandName ? `${opts.brandName} looks forward to serving you.` : 'We appreciate your time.'}`.replace(/\s+/g, ' ').trim()
  const closing = {
    _role: 'closing',
    _auto: true,
    _autoNarration: closingNarration,
    title: 'Thank You',
    narration: closingNarration,
    slideData: { headline: 'Thank You', cta: 'Reach out to take the next step.' },
  }
  let out = scenes
  if (!hasCover) out = [cover, ...out]
  if (!hasClosing) out = [...out, closing]
  return out
}

/**
 * An AI rewrite of the whole story returns plain JSON slides and can drop the
 * `_auto` / `_autoNarration` marks on the cover and closing. Without them an
 * untouched default looks "edited" and would override the personal touches
 * (client greeting, presenter intro, contact line) at generation time. Copy
 * the marks back from the scene that held the same role before the rewrite.
 */
export function keepAutoMarks(before: any[], after: any[]): any[] {
  return after.map(s => {
    const role = s?._role
    if (role !== 'cover' && role !== 'closing') return s
    if (s._auto !== undefined) return s
    const prev = before.find(p => p?._role === role)
    if (!prev?._auto) return s
    return { ...s, _auto: prev._auto, _autoNarration: prev._autoNarration }
  })
}

/** Rough spoken length of one scene, in seconds (about 2.5 words a second). */
export function sceneSeconds(scene: any): number {
  const words = String(scene?.narration || '').trim().split(/\s+/).filter(Boolean).length
  return Math.round(words / 2.5)
}

/** 75 → "1:15" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
