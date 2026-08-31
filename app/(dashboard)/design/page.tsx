'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { thumbUrl } from '../../_lib/flyer-engine'
import { useWizard } from './useWizard'
import { INK, SOFT, LINE, MINT, card, plainBtn, StepShell } from './ui'
import { useDictation } from '../../_components/useDictation'
import { downscaleDataUrl } from './downscale'
import type { Kind } from './useWizard'

// One-tap starters that show the kind of sentence that works best.
const STARTERS = [
  'A grand-opening flyer for my salon this Saturday',
  'An Instagram post for a new house listing',
  'A “now hiring” poster for my cafe',
  'A business card for a real-estate agent',
]

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
  const router = useRouter()

  // THE PROMPT HERO. One sentence → the AI drafts kind, look, words and sizes,
  // and the wizard opens as a review instead of a blank questionnaire.
  const [prompt, setPrompt] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftErr, setDraftErr] = useState('')
  const dictation = useDictation((t) => setPrompt((v) => (v ? v + ' ' : '') + t), { onError: (m) => setDraftErr(m) })

  const draftFromPrompt = async (text: string) => {
    const p = text.trim()
    if (!p || drafting) return
    setDrafting(true); setDraftErr('')
    try {
      const r = await fetch('/api/design-prefill', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: p }),
      }).then((x) => x.json())
      if (r?.error) { setDraftErr(r.error); return }
      // If the sentence named a website and it had a logo, bring it along as the
      // user's logo image (never auto-placed on the art — it rides into the job
      // so they can position it). Shrunk so it stores + survives to the generator.
      let sitePhotos: { dataUrl: string; role: 'logo'; name: string }[] = []
      if (typeof r.logoDataUrl === 'string' && r.logoDataUrl.startsWith('data:image')) {
        try {
          const dataUrl = await downscaleDataUrl(r.logoDataUrl, 900)
          sitePhotos = [{ dataUrl, role: 'logo', name: 'logo from site' }]
        } catch { /* a missing logo is never fatal to drafting */ }
      }
      // Seed the wizard with the AI's draft (all suggestions the user can change)
      // and mark which pieces were AI-guessed so the steps can badge them.
      patch({
        kind: r.kind, templateId: r.templateId, sizes: r.sizeIds ?? [],
        fields: r.fields ?? {}, note: p,
        // Colours read off a website the sentence named — tint the design to match.
        ...(Array.isArray(r.brandColors) && r.brandColors.length ? { brandColors: r.brandColors } : {}),
        ...(sitePhotos.length ? { photos: sitePhotos } : {}),
        aiSuggested: { kind: true, templateId: true, sizes: true, fields: true },
      })
      sessionStorage.setItem('design:walking', String(Date.now()))
      // Land on Content so they review the drafted words first (words drive the
      // look choice that comes next).
      router.push('/design/content')
    } catch {
      setDraftErr('Could not draft that just now — pick a tile below instead.')
    } finally {
      setDrafting(false)
    }
  }

  // AUTO-ADVANCE on a single tap — for EVERY kind, deck included. A deck is not
  // special: on the Content step you can describe it, paste notes, OR upload an
  // existing deck. Nothing to reveal here. The 250ms wait lets the mint selection
  // ring register so the jump doesn't feel like a misclick.
  const pickKind = (k: Kind) => {
    patch({ kind: k })
    sessionStorage.setItem('design:walking', String(Date.now()))
    // Go to Content first — say what it is, THEN pick a look that fits.
    setTimeout(() => router.push('/design/content'), 250)
  }

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
    // The mark carries WHEN it was set. Browsers that restore tabs keep
    // sessionStorage across a crash/restart, so a mark alone could shield a
    // days-old half-job from the reset ("my old logo and words came back").
    // A mark older than 12 hours is treated as no mark at all.
    const at = walking ? Number(walking) : 0
    const fresh = Number.isFinite(at) && at > 0 && Date.now() - at < 12 * 60 * 60 * 1000
    if (!fresh) reset() // new session (or a stale mark) → clean slate
    // Landing here always means we are back at the start; the walk mark is set
    // again as soon as the user advances (see the WHAT-step Next handler).
    sessionStorage.removeItem('design:walking')
  }, [ready, reset])

  if (!ready) return null

  // EVERY kind is ready once picked — a deck's slides are made later, on the
  // Content step (described, pasted or uploaded there). Requiring deckSlides
  // here blocked deck users on a step that has no way to create them.
  const nextReady = Boolean(state.kind)

  return (
    <StepShell
      title="What do you want to *make*?"
      subtitle="Pick one to start — then you’ll add your words (type it, paste it, upload a document, or let AI write it), choose a look, and pick sizes. You can change any of it later."
      next="/design/content"
      nextLabel="Next: your words"
      // Advancing off Step 1 begins the walk — mark it active (with WHEN, see
      // the reset guard above) so stepping BACK here doesn't wipe the job.
      onNext={() => sessionStorage.setItem('design:walking', String(Date.now()))}
      nextReady={nextReady}
      nextHint="Pick what you’re making"
      help={{
        title: 'Which one should I pick?',
        intro: 'Pick by where it ends up — you can change everything later.',
        points: [
          'Something to print — a flyer, poster, postcard, sign or business card you’ll print or hand out.',
          'A social graphic — a post or cover sized right for Instagram, Facebook or LinkedIn.',
          'A slide deck — a whole presentation, every slide matching, from your notes or a document.',
          'A set of sizes — the same design made in several sizes at once (flyer + post + banner).',
        ],
        example: 'Making a flyer AND an Instagram post from the same idea? Start with “A set of sizes”.',
      }}
    >
      {/* THE PICK COMES FIRST — the visual choice of what to make. This is the
          primary action; the "describe it" shortcut sits below for anyone who'd
          rather type. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
        {KINDS.map((k) => {
          const on = state.kind === k.kind
          return (
            <button key={k.kind} onClick={() => pickKind(k.kind)}
              style={{ ...card, padding: 0, overflow: 'hidden', textAlign: 'left', cursor: 'pointer',
                transition: 'box-shadow 180ms ease, border-color 180ms ease, transform 180ms ease',
                borderColor: on ? MINT : LINE, boxShadow: on ? `inset 0 0 0 2px ${MINT}` : 'none' }}>
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

      {/* THE SHORTCUT — describe it in a sentence and we draft the whole thing.
          Secondary to the tiles above, for anyone who'd rather just type. */}
      <div style={{ marginTop: 'var(--sp-6)', paddingTop: 'var(--sp-5)', borderTop: `1px solid ${LINE}` }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: SOFT, margin: '0 0 12px' }}>
          Or just describe it and skip ahead
        </div>
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 8,
          border: `1px solid ${LINE}`, borderRadius: 'var(--r-4)', background: 'white',
          padding: 8, boxShadow: '0 8px 30px rgba(35,32,28,0.08)',
        }}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void draftFromPrompt(prompt) } }}
            placeholder="Describe it in a sentence — e.g. a grand-opening flyer for my salon this Saturday. Or name a website (like jordyn.app) and I’ll pull its colours, logo and words."
            rows={2}
            disabled={drafting}
            aria-label="Describe what you want to make"
            style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent',
              font: 'inherit', fontSize: 16, color: INK, padding: '8px 8px', lineHeight: 1.5 }}
          />
          <button onClick={() => dictation.toggle()} disabled={drafting} aria-label={dictation.listening ? 'Stop talking' : 'Talk'}
            title={dictation.listening ? 'Stop' : 'Talk'}
            style={{ ...plainBtn, padding: '10px 12px', background: dictation.listening ? '#C0392B' : 'white', color: dictation.listening ? 'white' : INK }}>
            {dictation.transcribing ? '…' : dictation.listening ? '■' : '🎤'}
          </button>
          <button onClick={() => void draftFromPrompt(prompt)} disabled={drafting || !prompt.trim()}
            className="t2a-cta" style={{ opacity: drafting || !prompt.trim() ? 0.45 : 1 }}>
            {drafting ? 'Drafting…' : 'Draft it →'}
          </button>
        </div>
        {draftErr && <p role="alert" style={{ fontSize: 12.5, color: '#b91c1c', margin: '8px 2px 0' }}>{draftErr}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {STARTERS.map((s) => (
            <button key={s} onClick={() => { setPrompt(s); void draftFromPrompt(s) }} disabled={drafting}
              style={{ fontSize: 12.5, color: SOFT, background: 'white', border: `1px solid ${LINE}`,
                borderRadius: 'var(--r-3)', padding: '6px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </StepShell>
  )
}

