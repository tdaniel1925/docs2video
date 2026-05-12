'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '../../../_lib/supabase/client'
import type { Video, Brand, ChatMessage } from '../../../_lib/types'
import type { ExtractedData } from '../../../_lib/extract-types'

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
  stripe_user_id: string | null
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

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
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

  /* Main 2-col layout */
  .wp-main {
    display: flex;
    gap: 24px;
    padding: 24px 0 32px;
    align-items: flex-start;
  }
  .wp-col-left {
    width: 60%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .wp-col-right {
    width: 40%;
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid var(--border-light, #E8EDF2);
    border-radius: 10px;
    overflow: hidden;
    min-height: 520px;
    max-height: calc(100vh - 200px);
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

  /* Chat panel */
  .wp-chat-header {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-light, #E8EDF2);
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-light, #7A8FA3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .wp-chat-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .wp-chat-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 32px 20px;
    flex: 1;
  }
  .wp-chat-empty-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink, #1B3A5C);
    text-align: center;
  }
  .wp-chat-empty-sub {
    font-size: 12px;
    color: var(--ink-light, #7A8FA3);
    text-align: center;
    line-height: 1.5;
  }
  .wp-suggested-btns {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 280px;
  }
  .wp-suggested-btn {
    padding: 10px 14px;
    border: 1px solid var(--border-light, #E8EDF2);
    border-radius: 8px;
    background: #fff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    color: var(--ink, #1B3A5C);
    text-align: left;
    font-family: inherit;
  }
  .wp-suggested-btn:hover {
    border-color: var(--mint, #3BB5C8);
    background: var(--bg, #F0F4F8);
  }
  .wp-msg {
    max-width: 85%;
    animation: wp-fadeIn 0.2s ease;
  }
  .wp-msg-client {
    align-self: flex-end;
  }
  .wp-msg-ai {
    align-self: flex-start;
  }
  .wp-msg-bubble {
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.6;
    word-break: break-word;
  }
  .wp-msg-client .wp-msg-bubble {
    background: var(--mint, #3BB5C8);
    color: #fff;
  }
  .wp-msg-ai .wp-msg-bubble {
    background: #fff;
    border: 1px solid var(--border-light, #E8EDF2);
    color: var(--ink, #1B3A5C);
  }
  @keyframes wp-fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Typing dots */
  .wp-typing {
    display: flex;
    gap: 4px;
    padding: 10px 14px;
    border-radius: 10px;
    background: #fff;
    border: 1px solid var(--border-light, #E8EDF2);
    align-self: flex-start;
  }
  .wp-typing span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ink-light, #7A8FA3);
    animation: wp-dotPulse 1.2s ease-in-out infinite;
  }
  .wp-typing span:nth-child(2) { animation-delay: 0.2s; }
  .wp-typing span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes wp-dotPulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  /* Chat input */
  .wp-chat-input-wrap {
    padding: 12px 16px;
    border-top: 1px solid var(--border-light, #E8EDF2);
    background: #fff;
  }
  .wp-chat-input-row {
    display: flex;
    gap: 8px;
    border: 1px solid var(--border-light, #E8EDF2);
    border-radius: 8px;
    padding: 4px 4px 4px 12px;
    background: #fff;
    transition: border-color 0.15s;
  }
  .wp-chat-input-row:focus-within {
    border-color: var(--mint, #3BB5C8);
  }
  .wp-chat-input-row input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 13px;
    background: transparent;
    color: var(--ink, #1B3A5C);
    font-family: inherit;
  }
  .wp-chat-input-row input::placeholder {
    color: var(--ink-light, #7A8FA3);
  }
  .wp-chat-send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 6px;
    border: none;
    background: var(--ink, #1B3A5C);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
    font-family: inherit;
  }
  .wp-chat-send-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .wp-chat-send-btn:not(:disabled):hover {
    opacity: 0.85;
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

  /* Calendly embed */
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

  /* Mobile responsive */
  @media (max-width: 768px) {
    .wp-header { padding: 0 16px; }
    .wp-center { padding: 0 16px; }
    .wp-main {
      flex-direction: column;
    }
    .wp-col-left,
    .wp-col-right {
      width: 100%;
    }
    .wp-col-right {
      min-height: 400px;
      max-height: 520px;
    }
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
/*  Suggested questions for empty chat                                 */
/* ------------------------------------------------------------------ */

const SUGGESTED_QUESTIONS = [
  'Can you explain the key points of this video in simple terms?',
  'What are the most important numbers and metrics mentioned?',
  'Can you compare the different options or plans mentioned?',
  'Give me a one-paragraph summary of this video.',
]

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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const viewTracked = useRef(false)

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)

  const paid = searchParams.get('paid') === 'true'

  /* ---- Data loading ---- */
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('videos')
        .select('*, brand:brands(*), infographic:infographics(policy_data, source_pdf_url)')
        .eq('id', params.id as string)
        .eq('status', 'completed')
        .single()

      if (error || !data) {
        setNotFound(true)
        return
      }

      const v = data as VideoWithRelations
      setVideo(v)

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, photo_url, email, phone, calendly_url, stripe_user_id')
        .eq('id', v.user_id)
        .single()
      if (profile) setAgent(profile as AgentProfile)

      const { data: quoteData } = await supabase
        .from('quotes')
        .select('*')
        .eq('video_id', v.id)
        .neq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (quoteData) setQuote(quoteData as Quote)

      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('video_id', v.id)
        .order('created_at', { ascending: true })
      if (messages) setChatMessages(messages as ChatMessage[])

      if (!viewTracked.current) {
        viewTracked.current = true
        fetch('/api/track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: v.id }),
        }).catch(() => {})
      }
    }
    load()
  }, [params.id])

  /* ---- Scroll chat ---- */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  /* ---- Slide tracking ---- */
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !video?.slide_urls) return
    const slideUrls = video.slide_urls as string[]
    const slideCount = slideUrls.length
    if (slideCount === 0 || videoDuration === 0) return
    const segmentDuration = videoDuration / slideCount
    const idx = Math.min(Math.floor(videoRef.current.currentTime / segmentDuration), slideCount - 1)
    setCurrentSlideIndex(idx)
  }, [video, videoDuration])

  const jumpToSlide = useCallback(
    (index: number) => {
      if (!videoRef.current || !video?.slide_urls) return
      const slideCount = (video.slide_urls as string[]).length
      if (slideCount === 0 || videoDuration === 0) return
      videoRef.current.currentTime = (videoDuration / slideCount) * index
    },
    [video, videoDuration],
  )

  /* ---- Chat ---- */
  const sendChat = useCallback(
    async (msg?: string) => {
      const text = (msg ?? chatInput).trim()
      if (!text || !video || chatLoading) return
      setChatInput('')
      setChatLoading(true)

      const clientMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        video_id: video.id,
        role: 'client',
        message: text,
        created_at: new Date().toISOString(),
      }
      setChatMessages((prev) => [...prev, clientMsg])

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: video.id, message: text }),
        })
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        if (data.response) {
          setChatMessages((prev) => [
            ...prev,
            {
              id: `temp-${Date.now() + 1}`,
              video_id: video.id,
              role: 'assistant',
              message: data.response,
              created_at: new Date().toISOString(),
            },
          ])
        }
      } catch {
        setChatInput(text)
      } finally {
        setChatLoading(false)
      }
    },
    [chatInput, video, chatLoading],
  )

  /* ---- Pay ---- */
  const handlePay = useCallback(async () => {
    if (!quote || payLoading) return
    setPayLoading(true)
    setPayError(null)
    try {
      const res = await fetch('/api/quotes/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: quote.id }),
      })
      if (!res.ok) throw new Error('Payment setup failed')
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error('No payment URL')
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setPayLoading(false)
    }
  }, [quote, payLoading])

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
            <h1>Video Not Found</h1>
            <p>This video may have been removed or is still processing.</p>
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
  const agentName = agent?.full_name ?? agent?.company_name ?? 'Your Agent'
  const agentEmail = agent?.email ?? ''
  const agentPhone = agent?.phone ?? ''
  const agentInitials = getInitials(agentName)
  const calendlyUrl = agent?.calendly_url?.trim() ?? ''
  const hasCalendly = calendlyUrl.length > 0 && calendlyUrl.startsWith('https://calendly.com/')
  const hasStripe = !!(agent?.stripe_user_id?.trim())
  const hasQuote = !!(quote && quote.status !== 'paid')
  const hasPaidQuote = !!(quote && quote.status === 'paid')
  const slideUrls = (video.slide_urls ?? []) as string[]
  const slideCount = slideUrls.length
  const hasPdf = !!video.infographic?.source_pdf_url
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
          ) : (
            <div className="wp-agent-initials">{agentInitials}</div>
          )}
          <div>
            <div className="wp-agent-name">{agentName}</div>
            {agent?.company_name && agent.company_name !== agent.full_name && (
              <div className="wp-agent-company">{agent.company_name}</div>
            )}
          </div>
        </div>
        <div className="wp-powered-header">Powered by Docs2Video</div>
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
        {/*  MAIN 2-COLUMN LAYOUT                                        */}
        {/* ============================================================ */}
        <div className="wp-main">
          {/* ---- LEFT COLUMN ---- */}
          <div className="wp-col-left">
            {/* Video player */}
            <div className="wp-video-wrap">
              <video
                ref={videoRef}
                src={video.video_url!}
                poster={video.thumbnail_url ?? undefined}
                controls
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={() => {
                  if (videoRef.current) setVideoDuration(videoRef.current.duration)
                }}
                playsInline
              />
            </div>

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

            {/* Action buttons */}
            <div className="wp-actions">
              {video.video_url && (
                <button
                  className="wp-action-btn"
                  onClick={() => window.open(video.video_url!, '_blank')}
                >
                  <IconDownload />
                  Download Video
                </button>
              )}

              {slideCount > 0 && (
                <button
                  className="wp-action-btn"
                  onClick={() => window.open(slideUrls[0], '_blank')}
                >
                  <IconDownload />
                  Download Slides
                </button>
              )}

              {hasPdf && (
                <button
                  className="wp-action-btn"
                  onClick={() => window.open(video.infographic!.source_pdf_url!, '_blank')}
                >
                  <IconDownload />
                  Download Source PDF
                </button>
              )}

              <button
                className={`wp-action-btn${copied ? ' copied' : ''}`}
                onClick={handleCopyLink}
              >
                {copied ? <IconCheck /> : <IconShare />}
                {copied ? 'Link Copied' : 'Share'}
              </button>
            </div>
          </div>

          {/* ---- RIGHT COLUMN — Chat ---- */}
          <div className="wp-col-right">
            <div className="wp-chat-header">Ask about this video</div>

            <div className="wp-chat-body">
              {chatMessages.length === 0 ? (
                <div className="wp-chat-empty">
                  <div>
                    <div className="wp-chat-empty-title">
                      I can help you understand this video
                    </div>
                    <div className="wp-chat-empty-sub">
                      Try one of the suggestions below, or type your own question.
                    </div>
                  </div>
                  <div className="wp-suggested-btns">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        className="wp-suggested-btn"
                        onClick={() => sendChat(q)}
                        disabled={chatLoading}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`wp-msg ${msg.role === 'client' ? 'wp-msg-client' : 'wp-msg-ai'}`}
                    >
                      <div className="wp-msg-bubble">{msg.message}</div>
                    </div>
                  ))}
                </>
              )}

              {chatLoading && (
                <div className="wp-typing">
                  <span />
                  <span />
                  <span />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="wp-chat-input-wrap">
              <div className="wp-chat-input-row">
                <input
                  type="text"
                  placeholder="Ask about this video..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendChat()
                    }
                  }}
                  disabled={chatLoading}
                />
                <button
                  className="wp-chat-send-btn"
                  onClick={() => sendChat()}
                  disabled={chatLoading || !chatInput.trim()}
                >
                  <IconSend />
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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
            {payError && <div className="wp-pay-error">{payError}</div>}
            <div className="wp-quote-actions">
              {hasStripe ? (
                <button onClick={handlePay} disabled={payLoading} className="wp-pay-btn">
                  {payLoading ? 'Processing...' : `Accept & Pay ${formatCents(quote.total)}`}
                </button>
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
      {/*  BELOW MAIN — Calendly embed                                  */}
      {/* ============================================================ */}
      {hasCalendly && (
        <div className="wp-center wp-section" id="calendly-section">
          <div className="wp-calendly">
            <div className="wp-calendly-header">
              <IconCalendar />
              Book a Meeting with {agentName}
            </div>
            <iframe
              src={calendlyUrl}
              title="Book a meeting"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
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
            ) : (
              <div className="wp-contact-initials">{agentInitials}</div>
            )}
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
      {/*  FOOTER                                                       */}
      {/* ============================================================ */}
      <footer className="wp-footer">
        <a href="/">Powered by Docs2Video</a>
      </footer>
    </div>
  )
}
