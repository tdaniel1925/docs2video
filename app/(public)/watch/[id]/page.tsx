'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import type { Video, Brand } from '../../../_lib/types'
import type { ExtractedData } from '../../../_lib/extract-types'
import { INDUSTRIES } from '../../../_lib/industries'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AgentProfile {
  id: string
  full_name: string | null
  company_name: string | null
  photo_url: string | null
  email: string
  phone?: string | null
  calendly_url: string | null
  payment_link_url?: string | null
  subscription_status: string | null
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

const formatCents = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

/* ------------------------------------------------------------------ */
/*  SVG Icons (inline, no emoji)                                       */
/* ------------------------------------------------------------------ */

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const IconShare = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
)


const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 7l-10 6L2 7" />
  </svg>
)

const IconPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

/* ------------------------------------------------------------------ */
/*  Styles (template literal)                                          */
/* ------------------------------------------------------------------ */

const pageStyles = `
  /* Layout */
  .wp-root {
    min-height: 100vh;
    background: var(--bg, #F0F4F8);
    color: var(--ink, #1B3A5C);
    font-family: inherit;
  }
  .wp-center {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 32px;
  }

  /* Header */
  .wp-header {
    width: 100%;
    height: 64px;
    background: #fff;
    border-bottom: 1px solid var(--border-light, #E8EDF2);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 32px;
    box-sizing: border-box;
  }
  .wp-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .wp-agent-photo {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .wp-agent-initials {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--mint, #3BB5C8);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 14px;
    color: #fff;
    flex-shrink: 0;
  }
  .wp-agent-name {
    font-weight: 700;
    font-size: 14px;
    color: var(--ink, #1B3A5C);
    line-height: 1.3;
  }
  .wp-agent-company {
    font-size: 12px;
    color: var(--ink-light, #7A8FA3);
    line-height: 1.3;
  }
  .wp-powered-header {
    font-size: 11px;
    color: var(--ink-light, #7A8FA3);
    font-weight: 600;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  /* Title section */
  .wp-title-section {
    padding: 24px 0 0;
  }
  .wp-title {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 0 0 4px;
    color: var(--ink, #1B3A5C);
    line-height: 1.3;
  }
  .wp-date {
    font-size: 13px;
    color: var(--ink-light, #7A8FA3);
    margin: 0;
  }

  /* Paid banner */
  .wp-paid-banner {
    background: var(--mint, #3BB5C8);
    border-radius: 10px;
    padding: 12px 20px;
    margin-top: 16px;
    font-weight: 700;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #fff;
  }

  /* Main layout */
  .wp-main {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px 0 32px;
    max-width: 800px;
    margin: 0 auto;
  }
  .wp-col-left {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  /* Video player */
  .wp-video-wrap {
    background: #000;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--border-light, #E8EDF2);
  }
  .wp-video-wrap video {
    width: 100%;
    display: block;
    max-height: 55vh;
  }

  /* Slide indicator */
  .wp-slide-indicator {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-soft, #3D5A7A);
    padding: 0 4px;
  }

  /* Thumbnail strip */
  .wp-thumbstrip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 4px 0;
    scrollbar-width: thin;
  }
  .wp-thumb {
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    flex-shrink: 0;
    transition: border-color 0.15s;
    position: relative;
  }
  .wp-thumb.active {
    border-color: var(--mint, #3BB5C8);
  }
  .wp-thumb:hover {
    border-color: var(--ink-light, #7A8FA3);
  }
  .wp-thumb img {
    width: 120px;
    height: 68px;
    object-fit: cover;
    display: block;
  }
  .wp-thumb-num {
    position: absolute;
    bottom: 2px;
    left: 2px;
    background: rgba(0,0,0,0.65);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
  }

  /* Action buttons row */
  .wp-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .wp-action-btn {
    flex: 1 1 0;
    min-width: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 42px;
    padding: 0 16px;
    background: #fff;
    border: 1px solid var(--border-light, #E8EDF2);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink, #1B3A5C);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    font-family: inherit;
  }
  .wp-action-btn:hover {
    border-color: var(--mint, #3BB5C8);
    background: var(--bg, #F0F4F8);
  }
  .wp-action-btn.copied {
    border-color: var(--mint, #3BB5C8);
    color: var(--mint-darker, #1E7A8A);
  }


  /* Full-width sections below main */
  .wp-section {
    padding: 0 0 32px;
  }
  .wp-card {
    background: #fff;
    border: 1px solid var(--border-light, #E8EDF2);
    border-radius: 10px;
    padding: 24px;
  }
  .wp-section-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-light, #7A8FA3);
    margin-bottom: 16px;
  }

  /* Quote card */
  .wp-quote-line {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-light, #E8EDF2);
    font-size: 14px;
  }
  .wp-quote-line:last-of-type {
    border-bottom: none;
  }
  .wp-quote-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 2px solid var(--border-light, #E8EDF2);
  }
  .wp-quote-total-label {
    font-weight: 700;
    font-size: 15px;
  }
  .wp-quote-total-value {
    font-size: 22px;
    font-weight: 800;
    color: var(--mint-darker, #1E7A8A);
  }
  .wp-quote-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .wp-pay-btn {
    flex: 1;
    height: 44px;
    border: none;
    border-radius: 8px;
    background: var(--ink, #1B3A5C);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
    font-family: inherit;
  }
  .wp-pay-btn:disabled { opacity: 0.6; cursor: default; }
  .wp-pay-btn:not(:disabled):hover { opacity: 0.9; }
  .wp-pay-alt-btn {
    height: 44px;
    padding: 0 20px;
    border: 1px solid var(--border-light, #E8EDF2);
    border-radius: 8px;
    background: #fff;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink, #1B3A5C);
    cursor: pointer;
    transition: all 0.15s;
    text-decoration: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
  }
  .wp-pay-alt-btn:hover { border-color: var(--mint, #3BB5C8); }
  .wp-pay-error {
    margin-top: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(192,58,31,0.08);
    font-size: 13px;
    color: #C03A1F;
  }
  .wp-paid-card {
    background: rgba(59,181,200,0.08);
    border: 1px solid var(--mint, #3BB5C8);
    border-radius: 10px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .wp-paid-card-title { font-weight: 700; font-size: 14px; color: var(--ink, #1B3A5C); }
  .wp-paid-card-sub { font-size: 12px; color: var(--ink-soft, #3D5A7A); }

  /* Calendly embed (legacy — now uses simple link) */
  .wp-calendly {
    background: #fff;
    border: 1px solid var(--border-light, #E8EDF2);
    border-radius: 10px;
    overflow: hidden;
  }
  .wp-calendly-header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-light, #E8EDF2);
    font-weight: 700;
    font-size: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .wp-calendly iframe {
    width: 100%;
    height: 580px;
    border: none;
  }

  /* Contact card */
  .wp-contact-card {
    background: #fff;
    border: 1px solid var(--border-light, #E8EDF2);
    border-radius: 10px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }
  .wp-contact-photo {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    object-fit: cover;
  }
  .wp-contact-initials {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--mint, #3BB5C8);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 18px;
    color: #fff;
  }
  .wp-contact-name {
    font-weight: 700;
    font-size: 16px;
    color: var(--ink, #1B3A5C);
  }
  .wp-contact-details {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
  }
  .wp-contact-link {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-soft, #3D5A7A);
    text-decoration: none;
    transition: color 0.15s;
  }
  .wp-contact-link:hover {
    color: var(--mint-darker, #1E7A8A);
  }

  /* Footer */
  .wp-footer {
    text-align: center;
    padding: 24px 0;
    border-top: 1px solid var(--border-light, #E8EDF2);
  }
  .wp-footer a {
    font-size: 11px;
    color: var(--ink-light, #7A8FA3);
    text-decoration: none;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .wp-footer a:hover {
    color: var(--ink-soft, #3D5A7A);
  }

  /* Loading / Not found */
  .wp-center-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .wp-not-found {
    text-align: center;
    padding: 40px;
  }
  .wp-not-found h1 {
    font-size: 28px;
    font-weight: 800;
    margin-bottom: 10px;
  }
  .wp-not-found p {
    font-size: 15px;
    color: var(--ink-soft, #3D5A7A);
  }

  /* Legal Disclosures */
  .wp-disclosures-toggle {
    display: inline-block;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-soft, #3D5A7A);
    cursor: pointer;
    padding: 8px 0;
    border: none;
    background: none;
    text-decoration: underline;
    font-family: inherit;
    transition: color 0.15s;
  }
  .wp-disclosures-toggle:hover {
    color: var(--ink, #1B3A5C);
  }
  .wp-disclosures-panel {
    background: #F7F8FA;
    border: 1px solid var(--border-light, #E8EDF2);
    border-radius: 10px;
    padding: 24px 28px;
    margin-top: 8px;
    width: 100%;
    max-height: 480px;
    overflow-y: auto;
  }
  .wp-disclosures-heading {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink, #1B3A5C);
    margin: 0 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .wp-disclosures-text {
    font-size: 12px;
    line-height: 1.7;
    color: var(--ink-soft, #3D5A7A);
    margin: 0 0 6px;
  }
  .wp-disclosures-divider {
    border: none;
    border-top: 1px solid var(--border-light, #E8EDF2);
    margin: 16px 0;
  }

  /* Lead capture card */
  .wp-lead-card {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 200;
    background: #fff;
    border-top: 1px solid var(--border-light, #E8EDF2);
    box-shadow: 0 -4px 24px rgba(0,0,0,0.08);
    padding: 20px 24px;
    animation: slideUp 0.4s ease-out;
  }
  .wp-lead-inner {
    max-width: 520px;
    margin: 0 auto;
  }
  .wp-lead-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .wp-lead-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink, #1B3A5C);
  }
  .wp-lead-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--ink-light, #7A8FA3);
    transition: color 0.15s;
  }
  .wp-lead-close:hover {
    color: var(--ink, #1B3A5C);
  }
  .wp-lead-form {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .wp-lead-input {
    flex: 1;
    min-width: 140px;
    height: 40px;
    padding: 0 12px;
    border: 1px solid var(--border-light, #E8EDF2);
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    color: var(--ink, #1B3A5C);
    outline: none;
    transition: border-color 0.15s;
  }
  .wp-lead-input:focus {
    border-color: var(--mint, #3BB5C8);
  }
  .wp-lead-submit {
    height: 40px;
    padding: 0 20px;
    background: var(--ink, #1B3A5C);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s;
    white-space: nowrap;
  }
  .wp-lead-submit:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .wp-lead-submit:not(:disabled):hover {
    opacity: 0.9;
  }
  .wp-lead-success {
    font-size: 14px;
    color: var(--mint-darker, #1E7A8A);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .wp-lead-error {
    font-size: 12px;
    color: #C03A1F;
    margin-top: 6px;
  }
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .wp-header { padding: 0 16px; }
    .wp-center { padding: 0 16px; }
    .wp-actions {
      flex-direction: column;
    }
    .wp-action-btn {
      min-width: unset;
    }
    .wp-title { font-size: 20px; }
    .wp-quote-actions { flex-direction: column; }
  }
`

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
    if (!video || (video as any).output_type !== 'interactive') return
    const onMsg = (e: MessageEvent) => {
      const d = e.data
      if (!d || d.type !== 'act') return
      if (d.kind === 'deck') window.open(`/api/public/deck-pdf/${video.id}`, '_blank')
      if (d.kind === 'video' && (video as any).export_video_url) window.open((video as any).export_video_url, '_blank')
      if (d.kind === 'pdf' || d.kind === 'chat') {
        // source PDF has its own visible button; chat ships later — scroll
        // the actions area into view so the client finds them.
        document.querySelector('.wp-col-right')?.scrollIntoView({ behavior: 'smooth' })
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
  const trackEvent = useCallback((videoId: string, event: string, metadata?: Record<string, unknown>) => {
    fetch('/api/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, event, metadata }),
    }).catch(() => {})
  }, [])

  /* ---- Data loading ---- */
  useEffect(() => {
    async function load() {
      // Server endpoint (service role) — works for logged-out recipients and
      // returns the agent profile + quote that the anon key can't read.
      let data: { video?: VideoWithRelations; agent?: AgentProfile | null; quote?: Quote | null } | null = null
      try {
        const res = await fetch(`/api/public/watch/${params.id as string}`)
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
    if (!videoRef.current || !video?.slide_urls) return
    const slideUrls = video.slide_urls as string[]
    const slideCount = slideUrls.length
    if (slideCount === 0 || videoDuration === 0) return
    const segmentDuration = videoDuration / slideCount
    const idx = Math.min(Math.floor(videoRef.current.currentTime / segmentDuration), slideCount - 1)
    setCurrentSlideIndex(idx)

    // Track watch milestones (25%, 50%, 75%)
    if (video && videoDuration > 0) {
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
    const link = (agent as any)?.payment_link_url?.trim()
      || (video.script as any)?._pipeline_input?.paymentLink
      || ''
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
      <div className="wp-root">
        <style>{pageStyles}</style>
        <div className="wp-center-screen">
          <div className="wp-not-found">
            <h1>This presentation is no longer available</h1>
            <p>It may have been removed by the creator.</p>
            <a href="/" style={{ display: 'inline-block', marginTop: 20, padding: '10px 20px', background: 'var(--ink, #1B3A5C)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
              Go to Homepage
            </a>
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
      <div className="wp-root">
        <style>{pageStyles}</style>
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
  const agentName = agent?.company_name ?? agent?.full_name ?? video.title ?? 'Your Personalized Presentation'
  // The client this video was prepared for — powers the welcome banner. Prefer
  // the recorded recipient_name; fall back to the quote's client name.
  const clientName = ((video.recipient_name || quote?.client_name || '') as string).trim()
  const clientFirstName = clientName.split(/\s+/)[0] || ''
  const agentEmail = agent?.email ?? ''
  const agentPhone = agent?.phone ?? ''
  const agentInitials = hasAgentIdentity ? getInitials(agentName) : ''
  const calendlyUrl = agent?.calendly_url?.trim() ?? ''
  const hasCalendly = calendlyUrl.length > 0 && calendlyUrl.startsWith('https://calendly.com/')
  // Can the recipient pay? True when the agent has a payment link (Stripe
  // Payment Link / Square / PayPal) or a per-quote link. No Stripe Connect.
  const hasStripe = !!(
    (agent as any)?.payment_link_url?.trim()
    || (video?.script as any)?._pipeline_input?.paymentLink
  )
  const hasQuote = !!(quote && quote.status !== 'paid')
  const hasPaidQuote = !!(quote && quote.status === 'paid')
  const slideUrls = (video.slide_urls ?? []) as string[]
  const slideCount = slideUrls.length
  const hasPdf = !!video.infographic?.source_pdf_url

  // White-label: hide Docs2Video branding for business/enterprise subscribers
  const WHITELABEL_PLANS = ['enterprise', 'business']
  const isWhiteLabel = !!(agent?.subscription_status && WHITELABEL_PLANS.includes(agent.subscription_status.toLowerCase()))
  // Show promo banner only for free tier (no subscription or inactive)
  const PAID_PLANS = ['active', 'professional', 'pro', 'business', 'enterprise', 'starter']
  const isFreeTier = !agent?.subscription_status || !PAID_PLANS.includes(agent.subscription_status.toLowerCase())

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

  /* ================================================================ */
  /*  RENDER — Main page                                               */
  /* ================================================================ */
  return (
    <div className="wp-root">
      <style>{pageStyles}</style>

      {/* ============================================================ */}
      {/*  HEADER BAR                                                   */}
      {/* ============================================================ */}
      <header className="wp-header">
        <div className="wp-header-left">
          {agent?.photo_url ? (
            <img src={agent.photo_url} alt={agentName} className="wp-agent-photo" />
          ) : hasAgentIdentity ? (
            <div className="wp-agent-initials">{agentInitials}</div>
          ) : null}
          <div>
            <div className="wp-agent-name">{agentName}</div>
            {agent?.company_name && agent.company_name !== agent.full_name && (
              <div className="wp-agent-company">{agent.company_name}</div>
            )}
          </div>
        </div>
        {!isWhiteLabel && (
          <div className="wp-powered-header">Powered by Docs2Video</div>
        )}
      </header>

      {/* ============================================================ */}
      {/*  TITLE SECTION                                                */}
      {/* ============================================================ */}
      <div className="wp-center">
        <div className="wp-title-section">
          {video.title && <h1 className="wp-title">{video.title}</h1>}
          <p className="wp-date">{createdDate}</p>

          {paid && (
            <div className="wp-paid-banner">
              <IconCheck />
              Payment received! Thank you.
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/*  PERSONALIZED WELCOME BANNER + AGENT NOTE                     */}
        {/* ============================================================ */}
        {(clientFirstName || video.agent_note) && (
          <div style={{ width: '100%', maxWidth: 760, margin: '0 auto 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {clientFirstName && (
              <div style={{ padding: '14px 18px', borderRadius: 10, background: 'var(--mint-soft, rgba(199,232,168,0.18))', border: '1px solid var(--mint, #C7E8A8)', fontSize: 16, color: 'var(--ink, #1B3A5C)', fontWeight: 600, textAlign: 'center' }}>
                Hi {clientFirstName} — {hasAgentIdentity ? <>prepared for you by <strong>{agentName}</strong></> : 'prepared just for you'}.
              </div>
            )}
            {video.agent_note && (
              <div style={{ padding: '14px 18px', borderRadius: 10, background: '#fff', border: '1px solid var(--border-light, #E8EDF2)', fontSize: 15, color: 'var(--ink-soft, #3D5A7A)', lineHeight: 1.5 }}>
                {hasAgentIdentity && <div style={{ fontWeight: 700, color: 'var(--ink, #1B3A5C)', marginBottom: 4 }}>A note from {agentName}</div>}
                {video.agent_note}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/*  MAIN 2-COLUMN LAYOUT                                        */}
        {/* ============================================================ */}
        <div className="wp-main">
          {/* ---- LEFT COLUMN ---- */}
          <div className="wp-col-left">
            {/* Player: interactive presentations render the HTML deck in
                share mode; everything else keeps the video element. */}
            {(video as any).output_type === 'interactive' ? (
              <div className="wp-video-wrap" style={{ aspectRatio: '16/9' }}>
                <iframe
                  src={`${video.video_url!}?share=1`}
                  title={video.title ?? 'Presentation'}
                  style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
                  onLoad={() => { if (!playTracked.current && video) { playTracked.current = true; trackEvent(video.id, 'play') } }}
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
                <audio
                  ref={musicRef}
                  src={video.music_url}
                  loop
                  preload="auto"
                  style={{ display: 'none' }}
                />
              )}
            </div>
            )}

            {/* Music volume control */}
            {video.music_url && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 4px 0',
                fontSize: 12,
                color: 'var(--ink-soft, #3D5A7A)',
              }}>
                <button
                  onClick={() => {
                    setMusicMuted(m => {
                      const next = !m
                      if (musicRef.current) musicRef.current.muted = next
                      return next
                    })
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                    color: musicMuted ? 'var(--ink-light, #7A8FA3)' : 'var(--ink-soft, #3D5A7A)',
                  }}
                  title={musicMuted ? 'Unmute music' : 'Mute music'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                    {musicMuted && <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" />}
                  </svg>
                </button>
                <span style={{ fontWeight: 600, minWidth: 40 }}>Music</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
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
                  style={{ flex: 1, maxWidth: 140, accentColor: 'var(--mint, #3BB5C8)' }}
                />
                <span style={{ fontSize: 11, color: 'var(--ink-light, #7A8FA3)', minWidth: 30 }}>
                  {musicMuted ? 'Off' : `${Math.round(musicVolume * 100)}%`}
                </span>
              </div>
            )}

            {/* Slide indicator */}
            {slideCount > 0 && (
              <div className="wp-slide-indicator">
                Slide {currentSlideIndex + 1} of {slideCount}
              </div>
            )}

            {/* Thumbnail strip */}
            {slideCount > 0 && (
              <div className="wp-thumbstrip">
                {slideUrls.map((url, i) => (
                  <div
                    key={i}
                    className={`wp-thumb${i === currentSlideIndex ? ' active' : ''}`}
                    onClick={() => jumpToSlide(i)}
                  >
                    <img src={url} alt={`Slide ${i + 1}`} />
                    <div className="wp-thumb-num">{i + 1}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Chapter markers */}
            {(() => {
              const scriptData = video.script as any
              const chapters: any[] = scriptData?._pipeline_input?.scenes ?? (Array.isArray(scriptData) ? scriptData : [])
              if (chapters.length === 0 || videoDuration === 0 || slideCount === 0) return null
              const segDuration = videoDuration / slideCount
              return (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '4px 0' }}>
                  {chapters.map((ch: any, i: number) => {
                    const timestamp = segDuration * i
                    const mins = Math.floor(timestamp / 60)
                    const secs = Math.floor(timestamp % 60)
                    const isActive = i === currentSlideIndex
                    return (
                      <button
                        key={i}
                        onClick={() => jumpToSlide(i)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px', borderRadius: 10,
                          border: isActive ? '1.5px solid var(--mint, #3BB5C8)' : '1px solid var(--border-light, #E8EDF2)',
                          background: isActive ? 'rgba(59,181,200,0.08)' : '#fff',
                          cursor: 'pointer', fontSize: 12, fontWeight: isActive ? 700 : 500,
                          color: isActive ? 'var(--ink, #1B3A5C)' : 'var(--ink-soft, #3D5A7A)',
                          transition: 'all 0.15s', fontFamily: 'inherit',
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--ink-light, #7A8FA3)' }}>
                          {mins}:{secs.toString().padStart(2, '0')}
                        </span>
                        <span>{ch.title || `Scene ${i + 1}`}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })()}

            {/* Action buttons — client only downloads the video. Script/slides/
                PPTX/share/social removed per product decision. */}
            <div className="wp-actions">
              {video.video_url && (
                <button
                  className="wp-action-btn"
                  onClick={() => {
                    trackEvent(video.id, 'download', { type: 'video' })
                    window.open(video.video_url!, '_blank')
                  }}
                >
                  <IconDownload />
                  Download Video
                </button>
              )}
              {/* Original source PDF — only when the agent enabled it. Streams via
                  a server route that mints a short-lived signed URL (bucket stays
                  private); we never expose the storage path here. */}
              {video.allow_source_download && (
                <button
                  className="wp-action-btn"
                  onClick={() => {
                    trackEvent(video.id, 'download', { type: 'source_pdf' })
                    window.open(`/api/watch/${video.id}/source-pdf`, '_blank')
                  }}
                >
                  <IconDownload />
                  Download Original {video.source_pdf_name ? 'PDF' : 'Document'}
                </button>
              )}
            </div>

            {/* Booking & Payment buttons */}
            {(() => {
              const pi = (video.script as any)?._pipeline_input
              // Prefer a quote/pipeline-specific link; fall back to the agent's
              // saved Calendly + Stripe Payment Link from Settings → Integrations.
              const bookingUrl = pi?.bookingUrl || agent?.calendly_url?.trim() || ''
              const paymentLnk = pi?.paymentLink || (agent as any)?.payment_link_url?.trim() || ''
              if (!bookingUrl && !paymentLnk) return null
              return (
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  {bookingUrl && (
                    <a
                      href={bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackEvent(video.id, 'booking_click')}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        height: 48, borderRadius: 10, background: 'var(--mint, #3BB5C8)', color: '#fff',
                        fontSize: 15, fontWeight: 700, textDecoration: 'none', transition: 'opacity 0.15s',
                      }}
                    >
                      <IconCalendar /> Book a Call
                    </a>
                  )}
                  {paymentLnk && (
                    <a
                      href={paymentLnk}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackEvent(video.id, 'payment_click')}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        height: 48, borderRadius: 10, background: 'var(--ink, #1B3A5C)', color: '#fff',
                        fontSize: 15, fontWeight: 700, textDecoration: 'none', transition: 'opacity 0.15s',
                      }}
                    >
                      Make a Payment
                    </a>
                  )}
                </div>
              )
            })()}
          </div>

        </div>
      </div>

      {/* ============================================================ */}
      {/*  BELOW MAIN — Legal Disclosures (insurance only)              */}
      {/* ============================================================ */}
      {isInsurance && (
        <div className="wp-center wp-section">
          <button
            className="wp-disclosures-toggle"
            onClick={() => setDisclaimersOpen(!disclaimersOpen)}
          >
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
        </div>
      )}

      {/* ============================================================ */}
      {/*  BELOW MAIN — Quote section                                   */}
      {/* ============================================================ */}
      {hasQuote && quote && (
        <div className="wp-center wp-section">
          <div className="wp-card">
            <div className="wp-section-label">
              Quote{quote.client_name ? ` for ${quote.client_name}` : ''}
            </div>
            {quote.line_items.map((item, i) => (
              <div key={i} className="wp-quote-line">
                <span>{item.description}</span>
                <span style={{ fontWeight: 700 }}>
                  {item.amount === 0 ? 'FREE' : formatCents(item.amount)}
                </span>
              </div>
            ))}
            <div className="wp-quote-total">
              <span className="wp-quote-total-label">Total</span>
              <span className="wp-quote-total-value">{formatCents(quote.total)}</span>
            </div>
            <div className="wp-quote-actions">
              {quote.total === 0 ? (
                <div style={{ flex: 1, textAlign: 'center', padding: '12px 0', fontSize: 14, fontWeight: 600, color: 'var(--ink-soft, #3D5A7A)' }}>
                  This is a complimentary service
                </div>
              ) : pipelineInput?.paymentLink ? (
                <a
                  href={pipelineInput.paymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => video && trackEvent(video.id, 'payment_click')}
                  className="wp-pay-btn"
                  style={{ flex: 1, textAlign: 'center', textDecoration: 'none', display: 'block' }}
                >
                  Pay {formatCents(quote.total)}
                </a>
              ) : (
                <a href={`mailto:${agentEmail}`} className="wp-pay-alt-btn" style={{ flex: 1 }}>
                  Contact {agentName} to pay
                </a>
              )}
              <a
                href={`mailto:${agentEmail}?subject=Quote Changes&body=Hi ${agentName},%0A%0AI'd like to request changes to the quote.`}
                className="wp-pay-alt-btn"
              >
                Request Changes
              </a>
            </div>
          </div>
        </div>
      )}

      {hasPaidQuote && quote && (
        <div className="wp-center wp-section">
          <div className="wp-paid-card">
            <IconCheck />
            <div>
              <div className="wp-paid-card-title">Payment Complete</div>
              <div className="wp-paid-card-sub">
                {formatCents(quote.total)} paid{' '}
                {new Date(quote.paid_at ?? quote.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  BELOW MAIN — Book a meeting link                               */}
      {/* ============================================================ */}
      {hasCalendly && (
        <div className="wp-center wp-section" id="calendly-section">
          <a
            href={calendlyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => video && trackEvent(video.id, 'booking_click')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', height: 52, borderRadius: 10, background: 'var(--mint, #3BB5C8)', color: '#fff',
              fontSize: 16, fontWeight: 700, textDecoration: 'none', transition: 'opacity 0.15s',
            }}
          >
            <IconCalendar /> Book a Meeting with {agentName}
          </a>
        </div>
      )}

      {/* ============================================================ */}
      {/*  BELOW MAIN — Contact card                                    */}
      {/* ============================================================ */}
      {agent && (
        <div className="wp-center wp-section">
          <div className="wp-contact-card">
            {agent.photo_url ? (
              <img src={agent.photo_url} alt={agentName} className="wp-contact-photo" />
            ) : hasAgentIdentity ? (
              <div className="wp-contact-initials">{agentInitials}</div>
            ) : null}
            <div>
              <div className="wp-contact-name">{agentName}</div>
              {agent.company_name && agent.company_name !== agent.full_name && (
                <div style={{ fontSize: 13, color: 'var(--ink-light, #7A8FA3)', marginTop: 2 }}>
                  {agent.company_name}
                </div>
              )}
            </div>
            <div className="wp-contact-details">
              {agentEmail && (
                <a href={`mailto:${agentEmail}`} className="wp-contact-link">
                  <IconMail />
                  {agentEmail}
                </a>
              )}
              {agentPhone && (
                <a href={`tel:${agentPhone}`} className="wp-contact-link">
                  <IconPhone />
                  {agentPhone}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  DISCLOSURES DRAWER                                           */}
      {/* ============================================================ */}
      {hasDisclosures && (
        <>
          {/* Tab trigger — fixed to right edge */}
          <button
            onClick={() => setShowDisclosures(true)}
            style={{
              position: 'fixed',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%) rotate(-90deg)',
              transformOrigin: 'bottom right',
              background: 'var(--ink, #1a2b3c)',
              color: 'white',
              border: 'none',
              borderRadius: '6px 6px 0 0',
              padding: '8px 16px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.03em',
              cursor: 'pointer',
              zIndex: 900,
              opacity: 0.85,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')}
          >
            Disclosures
          </button>

          {/* Drawer overlay + panel */}
          {showDisclosures && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', justifyContent: 'flex-end' }}
              onClick={() => setShowDisclosures(false)}
            >
              {/* Backdrop */}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} />

              {/* Panel */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 420,
                  background: 'white',
                  boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
                  padding: '32px 24px',
                  overflowY: 'auto',
                  animation: 'slide-in-right 0.25s ease-out',
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Disclosures & Disclaimers</h3>
                  <button
                    onClick={() => setShowDisclosures(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink, #1a2b3c)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                {industryConfig?.disclaimerText && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft, #5a6b7a)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {industryConfig.label ?? 'Industry'} Disclosure
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink, #1a2b3c)', margin: 0 }}>
                      {industryConfig.disclaimerText}
                    </p>
                  </div>
                )}

                {carrierDisclaimers.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft, #5a6b7a)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Additional Disclosures
                    </div>
                    {carrierDisclaimers.map((d, i) => (
                      <p key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink, #1a2b3c)', margin: '0 0 8px' }}>
                        {d}
                      </p>
                    ))}
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-light, #e8ecf0)', paddingTop: 16, marginTop: 16 }}>
                  <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--ink-light, #7A8FA3)', margin: 0 }}>
                    This presentation was generated on {createdDate} and is intended for informational purposes only. Please consult with a qualified professional before making any decisions based on this content.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Drawer animation */}
          <style>{`
            @keyframes slide-in-right {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>
      )}

      {/* ============================================================ */}
      {/*  PROMO BANNER — free tier only                                */}
      {/* ============================================================ */}
      {isFreeTier && videoEnded && (
        <div style={{
          maxWidth: 600, margin: '0 auto 32px', padding: '28px 32px', borderRadius: 10,
          background: 'linear-gradient(135deg, #1B3A5C 0%, #2A5A8C 100%)',
          textAlign: 'center', animation: 'fadeInUp 0.5s ease',
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8, letterSpacing: '-0.02em' }}>
            Create videos like this in minutes
          </div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', marginBottom: 20, lineHeight: 1.5 }}>
            Turn any document, website, or idea into a professional narrated video. No editing skills needed.
          </div>
          <a
            href="https://docs2video.com/signup"
            style={{
              display: 'inline-block', padding: '14px 36px', borderRadius: 8,
              background: '#3BB5C8', color: '#fff', fontSize: 16, fontWeight: 700,
              textDecoration: 'none', transition: 'opacity 0.15s',
            }}
          >
            Try Free &rarr;
          </a>
        </div>
      )}

      {/* Fixed bottom bar — free tier only */}
      {isFreeTier && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          padding: '10px 20px',
          background: 'rgba(27, 58, 92, 0.95)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
            Made with Docs2Video
          </span>
          <a
            href="https://docs2video.com/signup"
            style={{
              padding: '6px 16px', borderRadius: 6,
              background: '#3BB5C8', color: '#fff', fontSize: 12, fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Create yours free &rarr;
          </a>
        </div>
      )}

      {/* ============================================================ */}
      {/*  LEAD CAPTURE — paid plans only, after 60% playback           */}
      {/* ============================================================ */}
      {showLeadCapture && !leadDismissed && !leadSubmitted && !isFreeTier && (
        <div className="wp-lead-card">
          <div className="wp-lead-inner">
            <div className="wp-lead-header">
              <div className="wp-lead-title">Interested? Leave your email for more info</div>
              <button
                className="wp-lead-close"
                onClick={() => setLeadDismissed(true)}
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              <input
                type="email"
                className="wp-lead-input"
                placeholder="Your email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                required
              />
              <input
                type="text"
                className="wp-lead-input"
                placeholder="Name (optional)"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
              />
              <button type="submit" className="wp-lead-submit" disabled={leadSubmitting}>
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
              <button
                className="wp-lead-close"
                onClick={() => setLeadDismissed(true)}
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  FOOTER                                                       */}
      {/* ============================================================ */}
      <footer className="wp-footer" style={isFreeTier ? { paddingBottom: 48 } : undefined}>
        {isWhiteLabel ? (
          <span style={{ fontSize: 11, color: 'var(--ink-light, #7A8FA3)', fontWeight: 600, letterSpacing: '0.04em' }}>
            {agent?.company_name ?? agentName}
          </span>
        ) : (
          <a href="/">Powered by Docs2Video</a>
        )}
      </footer>
    </div>
  )
}
