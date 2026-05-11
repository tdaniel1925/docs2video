'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../_lib/supabase/client'
import SendEmailModal from '../../../_components/SendEmailModal'
import type { Video, Brand } from '../../../_lib/types'

// Feature flags — now driven by user's subscription plan

const PROGRESS_STEPS = [
  { key: 'scripting', label: 'Writing Script', desc: 'AI is writing the narration script...' },
  { key: 'generating_audio', label: 'Generating Audio', desc: 'Creating voice narration for each scene...' },
  { key: 'generating_slides', label: 'Creating Slides', desc: 'Generating branded visuals for each scene...' },
  { key: 'assembling', label: 'Assembling Video', desc: 'Stitching slides and audio into final video...' },
]

function VideoProgress({ status }: { status: string }) {
  const currentIdx = PROGRESS_STEPS.findIndex(s => s.key === status)
  const pct = currentIdx < 0 ? 5 : Math.round(((currentIdx + 0.5) / PROGRESS_STEPS.length) * 100)
  const currentStep = PROGRESS_STEPS[currentIdx] ?? PROGRESS_STEPS[0]

  return (
    <div>
      <div className="section-eyebrow">Generating</div>

      <div className="progress-card">
        {/* Progress bar */}
        <div className="progress-bar-wrap">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="progress-percent">{pct}%</div>
        </div>

        {/* Current step highlight */}
        <div className="current-step-card">
          <span className="spinner" />
          <div className="info">
            <div className="name">{currentStep.label}</div>
            <div className="desc">{currentStep.desc}</div>
          </div>
        </div>

        {/* Step list */}
        <ul className="step-list">
          {PROGRESS_STEPS.map((step, i) => {
            const isDone = i < currentIdx
            const isActive = i === currentIdx
            const stepClass = isDone ? 'step-item done' : isActive ? 'step-item active' : 'step-item pending'
            return (
              <li key={step.key} className={stepClass}>
                <div className="step-num">
                  {isDone ? '\u2713' : i + 1}
                </div>
                <div className="step-name">{step.label}</div>
              </li>
            )
          })}
        </ul>

        <div className="progress-foot">
          Typically takes 45-90 seconds. This page updates automatically.
        </div>
      </div>
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

const QUICK_ACTIONS = [
  { label: 'Change Style', message: "I'd like to change the visual style" },
  { label: 'Change Voice', message: "I'd like to change the narration voice" },
  { label: 'Edit Script', message: "I'd like to edit the narration script" },
  { label: 'Fix Data', message: "I need to correct some data" },
  { label: 'Make Shorter', message: "Please make this video shorter and more concise" },
  { label: 'Make Longer', message: "Please make this video more detailed and longer" },
]

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

  // Follow-up state
  const [followUpPlan, setFollowUpPlan] = useState<FollowUpPlan | null>(null)
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [showFollowUpForm, setShowFollowUpForm] = useState(false)
  const [followUpClientName, setFollowUpClientName] = useState('')
  const [followUpClientEmail, setFollowUpClientEmail] = useState('')
  const [generatingPlan, setGeneratingPlan] = useState(false)

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
        setChatMessages(prev => [...prev, { role: 'assistant', text: data.reply ?? data.message ?? 'I received your request. Let me work on that.' }])
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }])
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setChatLoading(false)
    }
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

        // If status is pending and we haven't started the pipeline yet, start it
        if (data.status === 'pending' && !pipelineStarted.current) {
          pipelineStarted.current = true
          const input = (data.script as any)?._pipeline_input
          if (input) {
            console.log('[video] Starting pipeline...')
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
                musicUrl: input.musicUrl,
              }),
            }).catch((err) => console.error('[video] Pipeline error:', err))
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
        // Auto-detect stuck videos (processing for more than 5 minutes)
        const createdAt = new Date(data.created_at).getTime()
        const elapsed = Date.now() - createdAt
        const STUCK_THRESHOLD = 5 * 60 * 1000 // 5 minutes
        if (elapsed > STUCK_THRESHOLD && data.status !== 'completed' && data.status !== 'failed' && data.status !== 'pending') {
          // Mark as failed
          await supabase.from('videos').update({
            status: 'failed',
            error_message: 'Generation timed out. Please try again with fewer slides or a simpler document.'
          }).eq('id', data.id)
          setVideo({ ...data, status: 'failed', error_message: 'Generation timed out. Please try again with fewer slides or a simpler document.' } as Video)
          clearInterval(interval)
        }
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

  function copyShareLink() {
    const url = `${window.location.origin}/watch/${params.id}`
    navigator.clipboard.writeText(url)
    alert('Share link copied!')
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
            max-height: 50vh !important;
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
      `}</style>

      <Link href="/videos" className="back-link">
        &larr; Back to explainers
      </Link>

      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">{video.title ?? 'Untitled'}</h1>
        <div className="page-meta">
          {new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {video.duration && ` \u00b7 ${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}`}
        </div>
      </div>

      {/* Processing states */}
      {video.status !== 'completed' && video.status !== 'failed' && (
        <VideoProgress status={video.status} />
      )}

      {video.status === 'failed' && (
        <div style={{
          background: 'white',
          border: '1px solid var(--rose)',
          borderRadius: '10px',
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
                // Reset video to pending so pipeline restarts
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

      {/* Side-by-side editor layout — only when completed */}
      {video.status === 'completed' && video.video_url && (
        <div
          className="editor-layout"
          style={{
            display: 'flex',
            gap: 20,
            minHeight: 'calc(100vh - 220px)',
          }}
        >
          {/* LEFT SIDE — Video Player + Thumbnails */}
          <div
            className="editor-left"
            style={{
              width: '60%',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* HTML5 Video Player */}
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

            {/* Thumbnail timeline strip */}
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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT SIDE — AI Editor Panel */}
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
            }}
          >
            {/* Quick action buttons */}
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-light)',
              background: 'white',
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--ink-light)',
                marginBottom: 10,
              }}>
                Quick Actions
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
              }}>
                {QUICK_ACTIONS.map(action => (
                  <button
                    key={action.label}
                    className="quick-action-btn"
                    onClick={() => sendChatMessage(action.message)}
                    disabled={chatLoading}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat messages */}
            <div
              ref={chatListRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}
                >
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    fontSize: 13,
                    lineHeight: 1.5,
                    background: msg.role === 'user' ? 'var(--mint)' : 'white',
                    color: msg.role === 'user' ? '#0a2e1a' : 'var(--ink)',
                    border: msg.role === 'assistant' ? '1px solid var(--border-light)' : 'none',
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ alignSelf: 'flex-start' }}>
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'white',
                    border: '1px solid var(--border-light)',
                  }}>
                    <div className="typing-dots">
                      <span /><span /><span />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat input */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border-light)',
              background: 'white',
            }}>
              <div
                className="chat-input-wrap"
                style={{
                  display: 'flex',
                  gap: 8,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '4px 4px 4px 12px',
                  background: 'white',
                  transition: 'border-color 0.15s',
                }}
              >
                <input
                  type="text"
                  placeholder="Tell me what to change..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendChatMessage(chatInput)
                    }
                  }}
                  disabled={chatLoading}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontSize: 13,
                    background: 'transparent',
                    color: 'var(--ink)',
                  }}
                />
                <button
                  onClick={() => sendChatMessage(chatInput)}
                  disabled={chatLoading || !chatInput.trim()}
                  className="btn btn-primary"
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    borderRadius: 6,
                    opacity: chatLoading || !chatInput.trim() ? 0.5 : 1,
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons — below the editor */}
      {video.status === 'completed' && (
        <div style={{ marginTop: 24 }}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <button onClick={() => setShowShareModal(true)} className="btn btn-mint">Share with Client</button>
            <button onClick={copyShareLink} className="btn btn-soft">Copy Link</button>
            <button onClick={handleDownload} className="btn btn-soft">MP4</button>
            <button onClick={handleDownloadPDF} disabled={downloadingPDF} className="btn btn-soft"
              style={downloadingPDF ? {opacity:0.5} : undefined}>
              {downloadingPDF ? 'PDF...' : 'PDF'}
            </button>
            <button onClick={handleDownloadPPTX} disabled={downloadingPPTX} className="btn btn-soft"
              style={downloadingPPTX ? {opacity:0.5} : undefined}>
              {downloadingPPTX ? 'PPTX...' : 'PPTX'}
            </button>
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger"
              style={{marginLeft:'auto',...(deleting ? {opacity:0.5} : {})}}>
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Follow-Up Plan Section */}
      {PRO_PLANS.includes(userPlan.toLowerCase()) && video.status === 'completed' && (
        <div className="detail-section section-gap-lg">
          <h2>Follow-Up Plan</h2>

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
            <div className="settings-card" style={{ padding: 24, borderRadius: 10 }}>
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

      {/* Quote / Invoice Section */}
      {PRO_PLANS.includes(userPlan.toLowerCase()) && video.status === 'completed' && (
        <div className="detail-section section-gap-lg">
          <h2>Quote / Invoice</h2>

          {!existingQuote && !showQuoteBuilder && (
            <div className="settings-card" style={{ marginTop: 0 }}>
              <h3>Quote / Invoice</h3>
              <p className="ssub">Attach pricing to this presentation. Your client will see a payment button on the share page.</p>
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
            <div className="settings-card" style={{ padding: 24, borderRadius: 10 }}>
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
