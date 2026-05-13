'use client'

import { useState, useRef, useEffect } from 'react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type BrandBrief = {
  companyName: string
  industry: string
  audience: string
  personality: string
  colorPrefs: string
  notes: string
}

type SocialImage = {
  type: string
  url: string
}

type BrandKitResults = {
  logoImages: string[]
  cardFront: string
  cardBack: string
  socialImages: SocialImage[]
  guideUrl: string
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Welcome! I'm your brand strategist. Let's build your complete brand identity \u2014 logo, business cards, social media kit, and brand guide. What's the name of your company?",
}

export default function BrandKitPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [readyToBuild, setReadyToBuild] = useState(false)
  const [brandBrief, setBrandBrief] = useState<BrandBrief | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState('')
  const [results, setResults] = useState<BrandKitResults | null>(null)
  const [selectedLogo, setSelectedLogo] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  async function sendMessage(text: string) {
    if (!text.trim() || chatLoading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chat failed')

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])

      if (data.readyToBuild && data.brandBrief) {
        setReadyToBuild(true)
        setBrandBrief(data.brandBrief)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    }
    setChatLoading(false)
  }

  async function handleGenerate() {
    if (!brandBrief || generating) return
    setGenerating(true)
    setGenerationProgress('Starting brand kit generation...')

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Building your complete brand kit now. This will take a few minutes \u2014 I\'m generating logo concepts, business cards, social media graphics, and your brand guide. Hang tight!',
    }])

    try {
      setGenerationProgress('Generating logos...')
      const res = await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          brandBrief,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setResults(data)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Your brand kit is ready! Check the results panel on the right \u2014 you\'ve got logo concepts, business cards, social media graphics, and a brand guide. Click any logo to select it, and download everything when you\'re happy.',
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
      }])
    }
    setGenerating(false)
    setGenerationProgress('')
  }

  function handleDownloadAll() {
    if (!results) return
    const urls: { url: string; name: string }[] = []

    results.logoImages.forEach((url, i) => {
      urls.push({ url, name: `logo-concept-${i + 1}.png` })
    })
    if (results.cardFront) urls.push({ url: results.cardFront, name: 'business-card-front.png' })
    if (results.cardBack) urls.push({ url: results.cardBack, name: 'business-card-back.png' })
    results.socialImages.forEach(img => {
      urls.push({ url: img.url, name: `social-${img.type}.png` })
    })
    if (results.guideUrl) urls.push({ url: results.guideUrl, name: 'brand-guide.png' })

    urls.forEach(({ url, name }) => {
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.target = '_blank'
      link.click()
    })
  }

  function handleDownloadSingle(url: string, name: string) {
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.target = '_blank'
    link.click()
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 152px)', margin: '-40px auto 0', maxWidth: 1400, padding: '0 16px', overflow: 'hidden', gap: 20 }}>

      {/* ── LEFT: Chat Panel ────────────────────────────────── */}
      <div style={{ flex: results ? '0 0 50%' : '1', display: 'flex', flexDirection: 'column', minWidth: 0, transition: 'flex 0.3s ease' }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
            }}>
              <div style={{
                maxWidth: '85%',
                padding: '12px 18px',
                borderRadius: 10,
                background: msg.role === 'user' ? 'var(--mint, #A8F0D4)' : 'white',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-light, #e2e8f0)',
                fontSize: 14,
                lineHeight: 1.6,
              }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              </div>
            </div>
          ))}

          {chatLoading && (
            <div style={{ display: 'flex' }}>
              <div style={{ padding: '12px 18px', borderRadius: 10, background: 'white', border: '1px solid var(--border-light, #e2e8f0)' }}>
                <span className="spinner" style={{ width: 18, height: 18 }} />
              </div>
            </div>
          )}

          {generating && (
            <div style={{ display: 'flex' }}>
              <div style={{ padding: '12px 18px', borderRadius: 10, background: 'white', border: '1px solid var(--border-light, #e2e8f0)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="spinner" style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{generationProgress}</span>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Generate button */}
        {readyToBuild && !results && !generating && (
          <div style={{ padding: '12px 0', borderTop: '1px solid var(--border-light, #e2e8f0)' }}>
            <button
              onClick={handleGenerate}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px 24px', fontSize: 16, fontWeight: 600 }}
            >
              Generate Brand Kit
            </button>
          </div>
        )}

        {/* Price display */}
        <div style={{
          textAlign: 'center', padding: '6px 12px',
          background: 'var(--bg-soft, #f8fafc)', borderRadius: 8,
          border: '1px solid var(--border, #e2e8f0)',
          fontSize: 12, color: 'var(--ink-soft)',
        }}>
          Complete Brand Kit (logo + cards + social + guide) — <strong style={{ color: 'var(--ink)' }}>$149</strong>
        </div>

        {/* Input bar */}
        {!results && (
          <div style={{
            display: 'flex', gap: 8, padding: '12px 0 20px',
            borderTop: '1px solid var(--border-light, #e2e8f0)',
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage(input) }}
              className="input"
              placeholder="Type your answer..."
              style={{ flex: 1 }}
              disabled={chatLoading || generating}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={chatLoading || generating || !input.trim()}
              className="btn btn-primary"
            >
              Send
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT: Results Panel ────────────────────────────── */}
      {results && (
        <div style={{
          flex: '0 0 50%',
          overflowY: 'auto',
          padding: '24px 0',
          borderLeft: '1px solid var(--border-light, #e2e8f0)',
          paddingLeft: 20,
        }}>
          {/* Logo Section */}
          {results.logoImages.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--ink)' }}>Logo Concepts</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {results.logoImages.map((url, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedLogo(idx)}
                    style={{
                      borderRadius: 10,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: selectedLogo === idx ? '3px solid var(--mint-darker, #4a7c59)' : '2px solid var(--border, #e2e8f0)',
                      transition: 'border 0.2s',
                      background: 'white',
                    }}
                  >
                    <img src={url} alt={`Logo concept ${idx + 1}`} style={{ width: '100%', display: 'block' }} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  Concept {selectedLogo + 1} of {results.logoImages.length} selected
                </span>
                <button
                  onClick={() => handleDownloadSingle(results.logoImages[selectedLogo], `logo-concept-${selectedLogo + 1}.png`)}
                  className="btn btn-sm"
                  style={{ fontSize: 12, padding: '4px 12px' }}
                >
                  Download Selected
                </button>
              </div>
            </div>
          )}

          {/* Business Cards */}
          {(results.cardFront || results.cardBack) && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--ink)' }}>Business Cards</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.cardFront && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Front</div>
                    <div style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border, #e2e8f0)', background: 'white' }}>
                      <img src={results.cardFront} alt="Business card front" style={{ width: '100%', display: 'block' }} />
                    </div>
                  </div>
                )}
                {results.cardBack && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Back</div>
                    <div style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border, #e2e8f0)', background: 'white' }}>
                      <img src={results.cardBack} alt="Business card back" style={{ width: '100%', display: 'block' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Social Media Kit */}
          {results.socialImages.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--ink)' }}>Social Media Kit</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.socialImages.map((img, idx) => (
                  <div key={idx}>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {img.type === 'landscape' ? 'Landscape (Banners/Covers)' :
                       img.type === 'square' ? 'Square (Posts/Profile)' :
                       'Vertical (Stories)'}
                    </div>
                    <div style={{
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: '2px solid var(--border, #e2e8f0)',
                      background: 'white',
                      maxHeight: img.type === 'vertical' ? 300 : undefined,
                    }}>
                      <img
                        src={img.url}
                        alt={`Social ${img.type}`}
                        style={{
                          width: '100%',
                          display: 'block',
                          objectFit: img.type === 'vertical' ? 'cover' : undefined,
                          maxHeight: img.type === 'vertical' ? 300 : undefined,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brand Guide */}
          {results.guideUrl && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--ink)' }}>Brand Guide</h3>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border, #e2e8f0)', background: 'white' }}>
                <img src={results.guideUrl} alt="Brand guide" style={{ width: '100%', display: 'block' }} />
              </div>
            </div>
          )}

          {/* Download All */}
          <div style={{ padding: '16px 0 32px', borderTop: '1px solid var(--border-light, #e2e8f0)' }}>
            <button
              onClick={handleDownloadAll}
              className="btn btn-mint"
              style={{ width: '100%', padding: '14px 24px', fontSize: 15, fontWeight: 600 }}
            >
              Download All Assets
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
