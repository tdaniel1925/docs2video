'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '../../../_lib/supabase/client'
import VideoPlayer from '../../../_components/VideoPlayer'
import type { Video, Brand, Quote, ChatMessage } from '../../../_lib/types'
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

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function PublicWatchPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [video, setVideo] = useState<VideoWithRelations | null>(null)
  const [agent, setAgent] = useState<AgentProfile | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const viewTracked = useRef(false)

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

      if (error || !data) {
        setNotFound(true)
        return
      }

      const v = data as VideoWithRelations
      setVideo(v)

      // Load agent profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, photo_url, email, calendly_url, stripe_user_id')
        .eq('id', v.user_id)
        .single()

      if (profile) setAgent(profile as AgentProfile)

      // Load quote if exists
      const { data: quoteData } = await supabase
        .from('quotes')
        .select('*')
        .eq('video_id', v.id)
        .neq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (quoteData) setQuote(quoteData as Quote)

      // Load existing chat messages
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('video_id', v.id)
        .order('created_at', { ascending: true })

      if (messages) setChatMessages(messages as ChatMessage[])

      // Track view (once)
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

  // Escape key closes chat
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && chatOpen) setChatOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [chatOpen])

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || !video || chatLoading) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatLoading(true)
    setChatError(null)

    const clientMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      video_id: video.id,
      role: 'client',
      message: msg,
      created_at: new Date().toISOString(),
    }
    setChatMessages((prev) => [...prev, clientMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id, message: msg }),
      })
      if (!res.ok) {
        throw new Error('Failed to get response')
      }
      const data = await res.json()
      if (data.response) {
        const assistantMsg: ChatMessage = {
          id: `temp-${Date.now() + 1}`,
          video_id: video.id,
          role: 'assistant',
          message: data.response,
          created_at: new Date().toISOString(),
        }
        setChatMessages((prev) => [...prev, assistantMsg])
      }
    } catch {
      setChatError('Could not get a response. Please try again.')
      setChatInput(msg) // restore the message so user doesn't lose it
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
      if (!res.ok) {
        throw new Error('Payment setup failed')
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No payment URL received')
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Payment failed. Please try again.')
    } finally {
      setPayLoading(false)
    }
  }, [quote, payLoading])

  // --- Not found ---
  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A1628', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(199,232,168,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C7E8A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10 }}>Video Not Found</h1>
          <p style={{ fontSize: 15, opacity: 0.5 }}>This video may have been removed or is still processing.</p>
        </div>
      </div>
    )
  }

  // --- Loading ---
  if (!video) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(199,232,168,0.15)', borderTopColor: '#C7E8A8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  // --- Derived data ---
  const brand = video.brand as Brand | undefined
  const agentName = agent?.full_name ?? agent?.company_name ?? 'Your Agent'
  const agentEmail = agent?.email ?? ''
  const agentInitials = getInitials(agentName)
  const calendlyUrl = agent?.calendly_url?.trim() ?? ''
  const hasCalendly = calendlyUrl.length > 0 && calendlyUrl.startsWith('https://calendly.com/')
  const hasStripe = !!(agent?.stripe_user_id && agent.stripe_user_id.trim().length > 0)
  const hasQuote = !!(quote && quote.status !== 'paid')
  const hasPaidQuote = !!(quote && quote.status === 'paid')
  const hasSlides = !!(video.slide_urls && (video.slide_urls as string[]).length > 0)
  const hasPdf = !!video.infographic?.source_pdf_url

  // Brand-driven accent or default mint
  const accent = brand?.secondary_color || '#C7E8A8'
  const accentBg = brand?.primary_color || '#0A1628'
  const headerGradient = brand?.primary_color
    ? `linear-gradient(135deg, ${brand.primary_color}, ${adjustBrightness(brand.primary_color, 30)})`
    : 'linear-gradient(135deg, #0A1628, #1B365D)'

  // Extract key metrics from infographic policy_data
  const policyData = video.infographic?.policy_data as (ExtractedData & { insurance?: unknown }) | null
  const keyMetrics = policyData?.keyMetrics ?? []
  const displayMetrics = keyMetrics.slice(0, 4)

  const formatCents = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  // Count available action buttons to determine grid
  const actionButtons: { label: string; icon: string; action: () => void; style?: 'accent' | 'default' }[] = []

  if (hasCalendly) {
    actionButtons.push({
      label: 'Book a Meeting',
      icon: 'calendar',
      action: () => {
        const el = document.getElementById('calendly-section')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      },
    })
  }

  if (hasQuote && hasStripe && quote) {
    actionButtons.push({
      label: `Accept & Pay ${formatCents(quote.total)}`,
      icon: 'card',
      action: handlePay,
      style: 'accent',
    })
  }

  actionButtons.push({
    label: 'Ask AI',
    icon: 'chat',
    action: () => setChatOpen(true),
  })

  if (hasPdf) {
    actionButtons.push({
      label: 'Download PDF',
      icon: 'download',
      action: () => window.open(video.infographic!.source_pdf_url!, '_blank'),
    })
  }

  if (hasSlides) {
    actionButtons.push({
      label: 'Download Slides',
      icon: 'slides',
      action: () => {
        const urls = video.slide_urls as string[]
        if (urls[0]) window.open(urls[0], '_blank')
      },
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A1628', color: 'white', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @media (max-width: 640px) {
          .watch-metrics-grid { grid-template-columns: 1fr !important; }
          .watch-actions-grid { grid-template-columns: 1fr !important; }
          .watch-downloads { flex-direction: column !important; }
          .watch-quote-actions { flex-direction: column !important; }
        }
      `}</style>
      {/* ===== HEADER ===== */}
      <header style={{ background: headerGradient, padding: '28px 32px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {agent?.photo_url ? (
                <img
                  src={agent.photo_url}
                  alt={agentName}
                  style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: 44, height: 44, borderRadius: 10, background: accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, color: accentBg, fontSize: 16,
                }}>
                  {agentInitials}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{agentName}</div>
                {agent?.company_name && agent.company_name !== agent.full_name && (
                  <div style={{ fontSize: 12, opacity: 0.5 }}>{agent.company_name}</div>
                )}
              </div>
            </div>
            <div style={{ fontSize: 10, opacity: 0.3, fontWeight: 600, letterSpacing: '0.05em' }}>
              Powered by Docs2Video
            </div>
          </div>

          {/* Title */}
          {video.title && (
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 20, marginBottom: 0 }}>
              {video.title}
            </h1>
          )}
          {policyData?.subtitle && (
            <p style={{ fontSize: 14, opacity: 0.5, marginTop: 6 }}>{policyData.subtitle}</p>
          )}
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Paid banner */}
        {paid && (
          <div style={{
            background: accent, borderRadius: 10, padding: '14px 24px', marginBottom: 24,
            fontWeight: 700, fontSize: 14, color: accentBg,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Payment received! Thank you.
          </div>
        )}

        {/* ===== VIDEO PLAYER ===== */}
        <div style={{ marginBottom: 32, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          <VideoPlayer
            videoUrl={video.video_url!}
            thumbnailUrl={video.thumbnail_url}
            title={video.title}
            brand={brand ?? null}
          />
        </div>

        {/* ===== KEY METRICS ===== */}
        {displayMetrics.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase' as const, color: accent, marginBottom: 14,
            }}>
              Key Numbers
            </div>
            <div className="watch-metrics-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
            }}>
              {displayMetrics.map((m, i) => (
                <div key={i} style={{
                  background: m.highlight ? `${accent}15` : 'rgba(255,255,255,0.04)',
                  border: m.highlight ? `1px solid ${accent}30` : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10, padding: '16px 18px',
                }}>
                  <div style={{ fontSize: 11, opacity: 0.4, marginBottom: 4 }}>{m.label}</div>
                  <div style={{
                    fontSize: 22, fontWeight: 800,
                    color: m.highlight ? accent : 'white',
                  }}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== ACTION BUTTONS ===== */}
        {actionButtons.length > 0 && (
          <div className="watch-actions-grid" style={{
            display: 'grid',
            gridTemplateColumns: actionButtons.length <= 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
            gap: 10, marginBottom: 32,
          }}>
            {actionButtons.map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                disabled={btn.icon === 'card' && payLoading}
                style={{
                  padding: '16px 12px',
                  background: btn.style === 'accent' ? accent : 'rgba(255,255,255,0.04)',
                  color: btn.style === 'accent' ? accentBg : 'white',
                  border: btn.style === 'accent' ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'center' as const,
                  transition: 'all 0.15s ease',
                  opacity: (btn.icon === 'card' && payLoading) ? 0.6 : 1,
                }}
              >
                <div style={{ marginBottom: 6 }}>
                  {renderActionIcon(btn.icon, btn.style === 'accent' ? accentBg : accent)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{btn.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* ===== QUOTE SECTION ===== */}
        {hasQuote && quote && (
          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase' as const, color: accent, marginBottom: 14,
            }}>
              Quote {quote.client_name ? `for ${quote.client_name}` : ''}
            </div>

            {quote.notes && (
              <p style={{ fontSize: 13, opacity: 0.5, marginBottom: 14, marginTop: 0 }}>{quote.notes}</p>
            )}

            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, overflow: 'hidden',
            }}>
              {(quote.line_items as { description: string; amount: number }[]).map((item, i, arr) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '14px 18px',
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  fontSize: 14,
                }}>
                  <span>{item.description}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {item.amount === 0 ? 'FREE' : formatCents(item.amount)}
                  </span>
                </div>
              ))}

              {/* Subtotal & Tax */}
              <div style={{
                padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)',
                fontSize: 13, opacity: 0.6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Subtotal</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCents(quote.subtotal)}</span>
                </div>
                {quote.tax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tax</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCents(quote.tax)}</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '16px 18px',
                background: `${accent}12`, borderTop: `1px solid ${accent}25`,
              }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: accent }}>{formatCents(quote.total)}</span>
              </div>
            </div>

            {/* Payment error */}
            {payError && (
              <div style={{
                marginTop: 12, padding: '10px 16px', borderRadius: 10,
                background: 'rgba(192,58,31,0.15)', border: '1px solid rgba(192,58,31,0.3)',
                fontSize: 13, color: '#ff6b54',
              }}>
                {payError}
              </div>
            )}

            {/* Payment actions */}
            <div className="watch-quote-actions" style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              {hasStripe ? (
                <button
                  onClick={handlePay}
                  disabled={payLoading}
                  style={{
                    flex: 1, padding: '14px', background: accent, color: accentBg,
                    border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15,
                    cursor: payLoading ? 'not-allowed' : 'pointer',
                    opacity: payLoading ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {payLoading ? (
                    <>
                      <div style={{ width: 16, height: 16, border: '2px solid transparent', borderTopColor: accentBg, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Processing...
                    </>
                  ) : (
                    <>Accept & Pay {formatCents(quote.total)}</>
                  )}
                </button>
              ) : (
                <div style={{
                  flex: 1, padding: '14px 18px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
                  fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center' as const,
                }}>
                  Contact{' '}
                  <a href={`mailto:${agentEmail}`} style={{ color: accent, fontWeight: 600, textDecoration: 'underline' }}>
                    {agentName}
                  </a>
                  {' '}to arrange payment
                </div>
              )}
              <a
                href={`mailto:${agentEmail}?subject=Quote Changes Request - ${quote.client_name ?? ''}&body=Hi ${agentName},%0A%0AI'd like to request some changes to the quote.%0A%0A`}
                style={{
                  padding: '14px 20px', background: 'rgba(255,255,255,0.06)', color: 'white',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                Request Changes
              </a>
            </div>
          </div>
        )}

        {/* ===== PAID QUOTE CONFIRMATION ===== */}
        {hasPaidQuote && quote && (
          <div style={{
            background: `${accent}15`, border: `1px solid ${accent}30`,
            borderRadius: 10, padding: '20px 24px', marginBottom: 32,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', background: `${accent}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Payment Complete</div>
              <div style={{ fontSize: 13, opacity: 0.5, marginTop: 2 }}>
                {formatCents(quote.total)} paid on{' '}
                {new Date(quote.paid_at ?? quote.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===== CALENDLY EMBED ===== */}
        {hasCalendly && (
          <div id="calendly-section" style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase' as const, color: accent, marginBottom: 14,
            }}>
              Schedule a Meeting
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, overflow: 'hidden',
            }}>
              <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: `${accent}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Book a Meeting</div>
                  <div style={{ fontSize: 12, opacity: 0.4 }}>Pick a time that works for you with {agentName}</div>
                </div>
              </div>
              <iframe
                src={calendlyUrl}
                style={{ width: '100%', height: 650, border: 'none', background: '#fff' }}
                title="Book a meeting"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          </div>
        )}

        {/* ===== DOWNLOADS ===== */}
        {(hasPdf || hasSlides || video.video_url) && (
          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase' as const, color: accent, marginBottom: 14,
            }}>
              Downloads
            </div>
            <div className="watch-downloads" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
              {hasPdf && (
                <a
                  href={video.infographic!.source_pdf_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1, minWidth: 160, padding: '14px 18px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, color: 'white', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Download PDF</div>
                    <div style={{ fontSize: 11, opacity: 0.4 }}>Original document</div>
                  </div>
                </a>
              )}
              {hasSlides && (
                <a
                  href={(video.slide_urls as string[])[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1, minWidth: 160, padding: '14px 18px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, color: 'white', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Download Slides</div>
                    <div style={{ fontSize: 11, opacity: 0.4 }}>Presentation deck</div>
                  </div>
                </a>
              )}
              {video.video_url && (
                <a
                  href={video.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1, minWidth: 160, padding: '14px 18px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, color: 'white', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Download Video</div>
                    <div style={{ fontSize: 11, opacity: 0.4 }}>MP4 file</div>
                  </div>
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== FOOTER ===== */}
      <footer style={{
        textAlign: 'center' as const, padding: '24px 0',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <a
          href="/"
          style={{
            fontSize: 11, opacity: 0.3, color: 'white', textDecoration: 'none',
            fontWeight: 600, letterSpacing: '0.05em',
          }}
        >
          Powered by Docs2Video
        </a>
      </footer>

      {/* ===== AI CHAT WIDGET ===== */}
      {/* Toggle button */}
      <button
        onClick={() => setChatOpen((o) => !o)}
        style={{
          position: 'fixed' as const, bottom: 24, right: 24,
          width: 56, height: 56, borderRadius: 10,
          background: accent, color: accentBg,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          zIndex: 100, transition: 'transform 0.2s ease',
        }}
        aria-label="Chat"
      >
        {chatOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {chatOpen && (
        <div
          role="dialog"
          aria-label="AI Chat Assistant"
          style={{
          position: 'fixed' as const, bottom: 92, right: 24,
          width: 380, maxWidth: 'calc(100vw - 48px)',
          height: 520, maxHeight: 'calc(100vh - 140px)',
          background: '#111D30', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, display: 'flex', flexDirection: 'column' as const,
          boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
          zIndex: 99, overflow: 'hidden',
        }}>
          {/* Chat header */}
          <div style={{
            padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: accent,
              boxShadow: `0 0 8px ${accent}80`,
            }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>AI Assistant</div>
              <div style={{ fontSize: 11, opacity: 0.4 }}>Ask about this video</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto' as const, padding: 18,
            display: 'flex', flexDirection: 'column' as const, gap: 12,
          }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center' as const, marginTop: 60, padding: '0 20px' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', background: `${accent}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>How can I help?</div>
                <div style={{ fontSize: 12, opacity: 0.4, lineHeight: 1.5 }}>
                  Ask any question about the content in this video and I will find the answer for you.
                </div>
              </div>
            )}
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                style={{ alignSelf: msg.role === 'client' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}
              >
                <div style={{
                  padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.55,
                  background: msg.role === 'client' ? accent : 'rgba(255,255,255,0.06)',
                  color: msg.role === 'client' ? accentBg : 'white',
                  border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  {msg.message}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ alignSelf: 'flex-start' }}>
                <div style={{
                  padding: '12px 18px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', gap: 4,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, opacity: 0.6, animation: 'pulse 1.2s ease-in-out infinite' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, opacity: 0.6, animation: 'pulse 1.2s ease-in-out 0.2s infinite' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, opacity: 0.6, animation: 'pulse 1.2s ease-in-out 0.4s infinite' }} />
                  <style>{`@keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat error */}
          {chatError && (
            <div style={{
              padding: '8px 14px', background: 'rgba(192,58,31,0.15)',
              fontSize: 12, color: '#ff6b54', textAlign: 'center' as const,
            }}>
              {chatError}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', gap: 8, background: 'rgba(255,255,255,0.02)',
          }}>
            <input
              style={{
                flex: 1, padding: '10px 14px', fontSize: 13,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, color: 'white', outline: 'none',
              }}
              placeholder="Type your question..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendChat() }}
              disabled={chatLoading}
            />
            <button
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              style={{
                flexShrink: 0, padding: '10px 14px',
                background: accent, color: accentBg,
                border: 'none', borderRadius: 10, cursor: 'pointer',
                opacity: (chatLoading || !chatInput.trim()) ? 0.4 : 1,
                transition: 'opacity 0.15s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Helper: render action button icon ---
function renderActionIcon(icon: string, color: string) {
  switch (icon) {
    case 'calendar':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    case 'card':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      )
    case 'chat':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    case 'download':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )
    case 'slides':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      )
    default:
      return null
  }
}

// --- Helper: adjust hex color brightness ---
function adjustBrightness(hex: string, amount: number): string {
  const clamp = (v: number) => Math.min(255, Math.max(0, v))
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = clamp(parseInt(h.substring(0, 2), 16) + amount)
  const g = clamp(parseInt(h.substring(2, 4), 16) + amount)
  const b = clamp(parseInt(h.substring(4, 6), 16) + amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
