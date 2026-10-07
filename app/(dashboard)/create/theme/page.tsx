'use client'

// STEP 3 — MAKE IT YOURS. One screen: the look, what to send, the voice, and
// the price with the one button that spends credits.
//
// The price is never worked out here. It comes from /api/price-quote, which
// uses the same functions generate-video and generate-presentation charge
// with, reading the same saved draft. Before starting the job this page saves
// every choice to the draft, re-reads the price, and stops if it changed.

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import BuyCreditsModal from '../../../_components/BuyCreditsModal'
import { createClient } from '../../../_lib/supabase/client'
import { VOICE_OPTIONS } from '../../../_lib/types'
// Types only — the price helper itself is server code and never runs here.
import type { MakeOutput } from '../../../_lib/price-quote'
import s from '../_components/make/make.module.css'
import PricePanel from '../_components/make/PricePanel'
import { OutputPicker, PresLookPicker, VideoLookPicker, VoicePicker } from '../_components/make/Pickers'
import { usePriceQuote, formatCredits } from '../_components/make/usePriceQuote'
import { isPresLook, isVideoLook, PRES_LOOKS, type VideoLookId } from '../_components/make/looks'
// The same list the story step chooses from — one set of names for both.
import { LENGTHS, LENGTH_ANCHOR } from '../_components/story/lengths'
import Workspace from '../_components/workspace/Workspace'
import { clientLabel, factsFromDraft, lookName, voiceName } from '../_components/workspace/facts'
import FirstScenePreview from '../_components/make/FirstScenePreview'

type Draft = Record<string, any>
type BrandInfo = { id: string; name: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null; accent_color: string | null }

const DEFAULT_VOICE = VOICE_OPTIONS[0].id // Sarah (nova) — CLAUDE.md rule 5

function normalizeOutput(v: unknown): MakeOutput | null {
  return v === 'video' || v === 'pptx' || v === 'pdf' || v === 'interactive' || v === 'deck' ? v : null
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

  const [output, setOutput] = useState<MakeOutput>('video')
  const [videoLook, setVideoLook] = useState<VideoLookId>('slides')
  const [presLook, setPresLook] = useState<string>(PRES_LOOKS[0].id)
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE)
  const [aiMusic, setAiMusic] = useState(false)
  const [slidePhotos, setSlidePhotos] = useState(false) // Slide Deck look: photo backgrounds (opt-in, slower)
  const [allowSourceDownload, setAllowSourceDownload] = useState(false)
  const [agentNote, setAgentNote] = useState('')

  const [lightbox, setLightbox] = useState<string | null>(null)
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
        if (isVideoLook(d.videoStyle)) setVideoLook(d.videoStyle)
        if (isPresLook(d.presentationTemplate)) setPresLook(d.presentationTemplate)
        if (typeof d.voiceId === 'string' && VOICE_OPTIONS.some((o) => o.id === d.voiceId)) setVoiceId(d.voiceId)
        if (typeof d.aiMusic === 'boolean') setAiMusic(d.aiMusic)
        if (typeof d.slidePhotos === 'boolean') setSlidePhotos(d.slidePhotos)
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
        if (alive) { setBrand(found); setLoading(false) }
      })
      .catch((e) => { if (alive) { setLoadError(e instanceof Error ? e.message : 'Could not load your project.'); setLoading(false) } })
    return () => { alive = false }
  }, [videoId])

  const isPres = output === 'interactive' || output === 'deck'
  const isVideo = output === 'video'
  const narrated = output === 'video' || output === 'interactive'
  const shown = quote?.options?.[output] ?? null

  // Only estimates the app already gives on the progress screen.
  const timeNote = isVideo
    ? (videoLook === 'slides'
        ? `Usually about 10 minutes${slidePhotos ? ', plus 2–3 for photo backgrounds' : ''}. You can leave while it works.`
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
            videoStyle: videoLook,
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
          videoStyle: videoLook,
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

  if (loading) {
    return (
      <Workspace soFar={factsFromDraft(null)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner" /></div>
      </Workspace>
    )
  }
  if (!videoId || loadError) {
    return (
      <div className={s.page}>
        <h1 className={s.title}>We couldn’t find this project.</h1>
        <p className={s.lead}>{loadError || 'Start a new one and it will be saved as you go.'}</p>
        <button type="button" className="btn btn-primary" onClick={() => router.push('/create')}>Start a project</button>
      </div>
    )
  }

  const started = quote && !quote.startable
  const length = LENGTHS.find((l) => l.id === (quote?.detailLevel ?? draft?.detailLevel)) ?? null
  const makeLabel = isPres ? (output === 'deck' ? 'Make the deck' : 'Make it') : 'Make it'

  // "Your video so far": the saved draft, with this screen's choices on top
  // (they're only saved when Make it is pressed, but the summary should
  // already show them).
  const soFar = factsFromDraft(draft, {
    client: clientLabel(draft) ?? (draft?.clientId ? 'Your client' : 'No client — general'),
    output,
    look: lookName(output, isPres ? presLook : videoLook),
    voice: narrated ? voiceName(voiceId) : 'None — silent slides',
    price: { kind: 'quote', credits: shown?.total ?? null, free: shown?.free, loading: quoteLoading },
  })

  // FREE FIRST-SCENE PREVIEW (FirstScenePreview.tsx, 3 free a day per
  // account) — mounted right above the Make it button, given the choices on
  // screen so it previews what is picked right now.
  const firstScenePreview = videoId
    ? <FirstScenePreview videoId={videoId} output={output} look={isPres ? presLook : videoLook} voiceId={voiceId} />
    : null

  return (
    <Workspace
      soFar={soFar}
      side={
        <PricePanel
          quote={shown}
          balance={quote?.balance ?? null}
          quoteError={quoteError}
          loading={quoteLoading || !!started}
          blockedReason={quote?.blockedReason ?? null}
          submitting={submitting}
          submitLabel={makeLabel}
          timeNote={timeNote}
          error={started
            ? { message: 'This one has already been started. Open it to see how it’s going.' }
            : error}
          onMake={handleMake}
          onTopUp={() => setBuyCredits((b) => b ?? { balance: quote?.balance })}
          preview={firstScenePreview}
        />
      }
    >
    <div className={s.page}>
      <button type="button" className={s.back} onClick={() => router.push(`/create/script?id=${videoId}`)}>&larr; Back to the story</button>

      <div>
        <div>
          <h1 className={s.title}>Make it <em>yours.</em></h1>
          <p className={s.lead}>Pick the look, what to send and the voice. Your logo and colors come from your brand.</p>

          {/* Brand in use, with a way to change it */}
          <div className={s.brand}>
            {brand?.logo_url ? <img className={s.brandLogo} src={brand.logo_url} alt="" /> : null}
            {brand ? (
              <div className={s.brandDots} aria-hidden>
                {[brand.primary_color, brand.secondary_color, brand.accent_color].filter(Boolean).map((c, i) => (
                  <span key={i} className={s.brandDot} style={{ background: c as string }} />
                ))}
              </div>
            ) : null}
            <div className={s.brandText}>
              {brand
                ? <>Using <strong>{brand.name}</strong>’s logo and colors.</>
                : <>No brand on this one yet — it will use plain colors.</>}
            </div>
            <button type="button" className={s.link} onClick={() => router.push(`/create/brand?id=${videoId}`)}>
              {brand ? 'Change' : 'Add your brand'}
            </button>
          </div>

          <section className={s.section}>
            <div className={s.sectionHead}>
              <h2 className={s.sectionTitle}>What do you want to send?</h2>
              <span className={s.sectionHint}>pick one — each project makes one of these</span>
            </div>
            <OutputPicker
              offered={quote?.offered ?? ['video', 'interactive', 'deck']}
              value={output}
              onChange={(o) => { setOutput(o); setError(null) }}
              options={quote?.options ?? null}
            />
          </section>

          <section className={s.section}>
            <div className={s.sectionHead}>
              <h2 className={s.sectionTitle}>The look</h2>
              <span className={s.sectionHint}>{isPres ? 'for the presentation' : 'for the video'}</span>
            </div>
            {isPres
              ? <PresLookPicker value={presLook} onChange={setPresLook} />
              : <VideoLookPicker value={videoLook} onChange={setVideoLook} onZoom={setLightbox} />}
            {isVideo && videoLook === 'slides' ? (
              <label className={s.toggleRow}>
                <input type="checkbox" checked={slidePhotos} onChange={(e) => setSlidePhotos(e.target.checked)} />
                <span>
                  <span className={s.toggleTitle}>Add photo backgrounds</span>
                  <span className={s.toggleDesc}>Photo backdrops behind each slide. Looks richer, but adds about 2–3 minutes. Same price.</span>
                </span>
              </label>
            ) : null}
          </section>

          {narrated ? (
            <section className={s.section}>
              <div className={s.sectionHead}>
                <h2 className={s.sectionTitle}>The voice</h2>
                <span className={s.sectionHint}>press ▶ to hear a sample</span>
              </div>
              <VoicePicker value={voiceId} onChange={setVoiceId} />
              {isVideo ? (
                <label className={s.toggleRow}>
                  <input type="checkbox" checked={aiMusic} onChange={(e) => setAiMusic(e.target.checked)} />
                  <span>
                    <span className={s.toggleTitle}>Background music</span>
                    <span className={s.toggleDesc}>Soft music under the voice that fades in and out. Same price.</span>
                  </span>
                </label>
              ) : null}
            </section>
          ) : null}

          {isVideo ? (
            <section className={s.section}>
              <div className={s.sectionHead}>
                <h2 className={s.sectionTitle}>Length</h2>
                <span className={s.sectionHint}>chosen with your story</span>
              </div>
              <div className={s.chips}>
                {LENGTHS.map((l) => (
                  <span key={l.id} className={`${s.chip} ${length?.id === l.id ? s.chipOn : ''}`} style={{ cursor: 'default', opacity: length?.id === l.id ? 1 : 0.55 }}>
                    {l.name} <span className={s.chipSub}>{l.minutes}</span>
                  </span>
                ))}
              </div>
              <p className={s.note}>
                The story is written at this length, so changing it means rewriting the story — that&rsquo;s free.{' '}
                {/* Lands on the length choice on the story step, not the top of the page. */}
                <button type="button" className={s.link} onClick={() => router.push(`/create/script?id=${videoId}#${LENGTH_ANCHOR}`)}>Change the length</button>
              </p>
            </section>
          ) : null}

          {/* Share-page extras. The slide deck is private (no share page). */}
          {output !== 'deck' ? (
            <section className={s.section}>
              <details className={s.details} open={!!agentNote || allowSourceDownload}>
                <summary>For your client <span className={s.sectionHint}>(optional)</span></summary>
                {draft?.sourcePdfPath ? (
                  <label className={s.toggleRow}>
                    <input type="checkbox" checked={allowSourceDownload} onChange={(e) => setAllowSourceDownload(e.target.checked)} />
                    <span>
                      <span className={s.toggleTitle}>Let them download the original PDF</span>
                      <span className={s.toggleDesc}>Adds a “Download original document” button to the share page{draft?.sourcePdfName ? ` (${draft.sourcePdfName})` : ''}.</span>
                    </span>
                  </label>
                ) : null}
                <label style={{ display: 'block', marginTop: 12 }}>
                  <span className={s.toggleTitle}>A note to your client</span>
                  <textarea
                    className={s.textarea}
                    value={agentNote}
                    onChange={(e) => setAgentNote(e.target.value.slice(0, 400))}
                    placeholder="A short personal message shown above it on the share page…"
                    rows={3}
                  />
                  <span className={s.sectionHint}>{agentNote.length}/400</span>
                </label>
              </details>
            </section>
          ) : null}
        </div>

      </div>

      {started ? (
        <p className={s.note} style={{ textAlign: 'right' }}>
          <button type="button" className={s.link} onClick={() => router.push(`/create/generating?id=${videoId}`)}>See its progress</button>
        </p>
      ) : null}

      <BuyCreditsModal
        open={!!buyCredits}
        onClose={() => { setBuyCredits(null); void refresh() }}
        needed={buyCredits?.needed}
        balance={buyCredits?.balance}
      />

      {lightbox ? (
        <div className={s.lightbox} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Sample" />
        </div>
      ) : null}
    </div>
    </Workspace>
  )
}
