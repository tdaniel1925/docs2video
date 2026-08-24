'use client'

import type { DeckSlide } from '../../_lib/deck-split'
import type { PhotoRole } from '../../_lib/flyer-engine'

/**
 * DRAW A WHOLE DECK, ONE SLIDE AT A TIME.
 *
 * The image route (/api/flyer-art) makes ONE design per call and saves it under
 * a round. A deck is just N of those calls sharing one round — each at
 * slide-16x9, the SAME look (templateId) and brand, but with THAT slide's words.
 * We pass slotId/slotLabel so the N designs don't overwrite each other (they'd
 * otherwise all key off the same size). Sequential on purpose: it keeps slide
 * order honest and lets the wait screen report "slide 3 of 12".
 *
 * Reuses the existing generator and its per-design charge/refund — nothing new
 * on the drawing side. Image-only slides are skipped (told to the caller), never
 * shipped blank.
 */
export type DeckProgress = { done: number; total: number; failed: number }

export async function generateDeck(opts: {
  slides: DeckSlide[]
  templateId?: string | null
  brandId?: string | null
  /** A design to copy the LOOK of — applied to EVERY slide so the deck stays
   *  consistent. Same reference as the single-design path. */
  referenceDataUrl?: string | null
  /** Only true when the user confirmed they own the reference (allows close
   *  matching); otherwise the engine takes style inspiration only. */
  keepMotif?: boolean
  /** The user's logo and photos, placed on EVERY slide (a logo is placed as-is,
   *  never redrawn — the codebase rule). */
  photos?: { dataUrl: string; role: PhotoRole }[]
  /** Brand colours read off a website (Look step or chat) — tint every slide so
   *  the deck matches the business, when there's no saved brand driving it. */
  brandColors?: string[]
  roundId: string
  chatId: string
  onProgress?: (p: DeckProgress) => void
  signal?: AbortSignal
}): Promise<{ made: number; failed: number; skipped: number; firstError: string | null }> {
  // Only slides with text can be restyled from their words.
  const drawable = opts.slides.filter((s) => !s.imageOnly)
  const skipped = opts.slides.length - drawable.length
  let done = 0, failed = 0, firstError: string | null = null

  for (const slide of drawable) {
    if (opts.signal?.aborted) break
    const fields = {
      headline: slide.heading || undefined,
      details: slide.bullets.slice(0, 6),
    }
    // Cover and closing keep the model's hero logo placement (the customer
    // liked those). Every OTHER slide is a body slide: the logo is pasted in a
    // fixed top-right corner so it doesn't wander from slide to slide. A slide
    // with no role (restyled uploaded deck) is treated as a body slide.
    const isBody = slide.role !== 'cover' && slide.role !== 'closing'
    try {
      const r = await fetch('/api/flyer-art', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        signal: opts.signal,
        body: JSON.stringify({
          // A reference outranks a template style (both are art direction), so
          // only send the template when there's no reference — same rule as the
          // single-design path.
          templateId: opts.referenceDataUrl ? undefined : (opts.templateId ?? undefined),
          referenceDataUrl: opts.referenceDataUrl ?? undefined,
          keepMotif: Boolean(opts.referenceDataUrl && opts.keepMotif),
          sizeIds: ['slide-16x9'],
          fields,
          // The logo (and any photos) go on every slide so the deck is branded
          // consistently.
          photos: opts.photos && opts.photos.length ? opts.photos : undefined,
          brandColors: opts.brandColors && opts.brandColors.length ? opts.brandColors : undefined,
          // Body slides: keep the logo pinned to one corner (pasted in code),
          // never handed to the image model where it would land differently
          // each time. Cover/closing leave this off and keep hero placement.
          logoPlacement: isBody ? 'corner' : undefined,
          brandId: opts.brandId ?? undefined,
          slotId: `slide-${slide.n}`,
          slotLabel: `Slide ${slide.n}`,
          roundId: opts.roundId,
          chatId: opts.chatId,
        }),
      }).then((x) => x.json())
      if (r?.error) { failed++; firstError ??= r.error } else { done++ }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') break
      failed++; firstError ??= 'A slide could not be made.'
    }
    opts.onProgress?.({ done, total: drawable.length, failed })
  }

  return { made: done, failed, skipped, firstError }
}
