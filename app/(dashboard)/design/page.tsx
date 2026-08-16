'use client'

import { useEffect } from 'react'
import { thumbUrl } from '../../_lib/flyer-engine'
import { useWizard } from './useWizard'
import { INK, SOFT, LINE, card, StepShell } from './ui'
import type { Kind } from './useWizard'

/**
 * STEP 1 — WHAT ARE YOU MAKING?
 *
 * Just the pick. Each choice shows a sample and one plain line about what you
 * get, so the very first decision is obvious. Style, images and words all come
 * later on their own pages. Selecting a kind is enough to move on.
 */
// Sample tiles use REAL style thumbnails (via thumbUrl) so nothing 404s.
const KINDS: { kind: Kind; label: string; blurb: string; sample: string }[] = [
  { kind: 'print', label: 'Something to print', blurb: 'A flyer, poster, postcard, sign or card — one page, print-ready, artwork and words together.', sample: thumbUrl('corporate') },
  { kind: 'social', label: 'A social graphic', blurb: 'A post or cover for Instagram, Facebook, LinkedIn or the web — sized right for each place.', sample: thumbUrl('nightlife-garden-social') },
  { kind: 'deck', label: 'A slide deck', blurb: 'A whole presentation — every slide made to match, ready to present or share.', sample: thumbUrl('business-collage-network') },
  { kind: 'set', label: 'A set of sizes', blurb: 'The same design made in several sizes at once — flyer, post, banner, card — all matching.', sample: thumbUrl('retro') },
]

export default function WhatStep() {
  const { state, patch, reset, ready } = useWizard()

  // Landing on Step 1 begins a NEW design. If the last job was already finished
  // (its inputs were wiped after results), drop its leftover round pointer too,
  // so nothing at all carries over. A job in progress (not cleared) is left
  // alone — you can still step back into it.
  useEffect(() => {
    if (ready && state.cleared) reset()
  }, [ready, state.cleared, reset])

  if (!ready) return null

  return (
    <StepShell
      title="What do you want to make?"
      subtitle="Pick one to start. You’ll choose a look, add your words, and pick sizes on the next pages — you can change any of it later."
      next="/design/style"
      nextReady={Boolean(state.kind)}
      nextHint="Pick what you’re making"
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
        {KINDS.map((k) => {
          const on = state.kind === k.kind
          return (
            <button key={k.kind} onClick={() => patch({ kind: k.kind })}
              style={{ ...card, padding: 0, overflow: 'hidden', textAlign: 'left', cursor: 'pointer',
                borderColor: on ? INK : LINE, boxShadow: on ? `inset 0 0 0 2px ${INK}` : 'none' }}>
              <img src={k.sample} alt="" loading="lazy"
                style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block', background: '#111' }} />
              <div style={{ padding: '12px 14px 16px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{k.label}</div>
                <div style={{ fontSize: 12.5, color: SOFT, marginTop: 3, lineHeight: 1.5 }}>{k.blurb}</div>
              </div>
            </button>
          )
        })}
      </div>
    </StepShell>
  )
}
