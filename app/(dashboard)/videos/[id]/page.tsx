'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../_lib/supabase/client'
import { displayProgress } from '../../../_lib/video-progress'
import ScriptEditor from '../../../_components/ScriptEditor'
import FixScene from './FixScene'
import type { Video, Brand } from '../../../_lib/types'

// Feature flags — now driven by user's subscription plan

const PROGRESS_STEPS = [
  { key: 'starting', label: 'Starting', desc: 'Initializing your video pipeline...', sub: 'Setting up generation environment', icon: '🚀' },
  { key: 'scripting', label: 'Writing Script', desc: 'AI is crafting your narration script...', sub: 'Analyzing content and creating scenes', icon: '✍️' },
  { key: 'generating_audio', label: 'Generating Audio', desc: 'Professional voiceover being recorded...', sub: 'Converting script to natural speech', icon: '🎙️' },
  { key: 'generating_slides', label: 'Creating Slides', desc: 'Designing branded visuals for each scene...', sub: 'Generating and compositing graphics', icon: '🎨' },
  { key: 'assembling', label: 'Assembling Video', desc: 'Stitching everything into your final video...', sub: 'Encoding video, mixing audio, adding music', icon: '🎬' },
]

const FUN_FACTS = [
  'Your video will have professional narration with natural-sounding AI voice.',
  'Each slide is custom-designed with your brand colors and logo.',
  'You can share this video with clients via a branded link when it\'s done.',
  'Videos can be downloaded as MP4, PDF slides, or PPTX presentations.',
  'The AI chatbot on your share page will know everything about this video.',
  'Tip: You can leave this page — your video will continue generating in the background.',
]

function VideoProgress({ status, createdAt, progressDetail, progressPct, sceneCount }: { status: string; createdAt: string; progressDetail: string | null; progressPct: number | null; sceneCount: number }) {
  const [elapsed, setElapsed] = useState(0)
  const [factIndex, setFactIndex] = useState(0)

  useEffect(() => {
    const start = new Date(createdAt).getTime()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [createdAt])

  useEffect(() => {
    const timer = setInterval(() => {
      setFactIndex(prev => (prev + 1) % FUN_FACTS.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  const currentIdx = PROGRESS_STEPS.findIndex(s => s.key === status)
  const effectiveIdx = currentIdx < 0 ? 0 : currentIdx
  const fallbackPct = Math.min(95, Math.round(((effectiveIdx + 0.5) / PROGRESS_STEPS.length) * 100))
  // Same shared mapping the builder + dashboard use, so the % never disagrees
  // across screens. Fall back to the time-based estimate only when the server
  // hasn't emitted a real progress value yet.
  const pct = progressPct != null ? displayProgress(progressPct) : fallbackPct
  const currentStep = PROGRESS_STEPS[effectiveIdx] ?? PROGRESS_STEPS[0]

  // Estimate: ~30s script + ~10s per slide audio + ~25s per slide image + ~30s music + ~60s assembly
  const slides = Math.max(sceneCount, 5)
  const estimatedTotal = 30 + (slides * 10) + (slides * 25) + 30 + 60
  const timeRemaining = Math.max(0, estimatedTotal - elapsed)
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const elapsedMin = Math.floor(elapsed / 60)
  const elapsedSec = elapsed % 60

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <style>{`
        @keyframes progressShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(168,240,212,0.4); }
          50% { box-shadow: 0 0 0 12px rgba(168,240,212,0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fact-rotate { animation: fadeInUp 0.5s ease; }
      `}</style>

      {/* Hero progress card */}
      <div style={{
        background: 'white', borderRadius: 10, padding: '36px 32px',
        border: '1px solid var(--border-light)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        textAlign: 'center', marginBottom: 20,
      }}>
        {/* Big percentage */}
        <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {pct}%
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 4, marginBottom: 20 }}>
          {timeRemaining > 0
            ? `About ${minutes > 0 ? `${minutes} min` : ''}${minutes > 0 && seconds > 0 ? ' ' : ''}${seconds > 0 ? `${seconds}s` : ''} remaining`
            : `${elapsedMin}:${elapsedSec.toString().padStart(2, '0')} elapsed — almost done`
          }
        </div>

        {/* Animated gradient progress bar */}
        <div style={{ height: 10, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{
            height: '100%', borderRadius: 10,
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--mint), #34d399, var(--mint), #34d399)',
            backgroundSize: '200% 100%',
            animation: 'progressShimmer 2s linear infinite',
            transition: 'width 1s ease',
          }} />
        </div>

        {/* Current stage highlight */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          background: 'rgba(168,240,212,0.12)', border: '1px solid var(--mint)',
          borderRadius: 10, padding: '12px 24px',
        }}>
          <span style={{ fontSize: 24 }}>{currentStep.icon}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{currentStep.label}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{progressDetail ?? currentStep.sub}</div>
          </div>
        </div>
      </div>

      {/* Stage pipeline */}
      <div style={{
        background: 'white', borderRadius: 10, padding: '24px 28px',
        border: '1px solid var(--border-light)', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
          {PROGRESS_STEPS.map((step, i) => {
            const isDone = i < effectiveIdx
            const isActive = i === effectiveIdx
            const isPending = i > effectiveIdx
            return (
              <div key={step.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {/* Connector line */}
                {i > 0 && (
                  <div style={{
                    position: 'absolute', top: 16, right: '50%', width: '100%', height: 3,
                    background: isDone ? 'var(--mint)' : 'var(--border)',
                    transition: 'background 0.5s ease',
                    zIndex: 0,
                  }} />
                )}
                {/* Circle */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', zIndex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isDone ? 14 : 13, fontWeight: 700,
                  background: isDone ? 'var(--mint)' : isActive ? 'var(--ink)' : 'var(--border)',
                  color: isDone ? 'var(--ink)' : isActive ? 'white' : 'var(--ink-light)',
                  transition: 'all 0.5s ease',
                  ...(isActive ? { animation: 'pulseGlow 2s ease-in-out infinite' } : {}),
                }}>
                  {isDone ? '✓' : isActive ? (
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white' }} />
                  ) : i + 1}
                </div>
                {/* Label */}
                <div style={{
                  fontSize: 11, fontWeight: isActive ? 700 : 500, marginTop: 8,
                  color: isDone ? 'var(--mint-darker, #2d7a4f)' : isActive ? 'var(--ink)' : 'var(--ink-light)',
                  textAlign: 'center', lineHeight: 1.3, transition: 'all 0.3s ease',
                }}>
                  {step.label}
                </div>
                {/* Active description */}
                {isActive && (
                  <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 4, textAlign: 'center', maxWidth: 90 }}>
                    {progressDetail ?? step.desc.replace('...', '')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Fun facts / tips */}
      <div style={{
        background: 'rgba(168,240,212,0.08)', border: '1px solid rgba(168,240,212,0.2)',
        borderRadius: 10, padding: '14px 20px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
        <div key={factIndex} className="fact-rotate" style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          {FUN_FACTS[factIndex]}
        </div>
      </div>

      {/* Safety message */}
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-light)' }}>
        You can safely leave this page — your video continues generating in the background.
        <br />
        This page updates automatically every 3 seconds.
      </div>

      {/* Retry option — shows after 5 minutes */}
      {elapsed > 300 && (
        <div style={{
          marginTop: 20, padding: '16px 20px', borderRadius: 10,
          background: 'var(--surface-raised)', border: '1px solid var(--border)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
            Taking longer than expected? Progress is at {pct}%.
            {pct < 30 ? ' The video server may be busy.' : pct < 70 ? ' Slides are still being designed.' : ' Almost done — hang tight.'}
          </div>
          <button
            onClick={async () => {
              const sb = createClient()
              const vid = window.location.pathname.split('/').filter(Boolean).pop() || ''
              await sb.from('videos').update({ status: 'pending', progress_pct: 0, progress_detail: 'Restarting...' }).eq('id', vid)
              window.location.reload()
            }}
            className="btn btn-soft btn-sm"
          >
            Restart Generation
          </button>
        </div>
      )}
    </div>
  )
}

const PRO_PLANS = ['starter', 'pro', 'professional', 'active', 'business', 'enterprise']

interface FollowUpEmail {
  id: string
  plan_id: string
  user_id: string
  day_offset: number
  subject: string
  body: string
  scheduled_date: string | null
  status: 'pending' | 'sent' | 'skipped'
  sent_at: string | null
  created_at: string
}

interface FollowUpPlan {
  id: string
  user_id: string
  video_id: string
  client_name: string | null
  client_email: string | null
  suggestions: any[]
  created_at: string
  emails: FollowUpEmail[]
}

interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
}

const QUICK_ACTIONS: { label: string; message: string }[] = []

function toneLabel(offset: number): string {
  if (offset <= 3) return 'Reminder'
  if (offset <= 7) return 'Educational'
  return 'Soft Close'
}

function statusClass(status: string): string {
  if (status === 'sent') return 'mint'
  if (status === 'skipped') return ''
  return 'peach'
}

function statusLabel(status: string): string {
  if (status === 'sent') return 'Sent'
  if (status === 'skipped') return 'Skipped'
  return 'Pending'
}

export default function VideoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [video, setVideo] = useState<Video | null>(null)
  // Lightbox: index of the slide shown enlarged (thumbnails are too small to read).
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [inlineNotice, setInlineNotice] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [downloadingPPTX, setDownloadingPPTX] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [shareName, setShareName] = useState('')
  // Editable client-email composer (Share with Client). Body is editable plain
  // text; on copy we render a nice HTML email (with a 'View Your Video Now'
  // button) + a plain-text fallback so it pastes well into Gmail/Outlook.
  const [shareEmailBody, setShareEmailBody] = useState('')
  const [shareEmailBodyTouched, setShareEmailBodyTouched] = useState(false)
  const [shareEmailCopied, setShareEmailCopied] = useState(false)
  const pipelineStarted = useRef(false)
  const [userPlan, setUserPlan] = useState<string>('trial')
  // Editor state
  const [showEditor, setShowEditor] = useState(false)
  const [editorScenes, setEditorScenes] = useState<{scene: number; title: string; narration: string; slidePrompt: string}[]>([])
  const [editorSlides, setEditorSlides] = useState<(string | null)[]>([])
  const [reRendering, setReRendering] = useState(false)
  const [reRenderProgress, setReRenderProgress] = useState('')
  const [changedAudioIndexes, setChangedAudioIndexes] = useState<Set<number>>(new Set())
  const [showFixScene, setShowFixScene] = useState(false)  // Fix-a-Scene modal (slide-deck videos)

  // Translate state
  const [showTranslateModal, setShowTranslateModal] = useState(false)
  const [translateLang, setTranslateLang] = useState('')
  const [translating, setTranslating] = useState(false)

  // Social posts state
  const [showSocialModal, setShowSocialModal] = useState(false)
  const [socialPosts, setSocialPosts] = useState<{ linkedin: string; twitter: string; facebook: string } | null>(null)
  const [socialLoading, setSocialLoading] = useState(false)
  const [socialCopied, setSocialCopied] = useState<string | null>(null)

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null)
  const musicRef = useRef<HTMLAudioElement>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [musicVolume, setMusicVolume] = useState(0.01)
  const [musicMuted, setMusicMuted] = useState(false)

  // Sync music volume when ref or volume changes
  useEffect(() => {
    if (musicRef.current) {
      musicRef.current.volume = musicVolume
      musicRef.current.muted = musicMuted
    }
  }, [video?.music_url, musicVolume, musicMuted])

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

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { role: 'assistant', text: "I can help you refine this video. Use the buttons above or tell me what you'd like to change." }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatListRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  // Follow-up state
  const [followUpPlan, setFollowUpPlan] = useState<FollowUpPlan | null>(null)
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [showFollowUpForm, setShowFollowUpForm] = useState(false)
  const [followUpClientName, setFollowUpClientName] = useState('')
  const [followUpClientEmail, setFollowUpClientEmail] = useState('')
  const [generatingPlan, setGeneratingPlan] = useState(false)

  // Analytics state
  const [analytics, setAnalytics] = useState<{ views: number; plays: number; chats: number } | null>(null)

  // Quote state
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false)
  const [existingQuote, setExistingQuote] = useState<any>(null)
  const [quoteClientName, setQuoteClientName] = useState('')
  const [quoteClientEmail, setQuoteClientEmail] = useState('')
  const [quoteLineItems, setQuoteLineItems] = useState<{description: string, amount: number}[]>([
    { description: '', amount: 0 }
  ])
  const [quoteNotes, setQuoteNotes] = useState('')
  const [quoteSaving, setQuoteSaving] = useState(false)

  // Compute slide count and timestamps
  const slideUrls = video?.slide_urls ?? []
  const scenes = Array.isArray(video?.script) ? video.script : []
  const perSlideDurations: number[] = video?.slide_durations ?? []
  // Chapter chips are keyed to SCENES (the script), and slide_durations is keyed
  // to scenes too — NOT to slide_urls (which can be empty even when scenes exist,
  // e.g. cinematic/aurora videos that don't upload per-slide images). Use the
  // scene/duration count as the source of truth so timestamps render.
  const slideCount = scenes.length || slideUrls.length
  // True runtime: prefer the loaded <video> duration; else the DB column; else
  // the sum of per-scene durations (which is always present for rendered videos).
  const durationsSum = perSlideDurations.reduce((a, d) => a + (Number.isFinite(d) ? d : 0), 0)
  const effectiveDuration = videoDuration > 0 ? videoDuration
    : (Number.isFinite(video?.duration) && (video?.duration ?? 0) > 0) ? (video!.duration as number)
    : durationsSum
  const slideDuration = effectiveDuration > 0 && slideCount > 0 ? effectiveDuration / slideCount : 0

  // Build cumulative start times from per-slide durations (or fall back to equal division)
  const slideStartTimes = useMemo(() => {
    // Trust per-scene durations if every value is finite & >=0 (NaN/Infinity would
    // poison the cumulative sum). Keyed to the durations array length, not slideCount.
    const durationsValid = perSlideDurations.length > 0 &&
      perSlideDurations.every((d) => Number.isFinite(d) && d >= 0)
    if (durationsValid) {
      const starts: number[] = [0]
      for (let i = 0; i < perSlideDurations.length - 1; i++) {
        starts.push(starts[i] + perSlideDurations[i])
      }
      return starts
    }
    // Fallback: equal division (slideDuration is 0 when count/duration unknown,
    // which renders 0:00 — acceptable, never NaN/Infinity).
    const safeDur = Number.isFinite(slideDuration) && slideDuration >= 0 ? slideDuration : 0
    return Array.from({ length: slideCount }, (_, i) => i * safeDur)
  }, [perSlideDurations, slideCount, slideDuration])

  // Update current slide based on video time
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || slideCount === 0) return
    const time = videoRef.current.currentTime
    // Find which slide we're in by checking start times
    let idx = 0
    for (let i = slideStartTimes.length - 1; i >= 0; i--) {
      if (time >= slideStartTimes[i]) { idx = i; break }
    }
    setCurrentSlideIndex(Math.min(idx, slideCount - 1))
  }, [slideCount, slideStartTimes])

  // Jump video to a slide
  function jumpToSlide(index: number) {
    if (!videoRef.current || slideCount === 0) return
    // Use actual video duration from element, or DB duration as fallback
    const dur = videoRef.current.duration || videoDuration || (video as any)?.duration || 0
    const fallbackSlideDur = dur > 0 && slideCount > 0 ? dur / slideCount : 0
    const start = slideStartTimes[index] ?? (index * fallbackSlideDur)
    // Land a touch INTO the slide so the right frame shows. We must NOT clamp to
    // (dur - 0.1): if the summed slide durations run slightly longer than the
    // real video, the last slide's start lands past dur and the old clamp
    // snapped the seek back into the PREVIOUS slide — so clicking the final
    // thumbnail appeared to do nothing. Clamp instead against the NEXT slide's
    // start (or the video end only for the very last slide).
    const nextStart = slideStartTimes[index + 1]
    const ceiling = nextStart != null
      ? nextStart - 0.05                              // stay within this slide
      : (dur > 0 ? Math.max(dur - 0.05, start) : start) // last slide: clamp to end but never before its own start
    let seekTime = Math.min(start + 0.05, ceiling)
    if (!Number.isFinite(seekTime) || seekTime < 0) seekTime = Math.max(start, 0)
    videoRef.current.currentTime = seekTime
    setCurrentSlideIndex(index)
    if (videoRef.current.paused) videoRef.current.play().catch(() => {})
  }

  // Scroll chat to bottom
  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight
    }
  }, [chatMessages, chatLoading])

  // Send chat message
  async function sendChatMessage(text: string) {
    if (!text.trim() || chatLoading) return
    const userMsg: ChatMsg = { role: 'user', text: text.trim() }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)

    try {
      const slideContext = slideCount > 0 ? ` (currently viewing slide ${currentSlideIndex + 1} of ${slideCount})` : ''
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: params.id, message: text.trim() + slideContext }),
      })
      if (res.ok) {
        const data = await res.json()
        setChatMessages(prev => [...prev, { role: 'assistant', text: data.response ?? data.reply ?? data.message ?? 'I received your request. Let me work on that.' }])
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }])
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setChatLoading(false)
      chatInputRef.current?.focus()
    }
  }

  function VoiceInputButton({ onResult, disabled }: { onResult: (text: string) => void, disabled?: boolean }) {
    const [listening, setListening] = useState(false)

    function startListening() {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) return

      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => setListening(true)
      recognition.onend = () => setListening(false)
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript
        onResult(text)
      }
      recognition.onerror = () => setListening(false)

      recognition.start()
    }

    return (
      <button
        type="button"
        onClick={startListening}
        disabled={disabled || listening}
        title={listening ? 'Listening...' : 'Voice input'}
        style={{
          background: listening ? 'var(--mint)' : 'none',
          border: listening ? 'none' : '1px solid var(--border)',
          borderRadius: 8,
          padding: '6px 10px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={listening ? 'white' : 'var(--ink-light)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
    )
  }

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data } = await supabase
        .from('videos')
        .select('*, brand:brands(*)')
        .eq('id', params.id as string)
        .single()
      // Load user plan
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single()
        if (profile) setUserPlan(profile.subscription_status)
      }

      if (data) {
        setVideo(data as Video)

        // If status is pending or starting, trigger pipeline directly (proven to work)
        if ((data.status === 'pending' || data.status === 'starting') && !pipelineStarted.current) {
          pipelineStarted.current = true
          const input = (data.script as any)?._pipeline_input
          if (input) {
            console.log('[video] Triggering generate-video directly...')
            fetch('/api/generate-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                videoId: data.id,
                policyData: input.policyData,
                brandId: input.brandId,
                voiceId: input.voiceId,
                styleId: input.styleId,
                approvedSlides: input.approvedSlides,
                preGeneratedScenes: input.scenes,
                preGeneratedAudioId: input.preGeneratedAudioId,
                detailed: input.detailed,
                customStylePrompt: input.customStylePrompt,
                musicUrl: input.musicUrl,
                aiMusic: input.aiMusic,
                musicPrompt: input.musicPrompt,
                narrationStyle: input.narrationStyle,
                assetUrls: input.assets,
                purpose: input.purpose,
                uploadMode: input.uploadMode,
                industry: input.industry,
              }),
            }).then(res => {
              if (!res.ok) res.json().then(d => console.error('[video] Pipeline failed:', d.error)).catch(() => {})
            }).catch((err) => console.error('[video] Pipeline fetch error:', err))
          }
        }
      }
    }

    load()

    // Poll while processing
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('videos')
        .select('*, brand:brands(*)')
        .eq('id', params.id as string)
        .single()
      if (data) {
        setVideo(data as Video)
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval)
        }
        // Note: we do NOT auto-kill videos. The server-side pipeline handles
        // its own timeouts. The UI shows a "seems stuck?" retry option instead.
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [params.id])

  // Load follow-up plan and quote
  useEffect(() => {
    async function loadPlan() {
      const supabase = createClient()
      const { data: plan } = await supabase
        .from('follow_up_plans')
        .select('*, emails:follow_up_emails(*)')
        .eq('video_id', params.id as string)
        .single()
      if (plan) setFollowUpPlan(plan as FollowUpPlan)

      const { data: quoteData } = await supabase
        .from('quotes')
        .select('*')
        .eq('video_id', params.id as string)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (quoteData) setExistingQuote(quoteData)

      // Load analytics via API (bypasses RLS issues)
      try {
        const analyticsRes = await fetch(`/api/video-analytics?videoId=${params.id}`)
        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json()
          setAnalytics(analyticsData)
        } else {
          // Default to zeros if analytics table doesn't exist or query fails
          setAnalytics({ views: 0, plays: 0, chats: 0 })
        }
      } catch {
        setAnalytics({ views: 0, plays: 0, chats: 0 })
      }
    }
    loadPlan()
  }, [params.id])

  async function handleCreateFollowUp() {
    if (!followUpClientName.trim()) { setInlineNotice({ type: 'error', message: 'Please enter a client name' }); return }
    if (!followUpClientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(followUpClientEmail)) { setInlineNotice({ type: 'error', message: 'Please enter a valid email address' }); return }
    setGeneratingPlan(true)
    try {
      const res = await fetch('/api/follow-up/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: params.id }),
      })
      if (!res.ok) { setInlineNotice({ type: 'error', message: 'Failed to generate follow-up plan' }); return }
      const { suggestions } = await res.json()

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Create the plan
      const { data: plan, error: planErr } = await supabase
        .from('follow_up_plans')
        .insert({
          user_id: user.id,
          video_id: params.id as string,
          client_name: followUpClientName,
          client_email: followUpClientEmail,
          suggestions,
        })
        .select()
        .single()

      if (planErr || !plan) { setInlineNotice({ type: 'error', message: 'Failed to save plan' }); return }

      // Create individual email records
      const now = new Date()
      const emailRows = suggestions.map((s: any) => ({
        plan_id: plan.id,
        user_id: user.id,
        day_offset: s.dayOffset,
        subject: s.subject,
        body: s.body,
        scheduled_date: new Date(now.getTime() + s.dayOffset * 86400000).toISOString().split('T')[0],
        status: 'pending',
      }))

      const { data: emails } = await supabase
        .from('follow_up_emails')
        .insert(emailRows)
        .select()

      setFollowUpPlan({ ...plan, emails: emails ?? [] } as FollowUpPlan)
      setShowFollowUpForm(false)
    } catch (err) {
      console.error(err)
      setInlineNotice({ type: 'error', message: 'Error creating follow-up plan' })
    } finally {
      setGeneratingPlan(false)
    }
  }

  async function handleSendFollowUp(emailId: string) {
    setSendingEmail(emailId)
    try {
      const res = await fetch('/api/follow-up/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setInlineNotice({ type: 'error', message: data.error ?? 'Send failed' })
        return
      }
      // Update local state
      setFollowUpPlan(prev => {
        if (!prev) return prev
        return {
          ...prev,
          emails: prev.emails.map(e =>
            e.id === emailId ? { ...e, status: 'sent' as const, sent_at: new Date().toISOString() } : e
          ),
        }
      })
    } catch (err) {
      setInlineNotice({ type: 'error', message: 'Send failed' })
    } finally {
      setSendingEmail(null)
    }
  }

  async function handleSkipFollowUp(emailId: string) {
    const supabase = createClient()
    await supabase
      .from('follow_up_emails')
      .update({ status: 'skipped' })
      .eq('id', emailId)
    setFollowUpPlan(prev => {
      if (!prev) return prev
      return {
        ...prev,
        emails: prev.emails.map(e =>
          e.id === emailId ? { ...e, status: 'skipped' as const } : e
        ),
      }
    })
  }

  // Quote functions
  function addLineItem() {
    setQuoteLineItems([...quoteLineItems, { description: '', amount: 0 }])
  }
  function removeLineItem(index: number) {
    setQuoteLineItems(quoteLineItems.filter((_, i) => i !== index))
  }
  function updateLineItem(index: number, field: 'description' | 'amount', value: string | number) {
    const updated = [...quoteLineItems]
    updated[index] = { ...updated[index], [field]: value }
    setQuoteLineItems(updated)
  }

  function editQuote() {
    if (!existingQuote) return
    setQuoteClientName(existingQuote.client_name ?? '')
    setQuoteClientEmail(existingQuote.client_email ?? '')
    setQuoteLineItems(
      (existingQuote.line_items ?? []).map((i: any) => ({
        description: i.description,
        amount: i.amount / 100,
      }))
    )
    setQuoteNotes(existingQuote.notes ?? '')
    setShowQuoteBuilder(true)
  }

  async function removeQuote() {
    if (!existingQuote) return
    setConfirmAction({
      message: 'Remove this quote?',
      onConfirm: async () => {
        setConfirmAction(null)
        const supabase = createClient()
        await supabase.from('quotes').delete().eq('id', existingQuote.id)
        setExistingQuote(null)
      }
    })
  }

  async function saveQuote() {
    if (!video) return
    const validItems = quoteLineItems.filter(i => i.description.trim() && i.amount > 0)
    if (validItems.length === 0) { setInlineNotice({ type: 'error', message: 'Add at least one line item with a description and amount' }); return }
    if (quoteClientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quoteClientEmail)) { setInlineNotice({ type: 'error', message: 'Please enter a valid client email' }); return }
    setQuoteSaving(true)
    const subtotal = validItems.reduce((sum, i) => sum + i.amount, 0)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const quotePayload = {
      user_id: user!.id,
      video_id: video.id,
      client_name: quoteClientName || null,
      client_email: quoteClientEmail || null,
      line_items: validItems.map(i => ({ description: i.description, amount: Math.round(i.amount * 100) })),
      subtotal: Math.round(subtotal * 100),
      tax: 0,
      total: Math.round(subtotal * 100),
      status: 'sent',
      notes: quoteNotes || null,
    }

    if (existingQuote) {
      await supabase.from('quotes').update(quotePayload).eq('id', existingQuote.id)
      setExistingQuote({ ...existingQuote, ...quotePayload })
    } else {
      const { data } = await supabase.from('quotes').insert(quotePayload).select().single()
      if (data) setExistingQuote(data)
    }

    setQuoteSaving(false)
    setShowQuoteBuilder(false)
    setInlineNotice({ type: 'success', message: 'Quote saved successfully' })
  }

  function quoteStatusBadge(status: string) {
    const map: Record<string, string> = { draft: '', sent: 'peach', viewed: 'lilac', paid: 'mint' }
    return map[status] ?? ''
  }

  async function handleDelete() {
    // If video isn't completed, delete directly (no confirmation needed for stuck videos)
    if (video?.status !== 'completed') {
      setDeleting(true)
      const supabase = createClient()
      await supabase.from('videos').delete().eq('id', params.id as string)
      router.push('/videos')
      return
    }
    setConfirmAction({
      message: 'Delete this video? This cannot be undone.',
      onConfirm: async () => {
        setConfirmAction(null)
        setDeleting(true)
        const supabase = createClient()
        await supabase.from('videos').delete().eq('id', params.id as string)
        router.push('/videos')
      }
    })
    return
  }

  async function handleDownload() {
    if (!video?.video_url) return
    const res = await fetch(video.video_url)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${video.title ?? 'video'}.mp4`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDownloadPDF() {
    if (!video?.id) return
    setDownloadingPDF(true)
    try {
      const res = await fetch('/api/download-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id, title: video.title ?? 'Video Slides' }),
      })
      if (!res.ok) { setInlineNotice({ type: 'error', message: 'PDF generation failed' }); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${video.title ?? 'slides'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingPDF(false)
    }
  }

  async function handleDownloadPPTX() {
    if (!video?.id) return
    setDownloadingPPTX(true)
    try {
      const res = await fetch('/api/download-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id, title: video.title ?? 'Video Slides' }),
      })
      if (!res.ok) { setInlineNotice({ type: 'error', message: 'PPTX generation failed' }); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${video.title ?? 'slides'}.pptx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingPPTX(false)
    }
  }

  async function handleTranslate() {
    if (!video || !translateLang || translating) return
    setTranslating(true)
    try {
      const res = await fetch('/api/translate-presentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id, targetLanguage: translateLang }),
      })
      if (!res.ok) {
        const data = await res.json()
        setInlineNotice({ type: 'error', message: data.error ?? 'Translation failed' })
        return
      }
      const { videoId: newVideoId } = await res.json()
      setShowTranslateModal(false)
      setTranslateLang('')
      router.push(`/videos/${newVideoId}`)
    } catch {
      setInlineNotice({ type: 'error', message: 'Translation failed. Please try again.' })
    } finally {
      setTranslating(false)
    }
  }

  const [copied, setCopied] = useState(false)

  function copyShareLink() {
    const url = `${window.location.origin}/watch/${params.id}`

    const pipelineInput = (video?.script as any)?._pipeline_input
    const pd = pipelineInput?.policyData
    const isInsuranceVideo = !!(pd?.deathBenefit)

    if (isInsuranceVideo) {
      const textWithDisclaimer = `I've prepared a video overview of your policy illustration. Click below to watch:\n\n${url}\n\nImportant Disclosure: This video is for educational and informational purposes only and is not intended as legal, tax, or financial advice. Policy guarantees are based on the claims-paying ability of the issuing insurance company. Non-guaranteed values are subject to change. The policy contract and official carrier-issued illustration govern all policy values and guarantees. This video is not endorsed by or affiliated with any insurance carrier and is not a solicitation to purchase insurance. Please review all official policy materials and consult with your licensed professional before making any decisions.`
      navigator.clipboard.writeText(textWithDisclaimer)
    } else {
      navigator.clipboard.writeText(url)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  // ── Editable client-email composer (Share with Client) ──
  const watchUrl = () => `${typeof window !== 'undefined' ? window.location.origin : ''}/watch/${params.id}`

  // The default, friendly message body (editable). The watch link is NOT inlined
  // here — the modal renders a "View Your Video Now" button + raw link separately.
  function defaultShareBody(): string {
    const name = shareName.trim() || 'there'
    const pd = (video?.script as any)?._pipeline_input?.policyData
    if (pd?.deathBenefit) {
      return `Hi ${name},\n\nI've put together a short video overview of your policy illustration that walks you through the key details in plain language.\n\nIt only takes a couple of minutes — click the button below to watch.\n\nLet me know if you have any questions after watching.`
    }
    return `Hi ${name},\n\nI've put together a personalized video for you that walks through everything in plain language — it only takes a couple of minutes.\n\nClick the button below to watch it now.\n\nLet me know if you have any questions!`
  }

  const insuranceDisclaimer = `Important Disclosure: This video is for educational and informational purposes only and is not intended as legal, tax, or financial advice. Policy guarantees are based on the claims-paying ability of the issuing insurance company. Non-guaranteed values are subject to change. The policy contract and official carrier-issued illustration govern all policy values and guarantees. This video is not endorsed by or affiliated with any insurance carrier and is not a solicitation to purchase insurance. Please review all official policy materials and consult with your licensed professional before making any decisions.`

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  // Build the rich HTML email: message body + "View Your Video Now" button + raw
  // link at the bottom (+ insurance disclaimer when applicable).
  function buildShareEmailHtml(body: string): string {
    const url = watchUrl()
    const isIns = !!(video?.script as any)?._pipeline_input?.policyData?.deathBenefit
    const bodyHtml = escapeHtml(body).replace(/\n/g, '<br/>')
    return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a2b1f;font-size:15px;line-height:1.6;">
  <p style="margin:0 0 20px;">${bodyHtml}</p>
  <p style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 32px;border-radius:8px;">View Your Video Now →</a>
  </p>
  <p style="font-size:13px;color:#5b6b60;margin:24px 0 0;">Or paste this link into your browser:<br/><a href="${url}" style="color:#0d9488;">${url}</a></p>${isIns ? `\n  <p style="font-size:11px;color:#8a968d;margin-top:24px;line-height:1.5;">${escapeHtml(insuranceDisclaimer)}</p>` : ''}
</div>`
  }

  // Plain-text fallback for clients/clipboards that don't take rich HTML.
  function buildShareEmailText(body: string): string {
    const url = watchUrl()
    const isIns = !!(video?.script as any)?._pipeline_input?.policyData?.deathBenefit
    return `${body}\n\n► View Your Video Now: ${url}\n\nOr paste this link into your browser:\n${url}${isIns ? `\n\n${insuranceDisclaimer}` : ''}`
  }

  async function copyShareEmail() {
    const body = shareEmailBody || defaultShareBody()
    const html = buildShareEmailHtml(body)
    const text = buildShareEmailText(body)
    try {
      // Rich copy: HTML + plain fallback so it pastes styled into Gmail/Outlook.
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(text)
      }
    } catch {
      await navigator.clipboard.writeText(text)
    }
    setShareEmailCopied(true)
    setTimeout(() => setShareEmailCopied(false), 2500)
  }

  if (!video) {
    return (
      <div style={{ color: 'var(--ink-light)', padding: '64px', textAlign: 'center' }}>
        <span className="spinner lg" />
      </div>
    )
  }

  const currentSceneTitle = scenes[currentSlideIndex]?.title ?? null

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <style>{`
        @media (max-width: 767px) {
          .editor-layout {
            flex-direction: column !important;
          }
          .editor-left, .editor-right {
            width: 100% !important;
            min-height: auto !important;
          }
          .editor-right {
            max-height: 60vh !important;
          }
          .action-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        .chat-input-wrap:focus-within {
          border-color: var(--mint) !important;
        }
        .typing-dots span {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--ink-light);
          margin: 0 2px;
          animation: typingBounce 1.2s infinite;
        }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        .slide-thumb {
          cursor: pointer;
          border: 2px solid transparent;
          border-radius: 6px;
          overflow: hidden;
          flex-shrink: 0;
          transition: border-color 0.15s, transform 0.15s;
        }
        .slide-thumb:hover {
          transform: scale(1.05);
        }
        .slide-thumb.active {
          border-color: var(--mint);
          box-shadow: 0 0 0 2px rgba(0,200,150,0.25);
        }
        .quick-action-btn {
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: white;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          color: var(--ink);
          text-align: center;
        }
        .quick-action-btn:hover {
          background: var(--bg);
          border-color: var(--mint);
        }
        .action-grid button {
          padding: 10px 8px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          text-align: center;
          white-space: nowrap;
        }
      `}</style>

      {/* Page Header */}
      <Link href="/videos" className="back-link">
        &larr; Back to Library
      </Link>

      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {video.title ?? 'Untitled'}
        </h1>
        <div style={{ fontSize: 14, color: 'var(--ink-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {video.duration && ` \u00b7 ${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}`}
          {(video as any).brand && (
            <>
              {' \u00b7 '}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {(video as any).brand.primary_color && (
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: (video as any).brand.primary_color, display: 'inline-block' }} />
                )}
                {(video as any).brand.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Analytics Stats */}
      {video.status === 'completed' && (
        <div style={{
          display: 'flex',
          gap: 16,
          marginBottom: 24,
        }}>
          {[
            { label: 'Views', value: analytics?.views ?? 0 },
            { label: 'Plays', value: analytics?.plays ?? 0 },
            // Only show the chat card if this video actually has chat activity.
            ...((analytics?.chats ?? 0) > 0 ? [{ label: 'Chat Messages', value: analytics?.chats ?? 0 }] : []),
          ].map(stat => (
            <div key={stat.label} style={{
              flex: 1,
              background: 'white',
              border: '1px solid var(--border-light)',
              borderRadius: 10,
              padding: '16px 20px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Processing states */}
      {video.status !== 'completed' && video.status !== 'failed' && (
        <>
          <VideoProgress status={video.status} createdAt={video.created_at} progressDetail={video.progress_detail ?? null} progressPct={video.progress_pct ?? null} sceneCount={Array.isArray(video.script) ? video.script.length : (video.script as any)?._pipeline_input?.scenes?.length ?? 8} />
          <div style={{
            marginTop: 20,
            padding: '14px 20px',
            background: 'var(--bg-soft)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
            color: 'var(--ink-soft)',
            maxWidth: 640,
            margin: '20px auto 0',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker)" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <span>You can navigate away — we&apos;ll keep building your video. You&apos;ll find it in your <a href="/videos" style={{color: 'var(--mint-darker)', fontWeight: 600}}>library</a> when it&apos;s done.</span>
          </div>
        </>
      )}

      {video.status === 'failed' && (
        <div style={{
          background: 'white',
          border: '1px solid var(--rose)',
          borderRadius: 10,
          padding: '48px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '18px', fontWeight: 700, color: '#C03A1F', marginBottom: '8px' }}>
            Video Generation Failed
          </p>
          {video.error_message && (
            <p style={{ fontSize: '14px', color: 'var(--ink-soft)', marginBottom: '16px' }}>{video.error_message}</p>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
            <button
              onClick={async () => {
                const supabase = createClient()
                await supabase.from('videos').update({ status: 'pending', error_message: null }).eq('id', video.id)
                pipelineStarted.current = false
                setVideo({ ...video, status: 'pending', error_message: null } as Video)
              }}
              className="btn btn-primary"
            >
              Retry Generation
            </button>
            <a href="/create" className="btn btn-soft">Create New</a>
          </div>
        </div>
      )}

      {video.status !== 'completed' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '28px' }}>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn btn-danger"
            style={deleting ? { opacity: 0.5 } : undefined}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}

      {/* Two-column editor layout -- only when completed */}
      {video.status === 'completed' && video.video_url && (
        <div
          className="editor-layout"
          style={{
            display: 'flex',
            gap: 24,
            alignItems: 'stretch',
          }}
        >
          {/* LEFT COLUMN -- 60% -- Video + Thumbnails + Actions */}
          <div
            className="editor-left"
            style={{
              width: '60%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Video Player */}
            <div style={{
              background: '#000',
              borderRadius: 10,
              overflow: 'hidden',
              border: '1px solid var(--border-light)',
            }}>
              <video
                ref={videoRef}
                src={`${video.video_url}${video.video_url?.includes('?') ? '&' : '?'}v=${new Date(video.updated_at ?? video.created_at).getTime()}`}
                poster={video.thumbnail_url ?? undefined}
                controls
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={() => {
                  if (videoRef.current) setVideoDuration(videoRef.current.duration)
                }}
                onPlay={() => {
                  if (musicRef.current && video?.music_url) musicRef.current.play().catch(() => {})
                }}
                onPause={() => {
                  if (musicRef.current) musicRef.current.pause()
                }}
                onSeeking={() => {
                  if (musicRef.current && videoRef.current) {
                    const musicDur = musicRef.current.duration
                    if (musicDur && musicDur > 0) {
                      musicRef.current.currentTime = videoRef.current.currentTime % musicDur
                    }
                  }
                }}
                style={{ width: '100%', display: 'block', maxHeight: '50vh' }}
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

            {/* Music volume control */}
            {video.music_url && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 4px 0',
                fontSize: 12,
                color: 'var(--ink-soft)',
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
                    color: musicMuted ? 'var(--ink-light)' : 'var(--ink-soft)',
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
                  style={{ flex: 1, maxWidth: 140, accentColor: 'var(--mint)' }}
                />
                <span style={{ fontSize: 11, color: 'var(--ink-light)', minWidth: 30 }}>
                  {musicMuted ? 'Off' : `${Math.round(musicVolume * 100)}%`}
                </span>
              </div>
            )}

            {/* Slide indicator */}
            {slideCount > 0 && (
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--ink-soft)',
                padding: '0 4px',
              }}>
                Slide {currentSlideIndex + 1} of {slideCount}
                {currentSceneTitle && (
                  <span style={{ fontWeight: 400, marginLeft: 8, color: 'var(--ink-light)' }}>
                    &mdash; {currentSceneTitle}
                  </span>
                )}
              </div>
            )}

            {/* Horizontal scrollable thumbnail strip */}
            {slideCount > 0 && (
              <div style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                padding: '4px 0',
              }}>
                {slideUrls.map((url, i) => (
                  <div
                    key={i}
                    className={`slide-thumb${i === currentSlideIndex ? ' active' : ''}`}
                    onClick={() => jumpToSlide(i)}
                    style={{ position: 'relative' }}
                  >
                    <img
                      src={url}
                      alt={`Slide ${i + 1}`}
                      style={{
                        width: 160,
                        height: 90,
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 2,
                      left: 2,
                      background: 'rgba(0,0,0,0.65)',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 4,
                    }}>
                      {i + 1}
                    </div>
                    {/* Enlarge — thumbnails are small; open a readable lightbox. */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex(i) }}
                      title="Enlarge slide"
                      style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 22, height: 22, borderRadius: 5, border: 'none',
                        background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer',
                        fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      ⤢
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Chapter markers — show whenever we have scenes (timing comes from
                slide_durations / effectiveDuration, which exist even before the
                <video> element reports its duration). */}
            {scenes.length > 0 && (
              <div style={{
                display: 'flex', gap: 6, flexWrap: 'wrap', padding: '4px 0',
              }}>
                {scenes.map((scene: any, i: number) => {
                  // Guard against NaN/Infinity: `??` only catches null/undefined,
                  // so a bad value would render "NaN:NaN"/"Infinity:NaN". Use even
                  // spacing (off effectiveDuration) as the fallback, forced finite.
                  const evenSpaced = slideCount > 0 ? (effectiveDuration / slideCount) * i : 0
                  const raw = slideStartTimes[i]
                  const ts = Number.isFinite(raw) ? (raw as number) : evenSpaced
                  const timestamp = Number.isFinite(ts) && ts >= 0 ? ts : 0
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
                        border: isActive ? '1.5px solid var(--mint)' : '1px solid var(--border-light)',
                        background: isActive ? 'rgba(168,240,212,0.12)' : 'white',
                        cursor: 'pointer', fontSize: 12, fontWeight: isActive ? 700 : 500,
                        color: isActive ? 'var(--ink)' : 'var(--ink-soft)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--ink-light)' }}>
                        {mins}:{secs.toString().padStart(2, '0')}
                      </span>
                      <span>{scene.title || `Scene ${i + 1}`}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Inline notification */}
            {inlineNotice && (
              <div style={{
                padding: '12px 16px', borderRadius: 10, marginBottom: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: inlineNotice.type === 'error' ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${inlineNotice.type === 'error' ? '#fca5a5' : '#86efac'}`,
                color: inlineNotice.type === 'error' ? '#991b1b' : '#166534',
                fontSize: 13,
              }}>
                <span>{inlineNotice.message}</span>
                <button onClick={() => setInlineNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', padding: '0 4px' }}>&times;</button>
              </div>
            )}

            {/* Inline confirmation dialog */}
            {confirmAction && (
              <div style={{
                padding: '14px 16px', borderRadius: 10, marginBottom: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#fffbeb', border: '1px solid #fcd34d',
                fontSize: 13,
              }}>
                <span style={{ color: '#92400e', fontWeight: 500 }}>{confirmAction.message}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmAction(null)} className="btn btn-soft btn-sm">Cancel</button>
                  <button onClick={confirmAction.onConfirm} className="btn btn-sm" style={{ background: '#dc2626', color: 'white', border: 'none' }}>Confirm</button>
                </div>
              </div>
            )}

            {/* Action buttons row -- all same size, evenly spaced */}
            <div
              className="action-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 10,
                marginTop: 8,
              }}
            >
              <button onClick={() => { setShareEmailBody(''); setShareEmailBodyTouched(false); setShareEmailCopied(false); setShowShareModal(true) }} className="btn btn-mint" style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8 }}>
                Share with Client
              </button>
              <button onClick={copyShareLink} className={`btn ${copied ? 'btn-mint' : 'btn-soft'}`} style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8, transition: 'all 0.2s ease' }}>
                {copied ? '\u2713 Copied!' : 'Copy Link'}
              </button>
              <button onClick={handleDownload} className="btn btn-soft" style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8 }}>
                MP4
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={downloadingPDF}
                className="btn btn-soft"
                style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8, ...(downloadingPDF ? { opacity: 0.5 } : {}) }}
              >
                {downloadingPDF ? 'PDF...' : 'PDF'}
              </button>
              <button
                onClick={handleDownloadPPTX}
                disabled={downloadingPPTX}
                className="btn btn-soft"
                style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8, ...(downloadingPPTX ? { opacity: 0.5 } : {}) }}
              >
                {downloadingPPTX ? 'PPTX...' : 'PPTX'}
              </button>
              <button
                onClick={() => {
                  const scriptData = video.script as any
                  let scriptText = ''
                  if (Array.isArray(scriptData)) {
                    scriptText = scriptData.map((s: any, i: number) =>
                      `Scene ${i + 1}: ${s.title || ''}\n${s.narration || ''}\n`
                    ).join('\n---\n\n')
                  }
                  if (!scriptText) return
                  const blob = new Blob([scriptText], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${video.title ?? 'script'}.txt`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="btn btn-soft"
                style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8 }}
              >
                Script
              </button>
              <button
                onClick={() => router.push(`/create?duplicate=${video.id}`)}
                className="btn btn-soft"
                style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8 }}
              >
                Duplicate
              </button>
              <button
                onClick={async () => {
                  if (socialLoading) return
                  setSocialLoading(true)
                  setSocialPosts(null)
                  setShowSocialModal(true)
                  try {
                    const res = await fetch('/api/generate-social-post', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ videoId: video.id }),
                    })
                    if (!res.ok) throw new Error('Failed to generate posts')
                    const data = await res.json()
                    setSocialPosts(data)
                  } catch {
                    setSocialPosts(null)
                  } finally {
                    setSocialLoading(false)
                  }
                }}
                className="btn btn-soft"
                style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8 }}
              >
                Social Posts
              </button>
              <button
                onClick={() => {
                  const videoScenes = Array.isArray(video.script) ? video.script.map((s: any, i: number) => ({
                    scene: i + 1,
                    title: s.title ?? `Scene ${i + 1}`,
                    narration: s.narration ?? '',
                    slidePrompt: s.slidePrompt ?? '',
                  })) : []
                  setEditorScenes(videoScenes)
                  setEditorSlides((video.slide_urls ?? []).map((url: string) => url))
                  setChangedAudioIndexes(new Set())
                  setShowEditor(true)
                }}
                className="btn btn-primary"
                style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8 }}
              >
                Edit Video
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn btn-danger"
                style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8, ...(deleting ? { opacity: 0.5 } : {}) }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN -- 40% -- Slide Thumbnails */}
          <div
            className="editor-right"
            style={{
              width: '40%',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg)',
              border: '1px solid var(--border-light)',
              borderRadius: 10,
              overflow: 'hidden',
              minHeight: 480,
              maxHeight: 'calc(100vh - 200px)',
            }}
          >
            {/* Slide thumbnails */}
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-light)',
              background: 'white',
              flexShrink: 0,
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--ink-light)',
                marginBottom: 4,
              }}>
                Slides ({slideCount})
              </div>
              {/* Fix-a-Scene: only for slide-deck videos (which persist a plan) */}
              {(video as any)?.slide_plan_url && video?.status === 'completed' && (
                <button onClick={() => setShowFixScene(true)} style={{
                  marginTop: 8, width: '100%', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  border: '1.5px solid var(--mint)', background: 'rgba(199,232,168,0.14)', color: 'var(--ink)',
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                }}>✏️ Fix a scene (glitch, wording, or pronunciation)</button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slideUrls.map((url: string, i: number) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, alignItems: 'center',
                  padding: '8px 10px', borderRadius: 8,
                  background: currentSlideIndex === i ? 'rgba(168,240,212,0.15)' : 'transparent',
                  border: currentSlideIndex === i ? '1px solid var(--mint)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }} onClick={() => jumpToSlide(i)}>
                  <img src={url} alt={`Slide ${i+1}`} style={{ width: 80, borderRadius: 6, border: '1px solid var(--border-light)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>Slide {i + 1}</div>
                    {scenes[i] && (
                      <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>
                        {(scenes[i] as any).title ?? ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Script Editor -- full width, below video */}
      {showEditor && video.status === 'completed' && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Edit Video</h2>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-soft"
                onClick={() => setShowEditor(false)}
                style={{ fontSize: 13, borderRadius: 8 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  setReRendering(true)
                  setReRenderProgress('Starting re-render...')
                  try {
                    const res = await fetch('/api/re-render', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        videoId: video.id,
                        updatedScenes: editorScenes.map((s, i) => ({ ...s, duration: 0 })),
                        updatedSlideUrls: editorSlides.filter(Boolean) as string[],
                        changedAudioIndexes: Array.from(changedAudioIndexes),
                        voiceId: (video as any).voice_id ?? 'nova',
                      }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    // Refresh video data
                    setVideo(prev => prev ? {
                      ...prev,
                      video_url: data.videoUrl,
                      slide_urls: data.slideUrls,
                      duration: data.duration,
                      script: editorScenes.map(s => ({ ...s, beat: 'context' as const, duration: 0 })),
                    } : prev)
                    setShowEditor(false)
                    setReRenderProgress('')
                  } catch (err) {
                    setInlineNotice({ type: 'error', message: err instanceof Error ? err.message : 'Re-render failed' })
                  } finally {
                    setReRendering(false)
                  }
                }}
                disabled={reRendering}
                style={{ fontSize: 13, borderRadius: 8, opacity: reRendering ? 0.6 : 1 }}
              >
                {reRendering ? reRenderProgress || 'Re-rendering...' : 'Save & Regenerate'}
              </button>
            </div>
          </div>
          <ScriptEditor
            scenes={editorScenes}
            slides={editorSlides}
            onScenesChange={(newScenes) => setEditorScenes(newScenes)}
            onSlidesChange={(newSlides) => setEditorSlides(newSlides)}
            onRegenerateAudio={async (sceneIndex, _newNarration) => {
              setChangedAudioIndexes(prev => new Set(prev).add(sceneIndex))
            }}
            onDeleteScene={(sceneIndex) => {
              if (editorScenes.length <= 2) return
              setEditorScenes(prev => prev.filter((_, i) => i !== sceneIndex))
              setEditorSlides(prev => prev.filter((_, i) => i !== sceneIndex))
            }}
            onEditSlide={async (sceneIndex, instruction) => {
              const currentSlide = editorSlides[sceneIndex]
              if (!currentSlide) return
              const res = await fetch('/api/edit-slide', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentSlideBase64: currentSlide, editInstruction: instruction }),
              })
              const data = await res.json()
              if (!res.ok) throw new Error(data.error)
              const newSlides = [...editorSlides]
              newSlides[sceneIndex] = data.image
              setEditorSlides(newSlides)
            }}
            onRedoSlide={async () => {
              // Regeneration removed — content is now reviewed at script stage
            }}
          />
        </div>
      )}

      {/* Follow-Up Plan Section -- below columns, full width */}
      {PRO_PLANS.includes(userPlan.toLowerCase()) && video.status === 'completed' && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Follow-Up Plan</h2>

          {!followUpPlan && !showFollowUpForm && (
            <div style={{
              background: 'white',
              border: '1px dashed var(--border)',
              borderRadius: 10,
              padding: '32px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 14 }}>
                Create an AI-drafted follow-up email sequence for this presentation.
              </p>
              <button onClick={() => setShowFollowUpForm(true)} className="btn btn-primary">
                Create Follow-Up Plan
              </button>
            </div>
          )}

          {!followUpPlan && showFollowUpForm && (
            <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Jane Smith"
                  value={followUpClientName}
                  onChange={e => setFollowUpClientName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="jane@example.com"
                  value={followUpClientEmail}
                  onChange={e => setFollowUpClientEmail(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleCreateFollowUp}
                  disabled={generatingPlan || !followUpClientName || !followUpClientEmail}
                  className="btn btn-primary"
                  style={generatingPlan ? { opacity: 0.6 } : undefined}
                >
                  {generatingPlan ? 'Generating...' : 'Generate Follow-Up Emails'}
                </button>
                <button onClick={() => setShowFollowUpForm(false)} className="btn btn-soft">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {followUpPlan && (
            <div>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 14 }}>
                Follow-up plan for <strong>{followUpPlan.client_name}</strong> ({followUpPlan.client_email})
              </p>
              <div style={{
                background: 'white',
                border: '1px solid var(--border-light)',
                borderRadius: 10,
                overflow: 'hidden',
              }}>
                {(followUpPlan.emails ?? [])
                  .sort((a, b) => a.day_offset - b.day_offset)
                  .map((email, i, arr) => (
                  <div
                    key={email.id}
                    style={{
                      padding: '16px 20px',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
                        Day {email.day_offset} &mdash; {toneLabel(email.day_offset)}
                      </span>
                      <span className={`tag ${statusClass(email.status)}`} style={{ fontSize: 11 }}>
                        {statusLabel(email.status)}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                      {email.subject}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                        className="btn btn-soft btn-sm"
                      >
                        {expandedEmail === email.id ? 'Hide Preview' : 'Preview'}
                      </button>
                      {email.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleSendFollowUp(email.id)}
                            disabled={sendingEmail === email.id}
                            className="btn btn-mint btn-sm"
                            style={sendingEmail === email.id ? { opacity: 0.6 } : undefined}
                          >
                            {sendingEmail === email.id ? 'Sending...' : 'Send Now'}
                          </button>
                          <button
                            onClick={() => handleSkipFollowUp(email.id)}
                            className="btn btn-sm"
                            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                          >
                            Skip
                          </button>
                        </>
                      )}
                    </div>
                    {expandedEmail === email.id && (
                      <div style={{
                        marginTop: 12,
                        padding: '14px 16px',
                        background: 'var(--bg)',
                        borderRadius: 8,
                        fontSize: 13,
                        lineHeight: 1.7,
                        color: 'var(--ink-soft)',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {email.body}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quote / Invoice Section -- below columns, full width */}
      {PRO_PLANS.includes(userPlan.toLowerCase()) && video.status === 'completed' && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Quote / Invoice</h2>

          {!existingQuote && !showQuoteBuilder && (
            <div style={{
              background: 'white',
              border: '1px dashed var(--border)',
              borderRadius: 10,
              padding: '32px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 14 }}>
                Attach pricing to this presentation. Your client will see a payment button on the share page.
              </p>
              <button onClick={() => setShowQuoteBuilder(true)} className="btn btn-primary">
                Add Quote &rarr;
              </button>
            </div>
          )}

          {existingQuote && !showQuoteBuilder && (
            <div style={{
              background: 'white',
              border: '1px solid var(--border-light)',
              borderRadius: 10,
              padding: '24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>Quote</span>
                <span className={`tag ${quoteStatusBadge(existingQuote.status)}`} style={{ fontSize: 11 }}>
                  {existingQuote.status.charAt(0).toUpperCase() + existingQuote.status.slice(1)}
                </span>
              </div>
              {existingQuote.client_name && (
                <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 4 }}>
                  {existingQuote.client_name} {existingQuote.client_email ? `(${existingQuote.client_email})` : ''}
                </p>
              )}
              <div style={{ borderTop: '1px solid var(--border-light)', marginTop: 12, paddingTop: 12 }}>
                {(existingQuote.line_items ?? []).map((item: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    fontSize: 14,
                    borderBottom: i < (existingQuote.line_items ?? []).length - 1 ? '1px solid var(--border-light)' : 'none',
                  }}>
                    <span>{item.description}</span>
                    <span style={{ fontWeight: 600 }}>${(item.amount / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 12,
                paddingTop: 12,
                borderTop: '2px solid var(--ink)',
                fontSize: 16,
                fontWeight: 700,
              }}>
                <span>Total</span>
                <span>${(existingQuote.total / 100).toFixed(2)}</span>
              </div>
              {existingQuote.notes && (
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 12 }}>{existingQuote.notes}</p>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={editQuote} className="btn btn-soft">Edit</button>
                <button onClick={removeQuote} className="btn btn-danger btn-sm">Remove</button>
              </div>
            </div>
          )}

          {showQuoteBuilder && (
            <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Jane Smith"
                  value={quoteClientName}
                  onChange={e => setQuoteClientName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="jane@example.com"
                  value={quoteClientEmail}
                  onChange={e => setQuoteClientEmail(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Line Items</label>
                {quoteLineItems.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 8,
                    paddingBottom: 8,
                    borderBottom: i < quoteLineItems.length - 1 ? '1px solid var(--border-light)' : 'none',
                  }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Description"
                      value={item.description}
                      onChange={e => updateLineItem(i, 'description', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <div style={{ position: 'relative', width: 120 }}>
                      <span style={{
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 14,
                        color: 'var(--ink-soft)',
                        pointerEvents: 'none',
                      }}>$</span>
                      <input
                        type="number"
                        className="input"
                        placeholder="0.00"
                        value={item.amount || ''}
                        onChange={e => updateLineItem(i, 'amount', parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', paddingLeft: 22 }}
                        step="0.01"
                        min="0"
                      />
                    </div>
                    {quoteLineItems.length > 1 && (
                      <button
                        onClick={() => removeLineItem(i)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addLineItem} className="btn btn-soft btn-sm" style={{ marginTop: 4 }}>
                  + Add line item
                </button>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderTop: '2px solid var(--ink)',
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 20,
              }}>
                <span>Subtotal</span>
                <span>${quoteLineItems.reduce((sum, i) => sum + (i.amount || 0), 0).toFixed(2)}</span>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Notes (optional)</label>
                <textarea
                  className="input"
                  placeholder="Payment terms, additional details..."
                  value={quoteNotes}
                  onChange={e => setQuoteNotes(e.target.value)}
                  style={{ width: '100%', minHeight: 80, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={saveQuote}
                  disabled={quoteSaving}
                  className="btn btn-primary"
                  style={quoteSaving ? { opacity: 0.6 } : undefined}
                >
                  {quoteSaving ? 'Saving...' : 'Save Quote'}
                </button>
                <button
                  onClick={() => setShowQuoteBuilder(false)}
                  className="btn btn-soft"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slide lightbox — large, readable view of a slide (thumbnails are tiny). */}
      {/* Fix-a-Scene modal */}
      {showFixScene && video && (
        <FixScene
          videoId={video.id}
          planUrl={(video as any).slide_plan_url}
          slideUrls={slideUrls}
          script={scenes as any}
          sceneFixCost={50}
          onClose={() => setShowFixScene(false)}
          onStarted={() => { setShowFixScene(false); if (typeof window !== 'undefined') window.location.reload() }}
        />
      )}

      {lightboxIndex !== null && slideUrls[lightboxIndex] && (
        <div
          onClick={() => setLightboxIndex(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,12,16,0.88)', backdropFilter: 'blur(6px)', padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <img
              src={slideUrls[lightboxIndex]}
              alt={`Slide ${lightboxIndex + 1}`}
              style={{ maxWidth: '90vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 12px 48px rgba(0,0,0,0.5)' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: '#fff' }}>
              <button
                onClick={() => setLightboxIndex(Math.max(0, lightboxIndex - 1))}
                disabled={lightboxIndex === 0}
                style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', cursor: lightboxIndex === 0 ? 'default' : 'pointer', opacity: lightboxIndex === 0 ? 0.4 : 1, fontSize: 14, fontFamily: 'inherit' }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                Slide {lightboxIndex + 1} of {slideCount}
                {scenes[lightboxIndex]?.title ? ` · ${scenes[lightboxIndex].title}` : ''}
              </span>
              <button
                onClick={() => setLightboxIndex(Math.min(slideCount - 1, lightboxIndex + 1))}
                disabled={lightboxIndex >= slideCount - 1}
                style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', cursor: lightboxIndex >= slideCount - 1 ? 'default' : 'pointer', opacity: lightboxIndex >= slideCount - 1 ? 0.4 : 1, fontSize: 14, fontFamily: 'inherit' }}
              >
                Next →
              </button>
            </div>
          </div>
          <button
            onClick={() => setLightboxIndex(null)}
            title="Close"
            style={{ position: 'absolute', top: 20, right: 24, width: 40, height: 40, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && video && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,26,18,0.5)', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: '100%', maxWidth: 480, background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Share with Client</h2>
              <button onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-light)' }}>&times;</button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: -8, marginBottom: 18, lineHeight: 1.5 }}>
              Edit the message below, then copy the whole email and paste it into Gmail, Outlook, or any email app. The link is added automatically as a <strong>&ldquo;View Your Video Now&rdquo;</strong> button.
            </p>

            {/* Client name → personalizes the greeting */}
            <div className="form-group">
              <label className="input-label">Client name (optional)</label>
              <input
                className="input"
                placeholder="e.g. Sarah"
                value={shareName}
                onChange={e => {
                  setShareName(e.target.value)
                  // Re-seed the greeting only if the user hasn't hand-edited the body.
                  if (!shareEmailBodyTouched) setShareEmailBody('')
                }}
              />
            </div>

            {/* Editable email message */}
            <div className="form-group">
              <label className="input-label">Email message</label>
              <textarea
                className="input"
                rows={7}
                value={shareEmailBody || defaultShareBody()}
                onChange={e => { setShareEmailBody(e.target.value); setShareEmailBodyTouched(true) }}
                style={{ resize: 'vertical', lineHeight: 1.5, fontSize: 14 }}
              />
            </div>

            {/* What gets appended automatically */}
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '14px 16px', marginBottom: 18, textAlign: 'center' }}>
              <span style={{ display: 'inline-block', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13, padding: '9px 20px', borderRadius: 8 }}>View Your Video Now →</span>
              <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 10, wordBreak: 'break-all' }}>
                Link: {watchUrl()}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={copyShareEmail} className="btn btn-primary" style={{ flex: 1 }}>
                {shareEmailCopied ? '✓ Copied — paste into your email' : 'Copy Email'}
              </button>
              <button onClick={() => setShowShareModal(false)} className="btn btn-soft" style={{ flexShrink: 0 }}>
                Done
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16, marginTop: 16, fontSize: 12, color: 'var(--ink-light)', textAlign: 'center' }}>
              Your client opens a branded page with your video — and you&rsquo;ll get notified when they watch it.
            </div>
          </div>
        </div>
      )}

      {/* Translate Modal */}
      {showTranslateModal && video && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,26,18,0.5)', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Translate Presentation</h2>
              <button onClick={() => { setShowTranslateModal(false); setTranslateLang('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-light)' }}>&times;</button>
            </div>

            <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 20, lineHeight: 1.5 }}>
              Create a translated copy of this presentation. A new video will be generated with translated narration and slides.
            </p>

            <label className="input-label" style={{ marginBottom: 6, display: 'block' }}>Select language</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
              {[
                'Spanish', 'French', 'Portuguese', 'German', 'Korean',
                'Japanese', 'Chinese (Simplified)', 'Arabic', 'Hindi', 'Italian',
              ].map(lang => (
                <button
                  key={lang}
                  onClick={() => setTranslateLang(lang)}
                  style={{
                    padding: '10px 12px',
                    fontSize: 13,
                    fontWeight: translateLang === lang ? 700 : 500,
                    borderRadius: 8,
                    border: translateLang === lang ? '2px solid var(--mint)' : '1px solid var(--border)',
                    background: translateLang === lang ? 'rgba(168,240,212,0.12)' : 'white',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 20, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
              Translated presentations use 1 additional credit.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleTranslate}
                disabled={!translateLang || translating}
                className="btn btn-primary"
                style={{ flex: 1, opacity: !translateLang || translating ? 0.5 : 1 }}
              >
                {translating ? 'Translating...' : `Translate to ${translateLang || '...'}`}
              </button>
              <button
                onClick={() => { setShowTranslateModal(false); setTranslateLang('') }}
                className="btn btn-soft"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Social Posts Modal */}
      {showSocialModal && video && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,26,18,0.5)', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: '100%', maxWidth: 520, background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 32, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Social Posts</h2>
              <button onClick={() => { setShowSocialModal(false); setSocialPosts(null); setSocialCopied(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-light)' }}>&times;</button>
            </div>

            {socialLoading && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>Generating social posts...</div>
              </div>
            )}

            {!socialLoading && !socialPosts && (
              <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 14, color: 'var(--ink-soft)' }}>
                Failed to generate posts. Please try again.
              </div>
            )}

            {socialPosts && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {([
                  { key: 'linkedin' as const, label: 'LinkedIn', color: '#0A66C2' },
                  { key: 'twitter' as const, label: 'X / Twitter', color: '#1DA1F2' },
                  { key: 'facebook' as const, label: 'Facebook', color: '#1877F2' },
                ] as const).map(({ key, label, color }) => (
                  <div key={key} style={{ border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(socialPosts[key] || '')
                          setSocialCopied(key)
                          setTimeout(() => setSocialCopied(null), 2000)
                        }}
                        className="btn btn-soft"
                        style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6 }}
                      >
                        {socialCopied === key ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div style={{ padding: '14px 16px', fontSize: 13, lineHeight: 1.6, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
                      {socialPosts[key]}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => { setShowSocialModal(false); setSocialPosts(null); setSocialCopied(null) }}
                className="btn btn-soft"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
