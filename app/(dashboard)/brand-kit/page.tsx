'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useToast } from '../../_components/Toast'

// ── Types ──────────────────────────────────────────────────────────
type Stage = 'welcome' | 'chat' | 'palette' | 'logo' | 'building' | 'complete'

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

type Palette = {
  name: string
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
}

type BuildCard = {
  label: string
  status: 'pending' | 'active' | 'done'
  icon: string
  thumbnailUrl?: string
}

type AssetResult = {
  logoImages: string[]
  cardFront: string
  cardBack: string
  socialImages: { type: string; url: string }[]
  emailSignatureHtml: string
  guideUrl: string
}

// ── Shimmer keyframes injected once ────────────────────────────────
const shimmerCSS = `
@keyframes bk-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
@keyframes bk-fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes bk-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes bk-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`

export default function BrandKitPage() {
  const notify = useToast()
  const [stage, setStage] = useState<Stage>('welcome')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [brandBrief, setBrandBrief] = useState<BrandBrief | null>(null)

  // Palette stage
  const [palettes, setPalettes] = useState<Palette[]>([])
  const [selectedPalette, setSelectedPalette] = useState<number | null>(null)
  const [palettesLoading, setPalettesLoading] = useState(false)

  // Logo stage
  const [logoImages, setLogoImages] = useState<string[]>([])
  const [selectedLogo, setSelectedLogo] = useState<number | null>(null)
  const [logosLoading, setLogosLoading] = useState(false)
  const [refineInput, setRefineInput] = useState('')
  const [refining, setRefining] = useState(false)
  const [showRefine, setShowRefine] = useState(false)

  // Building stage
  const [buildCards, setBuildCards] = useState<BuildCard[]>([])

  // Complete stage
  const [assets, setAssets] = useState<AssetResult | null>(null)

  // Voice
  const [isListening, setIsListening] = useState(false)

  // Refs
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const refineRef = useRef<HTMLInputElement>(null)
  const styleRef = useRef<HTMLStyleElement | null>(null)

  // Inject keyframe CSS
  useEffect(() => {
    if (!styleRef.current) {
      const style = document.createElement('style')
      style.textContent = shimmerCSS
      document.head.appendChild(style)
      styleRef.current = style
    }
    return () => {
      if (styleRef.current) {
        styleRef.current.remove()
        styleRef.current = null
      }
    }
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  // Auto-focus input after messages change
  useEffect(() => {
    if (stage === 'chat' || stage === 'complete') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [messages, stage])

  // Auto-focus refine input
  useEffect(() => {
    if (showRefine) setTimeout(() => refineRef.current?.focus(), 100)
  }, [showRefine])

  // ── Chat ─────────────────────────────────────────────────────────
  const SOFIA_INTRO: ChatMessage = {
    role: 'assistant',
    content: "Hi! I'm Sofia, your brand director. I've helped build identities for hundreds of companies, and I'm excited to craft yours. Let's start simple — what's the name of your company or brand?",
  }

  function startChat() {
    setMessages([SOFIA_INTRO])
    setStage('chat')
  }

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
          brandBrief,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chat failed')

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])

      if (data.readyToBuild && data.brandBrief) {
        setBrandBrief(data.brandBrief)
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    }
    setChatLoading(false)
  }

  const isSofiaReady = brandBrief !== null && messages.length >= 6

  // ── Voice Input ──────────────────────────────────────────────────
  const startVoice = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { notify('Voice input is not supported in this browser.', 'error'); return }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInput(prev => prev + transcript)
    }
    recognition.start()
  }, [])

  // ── Palette Generation ───────────────────────────────────────────
  async function generatePalettes() {
    if (!brandBrief) return
    setStage('palette')
    setPalettesLoading(true)
    try {
      const res = await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-palettes', brandBrief }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate palettes')
      setPalettes(data.palettes)
    } catch (err) {
      console.error(err)
      setPalettes([])
    }
    setPalettesLoading(false)
  }

  // ── Logo Generation ──────────────────────────────────────────────
  async function generateLogos() {
    if (!brandBrief || selectedPalette === null) return
    setStage('logo')
    setLogosLoading(true)
    try {
      const res = await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          brandBrief,
          palette: palettes[selectedPalette],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate logos')
      setLogoImages(data.images || data.logoImages || [])
    } catch (err) {
      console.error(err)
    }
    setLogosLoading(false)
  }

  // ── Logo Refine ──────────────────────────────────────────────────
  async function refineLogo() {
    if (!refineInput.trim() || selectedLogo === null || refining) return
    setRefining(true)
    try {
      const res = await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refine',
          brandBrief,
          palette: palettes[selectedPalette!],
          logoUrl: logoImages[selectedLogo],
          feedback: refineInput,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refine failed')
      if (data.images && data.images.length > 0) {
        setLogoImages(prev => {
          const next = [...prev]
          next[selectedLogo!] = data.images[0]
          return next
        })
      }
      setRefineInput('')
      setShowRefine(false)
    } catch (err) {
      console.error(err)
    }
    setRefining(false)
  }

  // ── Build Assets ─────────────────────────────────────────────────
  async function buildAssets() {
    if (!brandBrief || selectedPalette === null || selectedLogo === null) return
    setStage('building')

    const cards: BuildCard[] = [
      { label: 'Logo', status: 'done', icon: '✅' },
      { label: 'Business Cards', status: 'active', icon: '🔄' },
      { label: 'Social Kit', status: 'pending', icon: '⏳' },
      { label: 'Email Signature', status: 'pending', icon: '⏳' },
      { label: 'Brand Guide', status: 'pending', icon: '⏳' },
    ]
    setBuildCards([...cards])

    try {
      const res = await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-assets',
          brandBrief,
          palette: palettes[selectedPalette],
          logoUrl: logoImages[selectedLogo],
        }),
      })

      // Simulate progressive updates
      const progressSteps = [
        { idx: 1, delay: 0 },
        { idx: 2, delay: 0 },
        { idx: 3, delay: 0 },
        { idx: 4, delay: 0 },
      ]

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Asset generation failed')

      // Progressive reveal of completed cards
      for (const step of progressSteps) {
        cards[step.idx].status = 'done'
        cards[step.idx].icon = '✅'
        if (step.idx + 1 < cards.length) {
          cards[step.idx + 1].status = 'active'
          cards[step.idx + 1].icon = '🔄'
        }
        // Add thumbnails
        if (step.idx === 1 && data.cardFront) cards[1].thumbnailUrl = data.cardFront
        if (step.idx === 2 && data.socialImages?.[0]) cards[2].thumbnailUrl = data.socialImages[0].url
        if (step.idx === 4 && data.guideUrl) cards[4].thumbnailUrl = data.guideUrl

        setBuildCards([...cards])
        await new Promise(r => setTimeout(r, 600))
      }

      setAssets({
        logoImages: [logoImages[selectedLogo]],
        cardFront: data.cardFront || '',
        cardBack: data.cardBack || '',
        socialImages: data.socialImages || [],
        emailSignatureHtml: data.emailSignatureHtml || '',
        guideUrl: data.guideUrl || '',
      })

      // Auto-advance after a beat
      setTimeout(() => setStage('complete'), 1200)
    } catch (err) {
      console.error(err)
    }
  }

  // ── Downloads ────────────────────────────────────────────────────
  function downloadFile(url: string, name: string) {
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.target = '_blank'
    link.click()
  }

  function downloadAll() {
    if (!assets) return
    const files: { url: string; name: string }[] = []
    assets.logoImages.forEach((u, i) => files.push({ url: u, name: `logo-${i + 1}.png` }))
    if (assets.cardFront) files.push({ url: assets.cardFront, name: 'business-card-front.png' })
    if (assets.cardBack) files.push({ url: assets.cardBack, name: 'business-card-back.png' })
    assets.socialImages.forEach(img => files.push({ url: img.url, name: `social-${img.type}.png` }))
    if (assets.guideUrl) files.push({ url: assets.guideUrl, name: 'brand-guide.png' })
    if (assets.emailSignatureHtml) {
      const blob = new Blob([assets.emailSignatureHtml], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      files.push({ url, name: 'email-signature.html' })
    }
    files.forEach(f => downloadFile(f.url, f.name))
  }

  // ── Shared Styles ───────────────────────────────────────────────
  const stageContainer: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 80px)',
    padding: '40px 24px',
    animation: 'bk-fadeUp 0.5s ease both',
  }

  const heading: React.CSSProperties = {
    fontSize: 40,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--ink, #1a1a2e)',
    marginBottom: 16,
    textAlign: 'center',
  }

  const subtext: React.CSSProperties = {
    fontSize: 17,
    lineHeight: 1.7,
    color: 'var(--ink-soft, #64748b)',
    maxWidth: 520,
    textAlign: 'center',
    marginBottom: 32,
  }

  const primaryBtn: React.CSSProperties = {
    padding: '16px 40px',
    fontSize: 16,
    fontWeight: 600,
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    background: 'var(--mint, #A8F0D4)',
    color: 'var(--ink, #1a1a2e)',
    transition: 'all 0.2s ease',
  }

  const badge: React.CSSProperties = {
    display: 'inline-block',
    padding: '8px 20px',
    borderRadius: 100,
    background: 'var(--bg-soft, #f8fafc)',
    border: '1px solid var(--border, #e2e8f0)',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ink, #1a1a2e)',
    marginBottom: 32,
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  // ── WELCOME ──────────────────────────────────────────────────────
  if (stage === 'welcome') {
    return (
      <div style={stageContainer}>
        <h1 style={heading}>Welcome to Brand Studio</h1>
        <p style={subtext}>
          In the next few minutes, we'll build your complete brand identity &mdash; logo, colors,
          business cards, social media, and more.
        </p>
        <div style={badge}>Brand Kit &mdash; $149</div>
        <br />
        <button style={primaryBtn} onClick={startChat}>
          Let&rsquo;s Begin &rarr;
        </button>
      </div>
    )
  }

  // ── CHAT ─────────────────────────────────────────────────────────
  if (stage === 'chat') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 80px)',
          maxWidth: 720,
          margin: '0 auto',
          padding: '0 20px',
          animation: 'bk-fadeUp 0.4s ease both',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 0 12px',
            borderBottom: '1px solid var(--border-light, #e2e8f0)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft, #64748b)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
            Brand Studio
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-softer, #94a3b8)', marginTop: 2 }}>
            Sofia, your brand director
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 14,
                animation: 'bk-fadeUp 0.3s ease both',
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '14px 20px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user' ? 'var(--mint, #A8F0D4)' : 'white',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border-light, #e2e8f0)',
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: 'var(--ink, #1a1a2e)',
                }}
              >
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              </div>
            </div>
          ))}

          {chatLoading && (
            <div style={{ display: 'flex', marginBottom: 14 }}>
              <div
                style={{
                  padding: '14px 24px',
                  borderRadius: '18px 18px 18px 4px',
                  background: 'white',
                  border: '1px solid var(--border-light, #e2e8f0)',
                  fontSize: 20,
                  letterSpacing: 4,
                  animation: 'bk-pulse 1.2s ease infinite',
                }}
              >
                &bull;&bull;&bull;
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Ready button */}
        {isSofiaReady && (
          <div style={{ padding: '12px 0', textAlign: 'center' }}>
            <button
              onClick={generatePalettes}
              style={{
                ...primaryBtn,
                width: '100%',
                padding: '16px 32px',
                background: 'linear-gradient(135deg, var(--mint, #A8F0D4), #7dd3c0)',
              }}
            >
              See Your Brand Direction &rarr;
            </button>
          </div>
        )}

        {/* Input bar */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '12px 0 24px',
            borderTop: '1px solid var(--border-light, #e2e8f0)',
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') sendMessage(input)
            }}
            className="input"
            placeholder="Type your answer..."
            style={{ flex: 1, padding: '14px 18px', fontSize: 15, borderRadius: 10 }}
            disabled={chatLoading}
          />
          <button
            onClick={startVoice}
            disabled={chatLoading}
            title="Voice input"
            style={{
              padding: '14px 16px',
              borderRadius: 10,
              border: '1px solid var(--border, #e2e8f0)',
              background: isListening ? 'var(--mint, #A8F0D4)' : 'white',
              cursor: 'pointer',
              fontSize: 18,
              transition: 'all 0.2s',
            }}
          >
            🎤
          </button>
          <button
            onClick={() => sendMessage(input)}
            disabled={chatLoading || !input.trim()}
            className="btn btn-primary"
            style={{ padding: '14px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
          >
            Send
          </button>
        </div>
      </div>
    )
  }

  // ── PALETTE ──────────────────────────────────────────────────────
  if (stage === 'palette') {
    return (
      <div style={{ ...stageContainer, justifyContent: 'flex-start', paddingTop: 60 }}>
        <h1 style={{ ...heading, fontSize: 34 }}>
          {brandBrief ? `Here's what I see for ${brandBrief.companyName}` : 'Your Color Palettes'}
        </h1>
        <p style={{ ...subtext, marginBottom: 40 }}>
          Choose the palette that feels right. Each one tells a different story.
        </p>

        {palettesLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid var(--border, #e2e8f0)',
                borderTopColor: 'var(--mint, #A8F0D4)',
                borderRadius: '50%',
                animation: 'bk-spin 0.8s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <div style={{ fontSize: 15, color: 'var(--ink-soft, #64748b)' }}>
              Crafting your palettes...
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                gap: 24,
                flexWrap: 'wrap',
                justifyContent: 'center',
                maxWidth: 900,
              }}
            >
              {palettes.map((p, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedPalette(i)}
                  style={{
                    width: 260,
                    padding: 24,
                    borderRadius: 10,
                    border:
                      selectedPalette === i
                        ? '3px solid var(--mint-darker, #4a7c59)'
                        : '2px solid var(--border, #e2e8f0)',
                    background: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    transform: selectedPalette === i ? 'scale(1.03)' : 'scale(1)',
                    boxShadow:
                      selectedPalette === i
                        ? '0 8px 30px rgba(0,0,0,0.08)'
                        : '0 2px 8px rgba(0,0,0,0.04)',
                    animation: `bk-fadeUp 0.4s ease ${i * 0.1}s both`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      marginBottom: 16,
                      color: 'var(--ink, #1a1a2e)',
                      textAlign: 'center',
                    }}
                  >
                    {p.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    {[p.primary, p.secondary, p.accent, p.background, p.text].map((color, ci) => (
                      <div
                        key={ci}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 8,
                          background: color,
                          border: '1px solid rgba(0,0,0,0.08)',
                        }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {selectedPalette !== null && (
              <div style={{ marginTop: 40, animation: 'bk-fadeUp 0.3s ease both' }}>
                <button style={primaryBtn} onClick={generateLogos}>
                  Lock Palette &rarr;
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ── LOGO ─────────────────────────────────────────────────────────
  if (stage === 'logo') {
    return (
      <div style={{ ...stageContainer, justifyContent: 'flex-start', paddingTop: 60 }}>
        <h1 style={{ ...heading, fontSize: 34 }}>
          {logosLoading ? 'Designing your logo...' : 'Choose your logo'}
        </h1>

        {logosLoading ? (
          <div style={{ textAlign: 'center', padding: 60, maxWidth: 500 }}>
            {/* Shimmer cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 440, margin: '0 auto' }}>
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  style={{
                    height: 200,
                    borderRadius: 10,
                    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                    backgroundSize: '400px 100%',
                    animation: `bk-shimmer 1.5s ease infinite ${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 15, color: 'var(--ink-soft, #64748b)', marginTop: 24 }}>
              Creating four unique concepts...
            </div>
          </div>
        ) : (
          <>
            <p style={subtext}>Click a concept to select it. You can refine or lock it in.</p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                maxWidth: 520,
                width: '100%',
              }}
            >
              {logoImages.map((url, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setSelectedLogo(i)
                    setShowRefine(false)
                  }}
                  style={{
                    borderRadius: 10,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border:
                      selectedLogo === i
                        ? '3px solid var(--mint-darker, #4a7c59)'
                        : '2px solid var(--border, #e2e8f0)',
                    background: 'white',
                    transition: 'all 0.2s',
                    transform: selectedLogo === i ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: selectedLogo === i ? '0 8px 30px rgba(0,0,0,0.08)' : 'none',
                    animation: `bk-fadeUp 0.4s ease ${i * 0.08}s both`,
                  }}
                >
                  <img
                    src={url}
                    alt={`Logo concept ${i + 1}`}
                    style={{ width: '100%', display: 'block' }}
                  />
                </div>
              ))}
            </div>

            {selectedLogo !== null && (
              <div
                style={{
                  marginTop: 28,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  animation: 'bk-fadeUp 0.3s ease both',
                }}
              >
                <button style={primaryBtn} onClick={buildAssets}>
                  This is perfect &rarr;
                </button>
                <button
                  onClick={() => setShowRefine(true)}
                  style={{
                    ...primaryBtn,
                    background: 'white',
                    border: '2px solid var(--border, #e2e8f0)',
                    color: 'var(--ink-soft, #64748b)',
                  }}
                >
                  Refine this one
                </button>
              </div>
            )}

            {showRefine && selectedLogo !== null && (
              <div
                style={{
                  marginTop: 20,
                  display: 'flex',
                  gap: 8,
                  maxWidth: 520,
                  width: '100%',
                  animation: 'bk-fadeUp 0.3s ease both',
                }}
              >
                <input
                  ref={refineRef}
                  value={refineInput}
                  onChange={e => setRefineInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') refineLogo()
                  }}
                  className="input"
                  placeholder="Tell Sofia what to change..."
                  style={{ flex: 1, padding: '14px 18px', fontSize: 15, borderRadius: 10 }}
                  disabled={refining}
                />
                <button
                  onClick={refineLogo}
                  disabled={refining || !refineInput.trim()}
                  className="btn btn-primary"
                  style={{ padding: '14px 24px', borderRadius: 10 }}
                >
                  {refining ? '...' : 'Refine'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ── BUILDING ─────────────────────────────────────────────────────
  if (stage === 'building') {
    return (
      <div style={stageContainer}>
        <h1 style={{ ...heading, fontSize: 34 }}>Building your complete brand kit...</h1>
        <p style={{ ...subtext, marginBottom: 48 }}>
          This will take a few minutes. Each asset is crafted individually.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: 800,
          }}
        >
          {buildCards.map((card, i) => (
            <div
              key={i}
              style={{
                width: 140,
                padding: 20,
                borderRadius: 10,
                background: card.status === 'done' ? 'white' : 'var(--bg-soft, #f8fafc)',
                border:
                  card.status === 'done'
                    ? '2px solid var(--mint, #A8F0D4)'
                    : card.status === 'active'
                    ? '2px solid var(--mint, #A8F0D4)'
                    : '2px solid var(--border, #e2e8f0)',
                textAlign: 'center',
                transition: 'all 0.4s ease',
                animation:
                  card.status === 'active' ? 'bk-pulse 1.5s ease infinite' : undefined,
                opacity: card.status === 'pending' ? 0.5 : 1,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{card.icon}</div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--ink, #1a1a2e)',
                }}
              >
                {card.label}
              </div>
              {card.thumbnailUrl && (
                <div
                  style={{
                    marginTop: 10,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid var(--border, #e2e8f0)',
                  }}
                >
                  <img
                    src={card.thumbnailUrl}
                    alt={card.label}
                    style={{ width: '100%', display: 'block', height: 60, objectFit: 'cover' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── COMPLETE ─────────────────────────────────────────────────────
  if (stage === 'complete' && assets) {
    return (
      <div
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '40px 24px 80px',
          animation: 'bk-fadeUp 0.5s ease both',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={heading}>Your brand is ready</h1>
          <p style={subtext}>
            Every asset below is ready to download and use. Your brand identity is complete.
          </p>
          <button
            onClick={downloadAll}
            style={{
              ...primaryBtn,
              padding: '18px 48px',
              fontSize: 17,
              background: 'linear-gradient(135deg, var(--mint, #A8F0D4), #7dd3c0)',
            }}
          >
            Download Everything
          </button>
        </div>

        {/* Logo */}
        {assets.logoImages.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>Logo</h2>
              <button
                onClick={() => downloadFile(assets.logoImages[0], 'logo.png')}
                className="btn btn-sm"
                style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8 }}
              >
                Download
              </button>
            </div>
            <div
              style={{
                borderRadius: 10,
                overflow: 'hidden',
                border: '2px solid var(--border, #e2e8f0)',
                background: 'white',
                maxWidth: 300,
              }}
            >
              <img src={assets.logoImages[0]} alt="Logo" style={{ width: '100%', display: 'block' }} />
            </div>
          </section>
        )}

        {/* Business Cards */}
        {(assets.cardFront || assets.cardBack) && (
          <section style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>Business Cards</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {assets.cardFront && (
                  <button onClick={() => downloadFile(assets.cardFront, 'card-front.png')} className="btn btn-sm" style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8 }}>
                    Front
                  </button>
                )}
                {assets.cardBack && (
                  <button onClick={() => downloadFile(assets.cardBack, 'card-back.png')} className="btn btn-sm" style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8 }}>
                    Back
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {assets.cardFront && (
                <div style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border, #e2e8f0)', background: 'white' }}>
                  <div style={{ fontSize: 11, padding: '8px 12px', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid var(--border-light, #e2e8f0)' }}>Front</div>
                  <img src={assets.cardFront} alt="Business card front" style={{ width: '100%', display: 'block' }} />
                </div>
              )}
              {assets.cardBack && (
                <div style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border, #e2e8f0)', background: 'white' }}>
                  <div style={{ fontSize: 11, padding: '8px 12px', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid var(--border-light, #e2e8f0)' }}>Back</div>
                  <img src={assets.cardBack} alt="Business card back" style={{ width: '100%', display: 'block' }} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Social Media Kit */}
        {assets.socialImages.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Social Media Kit</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {assets.socialImages.map((img, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {img.type === 'landscape' ? 'Landscape (Banners/Covers)' : img.type === 'square' ? 'Square (Posts)' : 'Vertical (Stories)'}
                    </span>
                    <button onClick={() => downloadFile(img.url, `social-${img.type}.png`)} className="btn btn-sm" style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8 }}>
                      Download
                    </button>
                  </div>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border, #e2e8f0)', background: 'white', maxHeight: img.type === 'vertical' ? 320 : undefined }}>
                    <img
                      src={img.url}
                      alt={`Social ${img.type}`}
                      style={{ width: '100%', display: 'block', objectFit: img.type === 'vertical' ? 'cover' : undefined, maxHeight: img.type === 'vertical' ? 320 : undefined }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Email Signature */}
        {assets.emailSignatureHtml && (
          <section style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>Email Signature</h2>
              <button
                onClick={() => {
                  const blob = new Blob([assets.emailSignatureHtml], { type: 'text/html' })
                  const url = URL.createObjectURL(blob)
                  downloadFile(url, 'email-signature.html')
                }}
                className="btn btn-sm"
                style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8 }}
              >
                Download HTML
              </button>
            </div>
            <div
              style={{
                borderRadius: 10,
                border: '2px solid var(--border, #e2e8f0)',
                background: 'white',
                padding: 24,
              }}
              dangerouslySetInnerHTML={{ __html: assets.emailSignatureHtml }}
            />
          </section>
        )}

        {/* Brand Guide */}
        {assets.guideUrl && (
          <section style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>Brand Guide</h2>
              <button onClick={() => downloadFile(assets.guideUrl, 'brand-guide.png')} className="btn btn-sm" style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8 }}>
                Download
              </button>
            </div>
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border, #e2e8f0)', background: 'white' }}>
              <img src={assets.guideUrl} alt="Brand guide" style={{ width: '100%', display: 'block' }} />
            </div>
          </section>
        )}

        {/* Sofia chat at bottom */}
        <div
          style={{
            marginTop: 48,
            padding: 24,
            borderRadius: 10,
            background: 'var(--bg-soft, #f8fafc)',
            border: '1px solid var(--border, #e2e8f0)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 15, color: 'var(--ink-soft, #64748b)', marginBottom: 16 }}>
            Want to make changes? Just ask Sofia.
          </div>
          <div style={{ display: 'flex', gap: 8, maxWidth: 500, margin: '0 auto' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && input.trim()) {
                  sendMessage(input)
                }
              }}
              className="input"
              placeholder="Ask Sofia to adjust anything..."
              style={{ flex: 1, padding: '14px 18px', fontSize: 15, borderRadius: 10 }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="btn btn-primary"
              style={{ padding: '14px 24px', borderRadius: 10 }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Fallback
  return null
}
