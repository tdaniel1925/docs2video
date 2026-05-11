'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '../../../_lib/supabase/client'
import type { Video, Brand, ChatMessage } from '../../../_lib/types'
import type { ExtractedData } from '../../../_lib/extract-types'

interface AgentProfile {
  id: string
  full_name: string | null
  company_name: string | null
  photo_url: string | null
  email: string
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

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

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
  const chatEndRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const viewTracked = useRef(false)

  // Slide tracking
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)

  const paid = searchParams.get('paid') === 'true'

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('videos')
        .select('*, brand:brands(*), infographic:infographics(policy_data, source_pdf_url)')
        .eq('id', params.id as string)
        .eq('status', 'completed')
        .single()

      if (error || !data) { setNotFound(true); return }

      const v = data as VideoWithRelations
      setVideo(v)

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, photo_url, email, calendly_url, stripe_user_id')
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !video?.slide_urls) return
    const slideUrls = video.slide_urls as string[]
    const slideCount = slideUrls.length
    if (slideCount === 0 || videoDuration === 0) return
    const segmentDuration = videoDuration / slideCount
    const idx = Math.min(Math.floor(videoRef.current.currentTime / segmentDuration), slideCount - 1)
    setCurrentSlideIndex(idx)
  }, [video, videoDuration])

  const jumpToSlide = useCallback((index: number) => {
    if (!videoRef.current || !video?.slide_urls) return
    const slideCount = (video.slide_urls as string[]).length
    if (slideCount === 0 || videoDuration === 0) return
    videoRef.current.currentTime = (videoDuration / slideCount) * index
  }, [video, videoDuration])

  const sendChat = useCallback(async (msg?: string) => {
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
    setChatMessages(prev => [...prev, clientMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id, message: text }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      if (data.response) {
        setChatMessages(prev => [...prev, {
          id: `temp-${Date.now() + 1}`,
          video_id: video.id,
          role: 'assistant',
          message: data.response,
          created_at: new Date().toISOString(),
        }])
      }
    } catch {
      setChatInput(text)
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, video, chatLoading])

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

  // --- Not found ---
  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Video Not Found</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)' }}>This video may have been removed or is still processing.</p>
        </div>
      </div>
    )
  }

  // --- Loading ---
  if (!video) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  // --- Derived ---
  const brand = video.brand as Brand | undefined
  const agentName = agent?.full_name ?? agent?.company_name ?? 'Your Agent'
  const agentEmail = agent?.email ?? ''
  const agentInitials = getInitials(agentName)
  const calendlyUrl = agent?.calendly_url?.trim() ?? ''
  const hasCalendly = calendlyUrl.length > 0 && calendlyUrl.startsWith('https://calendly.com/')
  const hasStripe = !!(agent?.stripe_user_id?.trim())
  const hasQuote = !!(quote && quote.status !== 'paid')
  const hasPaidQuote = !!(quote && quote.status === 'paid')
  const slideUrls = (video.slide_urls ?? []) as string[]
  const slideCount = slideUrls.length
  const hasPdf = !!video.infographic?.source_pdf_url
  const policyData = video.infographic?.policy_data as (ExtractedData & { insurance?: unknown }) | null
  const keyMetrics = policyData?.keyMetrics ?? []

  const formatCents = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

  const QUICK_ACTIONS = [
    { label: 'Explain This', message: 'Can you explain the key points of this video in simple terms?' },
    { label: 'Key Numbers', message: 'What are the most important numbers and metrics mentioned?' },
    { label: 'Compare Options', message: 'Can you compare the different options or plans mentioned?' },
    ...(hasCalendly ? [{ label: 'Book Meeting', message: '__ACTION_CALENDLY__' }] : []),
    ...(hasPdf ? [{ label: 'View PDF', message: '__ACTION_PDF__' }] : []),
    ...(video.video_url ? [{ label: 'Download Video', message: '__ACTION_DOWNLOAD__' }] : []),
  ]

  function handleQuickAction(message: string) {
    if (message === '__ACTION_CALENDLY__') {
      const el = document.getElementById('calendly-section')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    } else if (message === '__ACTION_PDF__' && video?.infographic?.source_pdf_url) {
      window.open(video.infographic.source_pdf_url, '_blank')
    } else if (message === '__ACTION_DOWNLOAD__' && video?.video_url) {
      window.open(video.video_url, '_blank')
    } else {
      sendChat(message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif", background: 'var(--bg, #f8fafc)' }}>
      <style>{`
        .watch-layout { display: flex; gap: 20px; min-height: calc(100vh - 160px); }
        .watch-left { width: 60%; display: flex; flex-direction: column; gap: 12px; }
        .watch-right { width: 40%; display: flex; flex-direction: column; background: white; border: 1px solid var(--border-light, #e2e8f0); border-radius: 10px; overflow: hidden; }
        .watch-thumb { border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid transparent; flex-shrink: 0; transition: border-color 0.15s; }
        .watch-thumb.active { border-color: var(--mint, #A8F0D4); }
        .watch-thumb:hover { border-color: var(--border, #cbd5e1); }
        .watch-quick-btn { padding: 8px 10px; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; background: white; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; color: var(--ink, #1a1a2e); }
        .watch-quick-btn:hover { background: var(--bg, #f8fafc); border-color: var(--mint, #A8F0D4); }
        .typing-dots { display: flex; gap: 4px; }
        .typing-dots span { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-light, #94a3b8); animation: dotPulse 1.2s ease-in-out infinite; }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dotPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        @media (max-width: 768px) {
          .watch-layout { flex-direction: column; }
          .watch-left, .watch-right { width: 100%; }
          .watch-right { max-height: 500px; }
        }
      `}</style>

      {/* Header */}
      <header style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-light, #e2e8f0)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {agent?.photo_url ? (
            <img src={agent.photo_url} alt={agentName} style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--mint, #A8F0D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: 'var(--ink, #1a1a2e)' }}>
              {agentInitials}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{agentName}</div>
            {agent?.company_name && agent.company_name !== agent.full_name && (
              <div style={{ fontSize: 11, color: 'var(--ink-light, #94a3b8)' }}>{agent.company_name}</div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink-light, #94a3b8)', fontWeight: 600, letterSpacing: '0.05em' }}>
          Powered by Docs2Video
        </div>
      </header>

      {/* Page head */}
      <div style={{ padding: '20px 32px 0' }}>
        {video.title && (
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 4px' }}>{video.title}</h1>
        )}
        {policyData?.subtitle && (
          <p style={{ fontSize: 14, color: 'var(--ink-soft, #64748b)', margin: '0 0 16px' }}>{policyData.subtitle}</p>
        )}

        {/* Paid banner */}
        {paid && (
          <div style={{ background: 'var(--mint, #A8F0D4)', borderRadius: 10, padding: '12px 20px', marginBottom: 16, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Payment received! Thank you.
          </div>
        )}

        {/* Key metrics row */}
        {keyMetrics.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {keyMetrics.slice(0, 4).map((m, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid var(--border-light, #e2e8f0)', borderRadius: 10, padding: '10px 16px', minWidth: 120 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-light, #94a3b8)', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: m.highlight ? 'var(--mint-darker, #2d7a4f)' : 'var(--ink, #1a1a2e)' }}>{m.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2-panel layout */}
      <div className="watch-layout" style={{ padding: '0 32px 32px' }}>
        {/* LEFT — Video + Thumbnails */}
        <div className="watch-left">
          <div style={{ background: '#000', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-light, #e2e8f0)' }}>
            <video
              ref={videoRef}
              src={video.video_url!}
              poster={video.thumbnail_url ?? undefined}
              controls
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => {
                if (videoRef.current) setVideoDuration(videoRef.current.duration)
              }}
              style={{ width: '100%', display: 'block', maxHeight: '55vh' }}
              playsInline
            />
          </div>

          {/* Slide indicator */}
          {slideCount > 0 && (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft, #64748b)', padding: '0 4px' }}>
              Slide {currentSlideIndex + 1} of {slideCount}
            </div>
          )}

          {/* Thumbnail strip */}
          {slideCount > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0' }}>
              {slideUrls.map((url, i) => (
                <div
                  key={i}
                  className={`watch-thumb${i === currentSlideIndex ? ' active' : ''}`}
                  onClick={() => jumpToSlide(i)}
                  style={{ position: 'relative' }}
                >
                  <img src={url} alt={`Slide ${i + 1}`} style={{ width: 120, height: 68, objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', bottom: 2, left: 2, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quote section */}
          {hasQuote && quote && (
            <div style={{ background: 'white', border: '1px solid var(--border-light, #e2e8f0)', borderRadius: 10, padding: 20, marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-light, #94a3b8)', marginBottom: 12 }}>
                Quote {quote.client_name ? `for ${quote.client_name}` : ''}
              </div>
              {(quote.line_items).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < quote.line_items.length - 1 ? '1px solid var(--border-light, #e2e8f0)' : 'none', fontSize: 14 }}>
                  <span>{item.description}</span>
                  <span style={{ fontWeight: 700 }}>{item.amount === 0 ? 'FREE' : formatCents(item.amount)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '2px solid var(--border-light, #e2e8f0)' }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--mint-darker, #2d7a4f)' }}>{formatCents(quote.total)}</span>
              </div>
              {payError && (
                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(192,58,31,0.1)', fontSize: 13, color: '#C03A1F' }}>{payError}</div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {hasStripe ? (
                  <button onClick={handlePay} disabled={payLoading} className="btn btn-primary" style={{ flex: 1, opacity: payLoading ? 0.6 : 1 }}>
                    {payLoading ? 'Processing...' : `Accept & Pay ${formatCents(quote.total)}`}
                  </button>
                ) : (
                  <a href={`mailto:${agentEmail}`} className="btn btn-soft" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>
                    Contact {agentName} to pay
                  </a>
                )}
                <a href={`mailto:${agentEmail}?subject=Quote Changes&body=Hi ${agentName},%0A%0AI'd like to request changes to the quote.`} className="btn btn-soft" style={{ textDecoration: 'none' }}>
                  Request Changes
                </a>
              </div>
            </div>
          )}

          {hasPaidQuote && quote && (
            <div style={{ background: 'rgba(168,240,212,0.15)', border: '1px solid var(--mint, #A8F0D4)', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker, #2d7a4f)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Payment Complete</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft, #64748b)' }}>{formatCents(quote.total)} paid {new Date(quote.paid_at ?? quote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
            </div>
          )}

          {/* Calendly embed */}
          {hasCalendly && (
            <div id="calendly-section" style={{ background: 'white', border: '1px solid var(--border-light, #e2e8f0)', borderRadius: 10, overflow: 'hidden', marginTop: 8 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light, #e2e8f0)', fontWeight: 700, fontSize: 14 }}>
                Book a Meeting with {agentName}
              </div>
              <iframe src={calendlyUrl} style={{ width: '100%', height: 550, border: 'none' }} title="Book a meeting" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
            </div>
          )}
        </div>

        {/* RIGHT — Quick Actions + AI Chat */}
        <div className="watch-right">
          {/* Quick actions */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light, #e2e8f0)', background: 'white' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-light, #94a3b8)', marginBottom: 10 }}>
              Quick Actions
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action.label}
                  className="watch-quick-btn"
                  onClick={() => handleQuickAction(action.message)}
                  disabled={chatLoading}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 40, padding: '0 20px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--ink, #1a1a2e)' }}>
                  I can help you understand this video
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-light, #94a3b8)', lineHeight: 1.5 }}>
                  Use the buttons above or ask me anything about the content.
                </div>
              </div>
            )}
            {chatMessages.map(msg => (
              <div key={msg.id} style={{ alignSelf: msg.role === 'client' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.55,
                  background: msg.role === 'client' ? 'var(--mint, #A8F0D4)' : 'white',
                  color: msg.role === 'client' ? '#0a2e1a' : 'var(--ink, #1a1a2e)',
                  border: msg.role !== 'client' ? '1px solid var(--border-light, #e2e8f0)' : 'none',
                }}>
                  {msg.message}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ alignSelf: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'white', border: '1px solid var(--border-light, #e2e8f0)' }}>
                  <div className="typing-dots"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light, #e2e8f0)', background: 'white' }}>
            <div style={{ display: 'flex', gap: 8, border: '1px solid var(--border, #cbd5e1)', borderRadius: 8, padding: '4px 4px 4px 12px', background: 'white' }}>
              <input
                type="text"
                placeholder="Ask about this video..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                disabled={chatLoading}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--ink, #1a1a2e)' }}
              />
              <button
                onClick={() => sendChat()}
                disabled={chatLoading || !chatInput.trim()}
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, opacity: chatLoading || !chatInput.trim() ? 0.5 : 1 }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '20px 0', borderTop: '1px solid var(--border-light, #e2e8f0)' }}>
        <a href="/" style={{ fontSize: 11, color: 'var(--ink-light, #94a3b8)', textDecoration: 'none', fontWeight: 600, letterSpacing: '0.05em' }}>
          Powered by Docs2Video
        </a>
      </footer>
    </div>
  )
}
