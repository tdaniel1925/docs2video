'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FlyerFields, PhotoRole } from '../../_lib/flyer-engine'
import type { DeckSlide } from '../../_lib/deck-split'

/**
 * THE JOB, CARRIED ACROSS FOUR PAGES.
 *
 * The old /flyer built everything in one component's useState, so nothing had
 * to survive navigation. A wizard has separate pages, so the choices — the
 * look, the words, the sizes — must live somewhere that outlasts a route
 * change. localStorage, the same store Docs2Video's /create wizard uses, so a
 * refresh or an accidental back-button does not wipe the work.
 *
 * WHAT WE STORE, AND WHAT WE DELIBERATELY DO NOT. Text, ids, the style, the
 * chosen sizes — small, safe. Photos and a reference are data URLs (the
 * generator needs the bytes), so they are the one heavy thing here; we cap how
 * many and note it. We never store a FINISHED design's image in here — those
 * live in the round on the server; we keep only its roundId and hand off to the
 * edit page by that.
 */
export type Kind = 'deck' | 'print' | 'social' | 'set'

export type WizardPhoto = { dataUrl: string; role: PhotoRole; name?: string }

export type WizardState = {
  kind: Kind | null
  templateId: string | null
  reference: { dataUrl: string; name: string } | null
  /**
   * Whether the user confirmed they OWN the reference artwork. Style-inspired is
   * always allowed; only close matching is gated behind this, so we never help
   * anyone copy work that isn't theirs.
   */
  referenceOwned: boolean
  brandId: string | null
  photos: WizardPhoto[]
  fields: FlyerFields
  note: string
  sizes: string[]
  /**
   * DECK RESTYLE. When the user uploads a deck to restyle, its parsed slides live
   * here (ordered, with image-only flagged). Its presence flips the deck flow on:
   * the content chat is skipped, sizes are fixed to slide-16x9, and Start draws
   * one styled slide per slide instead of one design.
   */
  deckSlides: DeckSlide[] | null
  /** The uploaded deck's file name, for showing back ("From MyDeck.pptx"). */
  deckName: string | null
  /**
   * Full-bleed for PRINT sizes: the artwork runs past the trim edge so cutting
   * leaves no white sliver. Only applies to printable (inch) sizes; ignored for
   * on-screen sizes. Undefined until the user chooses on the sizes step.
   */
  bleed: boolean
  /** The round produced by Generate — the edit page reads its designs by this. */
  roundId: string | null
  /**
   * The chat this job belongs to. /api/flyer-history filters rounds by chat_id,
   * so a round created with no chat is invisible to the edit page (it fetches
   * the most recent chat's rounds, which will never be ours). Minting a chat id
   * up front and passing it through generate + history is what makes the design
   * findable afterwards.
   */
  chatId: string | null
  /**
   * True once the inputs have been wiped after a finished job. Stops the results
   * page from re-clearing on every refresh, and marks this as a spent job whose
   * inputs are gone (only the round pointer remains).
   */
  cleared: boolean
  /**
   * Which fields the AI drafted from the one-sentence prompt (vs. the user
   * choosing them). Lets each step badge a value as "suggested" until the user
   * confirms or changes it. Cleared per-key as the user edits.
   */
  aiSuggested?: { kind?: boolean; templateId?: boolean; sizes?: boolean; fields?: boolean }
  /**
   * Brand colours read off a website the user pointed the chat at. Offered as a
   * tint for the design; the style step can show them and the generate call can
   * pass them along. Empty/undefined when no site was read.
   */
  brandColors?: string[]
  /**
   * RESTYLEZ FAITHFUL-RECREATE. The user came through the Restylez front door
   * and asked for their owned design remade EXACTLY (same layout/artwork/type,
   * only their content swapped in). The generator honors it only alongside a
   * reference + referenceOwned — the own-it gate.
   */
  recreate?: boolean
}

const KEY = 'text2art:wizard'

const EMPTY: WizardState = {
  kind: null, templateId: null, reference: null, referenceOwned: false, brandId: null,
  photos: [], fields: {}, note: '', sizes: [], deckSlides: null, deckName: null, bleed: false, roundId: null, chatId: null, cleared: false,
}

function load(): WizardState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<WizardState>) }
  } catch {
    return { ...EMPTY }
  }
}

/**
 * One shared store. Every page calls this; a change on one page is written to
 * localStorage and reflected on the next. The `ready` flag guards the first
 * paint — localStorage is only available in the browser, so the first render
 * (which may be server-side or pre-hydration) must not read it.
 */
export function useWizard() {
  const [state, setState] = useState<WizardState>(EMPTY)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setState(load())
    setReady(true)
  }, [])

  const patch = useCallback((next: Partial<WizardState>) => {
    setState((prev) => {
      const merged = { ...prev, ...next }
      try { localStorage.setItem(KEY, JSON.stringify(merged)) } catch { /* private mode / quota */ }
      return merged
    })
  }, [])

  const reset = useCallback(() => {
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    // Also drop the "walk in progress" mark. Otherwise a finished walk could
    // leave it set, and the NEXT visit to Step 1 would SKIP its own reset and
    // show the old job's words in the fields — the "new session still has the
    // old info" bug.
    try { sessionStorage.removeItem('design:walking') } catch { /* ignore */ }
    setState({ ...EMPTY })
  }, [])

  /**
   * Wipe the reusable inputs once a job is DONE, so the next design starts truly
   * empty — no leftover logo, photos, words, style or sizes pretending to belong
   * to the new job. The round is already saved on the server, so we keep only
   * its pointer (roundId + chatId) for the results page and drop everything else.
   * Guarded by a flag so calling it twice (or on refresh) does nothing.
   */
  const clearInputsKeepJob = useCallback(() => {
    setState((prev) => {
      if (prev.cleared) return prev
      const kept: WizardState = { ...EMPTY, roundId: prev.roundId, chatId: prev.chatId, cleared: true }
      try { localStorage.setItem(KEY, JSON.stringify(kept)) } catch { /* ignore */ }
      return kept
    })
  }, [])

  return { state, patch, reset, clearInputsKeepJob, ready }
}
