'use client'

import { useRef, useState } from 'react'
import type { DeckSlide } from '../../_lib/deck-split'
import { INK, SOFT, LINE, MINT, card, plainBtn } from './ui'

/**
 * Upload a deck you ALREADY have → parse it into slides → confirm before
 * spending. Storing the parsed slides on wizard state flips the deck flow on
 * (skip the brief chat, fix sizes to slide, draw one styled slide per slide).
 *
 * This is ONE option on the Content step, not a required "restyle" — a deck user
 * usually wants a NEW deck (described/pasted); uploading an existing one is just
 * a shortcut. Framed accordingly.
 */
export function DeckRestyle({ deckSlides, deckName, patch }: {
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
    // quick client-side guards so a bad/huge file fails INSTANTLY with a message
    // instead of spinning on "Reading your deck…" forever.
    const nm = (file.name || '').toLowerCase()
    const okType = nm.endsWith('.pptx') || nm.endsWith('.ppt') || nm.endsWith('.pdf') || file.type === 'application/pdf'
    if (!okType) { setErr('Upload a PowerPoint (.pptx) or PDF deck.'); return }
    if (file.size > 40 * 1024 * 1024) { setErr('That file is over 40MB — try a smaller one.'); return }
    setErr(''); setTruncated(false); setBusy(true)
    // hard timeout so the spinner can NEVER hang forever (server cap is 120s;
    // give the round-trip a little more, then abort with a clear message).
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 130_000)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/deck-parse', { method: 'POST', body: fd, signal: ctrl.signal })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(data?.error || 'Could not read that deck.'); return }
      patch({ deckSlides: data.slides as DeckSlide[], deckName: data.name as string })
      setTruncated(Boolean(data.truncated))
    } catch (e) {
      setErr((e as { name?: string })?.name === 'AbortError'
        ? 'That took too long to read. Try a smaller deck, or export it again as a PDF.'
        : 'Something went wrong reading the file.')
    } finally {
      clearTimeout(timer)
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const slides = deckSlides ?? []
  // Removing a slide RENUMBERS the rest (1..N). Without this, deleting slide 3
  // left the list reading 1,2,4,5 — and the generated slides carried the same
  // gaps ("Slide 4" with no Slide 3 anywhere in the deck).
  const dropSlide = (n: number) =>
    patch({ deckSlides: slides.filter((s) => s.n !== n).map((s, i) => ({ ...s, n: i + 1 })) })
  const imageOnly = slides.filter((s) => s.imageOnly).length
  const drawable = slides.length - imageOnly

  return (
    <div style={{ ...card, marginTop: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: INK, marginBottom: 4 }}>Already have a deck? Upload it instead</div>
      <p style={{ fontSize: 12.5, color: SOFT, margin: '0 0 12px', lineHeight: 1.5, maxWidth: 620 }}>
        Optional. Drop a PowerPoint or PDF and we keep your words and redraw every slide in the look you pick next — you get back a matching set (and a PDF).
      </p>

      {!slides.length ? (
        <label onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files?.[0]) }}
          style={{ display: 'block', border: `1.5px dashed ${LINE}`, borderRadius: 10, padding: '22px 16px', textAlign: 'center', cursor: 'pointer', color: SOFT, fontSize: 13 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>📊</div>
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
            {/* Parsing a big deck takes real time — one misclick must not throw
                it away silently. */}
            <button style={{ ...plainBtn, marginLeft: 'auto' }} onClick={() => {
              if (!confirm('Remove these slides and upload a different deck? You’d need to upload and read it again.')) return
              patch({ deckSlides: null, deckName: null })
            }}>Use a different deck</button>
          </div>

          {truncated && (
            <p style={{ fontSize: 12.5, color: '#8a5a00', background: '#fff4dd', padding: '8px 10px', borderRadius: 8, margin: '0 0 10px' }}>
              That deck was long — we kept the first {slides.length}. The rest weren’t included.
            </p>
          )}
          {imageOnly > 0 && (
            <p style={{ fontSize: 12.5, color: '#8a5a00', background: '#fff4dd', padding: '8px 10px', borderRadius: 8, margin: '0 0 10px' }}>
              {imageOnly} slide{imageOnly === 1 ? '' : 's'} look like pictures with no text — we can only redraw slides that have words, so {imageOnly === 1 ? 'it' : 'they'} will be skipped.
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
            {drawable} slide{drawable === 1 ? '' : 's'} will be redrawn. Pick the new look next.
          </p>
        </>
      )}

      {err && <p style={{ fontSize: 12.5, color: '#B4432F', margin: '10px 0 0' }}>{err}</p>}
    </div>
  )
}
