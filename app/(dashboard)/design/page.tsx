'use client'

import { useEffect, useRef, useState } from 'react'
import { thumbUrl } from '../../_lib/flyer-engine'
import { useWizard } from './useWizard'
import { INK, SOFT, LINE, MINT, card, plainBtn, StepShell } from './ui'
import type { Kind } from './useWizard'
import type { DeckSlide } from '../../_lib/deck-split'

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

  // A FRESH arrival at Step 1 begins a NEW design — wipe ANY leftover job so
  // nothing from a previous session carries over (a logo, words, a half-finished
  // deck, a spent round). "Fresh" = a real page load: opening /design from the
  // nav, a new tab, or a reload. Stepping BACK to Step 1 within an active walk is
  // NOT fresh — we mark the walk active in sessionStorage the moment you leave
  // Step 1, and only skip the reset while that mark is present. sessionStorage
  // clears when the tab closes, so the next visit is fresh again.
  useEffect(() => {
    if (!ready) return
    const walking = sessionStorage.getItem('design:walking')
    if (!walking) reset() // new session → clean slate
    // Landing here always means we are back at the start; the walk mark is set
    // again as soon as the user advances (see the WHAT-step Next handler).
    sessionStorage.removeItem('design:walking')
  }, [ready, reset])

  if (!ready) return null

  // A deck is ready to go once its slides are parsed; other kinds just need the pick.
  const nextReady = state.kind === 'deck'
    ? Boolean(state.deckSlides && state.deckSlides.length)
    : Boolean(state.kind)

  return (
    <StepShell
      title="What do you want to make?"
      subtitle="Pick one to start. You’ll choose a look, add your words, and pick sizes on the next pages — you can change any of it later."
      next="/design/style"
      // Advancing off Step 1 begins the walk — mark it active so stepping BACK
      // here doesn't wipe the in-progress job (only a fresh load does).
      onNext={() => sessionStorage.setItem('design:walking', '1')}
      nextReady={nextReady}
      nextHint={state.kind === 'deck' ? 'Upload a deck to restyle first' : 'Pick what you’re making'}
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

      {/* DECK RESTYLE — only when "A slide deck" is chosen. Shares the parent's
          state/patch (not its own useWizard copy) so a parsed deck immediately
          enables Next. */}
      {state.kind === 'deck' && (
        <DeckRestyle
          deckSlides={state.deckSlides}
          deckName={state.deckName}
          patch={patch}
        />
      )}
    </StepShell>
  )
}

/**
 * Upload a full deck → parse it into slides → confirm before spending. Storing
 * the parsed slides on wizard state flips the deck flow on (skip the chat, fix
 * sizes to slide, draw one styled slide per slide).
 */
function DeckRestyle({ deckSlides, deckName, patch }: {
  deckSlides: DeckSlide[] | null
  deckName: string | null
  patch: (next: { deckSlides?: DeckSlide[] | null; deckName?: string | null }) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [truncated, setTruncated] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setErr(''); setTruncated(false); setBusy(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/deck-parse', { method: 'POST', body: fd })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(data?.error || 'Could not read that deck.'); return }
      patch({ deckSlides: data.slides as DeckSlide[], deckName: data.name as string })
      setTruncated(Boolean(data.truncated))
    } catch {
      setErr('Something went wrong reading the file.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const slides = deckSlides ?? []
  const dropSlide = (n: number) => patch({ deckSlides: slides.filter((s) => s.n !== n) })
  const imageOnly = slides.filter((s) => s.imageOnly).length
  const drawable = slides.length - imageOnly

  return (
    <div style={{ ...card, marginTop: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 4 }}>Restyle a deck you already have</div>
      <p style={{ fontSize: 12.5, color: SOFT, margin: '0 0 12px', lineHeight: 1.5, maxWidth: 620 }}>
        Upload a PowerPoint or PDF. We read it slide by slide, keep your words, and redraw every slide in the look you pick next. You get back a matching set of slides (and a PDF).
      </p>

      {!slides.length ? (
        <label onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files?.[0]) }}
          style={{ display: 'block', border: `1.5px dashed ${LINE}`, borderRadius: 10, padding: '26px 16px', textAlign: 'center', cursor: 'pointer', color: SOFT, fontSize: 13 }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>📊</div>
          <strong style={{ color: INK }}>{busy ? 'Reading your deck…' : 'Drop your .pptx or PDF here'}</strong><br />
          {!busy && 'or click to pick a file'}
          <input ref={fileRef} type="file" accept=".pptx,.ppt,.pdf" hidden
            onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>We found {slides.length} slide{slides.length === 1 ? '' : 's'}</span>
            {deckName && <span style={{ fontSize: 12, color: SOFT }}>from {deckName}</span>}
            <button style={{ ...plainBtn, marginLeft: 'auto' }} onClick={() => patch({ deckSlides: null, deckName: null })}>Use a different deck</button>
          </div>

          {truncated && (
            <p style={{ fontSize: 12.5, color: '#8a5a00', background: '#fff4dd', padding: '8px 10px', borderRadius: 8, margin: '0 0 10px' }}>
              That deck was long — we kept the first {slides.length}. The rest weren’t included.
            </p>
          )}
          {imageOnly > 0 && (
            <p style={{ fontSize: 12.5, color: '#8a5a00', background: '#fff4dd', padding: '8px 10px', borderRadius: 8, margin: '0 0 10px' }}>
              {imageOnly} slide{imageOnly === 1 ? '' : 's'} look like pictures with no text — we can only restyle slides that have words, so {imageOnly === 1 ? 'it' : 'they'} will be skipped.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
            {slides.map((s) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: `1px solid ${LINE}`, borderRadius: 8, background: s.imageOnly ? '#faf8f4' : 'white' }}>
                <span style={{ width: 26, flexShrink: 0, fontSize: 12, fontWeight: 800, color: SOFT }}>{s.n}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.imageOnly ? <span style={{ color: SOFT, fontWeight: 400, fontStyle: 'italic' }}>Picture slide (no text — will be skipped)</span> : (s.heading || 'Untitled slide')}
                  </div>
                  {!s.imageOnly && s.bullets.length > 0 && (
                    <div style={{ fontSize: 11.5, color: SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.bullets.join(' · ')}</div>
                  )}
                </div>
                <button onClick={() => dropSlide(s.n)} aria-label="Remove slide"
                  style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 11, border: 'none', background: LINE, color: INK, fontSize: 13, cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: INK, margin: '12px 0 0', background: `${MINT}33`, padding: '8px 10px', borderRadius: 8 }}>
            {drawable} slide{drawable === 1 ? '' : 's'} will be restyled. Pick the new look next.
          </p>
        </>
      )}

      {err && <p style={{ fontSize: 12.5, color: '#B4432F', margin: '10px 0 0' }}>{err}</p>}
    </div>
  )
}
