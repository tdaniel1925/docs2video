'use client'

import { useState, useRef, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { useBrand } from './BrandProvider'

// Sanitize assistant HTML before injection (review S4): the prompt asks the
// model for p/strong/ul/ol/li/a only, but model output is NOT a security
// boundary — a jailbroken/echoed <img onerror> would be XSS. Enforce the
// allowlist here, where it can't be talked out of it.
const sanitize = (html: string) =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br', 'b', 'i'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/)/i,
  })

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function HelpChatWidget() {
  const brand = useBrand()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/help-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    }
    setLoading(false)
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--ink, #1a1a2e)', color: 'white',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          zIndex: 100, transition: 'transform 0.2s ease',
        }}
        aria-label="Help"
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24,
          width: 380, maxWidth: 'calc(100vw - 48px)',
          height: 500, maxHeight: 'calc(100vh - 140px)',
          background: 'white', border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: 10, display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
          zIndex: 99, overflow: 'hidden',
          animation: 'helpSlideUp 0.25s ease-out',
          transformOrigin: 'bottom right',
        }}>
          <style>{`@keyframes helpSlideUp { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
            .help-chat-html p { margin: 0 0 6px; }
            .help-chat-html p:last-child { margin-bottom: 0; }
            .help-chat-html ul, .help-chat-html ol { margin: 4px 0 6px; padding-left: 18px; }
            .help-chat-html li { margin: 2px 0; }
            .help-chat-html a { color: var(--mint-darker, #2d7a4f); font-weight: 600; }
            .help-chat-html strong { font-weight: 700; }`}</style>
          {/* Header */}
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid var(--border-light, #e2e8f0)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mint, #A8F0D4)', boxShadow: '0 0 6px rgba(168,240,212,0.6)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Help Assistant</div>
              <div style={{ fontSize: 11, color: 'var(--ink-light, #94a3b8)' }}>Ask anything about {brand.name}</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: 16,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 32, padding: '0 16px' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>&#128075;</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>How can I help?</div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)', lineHeight: 1.5, marginBottom: 16 }}>
                  {brand.showVideoFeatures
                    ? 'Ask me anything about creating videos, infographics, logos, business cards, billing, or any feature.'
                    : 'Ask me anything about making flyers, ads, social posts, banners or business cards — or about credits and billing.'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(brand.showVideoFeatures
                    ? ['How do I create a video?', 'What do credits cost?', 'How do I add my brand logo?', 'Can I download as PDF?']
                    : ['How do I make a flyer?', 'What do credits cost?', 'Can I use my own photos?', 'What sizes can I get?']
                  ).map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); setTimeout(() => send(), 0) }}
                      style={{
                        padding: '8px 12px', borderRadius: 8,
                        border: '1px solid var(--border-light, #e2e8f0)',
                        background: 'white', cursor: 'pointer',
                        fontSize: 12, color: 'var(--ink)', textAlign: 'left',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-soft, #f8fafc)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div
                  className={msg.role === 'assistant' ? 'help-chat-html' : undefined}
                  style={{
                    padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.55,
                    background: msg.role === 'user' ? 'var(--mint, #A8F0D4)' : 'var(--bg-soft, #f8fafc)',
                    color: msg.role === 'user' ? '#0a2e1a' : 'var(--ink, #1a1a2e)',
                    border: msg.role === 'assistant' ? '1px solid var(--border-light, #e2e8f0)' : 'none',
                    ...(msg.role === 'user' ? { whiteSpace: 'pre-wrap' as const } : {}),
                  }}
                  // Assistant replies are HTML from our own constrained prompt
                  // (p/strong/ul/ol/li/a only) — sanitized through DOMPurify
                  // regardless (review S4). User text stays escaped.
                  {...(msg.role === 'assistant' ? { dangerouslySetInnerHTML: { __html: sanitize(msg.content) } } : {})}
                >
                  {msg.role === 'assistant' ? undefined : msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--bg-soft, #f8fafc)', border: '1px solid var(--border-light, #e2e8f0)', display: 'flex', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-light)', animation: 'helpPulse 1.2s ease-in-out infinite' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-light)', animation: 'helpPulse 1.2s ease-in-out 0.2s infinite' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-light)', animation: 'helpPulse 1.2s ease-in-out 0.4s infinite' }} />
                  <style>{`@keyframes helpPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-light, #e2e8f0)' }}>
            <div style={{ display: 'flex', gap: 8, border: '1px solid var(--border, #cbd5e1)', borderRadius: 8, padding: '4px 4px 4px 12px' }}>
              <input
                type="text"
                placeholder="Ask a question..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                disabled={loading}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--ink)' }}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, opacity: loading || !input.trim() ? 0.5 : 1 }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
