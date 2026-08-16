'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FlyerFields, PhotoRole } from '../../_lib/flyer-engine'

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
}

const KEY = 'text2art:wizard'

const EMPTY: WizardState = {
  kind: null, templateId: null, reference: null, referenceOwned: false, brandId: null,
  photos: [], fields: {}, note: '', sizes: [], roundId: null, chatId: null,
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
    setState({ ...EMPTY })
  }, [])

  return { state, patch, reset, ready }
}
