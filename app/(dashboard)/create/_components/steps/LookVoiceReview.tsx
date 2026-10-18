'use client'

// STEPS 4, 6 AND 8 — "The look" (/create/style), "Voice" (/create/voice) and
// "Review" (/create/review). One screen's code, one job at a time (the
// approved redesign, 2026-10-18):
//
//   look    video or presentation, the look cards, your own look (a picture
//           you like: /create/look), the free first-scene preview
//   voice   the narrator (press ▶ to hear one), music, the length (set on the
//           Scenes step), photo backgrounds
//   review  everything at a glance with a Change for each step, things for
//           your client, the price lines, the free preview and Make it — the
//           one button that spends
//
// Every step's choices are saved to the draft before moving on, and read back
// from it on arrival, so Back and Next never lose one.
//
// The price is never worked out here. It comes from /api/price-quote, which
// uses the same functions generate-video and generate-presentation charge
// with, reading the same saved draft. Before starting the job this page saves
// every choice to the draft, re-reads the price, and stops if it changed.

import { StepExplain } from './StepExplain'
import { TemplatePicker } from '../make/TemplatePicker'
import { DEFAULT_VIDEO_TEMPLATE, VIDEO_TEMPLATES, isVideoTemplate, videoTemplate, type VideoTemplateId } from '../../../../_lib/video-templates'
import { Suspense, useEffect, useRef, useState } from 'react'
import { usePasteImage, pasteKeyLabel } from '../../../../_components/usePasteImage'
import { holdPastedReference } from '../../../../_components/look/pasted-reference'
import { Button, Note } from '../../../../_components/kit'
import { useRouter, useSearchParams } from 'next/navigation'
import BuyCreditsModal from '../../../../_components/BuyCreditsModal'
import { createClient } from '../../../../_lib/supabase/client'
import { VOICE_OPTIONS } from '../../../../_lib/types'
// Types only — the price helper itself is server code and never runs here.
import type { MakeOutput } from '../../../../_lib/price-quote'
import { LookPicker, OutputPicker, VoicePicker } from '../make/Pickers'
import { usePriceQuote, formatCredits } from '../make/usePriceQuote'
import { CREATE_LOOK_CARD, isPresLook, isVideoLook, lookCards, PRES_LOOKS, RECOMMENDED_VIDEO_LOOK, type VideoLookId, type YourLook } from '../make/looks'
// The same list the story step chooses from — one set of names for both.
import { LENGTHS, LENGTH_ANCHOR } from '../story/lengths'
import { sceneSeconds } from '../story/bookends'
import BottomBar from '../workspace/BottomBar'
import { lookName, settingsLine } from '../workspace/facts'
import { neighbours, stepPath, STEPS, type StepKey } from '../workspace/steps'
import FirstScenePreview, { useFirstScenePreview } from '../make/FirstScenePreview'
import AddBrandPiece from '../make/AddBrandPiece'
import { D2V_OUTPUTS, d2vOutputs } from '../../../../_lib/videos-only'
// Drawn slides' drawing styles (pure data — safe in the browser).
import { DEFAULT_DRAW_STYLE, DRAW_STYLES, isDrawStyle, type DrawStyleId } from '../../../../_lib/drawn-slides'
// The new scene engine (KIT_ENGINE=on): which card saves which kit look (pure data).
import { cardForDraft, previewLookFor, RETIRED_WITH_KIT, styleForCard } from '../../../../_lib/kit-looks'
import { voiceNote, type SpeakAs, type PresenterVoice } from '../../../../_lib/narration-pov'

type Draft = Record<string, any>
type BrandInfo = { id: string; name: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null; accent_color: string | null; brand_guide_data?: Record<string, unknown> | null; profile_type?: string | null; intro_line?: string | null }

/** A saved look (the look screen) as step 3 needs it: the whole settings object, copied at Make time. */
type FullLook = YourLook & Record<string, unknown>
const asLook = (v: unknown): FullLook | null => (v && typeof v === 'object' && !Array.isArray(v) && (v as YourLook).colors && typeof (v as YourLook).colors === 'object' ? v as FullLook : null)

const DEFAULT_VOICE = VOICE_OPTIONS[0].id // Sarah (nova) — CLAUDE.md rule 5

// Docs2Video makes a narrated video or an interactive presentation (videos-only.ts).
// An old draft saved as a slide deck / PowerPoint / PDF opens as a video.
function normalizeOutput(v: unknown): MakeOutput | null {
  return v === 'video' || v === 'interactive' ? v : null
}

export default function LookVoiceReview({ part }: { part: 'look' | 'voice' | 'review' }) {
  return (
    <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner" /></div>}>
      <MakeItYours part={part} />
    </Suspense>
  )
}

function MakeItYours({ part }: { part: 'look' | 'voice' | 'review' }) {
  const router = useRouter()
  const params = useSearchParams()
  const videoId = params.get('id')
  const stepKey: StepKey = part === 'look' ? 'look' : part === 'voice' ? 'voice' : 'review'
  const { prev, next } = neighbours(stepKey)
  // Where Make sends people to add a card, and back here afterwards.
  const backHere = videoId ? stepPath('review', videoId) : '/create'

  const { quote, error: quoteError, loading: quoteLoading, refresh } = usePriceQuote(videoId)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandInfo | null>(null)
  // "Add your brand" inside the project (light start). Opens by itself when
  // the person has no brand at all yet — their first project.
  const [addingBrand, setAddingBrand] = useState(false)
  // "Your look": this project's own copy (draft.kitLookCustom), else the brand's saved look.
  const [yourLook, setYourLook] = useState<FullLook | null>(null)

  const [output, setOutput] = useState<MakeOutput>('video')
  const [videoLook, setVideoLook] = useState<VideoLookId>(RECOMMENDED_VIDEO_LOOK)
  // Is the new scene engine on? (env KIT_ENGINE=on, asked once.) Off = the old looks, unchanged.
  const [kitOn, setKitOn] = useState(false)
  const [kitKnown, setKitKnown] = useState(false)
  useEffect(() => {
    let alive = true
    fetch('/api/kit-engine').then((r) => r.json()).then((j) => { if (alive) setKitOn(!!j?.on) }).catch(() => {}).finally(() => { if (alive) setKitKnown(true) })
    return () => { alive = false }
  }, [])
  // With the kit on, Aurora / Cinematic / Infographic are no longer offered.
  useEffect(() => {
    if (kitOn && (RETIRED_WITH_KIT as readonly string[]).includes(videoLook)) setVideoLook(RECOMMENDED_VIDEO_LOOK)
    // "Your look" is a scene-kit look: with the kit off it isn't offered.
    if (kitKnown && !kitOn && videoLook === 'custom') setVideoLook(RECOMMENDED_VIDEO_LOOK)
  }, [kitOn, kitKnown, videoLook])
  const chosenStyle = styleForCard(videoLook, kitOn)
  // ONE OF THE EIGHT TEMPLATES (video-templates.ts), or none — a look below.
  const [templateId, setTemplateId] = useState<VideoTemplateId | null>(null)
  // The Look step's tabs (layout B): Templates · Match a picture · My looks.
  const [lookTab, setLookTab] = useState<'templates' | 'picture' | 'mine'>('templates')
  const [presLook, setPresLook] = useState<string>(PRES_LOOKS[0].id)
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE)
  const [aiMusic, setAiMusic] = useState(false)
  const [slidePhotos, setSlidePhotos] = useState(false) // Animated slides look: photo backgrounds (opt-in, slower)
  const [drawStyle, setDrawStyle] = useState<DrawStyleId>(DEFAULT_DRAW_STYLE) // Drawn slides look: 3D / Illustrated / Classic
  const [allowSourceDownload, setAllowSourceDownload] = useState(false)
  const [agentNote, setAgentNote] = useState('')

  const [lightbox, setLightbox] = useState<string | null>(null)
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
        const cols = 'id, name, logo_url, primary_color, secondary_color, accent_color, brand_guide_data'
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
        // Is it a person's brand (for the voice note)? Its own query: a column
        // this read lacks must never cost the page its brand — with no brand
        // the video would be made from the account's profile instead.
        if (found) {
          const { data: who } = await supabase.from('brands').select('profile_type, intro_line').eq('id', found.id).maybeSingle()
          if (who) found = { ...found, ...(who as Pick<BrandInfo, 'profile_type' | 'intro_line'>) }
        }
        // Loading ends only now, so Make can never run before the brand is known.
        if (alive) {
          const own = d.kitLook === 'custom' ? asLook(d.kitLookCustom) : null
          const mine = own ?? asLook(found?.brand_guide_data?.video_look)
          setYourLook(mine)
          // "Your look" is picked by default when the brand has one and nothing else was chosen yet.
          if (mine && (d.kitLook === 'custom' || !d.videoStyle)) setVideoLook('custom')
          else if (!mine && d.kitLook === 'custom') setVideoLook(RECOMMENDED_VIDEO_LOOK)
          // A template chosen before; else a look chosen before (or the brand's
          // own look) opens My looks; else a new video starts on a template.
          if (isVideoTemplate(d.templateId)) { setTemplateId(d.templateId); setLookTab('templates') }
          else if (d.videoStyle || d.kitLook === 'custom' || mine) setLookTab('mine')
          else { setTemplateId(DEFAULT_VIDEO_TEMPLATE); setLookTab('templates') }
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

  /**
   * Save every choice on the draft. The server prices from the draft, so
   * this is what makes the charge match what was chosen; it is also what
   * carries each step's choices to the next (steps 4, 6 and 8 read them back
   * from the draft). Returns the problem, or null when saved.
   */
  async function saveChoices(): Promise<string | null> {
    if (!videoId || !draft) return 'We couldn’t find this project.'
    const note = agentNote.trim()
    try {
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
            // "Your look": a COPY goes on this video now, so editing the look later never changes it.
            ...(chosenStyle.kitLook === 'custom' && yourLook ? { kitLookCustom: yourLook } : {}),
            // Drawn slides only: its drawing style (3D infographic / Illustrated / Classic).
            ...(videoLook === 'drawn' ? { drawStyle } : {}),
            // The template, or none (a look) — videos only.
            templateId: isVideo ? templateId : null,
            presentationTemplate: presLook,
            slidePhotos,
            // Make the brand shown on this screen the draft's explicit choice.
            ...(brand && draft.brandId === undefined ? { brandId: brand.id } : {}),
            allowSourceDownload,
            agentNote: note || undefined,
            // The step to come back to (the dashboard's "continue"): the next one, or this review.
            step: STEPS.findIndex((s) => s.key === (next?.key ?? 'review')) + 1,
          },
        }),
      })
      if (!save.ok) {
        const g = await save.json().catch(() => ({}))
        return g.error || 'We couldn’t save your choices. Please try again.'
      }
      return null
    } catch {
      return 'Connection lost. Please check your internet and try again.'
    }
  }

  /** Next on steps 4 and 6: save, then the next step. */
  async function goNext() {
    if (!videoId || !next || inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    setError(null)
    const problem = await saveChoices()
    if (problem) { setError({ message: problem }); setSubmitting(false); inFlight.current = false; return }
    router.push(stepPath(next.key, videoId))
  }

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
        router.push(`/setup-payment?next=${encodeURIComponent(backHere)}`)
        return
      }

      // 1. Save every choice on the draft (saveChoices).
      const note = agentNote.trim()
      const problem = await saveChoices()
      if (problem) return stop({ message: problem })

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
            router.push(`/setup-payment?next=${encodeURIComponent(backHere)}`)
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
          templateId: isVideo ? templateId : null,
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
          router.push(`/setup-payment?next=${encodeURIComponent(backHere)}`)
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

  // Wait for the engine answer too: until it comes, the cards (and what Make
  // would send) could be the old engine's — a slow answer must never start a
  // video on the wrong engine. A failed answer counts as known (kit off).
  /* Hooks before the early returns below (rules of hooks). */
  const openLookScreen = () => router.push(`/create/look?id=${encodeURIComponent(videoId ?? "")}`)
  /* A picture pasted on the Look step becomes the reference on the look screen (pasted-reference). */
  const [pasteKey, setPasteKey] = useState('Ctrl+V')
  useEffect(() => { void Promise.resolve().then(() => setPasteKey(pasteKeyLabel())) }, [])
  usePasteImage((f) => { setLookTab('picture'); void holdPastedReference(f).then(openLookScreen) }, part === 'look' && kitOn && isVideo)

  if (loading || !kitKnown) {
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

  const cards = lookCards(output, { kit: kitOn, yourLook: kitOn ? yourLook : null })
  const back = prev ? { href: stepPath(prev.key, videoId), label: prev.label } : null
  const lengthHref = `${stepPath('scenes', videoId)}#${LENGTH_ANCHOR}`

  /* A template is chosen for this video (the free preview draws looks, not templates). */
  const templateOn = isVideo && !!templateId
  const chosenTemplate = templateOn ? videoTemplate(templateId) : null
  /* The free preview, beside Next (look) or Make it (review). */
  const previewButton = (
    <span className="cf-main">
      <Button
        variant="secondary"
        className="cf-helper-btn"
        onClick={() => void preview.make()}
        disabled={preview.busy || preview.noneLeft || templateOn}
        aria-busy={preview.busy || undefined}
        disabledReason={templateOn ? 'Templates show their scenes on the card: press ▶ on it.' : preview.disabledReason}
        title={preview.leftLabel ?? undefined}
      >
        {preview.label}
      </Button>
    </span>
  )

  /* The brand in use, with a way to change it — one slim line. */
  const brandLine = (
    <>
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
          <button type="button" className="cf-link" onClick={() => router.push(stepPath('brand', videoId))}>Change</button>
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
    </>
  )

  /* What's in the price — the server's own lines. */
  const priceLines = shown ? (
    <div className="cf-price-lines" aria-label="What’s in the price">
      {shown.lines.map((l) => (
        <div key={l.label} className="cf-price-line"><span>{l.label}</span><span>{formatCredits(l.credits)}</span></div>
      ))}
      <div className="cf-price-line is-total"><span>Total</span><span>{formatCredits(shown.total)}</span></div>
      {!shown.free && balance !== null ? <span className="cf-hint" style={{ fontSize: 'var(--fs-small)' }}>You have {formatCredits(balance)}.</span> : null}
    </div>
  ) : (
    <span className="cf-hint">{quoteError || 'Working out the price…'}</span>
  )

  /* Step 8's summary: every step at a glance, each with its Change. */
  const scenesSaved: unknown[] = Array.isArray(draft?.scenes) ? draft!.scenes : []
  const sceneSecs = scenesSaved.reduce((n: number, s: unknown) => n + sceneSeconds(s), 0)
  const sceneMins = Math.max(1, Math.round(sceneSecs / 60))
  const openerWords = draft?.introduceInOpening === false && draft?.showContactClosing === false
    ? 'No introduction, no contact on the closing'
    : [draft?.introduceInOpening !== false ? 'You’re introduced at the start' : null, draft?.showContactClosing !== false ? 'your contact on the closing' : null].filter(Boolean).join(' · ')
  const summary: { key: StepKey; label: string; value: string }[] = [
    { key: 'content', label: 'Made from', value: draft?.sourcePdfName || draft?.title || 'Your content' },
    { key: 'story', label: 'Story', value: draft?.brief?.angle ? `“${draft.brief.angle}”` : 'Written from your content' },
    { key: 'brand', label: 'Brand', value: brand?.name ?? 'No brand — plain colors' },
    { key: 'look', label: 'Look', value: (isPres ? lookName('interactive', presLook) : chosenTemplate ? `${chosenTemplate.name} template` : videoLook === 'custom' ? 'Your look' : lookName('video', videoLook)) ?? 'Picked for you' },
    { key: 'scenes', label: 'Scenes', value: scenesSaved.length ? `${scenesSaved.length} scenes${isVideo && sceneSecs > 0 ? ` · about ${sceneMins} minute${sceneMins === 1 ? '' : 's'}` : ''}` : 'Not written yet' },
    { key: 'voice', label: 'Voice', value: settingsLine({ output, voiceId, aiMusic, length: isVideo ? (length?.name ?? null) : null }) },
    { key: 'opening', label: 'Opener & close', value: openerWords || 'As your brand sets it' },
  ]

  const heads = {
    look: { h: <>Choose a <em>look</em></>, lede: '' },
    voice: { h: <>Voice <em>&amp; music.</em></>, lede: 'Who tells it, and whether music plays under it. Press ▶ to hear a voice.' },
    review: { h: <>Check it, <em>then make it.</em></>, lede: 'Everything at a glance. Change any step, see the first scene for free, then press Make it — the only button that spends.' },
  }[part]

  return (
    <div className="cf-page cf-step" data-step={part}>
      <StepExplain step={part} />
      <h1 className="cf-h1">{heads.h}</h1>

      {part === 'look' ? (
        <div className="cf-lookstep">
          {/* LAYOUT B (2026-10-18): the kinds of look as tabs; the brand and video/presentation on the right. */}
          <div className="cf-lookbar">
            {isVideo ? (
              <div className="cf-tabs" role="tablist" aria-label="Kinds of look">
                <button type="button" role="tab" id="look-tab-templates" aria-controls="look-panel" aria-selected={lookTab === 'templates'} className="cf-tab" onClick={() => setLookTab('templates')}>
                  Templates <span className="cf-tab-count">{VIDEO_TEMPLATES.length}</span>
                </button>
                {kitOn ? (
                  <button type="button" role="tab" id="look-tab-picture" aria-controls="look-panel" aria-selected={lookTab === 'picture'} className="cf-tab" onClick={() => setLookTab('picture')}>Match a picture</button>
                ) : null}
                <button type="button" role="tab" id="look-tab-mine" aria-controls="look-panel" aria-selected={lookTab === 'mine'} className="cf-tab" onClick={() => setLookTab('mine')}>My looks</button>
              </div>
            ) : <span />}
            <div className="cf-lookbar-right">
              <span className="cf-brandchip" data-brand-chip>
                {brand?.logo_url
                  // eslint-disable-next-line @next/next/no-img-element -- the brand's own logo
                  ? <img className="cf-brandchip-mark" src={brand.logo_url} alt="" />
                  : <span className="cf-brandchip-mark" aria-hidden="true" />}
                Brand: <b>{brand?.name ?? 'None'}</b>
                {brand
                  ? <button type="button" className="cf-link" onClick={() => router.push(stepPath('brand', videoId))}>Change</button>
                  : <button type="button" className="cf-link" aria-expanded={addingBrand} onClick={() => setAddingBrand((o) => !o)}>Add</button>}
              </span>
              <OutputPicker
                compact
                offered={d2vOutputs(quote?.offered ?? D2V_OUTPUTS)}
                value={output}
                onChange={(o) => { setOutput(o); setError(null) }}
                options={quote?.options ?? null}
              />
            </div>
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

          <div id="look-panel" role={isVideo ? 'tabpanel' : undefined} aria-labelledby={isVideo ? `look-tab-${lookTab}` : undefined}>
          {isVideo && lookTab === 'templates' ? (
            <TemplatePicker
              templates={VIDEO_TEMPLATES}
              value={templateId}
              onChange={(id) => {
                setTemplateId(id)
                // A template is made by the explainer engine; Drawn slides is not.
                if (videoLook === 'drawn') setVideoLook(RECOMMENDED_VIDEO_LOOK)
              }}
            />
          ) : null}

          {isVideo && lookTab === 'picture' && kitOn ? (
            <div className="cf-card cf-picture" data-match-picture>
              <span className="cf-label">A picture you like</span>
              <p className="cf-hint">An ad, a slide, a poster or a website you like: every scene copies its colours, fonts and feel — never its words, logos or photos.</p>
              <p className="cf-hint"><b>Paste a screenshot:</b> copy a picture, then press <kbd>{pasteKey}</kbd> anywhere on this page.</p>
              <button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" onClick={openLookScreen}>Paste, drop or upload a picture</button>
              {preview.result && !preview.busy && videoLook !== 'custom' ? (
                <Note tone="info" action={<button type="button" className="cf-link" onClick={openLookScreen}>Make it match</button>}>
                  Make it match your brand? Pick your colours, fonts and feel — the preview plays your own scenes.
                </Note>
              ) : null}
            </div>
          ) : null}

          {!isVideo || lookTab === 'mine' ? (
          <div className="cf-main-col">
            <LookPicker
              cards={cards}
              value={isPres ? presLook : templateOn ? '' : videoLook}
              onChange={(id) => {
                if (isPres) { if (isPresLook(id)) setPresLook(id) }
                else if (id === CREATE_LOOK_CARD) openLookScreen()
                else if (isVideoLook(id)) { setVideoLook(id); setTemplateId(null) }
              }}
              onZoom={setLightbox}
              note={timeNote}
            >
              {isVideo && videoLook === 'custom' && yourLook ? (
                <p className="cf-hint"><button type="button" className="cf-link" onClick={openLookScreen}>Change this look</button></p>
              ) : null}
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

            {/* THE PICKED LOOK ON A COVER AND AN INSIDE PAGE (owner, 2026-10-18): every scene wears it, not just the first. */}
            {(() => {
              const picked = cards.find((c) => c.id === (isPres ? presLook : videoLook))
              const pages = picked?.samples ?? []
              return pages.length >= 2 ? (
                <div className="cf-look-pages" data-look-pages>
                  <figure>
                    <span className="cf-label">Cover</span>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a sample of this look */}
                    <img src={pages[0]} alt={`${picked?.name ?? 'This look'}: a cover`} loading="lazy" />
                    <figcaption>The first screen: title, who it is for, your photo or logo.</figcaption>
                  </figure>
                  <figure>
                    <span className="cf-label">Inside page</span>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a sample of this look */}
                    <img src={pages[1]} alt={`${picked?.name ?? 'This look'}: an inside page`} loading="lazy" />
                    <figcaption>Every scene after it, in the same look. Samples use made-up names; press Free preview to see your own.</figcaption>
                  </figure>
                </div>
              ) : (
                <p className="cf-hint" data-look-pages-none>{isPres ? 'Every slide of your presentation wears this look.' : 'Every scene of your video wears this look.'} Press <b>Free preview</b> to see your own cover and first scene in it.</p>
              )
            })()}
          </div>
          ) : null}
          </div>

          <FirstScenePreview ref={previewRef} preview={preview} />
        </div>
      ) : null}

      {part === 'voice' ? (
        <div className="cf-split">
          <div className="cf-main-col">
            {narrated ? (
              <div className="cf-row">
                <span className="cf-row-name">Voice</span>
                <VoicePicker value={voiceId} onChange={setVoiceId} />
              </div>
            ) : null}
            {narrated && brand?.profile_type === 'person' ? (() => {
              // WHO IS SPEAKING (app/_lib/narration-pov.ts): say it when this
              // voice cannot be the presenter they asked it to be.
              const note = voiceNote({
                presenterName: brand.name,
                speakAs: (draft?.speakAs as SpeakAs | undefined) ?? 'for',
                presenterVoice: (draft?.presenterVoice as PresenterVoice | undefined) ?? null,
                voiceId,
                intro: typeof draft?.presenterIntro === 'string' ? draft.presenterIntro : brand.intro_line,
              })
              return note ? <p className="cf-hint" role="status" data-testid="voice-note">{note}</p> : null
            })() : null}

            {isVideo ? (
              <div className="cf-row">
                <span className="cf-row-name">Music</span>
                <div className="cf-chips" role="radiogroup" aria-label="Background music">
                  <button type="button" role="radio" aria-checked={aiMusic} className="cf-chip" onClick={() => setAiMusic(true)}>On <small>soft, under the voice</small></button>
                  <button type="button" role="radio" aria-checked={!aiMusic} className="cf-chip" onClick={() => setAiMusic(false)}>Off</button>
                </div>
              </div>
            ) : null}

            {isVideo ? (
              <div className="cf-row">
                <span className="cf-row-name">Length</span>
                <span className="cf-hint" style={{ color: 'var(--ink)' }}>
                  {length ? <><strong>{length.name}</strong> · {length.minutes}</> : 'Standard'}
                </span>
                {/* Lands on the length choice on the Scenes step, not the top of the page. */}
                <button type="button" className="cf-link" onClick={() => router.push(lengthHref)}>Change the length</button>
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
          </div>
          <aside className="cf-side" aria-label="What you will hear">
            <div className="cf-card cf-side-card">
              <span className="cf-label">What you’ll hear</span>
              <span data-testid="settings-line">{settingsLine({ output, voiceId, aiMusic, length: isVideo ? (length?.name ?? null) : null })}</span>
              {timeNote ? <span className="cf-hint">{timeNote}</span> : null}
            </div>
          </aside>
        </div>
      ) : null}

      {part === 'review' ? (
        <div className="cf-split">
          <div className="cf-main-col">
            <dl className="cf-card cf-summary" aria-label="Your project">
              {summary.map((row) => (
                <div key={row.key} className="cf-summary-row">
                  <dt className="cf-label">{row.label}</dt>
                  <dd>{row.value}</dd>
                  <a className="cf-link" href={stepPath(row.key, videoId)} aria-label={`Change: ${row.label}`}>Change</a>
                </div>
              ))}
            </dl>

            {brandLine}

            <FirstScenePreview ref={previewRef} preview={preview} />

            {/* Share-page extras (videos and presentations both have a share page). */}
            <div className="cf-card cf-for-client">
              <span className="cf-label">On their watch page</span>
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
          <aside className="cf-side" aria-label="The price">
            <div className="cf-card cf-side-card">
              <span className="cf-label">The price</span>
              {priceLines}
              {timeNote ? <span className="cf-hint">{timeNote}</span> : null}
              <span className="cf-hint">If it can’t be made, every credit comes back.</span>
            </div>
          </aside>
        </div>
      ) : null}

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

      {part === 'review' ? (
        <BottomBar
          label="The price"
          info={barInfo}
          sub={barSub}
          notice={notice}
          back={back}
          helper={previewButton}
          onMain={handleMake}
          mainLabel={submitting ? 'Starting…' : makeLabel}
          disabled={submitting || !!started}
          busy={submitting}
          missing={submitting || started ? null : !shown || quoteLoading ? { reason: quoteError || 'Working out the price…' } : null}
        />
      ) : (
        <BottomBar
          label="Next step"
          info={barInfo}
          sub={barSub}
          notice={error ? <Note tone="stop">{error.message}</Note> : null}
          back={back}
          helper={part === 'look' ? previewButton : undefined}
          onMain={() => void goNext()}
          mainLabel={submitting ? 'Saving…' : `Next: ${next?.label ?? ''} →`}
          disabled={submitting}
          busy={submitting}
        />
      )}
    </div>
  )
}
