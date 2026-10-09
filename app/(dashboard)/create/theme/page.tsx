'use client'

// STEP 3 — "THE LOOK" (/create/theme). "Pick a look.": the look cards three
// across, ONE settings line ("Sarah · music on · standard  Change") and a
// "More options" fold (voice, music, video or presentation, length, photo
// backgrounds, things for your client, the price lines). The bottom bar holds
// the price, the free preview and Make it — the one button that spends.
//
// The price is never worked out here. It comes from /api/price-quote, which
// uses the same functions generate-video and generate-presentation charge
// with, reading the same saved draft. Before starting the job this page saves
// every choice to the draft, re-reads the price, and stops if it changed.

import { Suspense, useEffect, useRef, useState } from 'react'
import { Button, Note } from '../../../_components/kit'
import { useRouter, useSearchParams } from 'next/navigation'
import BuyCreditsModal from '../../../_components/BuyCreditsModal'
import { createClient } from '../../../_lib/supabase/client'
import { VOICE_OPTIONS } from '../../../_lib/types'
// Types only — the price helper itself is server code and never runs here.
import type { MakeOutput } from '../../../_lib/price-quote'
import { LookPicker, OutputPicker, VoicePicker } from '../_components/make/Pickers'
import { usePriceQuote, formatCredits } from '../_components/make/usePriceQuote'
import { isPresLook, isVideoLook, lookCards, PRES_LOOKS, RECOMMENDED_VIDEO_LOOK, type VideoLookId } from '../_components/make/looks'
// The same list the story step chooses from — one set of names for both.
import { LENGTHS, LENGTH_ANCHOR } from '../_components/story/lengths'
import BottomBar from '../_components/workspace/BottomBar'
import { settingsLine } from '../_components/workspace/facts'
import FirstScenePreview, { useFirstScenePreview } from '../_components/make/FirstScenePreview'
import AddBrandPiece from '../_components/make/AddBrandPiece'
import { D2V_OUTPUTS, d2vOutputs } from '../../../_lib/videos-only'
// Drawn slides' drawing styles (pure data — safe in the browser).
import { DEFAULT_DRAW_STYLE, DRAW_STYLES, isDrawStyle, type DrawStyleId } from '../../../_lib/drawn-slides'
// The new scene engine (KIT_ENGINE=on): which card saves which kit look (pure data).
import { cardForDraft, previewLookFor, RETIRED_WITH_KIT, styleForCard } from '../../../_lib/kit-looks'

type Draft = Record<string, any>
type BrandInfo = { id: string; name: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null; accent_color: string | null }

const DEFAULT_VOICE = VOICE_OPTIONS[0].id // Sarah (nova) — CLAUDE.md rule 5

// Docs2Video makes a narrated video or an interactive presentation (videos-only.ts).
// An old draft saved as a slide deck / PowerPoint / PDF opens as a video.
function normalizeOutput(v: unknown): MakeOutput | null {
  return v === 'video' || v === 'interactive' ? v : null
}

export default function ThemePage() {
  return (
    <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner" /></div>}>
      <MakeItYours />
    </Suspense>
  )
}

function MakeItYours() {
  const router = useRouter()
  const params = useSearchParams()
  const videoId = params.get('id')

  const { quote, error: quoteError, loading: quoteLoading, refresh } = usePriceQuote(videoId)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandInfo | null>(null)
  // "Add your brand" inside the project (light start). Opens by itself when
  // the person has no brand at all yet — their first project.
  const [addingBrand, setAddingBrand] = useState(false)

  const [output, setOutput] = useState<MakeOutput>('video')
  const [videoLook, setVideoLook] = useState<VideoLookId>(RECOMMENDED_VIDEO_LOOK)
  // Is the new scene engine on? (env KIT_ENGINE=on, asked once.) Off = the old looks, unchanged.
  const [kitOn, setKitOn] = useState(false)
  useEffect(() => {
    let alive = true
    fetch('/api/kit-engine').then((r) => r.json()).then((j) => { if (alive) setKitOn(!!j?.on) }).catch(() => {})
    return () => { alive = false }
  }, [])
  // With the kit on, Aurora / Cinematic / Infographic are no longer offered.
  useEffect(() => {
    if (kitOn && (RETIRED_WITH_KIT as readonly string[]).includes(videoLook)) setVideoLook(RECOMMENDED_VIDEO_LOOK)
  }, [kitOn, videoLook])
  const chosenStyle = styleForCard(videoLook, kitOn)
  const [presLook, setPresLook] = useState<string>(PRES_LOOKS[0].id)
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE)
  const [aiMusic, setAiMusic] = useState(false)
  const [slidePhotos, setSlidePhotos] = useState(false) // Animated slides look: photo backgrounds (opt-in, slower)
  const [drawStyle, setDrawStyle] = useState<DrawStyleId>(DEFAULT_DRAW_STYLE) // Drawn slides look: 3D / Illustrated / Classic
  const [allowSourceDownload, setAllowSourceDownload] = useState(false)
  const [agentNote, setAgentNote] = useState('')

  const [lightbox, setLightbox] = useState<string | null>(null)
  // "More options" — voice, music, what to make, length, extras, the price lines.
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDetailsElement>(null)
  const previewRef = useRef<HTMLElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false) // stops a double-click before React re-renders
  const [error, setError] = useState<{ message: string; topUp?: boolean } | null>(null)
  const [buyCredits, setBuyCredits] = useState<{ needed?: number; balance?: number } | null>(null)

  // ── Load the draft (and restore every choice saved on it) ──
  useEffect(() => {
    if (!videoId) { setLoading(false); return }
    let alive = true
    fetch(`/api/videos/draft?videoId=${encodeURIComponent(videoId)}`)
      .then(async (r) => {
        const v = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(v?.error || 'Could not load your project.')
        return v
      })
      .then(async (v) => {
        if (!alive) return
        const d: Draft = v?.draft_data || {}
        setDraft(d)
        setOutput(normalizeOutput(v?.output_type) ?? normalizeOutput(d.outputType) ?? 'video')
        { const card = cardForDraft(d.videoStyle, d.kitLook); if (isVideoLook(card)) setVideoLook(card) }
        if (isPresLook(d.presentationTemplate)) setPresLook(d.presentationTemplate)
        if (typeof d.voiceId === 'string' && VOICE_OPTIONS.some((o) => o.id === d.voiceId)) setVoiceId(d.voiceId)
        if (typeof d.aiMusic === 'boolean') setAiMusic(d.aiMusic)
        if (typeof d.slidePhotos === 'boolean') setSlidePhotos(d.slidePhotos)
        if (isDrawStyle(d.drawStyle)) setDrawStyle(d.drawStyle)
        setAllowSourceDownload(!!d.allowSourceDownload)
        setAgentNote(typeof d.agentNote === 'string' ? d.agentNote : '')

        // The brand this project will use. A brand picked on the brand page
        // (or an explicit "no brand" — brandId: null) wins; otherwise it's the
        // default brand on the person's profile. Whatever is shown here is
        // saved to the draft and sent, so both make routes use the same one.
        const supabase = createClient()
        const cols = 'id, name, logo_url, primary_color, secondary_color, accent_color'
        let found: BrandInfo | null = null
        if (typeof d.brandId === 'string' && d.brandId) {
          const { data } = await supabase.from('brands').select(cols).eq('id', d.brandId).maybeSingle()
          found = (data as BrandInfo | null) ?? null
        } else if (d.brandId === undefined) {
          const { data: auth } = await supabase.auth.getUser()
          if (auth.user) {
            const { data } = await supabase.from('brands').select(cols)
              .eq('user_id', auth.user.id)
              .order('is_default', { ascending: false })
              .order('created_at', { ascending: true })
              .limit(1)
            found = ((data as BrandInfo[] | null) ?? [])[0] ?? null
          }
        }
        // Loading ends only now, so Make can never run before the brand is known.
        if (alive) {
          setBrand(found)
          setAddingBrand(!found && d.brandId === undefined)
          setLoading(false)
        }
      })
      .catch((e) => { if (alive) { setLoadError(e instanceof Error ? e.message : 'Could not load your project.'); setLoading(false) } })
    return () => { alive = false }
  }, [videoId])

  const isPres = output === 'interactive'
  const isVideo = output === 'video'
  const narrated = output === 'video' || output === 'interactive'
  const shown = quote?.options?.[output] ?? null

  // Only estimates the app already gives on the progress screen.
  const timeNote = isVideo
    ? (chosenStyle.videoStyle === 'kit'
        ? 'Usually 5–10 minutes. You can leave while it works.'
        : videoLook === 'slides'
        ? `Usually about 10 minutes${slidePhotos ? ', plus 2–3 for photo backgrounds' : ''}. You can leave while it works.`
        : videoLook === 'drawn'
          ? 'Usually about 4–6 minutes. You can leave while it works.'
          : 'Usually about 3–5 minutes. You can leave while it works.')
    : null

  async function handleMake() {
    if (!videoId || !draft || !shown || inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    setError(null)
    const stop = (e: { message: string; topUp?: boolean } | null) => { setError(e); setSubmitting(false); inFlight.current = false }

    try {
      // Presentations don't report "add a card" on their own — send people to
      // the card page first, and back here afterwards (the same place the video
      // route's card_required answer sends them).
      if (isPres && quote?.blockedReason === 'card_required') {
        router.push(`/setup-payment?next=${encodeURIComponent(`/create/theme?id=${videoId}`)}`)
        return
      }

      // 1. Save every choice on the draft. The server prices from the draft,
      //    so this is what makes the charge match what was chosen here.
      const note = agentNote.trim()
      const save = await fetch('/api/videos/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          updates: {
            outputType: output,
            voiceId,
            aiMusic,
            videoStyle: chosenStyle.videoStyle,
            // The scene kit's look ('animated-slides' | 'editorial' | 'bright'), when the kit engine is on.
            ...(chosenStyle.kitLook ? { kitLook: chosenStyle.kitLook } : {}),
            // Drawn slides only: its drawing style (3D infographic / Illustrated / Classic).
            ...(videoLook === 'drawn' ? { drawStyle } : {}),
            presentationTemplate: presLook,
            slidePhotos,
            // Make the brand shown on this screen the draft's explicit choice.
            ...(brand && draft.brandId === undefined ? { brandId: brand.id } : {}),
            allowSourceDownload,
            agentNote: note || undefined,
          },
        }),
      })
      if (!save.ok) {
        const g = await save.json().catch(() => ({}))
        return stop({ message: g.error || 'We couldn’t save your choices. Please try again.' })
      }

      // 2. Re-read the price from the saved draft. If it moved, show the new
      //    one and let the person press again — never charge a surprise.
      const fresh = await refresh()
      const freshTotal = fresh?.options?.[output]?.total
      if (freshTotal === undefined) return stop({ message: 'We couldn’t check the price just now. Please try again.' })
      if (freshTotal !== shown.total) {
        return stop({ message: `The price changed to ${formatCredits(freshTotal)}. Check it, then press Make it again.` })
      }

      // 3. Start the job.
      if (isPres) {
        const res = await fetch('/api/generate-presentation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, templateId: presLook, outputType: output }),
        })
        if (!res.ok) {
          const g = await res.json().catch(() => ({}))
          // No card yet (e.g. the quote was read before the card check): add
          // one, then come back here.
          if (g.code === 'card_required') {
            router.push(`/setup-payment?next=${encodeURIComponent(`/create/theme?id=${videoId}`)}`)
            return
          }
          if (res.status === 402 && g.code === 'insufficient_credits') {
            setBuyCredits({ needed: g.needed, balance: g.balance })
            return stop({ message: g.error || 'Not enough credits.', topUp: true })
          }
          return stop({ message: g.error || 'We couldn’t start it. Please try again.' })
        }
        router.push(`/create/generating?id=${videoId}&style=${presLook}`)
        return
      }

      const genRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          outputType: output,
          videoStyle: chosenStyle.videoStyle,
          ...(chosenStyle.kitLook ? { kitLook: chosenStyle.kitLook } : {}),
          ...(videoLook === 'drawn' ? { drawStyle } : {}),
          policyData: draft.extractedData || {},
          purpose: draft.purpose || 'Create a professional video',
          recipientName: draft.recipientName || undefined,
          preGeneratedScenes: draft.scenes || [],
          // The brand shown on this screen (null = none).
          brandId: brand?.id || undefined,
          voiceId,
          narrationStyle: 'solo',
          detailLevel: draft.detailLevel,
          industry: draft.extractedData?.industry || 'general',
          aiMusic,
          musicPrompt: aiMusic ? 'Professional ambient background music, subtle and warm' : undefined,
          styleId: draft.styleId || undefined,
          customStylePrompt: draft.customStylePrompt || undefined,
          presenterIntro: draft.presenterIntro || undefined,
          introduceInOpening: draft.introduceInOpening,
          showContactClosing: draft.showContactClosing,
          photoPlacement: draft.photoPlacement || undefined,
          slidePhotos,
          allowSourceDownload,
          agentNote: note || undefined,
          sourcePdfPath: draft.sourcePdfPath || undefined,
          sourcePdfName: draft.sourcePdfName || undefined,
        }),
      })
      if (!genRes.ok) {
        const g = await genRes.json().catch(() => ({}))
        // Free/trial accounts must save a card first. ONLY for card_required —
        // "not enough credits" used to go to the card page too, which sent
        // people straight back here, forever.
        if (g.code === 'card_required') {
          router.push(`/setup-payment?next=${encodeURIComponent(`/create/theme?id=${videoId}`)}`)
          return
        }
        if (g.code === 'insufficient_credits') {
          setBuyCredits({ needed: g.needed, balance: g.balance })
          return stop({ message: g.error || 'You don’t have enough credits for this.', topUp: true })
        }
        // One-at-a-time limit, "already being made", failed payment… the
        // server's own words are written for people.
        return stop({ message: g.error || 'We couldn’t start it. Please try again.' })
      }
      router.push(`/create/generating?id=${videoId}&style=${videoLook}`)
    } catch {
      stop({ message: 'Connection lost. Please check your internet and try again.' })
    }
  }

  // FREE FIRST-SCENE PREVIEW (FirstScenePreview.tsx, 3 free a day per
  // account): the button sits in the bottom bar beside Make it, the picture
  // on the page. It previews the choices on screen right now.
  const preview = useFirstScenePreview({ videoId: videoId ?? '', output, look: isPres ? presLook : previewLookFor(videoLook, kitOn), drawStyle: !isPres && videoLook === 'drawn' ? drawStyle : undefined, voiceId })
  // Bring the preview into view when it starts, so the wait is seen.
  useEffect(() => {
    if (preview.busy) previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [preview.busy])

  function openMore() {
    setMoreOpen(true)
    // After the fold opens, bring it into view.
    window.setTimeout(() => moreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  if (loading) {
    return (
      <div className="cf-page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner" /></div>
      </div>
    )
  }
  if (!videoId || loadError) {
    return (
      <div className="cf-page">
        <h1 className="cf-h1">We couldn’t find this project.</h1>
        <p className="cf-hint">{loadError || 'Start a new one and it will be saved as you go.'}</p>
        <div className="cf-buttons">
          <button type="button" className="kit-btn kit-btn--secondary" onClick={() => router.push('/create')}>Start a project</button>
        </div>
      </div>
    )
  }

  const started = quote && !quote.startable
  const length = LENGTHS.find((l) => l.id === (quote?.detailLevel ?? draft?.detailLevel)) ?? null
  const makeLabel = 'Make it'
  const balance = quote?.balance ?? null
  const total = shown?.total ?? null
  const after = total !== null && balance !== null ? balance - total : null
  const short = !shown?.free && after !== null && after < 0
  const topUp = () => setBuyCredits((b) => b ?? { balance: quote?.balance })

  // The bar's left side: the price in big words, from the server's quote.
  const barInfo = shown
    ? (shown.free ? 'Free' : formatCredits(shown.total))
    : (quoteError ? 'No price yet' : '…')
  const barSub = shown
    ? (shown.free
        ? 'Your account isn’t charged for this.'
        : after !== null && after >= 0
          ? `${formatCredits(after).replace(/ credits?$/, '')} left after`
          : balance !== null ? `You have ${formatCredits(balance)}` : null)
    : (quoteError || 'Working out the price…')

  // One message beside the button at a time, the one that matters most.
  const notice = started ? (
    <Note tone="info" action={<button type="button" className="cf-link" onClick={() => router.push(`/create/generating?id=${videoId}`)}>See its progress</button>}>
      This one has already been started. Open it to see how it’s going.
    </Note>
  ) : error ? (
    <Note tone="stop">
      {error.message}
      {error.topUp ? (<> <button type="button" className="cf-link" onClick={topUp}>Top up credits</button></>) : null}
    </Note>
  ) : quote?.blockedReason === 'card_required' ? (
    // LIGHT START: an account with no card reaches this screen and the free
    // preview; the card is asked for only now, for the real thing.
    <Note tone="warn">Add a card to start your free trial. We’ll take you there when you press Make it, then bring you back here. The free preview doesn’t need one.</Note>
  ) : short ? (
    <Note tone="warn">
      You need {formatCredits(-(after as number))} more.{' '}
      <button type="button" className="cf-link" onClick={topUp}>Top up credits</button>
    </Note>
  ) : null

  const cards = lookCards(output, { kit: kitOn })

  return (
    <div className="cf-page">
      <h1 className="cf-h1">Pick a <em>look.</em></h1>

      <LookPicker
        cards={cards}
        value={isPres ? presLook : videoLook}
        onChange={(id) => {
          if (isPres) { if (isPresLook(id)) setPresLook(id) }
          else if (isVideoLook(id)) setVideoLook(id)
        }}
        onZoom={setLightbox}
        note={timeNote}
      >
        {isVideo && videoLook === 'drawn' ? (
          <div className="cf-row cf-draw-styles">
            <span className="cf-row-name">Drawing style</span>
            <div className="cf-chips" role="radiogroup" aria-label="Drawing style">
              {DRAW_STYLES.map((st) => (
                <button key={st.id} type="button" role="radio" aria-checked={drawStyle === st.id} className="cf-chip" onClick={() => setDrawStyle(st.id)} title={st.hint}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a small sample of this style */}
                  <img className="cf-chip-thumb" src={`/style-samples/drawn-${st.id}.png`} alt="" loading="lazy" />
                  {st.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </LookPicker>

      <FirstScenePreview ref={previewRef} preview={preview} />

      {/* Everything else, in one line. "Change" opens More options. */}
      <div className="cf-card cf-quick">
        <span data-testid="settings-line">{settingsLine({ output, voiceId, aiMusic, length: isVideo ? (length?.name ?? null) : null })}</span>
        <button type="button" className="cf-link" onClick={openMore} aria-controls="more-options">Change</button>
      </div>

      {/* The brand in use, with a way to change it — one slim line. */}
      <div className="cf-card cf-brand">
        {brand?.logo_url ? <img className="cf-brand-logo" src={brand.logo_url} alt="" /> : null}
        {brand ? (
          <span className="cf-brand-dots" aria-hidden>
            {[brand.primary_color, brand.secondary_color, brand.accent_color].filter(Boolean).map((c, i) => (
              <span key={i} className="cf-brand-dot" style={{ background: c as string }} />
            ))}
          </span>
        ) : null}
        <span className="cf-brand-text">
          {brand
            ? <>Using <strong>{brand.name}</strong>’s logo and colors.</>
            : <>No brand on this one yet — it will use plain colors.</>}
        </span>
        {brand ? (
          <button type="button" className="cf-link" onClick={() => router.push(`/create/brand?id=${videoId}`)}>Change</button>
        ) : (
          <button type="button" className="cf-link" aria-expanded={addingBrand} onClick={() => setAddingBrand((o) => !o)}>Add your brand</button>
        )}
      </div>
      {!brand && addingBrand && videoId ? (
        <AddBrandPiece
          videoId={videoId}
          draft={draft}
          onClose={() => setAddingBrand(false)}
          onSaved={(b) => {
            setBrand(b)
            setDraft((d) => ({ ...(d ?? {}), brandId: b.id }))
            setAddingBrand(false)
          }}
        />
      ) : null}

      <details
        id="more-options"
        ref={moreRef}
        className="cf-card cf-more"
        open={moreOpen}
        onToggle={(e) => setMoreOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>More options</summary>
        <div className="cf-more-in">
          {narrated ? (
            <div className="cf-row">
              <span className="cf-row-name">Voice</span>
              <VoicePicker value={voiceId} onChange={setVoiceId} />
            </div>
          ) : null}

          {isVideo ? (
            <div className="cf-row">
              <span className="cf-row-name">Music</span>
              <div className="cf-chips" role="radiogroup" aria-label="Background music">
                <button type="button" role="radio" aria-checked={aiMusic} className="cf-chip" onClick={() => setAiMusic(true)}>On <small>soft, under the voice</small></button>
                <button type="button" role="radio" aria-checked={!aiMusic} className="cf-chip" onClick={() => setAiMusic(false)}>Off</button>
              </div>
            </div>
          ) : null}

          <div className="cf-row">
            <span className="cf-row-name">Make</span>
            <OutputPicker
              offered={d2vOutputs(quote?.offered ?? D2V_OUTPUTS)}
              value={output}
              onChange={(o) => { setOutput(o); setError(null) }}
              options={quote?.options ?? null}
            />
          </div>

          {isVideo ? (
            <div className="cf-row">
              <span className="cf-row-name">Length</span>
              <span className="cf-hint" style={{ color: 'var(--ink)' }}>
                {length ? <><strong>{length.name}</strong> · {length.minutes}</> : 'Standard'}
              </span>
              {/* Lands on the length choice on the story step, not the top of the page. */}
              <button type="button" className="cf-link" onClick={() => router.push(`/create/script?id=${videoId}#${LENGTH_ANCHOR}`)}>Change the length</button>
            </div>
          ) : null}

          {isVideo && videoLook === 'slides' && !kitOn ? (
            <div className="cf-row">
              <span className="cf-row-name">Photos</span>
              <label className="cf-toggle">
                <input type="checkbox" checked={slidePhotos} onChange={(e) => setSlidePhotos(e.target.checked)} />
                <span>
                  Add photo backgrounds
                  <small>Photo backdrops behind each slide. Looks richer, but adds about 2–3 minutes. Same price.</small>
                </span>
              </label>
            </div>
          ) : null}

          {/* Share-page extras (videos and presentations both have a share page). */}
          <div className="cf-row" style={{ alignItems: 'flex-start' }}>
            <span className="cf-row-name">For your client</span>
            <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {draft?.sourcePdfPath ? (
                <label className="cf-toggle">
                  <input type="checkbox" checked={allowSourceDownload} onChange={(e) => setAllowSourceDownload(e.target.checked)} />
                  <span>
                    Let them download the original PDF
                    <small>Adds a “Download original document” button to the share page{draft?.sourcePdfName ? ` (${draft.sourcePdfName})` : ''}.</small>
                  </span>
                </label>
              ) : null}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>A note to your client</span>
                <textarea
                  className="cf-input"
                  value={agentNote}
                  onChange={(e) => setAgentNote(e.target.value.slice(0, 400))}
                  placeholder="A short personal message shown above it on the share page…"
                  rows={3}
                />
                <span className="cf-hint" style={{ fontSize: 'var(--fs-small)' }}>{agentNote.length}/400</span>
              </label>
            </div>
          </div>

          {/* What's in the price — the server's own lines. */}
          <div className="cf-row" style={{ alignItems: 'flex-start' }}>
            <span className="cf-row-name">Price</span>
            {shown ? (
              <div className="cf-price-lines" aria-label="What’s in the price">
                {shown.lines.map((l) => (
                  <div key={l.label} className="cf-price-line"><span>{l.label}</span><span>{formatCredits(l.credits)}</span></div>
                ))}
                <div className="cf-price-line is-total"><span>Total</span><span>{formatCredits(shown.total)}</span></div>
                {!shown.free && balance !== null ? <span className="cf-hint" style={{ fontSize: 'var(--fs-small)' }}>You have {formatCredits(balance)}.</span> : null}
              </div>
            ) : (
              <span className="cf-hint">{quoteError || 'Working out the price…'}</span>
            )}
          </div>
        </div>
      </details>

      <BuyCreditsModal
        open={!!buyCredits}
        onClose={() => { setBuyCredits(null); void refresh() }}
        needed={buyCredits?.needed}
        balance={buyCredits?.balance}
      />

      {lightbox ? (
        <div className="cf-lightbox" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a sample picture, larger */}
          <img src={lightbox} alt="Sample" />
        </div>
      ) : null}

      <BottomBar
        label="The price"
        info={barInfo}
        sub={barSub}
        notice={notice}
        helper={
          <span className="cf-main">
            <Button
              variant="secondary"
              className="cf-helper-btn"
              onClick={() => void preview.make()}
              disabled={preview.busy || preview.noneLeft}
              aria-busy={preview.busy || undefined}
              disabledReason={preview.disabledReason}
              title={preview.leftLabel ?? undefined}
            >
              {preview.label}
            </Button>
          </span>
        }
        onMain={handleMake}
        mainLabel={submitting ? 'Starting…' : makeLabel}
        disabled={submitting || !!started}
        busy={submitting}
        missing={submitting || started ? null : !shown || quoteLoading ? { reason: quoteError || 'Working out the price…' } : null}
      />
    </div>
  )
}
