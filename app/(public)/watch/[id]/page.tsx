'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import type { Video, Brand } from '../../../_lib/types'
import type { ExtractedData } from '../../../_lib/extract-types'
import { INDUSTRIES } from '../../../_lib/industries'
import { salutationFor } from '../../../_lib/text-format'
import { shareTheme, shareThemeVars, type BrandColours } from '../../../_lib/share-theme'
import { WATCH_CSS, WatchHero, PresenterPanel, ChapterList, IconCheck, IconDownload, IconMail, IconPhone, IconCalendar, endStop, type WatchIdentity } from '../watch-view'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Who the video is from: the brand it was made with, else the account (app/_lib/video-sender.ts). */
interface AgentProfile {
  /** A person (photo first) or a company (logo first). */
  kind?: 'person' | 'company' | null
  /** The brand's colours; the page wears them (app/_lib/share-theme.ts). */
  colours?: BrandColours | null
  full_name: string | null
  company_name: string | null
  role?: string | null
  photo_url: string | null
  email: string | null
  phone?: string | null
  website?: string | null
  calendly_url: string | null
  payment_link_url?: string | null
  // Branding decisions made on the server; the agent's plan itself is private.
  white_label?: boolean
  free_tier?: boolean
}

/** Only real https links become buttons (never javascript: or plain http). */
function safeLink(url: unknown): string {
  const s = String(url ?? '').trim()
  if (!/^https:\/\//i.test(s)) return ''
  try { new URL(s); return s } catch { return '' }
}

/** 'video' | 'interactive' | 'deck' … (the shared Video type predates decks). */
function outputTypeOf(v: unknown): string {
  return String((v as { output_type?: unknown } | null)?.output_type ?? '')
}

interface VideoWithRelations extends Video {
  brand?: Brand
  infographic?: {
    policy_data: unknown
    source_pdf_url: string | null
  } | null
}

interface Quote {
  id: string
  video_id: string
  client_name: string | null
  notes: string | null
  line_items: { description: string; amount: number }[]
  subtotal: number
  tax: number
  total: number
  status: string
  paid_at: string | null
  created_at: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Before the video loads there is no brand to wear: the neutral theme. */
const NEUTRAL_STYLE = shareThemeVars(shareTheme(null)) as React.CSSProperties

const formatCents = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)


/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PublicWatchPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const [video, setVideo] = useState<VideoWithRelations | null>(null)
  const [agent, setAgent] = useState<AgentProfile | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [videoEnded, setVideoEnded] = useState(false)
  const [disclaimersOpen, setDisclaimersOpen] = useState(false)

  // "Ask a question" (from the deck's closing slide) — a real message emailed to
  // the presenter. Opens a small form; nothing is a dead button.
  const [askOpen, setAskOpen] = useState(false)
  const [askQuestion, setAskQuestion] = useState('')
  const [askEmail, setAskEmail] = useState('')
  const [askName, setAskName] = useState('')
  const [askSending, setAskSending] = useState(false)
  const [askSent, setAskSent] = useState(false)
  const [askError, setAskError] = useState('')
  // Spam guards (the server checks both): a field people never see, and how
  // long the form was open before Send.
  const [askTrap, setAskTrap] = useState('')
  const askOpenedAt = useRef(0)
  useEffect(() => { if (askOpen) askOpenedAt.current = Date.now() }, [askOpen])
  // Answers the agent APPROVED (never an AI draft) — shown under the video.
  const [answers, setAnswers] = useState<{ id: string; question: string; answer: string; answeredAt: string | null; from: string[] }[]>([])
  useEffect(() => {
    const vid = params.id as string
    if (!vid) return
    fetch(`/api/watch/${vid}/answers`)
      .then((r) => (r.ok ? r.json() : { answers: [] }))
      .then((j) => setAnswers(Array.isArray(j?.answers) ? j.answers : []))
      .catch(() => {})
  }, [params.id])

  // Lead capture state
  const [showLeadCapture, setShowLeadCapture] = useState(false)
  const [leadDismissed, setLeadDismissed] = useState(false)
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [leadEmail, setLeadEmail] = useState('')
  const [leadName, setLeadName] = useState('')
  const [leadSubmitting, setLeadSubmitting] = useState(false)
  const [leadError, setLeadError] = useState<string | null>(null)
  const leadTriggered = useRef(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const musicRef = useRef<HTMLAudioElement>(null)
  const viewTracked = useRef(false)
  const playTracked = useRef(false)
  const deckFrameRef = useRef<HTMLIFrameElement>(null)
  const milestonesTracked = useRef<Set<number>>(new Set())

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [musicVolume, setMusicVolume] = useState(0.01)
  const [musicMuted, setMusicMuted] = useState(false)

  // Sync music volume
  useEffect(() => {
    if (musicRef.current) {
      musicRef.current.volume = musicVolume
      musicRef.current.muted = musicMuted
    }
  }, [video?.music_url, musicVolume, musicMuted])

  // Interactive presentations: the deck's closing slide posts action clicks
  // up (deck PDF / video download / source PDF). Handle them here.
  useEffect(() => {
    const ot = outputTypeOf(video)
    if (!video || (ot !== 'interactive' && ot !== 'deck')) return
    const onMsg = (e: MessageEvent) => {
      // Only our own deck (served from this site) may trigger these actions.
      if (e.origin !== window.location.origin) return
      const d = e.data
      if (!d || d.type !== 'act') return
      if (d.kind === 'deck') window.open(`/api/public/deck-pdf/${video.id}`, '_blank')
      if (d.kind === 'video' && (video as any).export_video_url) window.open((video as any).export_video_url, '_blank')
      if (d.kind === 'chat') {
        // "Ask a question" — open the form that emails the presenter for real.
        setAskSent(false); setAskError(''); setAskOpen(true)
      }
      if (d.kind === 'pdf') {
        // The source PDF has its own visible button; bring it into view.
        document.querySelector('#wp-downloads')?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [video])

  // Pause music when tab is hidden, resume when visible
  useEffect(() => {
    function handleVisibility() {
      if (!musicRef.current || !videoRef.current) return
      if (document.hidden) {
        musicRef.current.pause()
      } else if (!videoRef.current.paused && video?.music_url) {
        musicRef.current.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [video?.music_url])
  const [showDisclosures, setShowDisclosures] = useState(false)

  const paid = searchParams.get('paid') === 'true'

  /* ---- Analytics helper ---- */
  // A link from a share email carries ?s=<that email's id>. It rides along in
  // every event so the owner's result page can say how far THAT person got.
  // Anything that isn't an email id is ignored (a forwarded or hand-typed
  // link just counts as a viewer on its own).
  const shareTag = (() => {
    const s = searchParams.get('s') ?? ''
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null
  })()
  const trackEvent = useCallback((videoId: string, event: string, metadata?: Record<string, unknown>) => {
    const meta = shareTag ? { ...(metadata ?? {}), share: shareTag } : metadata
    fetch('/api/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, event, metadata: meta }),
    }).catch(() => {})
  }, [shareTag])

  /* ---- Presentations: count a "play" on real interaction ---- */
  // A deck has no play button. It used to count a play the moment the iframe
  // LOADED — so every page load was a "play" and the numbers meant nothing.
  // Now it counts when the viewer first clicks or taps into the deck: focus
  // moves into the iframe, which the page sees as the window losing focus
  // while the iframe is the active element.
  useEffect(() => {
    const ot = outputTypeOf(video)
    if (!video || (ot !== 'interactive' && ot !== 'deck')) return
    const onBlur = () => {
      setTimeout(() => {
        if (!playTracked.current && deckFrameRef.current && document.activeElement === deckFrameRef.current) {
          playTracked.current = true
          trackEvent(video.id, 'play')
        }
      }, 0)
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [video, trackEvent])

  /* ---- Ask a question → real email to the presenter ---- */
  async function submitAsk() {
    if (!video) return
    const q = askQuestion.trim()
    if (!q) { setAskError('Type your question first.'); return }
    setAskSending(true); setAskError('')
    try {
      const r = await fetch(`/api/watch/${video.id}/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, fromEmail: askEmail.trim(), fromName: askName.trim(), website: askTrap, elapsedMs: Date.now() - askOpenedAt.current }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { setAskError(data?.error || 'Could not send your question. Please try again.'); return }
      setAskSent(true)
      trackEvent(video.id, 'question_asked', {})
    } catch {
      setAskError('Network problem — please try again.')
    } finally {
      setAskSending(false)
    }
  }

  /* ---- Data loading ---- */
  useEffect(() => {
    async function load() {
      // Server endpoint (service role) — works for logged-out recipients and
      // returns the agent profile + quote that the anon key can't read.
      let data: { video?: VideoWithRelations; agent?: AgentProfile | null; quote?: Quote | null } | null = null
      try {
        // Give up after 10 s so a dead link never spins forever.
        const ctl = new AbortController()
        const t = setTimeout(() => ctl.abort(), 10000)
        const res = await fetch(`/api/public/watch/${params.id as string}`, { signal: ctl.signal }).finally(() => clearTimeout(t))
        if (!res.ok) { setNotFound(true); return }
        data = await res.json()
      } catch {
        setNotFound(true)
        return
      }

      if (!data?.video) { setNotFound(true); return }
      const v = data.video as VideoWithRelations
      setVideo(v)
      if (data.agent) setAgent(data.agent as AgentProfile)
      if (data.quote) setQuote(data.quote as Quote)

      if (!viewTracked.current) {
        const sessionKey = `viewed_${v.id}`
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, '1')
          viewTracked.current = true
          trackEvent(v.id, 'view')
        } else {
          viewTracked.current = true
        }
      }
    }
    load()
  }, [params.id])

  /* ---- Slide tracking ---- */
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !video || videoDuration === 0) return
    // Slide tracking only for looks that save slide pictures. The watch
    // milestones below used to sit behind this same check, so every look
    // WITHOUT slide pictures (Aurora and others) never reported how far a
    // client got. They are now tracked for every video.
    const slideUrls = (video.slide_urls ?? []) as string[]
    const slideCount = slideUrls.length
    if (slideCount > 0) {
      const segmentDuration = videoDuration / slideCount
      const idx = Math.min(Math.floor(videoRef.current.currentTime / segmentDuration), slideCount - 1)
      setCurrentSlideIndex(idx)
    }

    // Track watch milestones (25%, 50%, 75%)
    {
      const pct = (videoRef.current.currentTime / videoDuration) * 100
      for (const milestone of [25, 50, 75]) {
        if (pct >= milestone && !milestonesTracked.current.has(milestone)) {
          milestonesTracked.current.add(milestone)
          trackEvent(video.id, 'progress', { percent: milestone })
        }
      }
    }

    // Trigger lead capture at 60% playback
    if (!leadTriggered.current && videoDuration > 0 && videoRef.current.currentTime / videoDuration >= 0.6) {
      leadTriggered.current = true
      setShowLeadCapture(true)
    }
  }, [video, videoDuration, trackEvent])

  const jumpToSlide = useCallback(
    (index: number) => {
      if (!videoRef.current || !video?.slide_urls) return
      const slideCount = (video.slide_urls as string[]).length
      if (slideCount === 0 || videoDuration === 0) return
      videoRef.current.currentTime = (videoDuration / slideCount) * index
    },
    [video, videoDuration],
  )

  /* ---- Pay ---- */
  // Opens the agent's own payment link (Stripe Payment Link / Square / PayPal)
  // set in Settings → Integrations, or a per-quote link from the pipeline. We do
  // NOT process the client's payment ourselves (no Stripe Connect).
  const handlePay = useCallback(() => {
    if (!video) return
    const link = safeLink(agent?.payment_link_url)
      || safeLink((video.script as any)?._pipeline_input?.paymentLink)
    if (!link) {
      setPayError('No payment link is set up yet. Please contact us to pay.')
      return
    }
    trackEvent(video.id, 'payment_click')
    window.open(link, '_blank', 'noopener,noreferrer')
  }, [agent, video, trackEvent])

  /* ---- Copy link ---- */
  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  /* ================================================================ */
  /*  RENDER — Not found                                               */
  /* ================================================================ */
  if (notFound) {
    return (
      <div className="wp-root" style={NEUTRAL_STYLE}>
        <style>{WATCH_CSS}</style>
        <div className="wp-center-screen">
          <div className="wp-not-found">
            <h1>We can&apos;t find this video</h1>
            <p>The link may be old, or the person who sent it took it down.</p>
            <p>Ask them to send you a fresh link.</p>
          </div>
        </div>
      </div>
    )
  }

  /* ================================================================ */
  /*  RENDER — Loading                                                 */
  /* ================================================================ */
  if (!video) {
    return (
      <div className="wp-root" style={NEUTRAL_STYLE}>
        <style>{WATCH_CSS}</style>
        <div className="wp-center-screen">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  /* ================================================================ */
  /*  Derived data                                                     */
  /* ================================================================ */
  // On client-facing share page, show company name first, then personal name
  const hasAgentIdentity = !!(agent?.company_name || agent?.full_name)
  // The PERSON comes first on a client-facing share page — an insurance client is
  // meeting Michele, not "Valor". Company is shown as the secondary line under the
  // name (and in the banner we lead with the person). Fall back to company only if
  // there's no full_name. (Was company-first, which showed "prepared for you by
  // Valor" and "Valor / Valor" on the agent card.)
  const agentName = agent?.full_name ?? agent?.company_name ?? video.title ?? 'Your Personalized Presentation'
  // The client this video was prepared for — powers the welcome banner. Prefer
  // the recorded recipient_name; fall back to the quote's client name.
  const clientName = ((video.recipient_name || quote?.client_name || '') as string).trim()
  // "Smith family", "Mr. Smith", "Jane" — never "Hi The," (text-format.ts).
  const clientFirstName = salutationFor(clientName)
  const agentEmail = agent?.email ?? ''
  const agentPhone = agent?.phone ?? ''
  const agentWebsite = safeLink(agent?.website && !/^https?:\/\//i.test(agent.website) ? `https://${agent.website}` : agent?.website)
  // The line under the name: their role, and the company when it isn't the name.
  const agentSecondary = [agent?.role, agent?.company_name && agent.company_name !== agentName ? agent.company_name : null].filter(Boolean).join(' · ')
  const agentInitials = hasAgentIdentity ? getInitials(agentName) : ''
  // Any https booking link gets the big button — Calendly, Cal.com, Acuity,
  // Google Calendar, a website page. It used to show only for calendly.com,
  // so everyone else's clients got just the small button.
  const calendlyUrl = safeLink(agent?.calendly_url)
  // The ONE booking link: a per-project link first, then the agent's own.
  const nextBooking = safeLink((video.script as any)?._pipeline_input?.bookingUrl) || calendlyUrl
  // What the next-step buttons call the agent: their name, else company,
  // else plain words (never the video's title).
  const agentShort = (agent?.full_name || agent?.company_name || '').trim() || 'the sender'
  // Can the recipient pay? True when the agent has a payment link (Stripe
  // Payment Link / Square / PayPal) or a per-quote link. No Stripe Connect.
  // Only a real https link counts — otherwise a Pay button appeared that
  // could only ever show "no payment link is set up".
  const hasStripe = !!(
    safeLink(agent?.payment_link_url)
    || safeLink((video?.script as any)?._pipeline_input?.paymentLink)
  )
  const hasQuote = !!(quote && quote.status !== 'paid')
  const hasPaidQuote = !!(quote && quote.status === 'paid')
  // Interactive presentations AND slide decks are HTML, shown in a frame.
  const isHtmlDeck = outputTypeOf(video) === 'interactive' || outputTypeOf(video) === 'deck'
  const slideUrls = (video.slide_urls ?? []) as string[]
  const slideCount = slideUrls.length
  const hasPdf = !!video.infographic?.source_pdf_url

  // White-label: hide Docs2Video branding for business/enterprise subscribers.
  // Show promo banner only for free tier. (Worked out on the server — the
  // agent's plan name is no longer sent to the public page.)
  const isWhiteLabel = agent?.white_label === true
  const isFreeTier = agent?.free_tier !== false

  // Insurance detection and disclaimers
  const pipelineInput = (video.script as any)?._pipeline_input
  const policyData = pipelineInput?.policyData
  const isInsurance = !!(policyData?.deathBenefit)
  const carrierDisclaimers: string[] = (video as any).disclaimers ?? policyData?.disclaimers ?? []

  // Industry-based disclosures
  const detectedIndustry = policyData?.industry as string | undefined
  const industryConfig = detectedIndustry && INDUSTRIES[detectedIndustry as keyof typeof INDUSTRIES]
    ? INDUSTRIES[detectedIndustry as keyof typeof INDUSTRIES]
    : isInsurance ? INDUSTRIES.insurance : null
  const hasDisclosures = !!(industryConfig?.disclaimerRequired && industryConfig.disclaimerText) || carrierDisclaimers.length > 0
  const createdDate = new Date(video.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  // The page wears the brand (app/_lib/share-theme.ts): its colours, corrected until they read.
  const themeStyle = shareThemeVars(shareTheme(agent?.colours ?? null)) as React.CSSProperties
  const who: WatchIdentity | null = hasAgentIdentity ? {
    kind: agent?.kind ?? null,
    name: agentName,
    secondary: agentSecondary,
    image: agent?.photo_url ?? null,
    initials: agentInitials,
  } : null
  // "In this video": the scenes' titles with the time each starts, once the
  // video knows its length (each scene is an equal part, as the slides are).
  const chapterItems: { time: string; title: string }[] = (() => {
    const scriptData = video.script as any
    const chapters: any[] = scriptData?._pipeline_input?.scenes ?? (Array.isArray(scriptData) ? scriptData : [])
    if (chapters.length === 0 || videoDuration === 0 || slideCount === 0) return []
    const segDuration = videoDuration / slideCount
    return chapters.map((ch: any, i: number) => {
      const t = segDuration * i
      return { time: `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`, title: String(ch?.title || `Scene ${i + 1}`) }
    })
  })()
  const kicker = [isHtmlDeck ? 'Presentation' : 'Video', createdDate].join(' · ')

  /* ================================================================ */
  /*  RENDER — Main page                                               */
  /* ================================================================ */
  return (
    <div className="wp-root" style={themeStyle}>
      <style>{WATCH_CSS}</style>

      {/* The hero: who it is from, who it is for, the title. "Powered by
          Docs2Video" is said ONCE, in the footer (audit 2026-10-09). */}
      <WatchHero
        who={who}
        forLine={clientName ? `Prepared for ${clientName}` : null}
        kicker={kicker}
        title={video.title}
        hello={clientFirstName ? <>Hi {clientFirstName} — {hasAgentIdentity ? <>prepared for you by <strong>{agentName}</strong></> : 'prepared just for you'}{endStop(hasAgentIdentity ? agentName : '')}</> : null}
      />

      <main className="wp-body">
        <div className="wp-wrap wp-grid">
          {/* ---- THE PLAYER ---- */}
          <div className="wp-a-player">
            {paid && (
              <div className="wp-paid"><IconCheck /> Payment received! Thank you.</div>
            )}
            {/* Slide decks ('deck') are HTML too — they used to fall through to
                the <video> element and show a broken player. The ?v= makes an
                edited deck show up right away instead of a cached old copy.
                A "play" is counted when the viewer actually clicks into the
                deck (see the effect above), not when the page merely loads. */}
            {isHtmlDeck ? (
              <div className="wp-video-wrap" style={{ aspectRatio: '16/9' }}>
                <iframe
                  ref={deckFrameRef}
                  src={`/api/public/presentation/${video.id}?share=1&v=${new Date(video.updated_at ?? video.created_at).getTime()}`}
                  title={video.title ?? 'Presentation'}
                  allowFullScreen
                  style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
                />
              </div>
            ) : (
              <div className="wp-video-wrap">
                <video
                  ref={videoRef}
                  src={`${video.video_url!}${video.video_url!.includes('?') ? '&' : '?'}v=${new Date(video.updated_at ?? video.created_at).getTime()}`}
                  poster={video.thumbnail_url ?? undefined}
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={() => {
                    if (videoRef.current) setVideoDuration(videoRef.current.duration)
                  }}
                  onPlay={() => {
                    if (!playTracked.current && video) {
                      playTracked.current = true
                      trackEvent(video.id, 'play')
                    }
                    if (musicRef.current && video?.music_url) musicRef.current.play().catch(() => {})
                  }}
                  onPause={() => {
                    if (musicRef.current) musicRef.current.pause()
                  }}
                  onEnded={() => {
                    if (musicRef.current) musicRef.current.pause()
                    setVideoEnded(true)
                    if (video && !milestonesTracked.current.has(100)) {
                      milestonesTracked.current.add(100)
                      trackEvent(video.id, 'complete', { percent: 100 })
                    }
                  }}
                  onSeeking={() => {
                    if (musicRef.current && videoRef.current) {
                      const musicDur = musicRef.current.duration
                      if (musicDur && musicDur > 0) {
                        musicRef.current.currentTime = videoRef.current.currentTime % musicDur
                      }
                    }
                  }}
                  playsInline
                />
                {video.music_url && (
                  <audio ref={musicRef} src={video.music_url} loop preload="auto" style={{ display: 'none' }} />
                )}
              </div>
            )}

            {/* Music volume control */}
            {video.music_url && (
              <div className="wp-music">
                <button
                  type="button"
                  onClick={() => {
                    setMusicMuted(m => {
                      const next = !m
                      if (musicRef.current) musicRef.current.muted = next
                      return next
                    })
                  }}
                  title={musicMuted ? 'Unmute music' : 'Mute music'}
                  aria-label={musicMuted ? 'Unmute music' : 'Mute music'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                    {musicMuted && <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" />}
                  </svg>
                </button>
                <span style={{ fontWeight: 600 }}>Music</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  aria-label="Music volume"
                  value={musicMuted ? 0 : musicVolume}
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    setMusicVolume(v)
                    setMusicMuted(v === 0)
                    if (musicRef.current) {
                      musicRef.current.volume = v
                      musicRef.current.muted = v === 0
                    }
                  }}
                />
                <span>{musicMuted ? 'Off' : `${Math.round(musicVolume * 100)}%`}</span>
              </div>
            )}
          </div>

          {/* ---- THE PRESENTER and the ONE next step (audit 2026-10-09):
                book a call when a booking link is set; otherwise reply (the
                real "ask a question" email form) and call when a phone is set. ---- */}
          <aside className="wp-col-side">
            {who ? (
              <PresenterPanel
                who={who}
                contact={{ email: agentEmail, phone: agentPhone, website: agentWebsite, websiteLabel: agent?.website ?? '' }}
                next={
                  <div className="wp-next" id="next-step" data-testid="watch-next-step">
                    {nextBooking ? (
                      <a
                        href={nextBooking}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => video && trackEvent(video.id, 'booking_click')}
                        className="wp-btn wp-btn--main"
                      >
                        <IconCalendar /> Book a call with {agentShort}
                      </a>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="wp-btn wp-btn--main"
                          onClick={() => { setAskSent(false); setAskError(''); setAskOpen(true) }}
                        >
                          <IconMail /> Reply to {agentShort}
                        </button>
                        {agentPhone && (
                          <a href={`tel:${agentPhone}`} className="wp-btn">
                            <IconPhone /> Call {agentShort}
                          </a>
                        )}
                      </>
                    )}
                    {nextBooking ? (
                      <button type="button" className="wp-btn" onClick={() => { setAskSent(false); setAskError(''); setAskOpen(true) }}>
                        <IconMail /> Ask a question
                      </button>
                    ) : null}
                  </div>
                }
              />
            ) : null}
          </aside>

          {/* ---- EVERYTHING ELSE, under the player ---- */}
          <div className="wp-col-main">
            {video.agent_note && (
              <section className="wp-note" aria-label={hasAgentIdentity ? `A note from ${agentName}` : 'A note'}>
                <p>{video.agent_note}</p>
                {hasAgentIdentity && <div className="wp-note-by">— {agentName}</div>}
              </section>
            )}

            {(chapterItems.length > 0 || slideCount > 0) && (
              <section>
                <span className="wp-label">In this {isHtmlDeck ? 'presentation' : 'video'}</span>
                <h2 className="wp-h2">{slideCount > 0 ? `Slide ${currentSlideIndex + 1} of ${slideCount}` : 'Jump to a part'}</h2>
                {chapterItems.length > 0 ? (
                  <ChapterList items={chapterItems} active={currentSlideIndex} onPick={jumpToSlide} />
                ) : (
                  <div className="wp-pages">
                    {slideUrls.map((url, i) => (
                      <button
                        type="button"
                        key={i}
                        className={`wp-page${i === currentSlideIndex ? ' is-on' : ''}`}
                        onClick={() => jumpToSlide(i)}
                        aria-label={`Go to slide ${i + 1}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- the video's own slide */}
                        <img src={url} alt="" />
                        <span className="wp-page-num">{i + 1}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Downloads and payment. Video download removed per product
                decision — the share page is for watching, not downloading the
                video. Only the source PDF, and only when the agent turned it on. */}
            {(video.allow_source_download || safeLink(pipelineInput?.paymentLink) || safeLink(agent?.payment_link_url)) && !hasQuote ? (
              <section className="wp-actions" id="wp-downloads">
                {video.allow_source_download && (
                  /* Original source PDF. Streams via a server route that mints a
                     short-lived signed URL (bucket stays private); we never expose
                     the storage path here. */
                  <button
                    type="button"
                    className="wp-btn wp-btn--grow"
                    onClick={() => {
                      trackEvent(video.id, 'download', { type: 'source_pdf' })
                      window.open(`/api/watch/${video.id}/source-pdf`, '_blank')
                    }}
                  >
                    <IconDownload />
                    Download Original {video.source_pdf_name ? 'PDF' : 'Document'}
                  </button>
                )}
                {(safeLink(pipelineInput?.paymentLink) || safeLink(agent?.payment_link_url)) && (
                  <a
                    href={safeLink(pipelineInput?.paymentLink) || safeLink(agent?.payment_link_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent(video.id, 'payment_click')}
                    className="wp-btn wp-btn--grow"
                  >
                    Make a Payment
                  </a>
                )}
              </section>
            ) : null}

            {/* QUOTE */}
            {hasQuote && quote && (
              <section>
                <span className="wp-label">Your quote</span>
                <h2 className="wp-h2">{quote.client_name ? `Prepared for ${quote.client_name}` : 'What it costs'}</h2>
                <div className="wp-card">
                  {quote.line_items.map((item, i) => (
                    <div key={i} className="wp-quote-line">
                      <span>{item.description}</span>
                      <span>{item.amount === 0 ? 'Included' : formatCents(item.amount)}</span>
                    </div>
                  ))}
                  <div className="wp-quote-total">
                    <span className="wp-quote-total-label">Total</span>
                    <span className="wp-quote-total-value">{formatCents(quote.total)}</span>
                  </div>
                  <div className="wp-quote-actions">
                    {quote.total === 0 ? (
                      <div style={{ flex: 1, textAlign: 'center', padding: '12px 0', fontSize: 'var(--fs-ui)', fontWeight: 600, color: 'var(--wt-ink-soft)' }}>
                        This is a complimentary service
                      </div>
                    ) : (safeLink(pipelineInput?.paymentLink) || safeLink(agent?.payment_link_url)) ? (
                      <a
                        href={safeLink(pipelineInput?.paymentLink) || safeLink(agent?.payment_link_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => video && trackEvent(video.id, 'payment_click')}
                        className="wp-btn wp-btn--main wp-btn--grow"
                      >
                        Pay {formatCents(quote.total)}
                      </a>
                    ) : (
                      <a href={`mailto:${agentEmail}`} className="wp-btn wp-btn--main wp-btn--grow">
                        Contact {agentName} to pay
                      </a>
                    )}
                    <a
                      href={`mailto:${agentEmail}?subject=Quote Changes&body=Hi ${agentName},%0A%0AI'd like to request changes to the quote.`}
                      className="wp-btn"
                    >
                      Request Changes
                    </a>
                  </div>
                  {video.allow_source_download && (
                    <button
                      type="button"
                      className="wp-textlink"
                      onClick={() => {
                        trackEvent(video.id, 'download', { type: 'source_pdf' })
                        window.open(`/api/watch/${video.id}/source-pdf`, '_blank')
                      }}
                    >
                      Download Original {video.source_pdf_name ? 'PDF' : 'Document'}
                    </button>
                  )}
                </div>
              </section>
            )}

            {hasPaidQuote && quote && (
              <div className="wp-paid">
                <IconCheck />
                <div>
                  <div>Payment Complete</div>
                  <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 500, color: 'var(--wt-ink-soft)' }}>
                    {formatCents(quote.total)} paid{' '}
                    {new Date(quote.paid_at ?? quote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
            )}

            {/* QUESTIONS & ANSWERS — only answers the agent approved */}
            {answers.length > 0 && (
              <section data-testid="watch-answers">
                <span className="wp-label">Questions</span>
                <h2 className="wp-h2">Your questions, answered</h2>
                <div className="wp-card">
                  {answers.map((a) => (
                    <div key={a.id} className="wp-answer">
                      <p className="wp-answer-q">{a.question}</p>
                      <p className="wp-answer-a">{a.answer}</p>
                      <p className="wp-answer-by">
                        Answered by {agentShort || 'your agent'}{a.from.length ? ` · from your document: ${a.from.map((f) => f.replace(/^Document section /, '')).join(', ')}` : ''}
                      </p>
                    </div>
                  ))}
                  <p className="wp-fine">
                    Answers explain what your document says. They are not a promise of coverage or of any result, and not legal, tax or financial advice.
                  </p>
                </div>
              </section>
            )}

            {/* Legal disclosures (insurance only) */}
            {isInsurance && (
              <section>
                <button type="button" className="wp-textlink" onClick={() => setDisclaimersOpen(!disclaimersOpen)}>
                  {disclaimersOpen ? 'Hide Legal Disclosures' : 'View Legal Disclosures'}
                </button>
                {disclaimersOpen && (
                  <div className="wp-disclosures-panel">
                    {carrierDisclaimers.length > 0 && (
                      <>
                        <h3 className="wp-disclosures-heading">Carrier Disclosures</h3>
                        {carrierDisclaimers.map((d, i) => (
                          <p key={i} className="wp-disclosures-text">{d}</p>
                        ))}
                        <hr className="wp-disclosures-divider" />
                      </>
                    )}
                    <h3 className="wp-disclosures-heading">Platform Disclosures</h3>
                    <p className="wp-disclosures-text">This video is for educational and informational purposes only. It is not intended as legal, tax, accounting, investment, or financial advice.</p>
                    <p className="wp-disclosures-text">Any values shown that are not guaranteed — including credited interest rates, dividends, index performance, policy charges, or loans — are subject to change and may vary over time. Actual policy performance may be more or less favorable than illustrated.</p>
                    <p className="wp-disclosures-text">Policy guarantees are based solely on the claims-paying ability of the issuing insurance company.</p>
                    <p className="wp-disclosures-text">This video was produced by a third party and is not endorsed by, affiliated with, or authorized by any insurance carrier.</p>
                    <p className="wp-disclosures-text">The policy contract and the official carrier-issued illustration govern all policy values, benefits, features, charges, and guarantees.</p>
                    <p className="wp-disclosures-text">This video is not a solicitation or offer to purchase insurance.</p>
                    <p className="wp-disclosures-text">This presentation assumes that currently illustrated non-guaranteed elements will continue unchanged for all years shown. This is not likely to occur, and actual results may be more or less favorable.</p>
                    <p className="wp-disclosures-text">Clients should review all policy materials and consult with their licensed insurance professional before making decisions.</p>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </main>

      {/* ============================================================ */}
      {/*  DISCLOSURES DRAWER                                           */}
      {/* ============================================================ */}
      {hasDisclosures && (
        <>
          {/* Tab trigger — fixed to right edge */}
          <button
            type="button"
            onClick={() => setShowDisclosures(true)}
            style={{
              position: 'fixed', right: 0, top: '50%',
              transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'bottom right',
              background: 'var(--wt-hero)', color: 'var(--wt-hero-ink)', border: 'none', borderRadius: '6px 6px 0 0',
              padding: '8px 16px', fontSize: 'var(--fs-caption)', fontWeight: 600, letterSpacing: '0.03em',
              cursor: 'pointer', zIndex: 900,
            }}
          >
            Disclosures
          </button>

          {showDisclosures && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', justifyContent: 'flex-end' }}
              onClick={() => setShowDisclosures(false)}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} />
              <div
                style={{ position: 'relative', width: '100%', maxWidth: 420, background: 'var(--wt-card)', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', padding: '32px 24px', overflowY: 'auto', animation: 'wpSlideIn 0.25s ease-out' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 'var(--fs-lead)', fontWeight: 700 }}>Disclosures & Disclaimers</h3>
                  <button type="button" onClick={() => setShowDisclosures(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--wt-ink)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                {industryConfig?.disclaimerText && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--wt-ink-soft)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {industryConfig.label ?? 'Industry'} Disclosure
                    </div>
                    <p style={{ fontSize: 'var(--fs-small)', lineHeight: 1.6, color: 'var(--wt-ink)', margin: 0 }}>
                      {industryConfig.disclaimerText}
                    </p>
                  </div>
                )}

                {carrierDisclaimers.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--wt-ink-soft)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Additional Disclosures
                    </div>
                    {carrierDisclaimers.map((d, i) => (
                      <p key={i} style={{ fontSize: 'var(--fs-small)', lineHeight: 1.6, color: 'var(--wt-ink)', margin: '0 0 8px' }}>{d}</p>
                    ))}
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--wt-line)', paddingTop: 16, marginTop: 16 }}>
                  <p style={{ fontSize: 'var(--fs-caption)', lineHeight: 1.5, color: 'var(--wt-ink-faint)', margin: 0 }}>
                    This presentation was generated on {createdDate} and is intended for informational purposes only. Please consult with a qualified professional before making any decisions based on this content.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/*  PROMO — free tier only, after the video ends                 */}
      {/* ============================================================ */}
      {isFreeTier && videoEnded && (
        <div className="wp-promo">
          <div className="wp-promo-title">Make videos like this one</div>
          <p>Turn a document, website, or idea into a short narrated video. No editing skills needed.</p>
          <a href="https://docs2video.com/signup" className="wp-btn">Try Free &rarr;</a>
        </div>
      )}

      {/* The old free-plan bar pinned to the bottom ("Made with Docs2Video")
          was a second "powered by" over the agent's page — the footer says
          it once now (audit 2026-10-09). */}

      {/* ============================================================ */}
      {/*  LEAD CAPTURE — paid plans only, after 60% playback           */}
      {/* ============================================================ */}
      {showLeadCapture && !leadDismissed && !leadSubmitted && !isFreeTier && (
        <div className="wp-lead-card">
          <div className="wp-lead-inner">
            <div className="wp-lead-header">
              <div className="wp-lead-title">Interested? Leave your email for more info</div>
              <button type="button" className="wp-lead-close" onClick={() => setLeadDismissed(true)} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form
              className="wp-lead-form"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!leadEmail.trim() || leadSubmitting) return
                setLeadSubmitting(true)
                setLeadError(null)
                try {
                  const res = await fetch('/api/capture-lead', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      videoId: video.id,
                      email: leadEmail.trim(),
                      name: leadName.trim() || undefined,
                    }),
                  })
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error(data.error || 'Failed to submit')
                  }
                  setLeadSubmitted(true)
                } catch (err) {
                  setLeadError(err instanceof Error ? err.message : 'Something went wrong')
                } finally {
                  setLeadSubmitting(false)
                }
              }}
            >
              <input type="email" className="wp-input" placeholder="Your email" aria-label="Your email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} required />
              <input type="text" className="wp-input" placeholder="Name (optional)" aria-label="Your name" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
              <button type="submit" className="wp-btn wp-btn--main" disabled={leadSubmitting}>
                {leadSubmitting ? 'Sending...' : 'Submit'}
              </button>
            </form>
            {leadError && <div className="wp-lead-error">{leadError}</div>}
          </div>
        </div>
      )}

      {leadSubmitted && showLeadCapture && !leadDismissed && !isFreeTier && (
        <div className="wp-lead-card">
          <div className="wp-lead-inner">
            <div className="wp-lead-header">
              <div className="wp-lead-success">
                <IconCheck /> Thanks! We'll be in touch.
              </div>
              <button type="button" className="wp-lead-close" onClick={() => setLeadDismissed(true)} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ASK A QUESTION — a real message emailed to the presenter ── */}
      {askOpen && (
        <div className="wp-modal-back" onClick={(e) => { if (e.target === e.currentTarget) setAskOpen(false) }}>
          <div className="wp-modal" role="dialog" aria-modal="true" aria-label="Ask a question">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Ask a question</h2>
              <button type="button" onClick={() => setAskOpen(false)} aria-label="Close" className="wp-lead-close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {askSent ? (
              <div style={{ textAlign: 'center', padding: '14px 0 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--wt-accent-tint)', color: 'var(--wt-accent-ink)', display: 'grid', placeItems: 'center' }}><IconCheck /></div>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 800 }}>Your agent will reply shortly</div>
                <p>
                  Thanks for asking. {askEmail.trim() ? 'We’ll email you their answer, and it will show on this page too.' : 'Their answer will show on this page.'}
                </p>
                <button type="button" onClick={() => setAskOpen(false)} className="wp-btn wp-btn--main">Done</button>
              </div>
            ) : (
              <>
                <p>
                  Type your question and we&rsquo;ll pass it to {agentShort || 'the person who made this'}. Add your email if you&rsquo;d like the answer emailed to you.
                </p>
                <textarea
                  className="wp-input"
                  value={askQuestion}
                  onChange={(e) => { setAskQuestion(e.target.value); setAskError('') }}
                  rows={4}
                  aria-label="Your question"
                  placeholder="What would you like to know?"
                />
                <input type="email" className="wp-input" value={askEmail} onChange={(e) => setAskEmail(e.target.value)} aria-label="Your email" placeholder="Your email (optional, for a reply)" />
                <input type="text" className="wp-input" value={askName} onChange={(e) => setAskName(e.target.value)} aria-label="Your name" placeholder="Your name (optional)" />
                {/* Honeypot: hidden from people and screen readers; bots fill it. */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={askTrap}
                  onChange={(e) => setAskTrap(e.target.value)}
                  style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }}
                />
                {askError && (
                  <div role="alert" style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', color: 'var(--error-text)', borderRadius: 8, padding: '9px 12px', fontSize: 'var(--fs-small)' }}>{askError}</div>
                )}
                <button type="button" onClick={submitAsk} disabled={askSending} className="wp-btn wp-btn--main">
                  {askSending ? 'Sending…' : 'Send question'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  FOOTER                                                       */}
      {/* ============================================================ */}
      <footer className="wp-footer">
        {isWhiteLabel ? (
          <span>{agent?.company_name ?? agentName}</span>
        ) : (
          <a href="/" data-testid="watch-powered-by">Powered by Docs2Video</a>
        )}
      </footer>
    </div>
  )
}
