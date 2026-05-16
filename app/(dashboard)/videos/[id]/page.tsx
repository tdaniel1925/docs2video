'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../_lib/supabase/client'
import SendEmailModal from '../../../_components/SendEmailModal'
import ScriptEditor from '../../../_components/ScriptEditor'
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

function VideoProgress({ status, createdAt, progressDetail, progressPct }: { status: string; createdAt: string; progressDetail: string | null; progressPct: number | null }) {
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
  const pct = progressPct != null ? Math.min(95, progressPct) : fallbackPct
  const currentStep = PROGRESS_STEPS[effectiveIdx] ?? PROGRESS_STEPS[0]

  const estimatedTotal = 300 // ~5 minutes
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
        background: 'white', borderRadius: 16, padding: '36px 32px',
        border: '1px solid var(--border-light)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        textAlign: 'center', marginBottom: 20,
      }}>
        {/* Big percentage */}
        <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {pct}%
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 4, marginBottom: 20 }}>
          {elapsedMin}:{elapsedSec.toString().padStart(2, '0')} elapsed
          {timeRemaining > 0 && ` · ~${minutes}:${seconds.toString().padStart(2, '0')} remaining`}
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
          borderRadius: 12, padding: '12px 24px',
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
        background: 'white', borderRadius: 16, padding: '24px 28px',
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
        borderRadius: 12, padding: '14px 20px', marginBottom: 20,
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

      {/* Stuck? retry option — shows after 10 minutes */}
      {elapsed > 600 && (
        <div style={{
          marginTop: 20, padding: '16px 20px', borderRadius: 12,
          background: 'rgba(255,199,194,0.1)', border: '1px solid rgba(192,58,31,0.2)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#C03A1F', marginBottom: 6 }}>
            Taking longer than expected?
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
            Your video may still be processing. If it seems stuck, you can retry.
          </div>
          <button
            onClick={async () => {
              const sb = createClient()
              await sb.from('videos').update({ status: 'pending' }).eq('id', window.location.pathname.split('/').pop()!)
              window.location.reload()
            }}
            className="btn btn-soft btn-sm"
            style={{ color: '#C03A1F' }}
          >
            Retry Generation
          </button>
        </div>
      )}
    </div>
  )
}

const PRO_PLANS = ['professional', 'active', 'agency']

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
  const [deleting, setDeleting] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [downloadingPPTX, setDownloadingPPTX] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [shareName, setShareName] = useState('')
  const pipelineStarted = useRef(false)
  const [userPlan, setUserPlan] = useState<string>('trial')
  const [regeneratingSlide, setRegeneratingSlide] = useState<number | null>(null)

  // Editor state
  const [showEditor, setShowEditor] = useState(false)
  const [editorScenes, setEditorScenes] = useState<{scene: number; title: string; narration: string; slidePrompt: string}[]>([])
  const [editorSlides, setEditorSlides] = useState<(string | null)[]>([])
  const [reRendering, setReRendering] = useState(false)
  const [reRenderProgress, setReRenderProgress] = useState('')
  const [changedAudioIndexes, setChangedAudioIndexes] = useState<Set<number>>(new Set())

  // Translate state
  const [showTranslateModal, setShowTranslateModal] = useState(false)
  const [translateLang, setTranslateLang] = useState('')
  const [translating, setTranslating] = useState(false)

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)

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
  const slideCount = slideUrls.length
  const scenes = Array.isArray(video?.script) ? video.script : []
  const slideDuration = videoDuration > 0 && slideCount > 0 ? videoDuration / slideCount : 0

  // Update current slide based on video time
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || slideCount === 0 || slideDuration === 0) return
    const time = videoRef.current.currentTime
    const idx = Math.min(Math.floor(time / slideDuration), slideCount - 1)
    setCurrentSlideIndex(idx)
  }, [slideCount, slideDuration])

  // Jump video to a slide
  function jumpToSlide(index: number) {
    if (!videoRef.current || slideDuration === 0) return
    videoRef.current.currentTime = index * slideDuration
    setCurrentSlideIndex(index)
  }

  async function handleRegenerateSlide(index: number) {
    if (regeneratingSlide !== null || !video) return
    setRegeneratingSlide(index)
    try {
      const res = await fetch('/api/regenerate-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id, slideIndex: index }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Failed to regenerate slide')
        return
      }
      const { slideUrl } = await res.json()
      // Update the slide URL locally
      setVideo(prev => {
        if (!prev) return prev
        const updatedUrls = [...(prev.slide_urls ?? [])]
        updatedUrls[index] = slideUrl
        return { ...prev, slide_urls: updatedUrls }
      })
    } catch {
      alert('Failed to regenerate slide')
    } finally {
      setRegeneratingSlide(null)
    }
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
                assetUrls: input.assets,
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
    if (!followUpClientName || !followUpClientEmail) return
    setGeneratingPlan(true)
    try {
      const res = await fetch('/api/follow-up/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: params.id }),
      })
      if (!res.ok) { alert('Failed to generate follow-up plan'); return }
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

      if (planErr || !plan) { alert('Failed to save plan'); return }

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
      alert('Error creating follow-up plan')
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
        alert(data.error ?? 'Send failed')
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
      alert('Send failed')
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
    if (!existingQuote || !confirm('Remove this quote?')) return
    const supabase = createClient()
    await supabase.from('quotes').delete().eq('id', existingQuote.id)
    setExistingQuote(null)
  }

  async function saveQuote() {
    if (!video) return
    setQuoteSaving(true)
    const validItems = quoteLineItems.filter(i => i.description.trim() && i.amount > 0)
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
  }

  function quoteStatusBadge(status: string) {
    const map: Record<string, string> = { draft: '', sent: 'peach', viewed: 'lilac', paid: 'mint' }
    return map[status] ?? ''
  }

  async function handleDelete() {
    if (!confirm('Delete this video?')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('videos').delete().eq('id', params.id as string)
    router.push('/videos')
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
      if (!res.ok) { alert('PDF generation failed'); return }
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
      if (!res.ok) { alert('PPTX generation failed'); return }
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
        alert(data.error ?? 'Translation failed')
        return
      }
      const { videoId: newVideoId } = await res.json()
      setShowTranslateModal(false)
      setTranslateLang('')
      router.push(`/videos/${newVideoId}`)
    } catch {
      alert('Translation failed. Please try again.')
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
        <h1 className="page-title" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
          {video.title ?? 'Untitled'}
        </h1>
        <div style={{ fontSize: 14, color: 'var(--ink-light)' }}>
          {new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {video.duration && ` \u00b7 ${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}`}
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
            { label: 'Chat Messages', value: analytics?.chats ?? 0 },
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
        <VideoProgress status={video.status} createdAt={video.created_at} progressDetail={video.progress_detail ?? null} progressPct={video.progress_pct ?? null} />
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
                src={video.video_url}
                poster={video.thumbnail_url ?? undefined}
                controls
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={() => {
                  if (videoRef.current) setVideoDuration(videoRef.current.duration)
                }}
                style={{ width: '100%', display: 'block', maxHeight: '50vh' }}
                playsInline
              />
            </div>

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
                        width: 120,
                        height: 68,
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
                    {/* Regenerate slide button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRegenerateSlide(i) }}
                      disabled={regeneratingSlide !== null}
                      title={`Regenerate slide ${i + 1}`}
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: regeneratingSlide === i ? 'var(--mint)' : 'rgba(0,0,0,0.6)',
                        border: 'none',
                        cursor: regeneratingSlide !== null ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        opacity: regeneratingSlide !== null && regeneratingSlide !== i ? 0.4 : 1,
                        transition: 'opacity 0.15s, background 0.15s',
                      }}
                    >
                      {regeneratingSlide === i ? (
                        <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderTopColor: 'white' }} />
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Chapter markers */}
            {scenes.length > 0 && videoDuration > 0 && (
              <div style={{
                display: 'flex', gap: 6, flexWrap: 'wrap', padding: '4px 0',
              }}>
                {scenes.map((scene: any, i: number) => {
                  const segDuration = videoDuration / slideCount
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
                        padding: '6px 12px', borderRadius: 20,
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
              <button onClick={() => setShowShareModal(true)} className="btn btn-mint" style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8 }}>
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
                onClick={() => router.push(`/create?duplicate=${video.id}`)}
                className="btn btn-soft"
                style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8 }}
              >
                Duplicate
              </button>
              <button
                onClick={() => setShowEmailModal(true)}
                className="btn btn-soft"
                style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8 }}
              >
                Email to Client
              </button>
              <button
                onClick={() => setShowTranslateModal(true)}
                className="btn btn-soft"
                style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, borderRadius: 8 }}
              >
                Translate
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
            {/* Slide thumbnails with regenerate */}
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
                  <button
                    className="btn btn-soft btn-sm"
                    onClick={(e) => { e.stopPropagation(); handleRegenerateSlide(i) }}
                    disabled={regeneratingSlide === i}
                    style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, opacity: regeneratingSlide === i ? 0.5 : 1 }}
                  >
                    {regeneratingSlide === i ? '...' : 'Redo'}
                  </button>
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
                    alert(err instanceof Error ? err.message : 'Re-render failed')
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
            onRedoSlide={async (sceneIndex) => {
              await handleRegenerateSlide(sceneIndex)
              // Update editor slides with the new slide_url
              const updatedVideo = video
              if (updatedVideo?.slide_urls?.[sceneIndex]) {
                const newSlides = [...editorSlides]
                newSlides[sceneIndex] = (updatedVideo.slide_urls as string[])[sceneIndex]
                setEditorSlides(newSlides)
              }
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

      {/* Share Modal */}
      {showShareModal && video && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,26,18,0.5)', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: '100%', maxWidth: 480, background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Share with Client</h2>
              <button onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-light)' }}>&times;</button>
            </div>

            {/* Share link */}
            <div style={{ marginBottom: 20 }}>
              <label className="input-label">Share link</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/watch/${video.id}`} style={{ flex: 1, fontSize: 13 }} />
                <button onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/watch/${video.id}`)
                  setShareCopied(true)
                  setTimeout(() => setShareCopied(false), 2000)
                }} className="btn btn-soft btn-sm" style={{ flexShrink: 0 }}>
                  {shareCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Quick email */}
            <div style={{ marginBottom: 20 }}>
              <label className="input-label">Send via email</label>
              <div className="form-group">
                <input className="input" placeholder="Client name" value={shareName} onChange={e => setShareName(e.target.value)} />
              </div>
              <div className="form-group">
                <input className="input" type="email" placeholder="Client email address" value={shareEmail} onChange={e => setShareEmail(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* mailto fallback */}
                <a
                  href={`mailto:${shareEmail}?subject=${encodeURIComponent(`Your Explainer: ${video.title ?? 'Video'}`)}&body=${encodeURIComponent(`Hi ${shareName || 'there'},\n\nI've put together a personalized explainer for you. Watch it here:\n\n${typeof window !== 'undefined' ? window.location.origin : ''}/watch/${video.id}\n\nLet me know if you have any questions!`)}`}
                  className="btn btn-primary"
                  style={{ flex: 1, textAlign: 'center' }}
                  onClick={() => shareEmail && setShowShareModal(false)}
                >
                  Open in Email App
                </a>
                {/* Connected email */}
                <button
                  onClick={() => { setShowShareModal(false); setShowEmailModal(true) }}
                  className="btn btn-soft"
                  style={{ flexShrink: 0 }}
                >
                  Send via Connected Email
                </button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16, fontSize: 12, color: 'var(--ink-light)', textAlign: 'center' }}>
              Your client will see your branded explainer video with an option to book a meeting.
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

      {showEmailModal && video && (
        <SendEmailModal
          videoId={video.id}
          title={video.title ?? 'Explainer'}
          clientName={shareName}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  )
}
