'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type Phase = 'discovery' | 'direction' | 'concepts' | 'refine' | 'final'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  referenceImage?: string
  moodChips?: boolean
  descriptions?: string[]
}

type DesignBrief = {
  name: string
  industry: string
  audience: string
  personality: string
  moodWords: string[]
  referenceNotes: string
  colorPrefs: string
}

type DirectionChoice = 'wordmark' | 'symbol' | 'combination'

type DirectionCard = {
  id: DirectionChoice
  title: string
  description: string
  keywords: string[]
  approach: string
  icon: React.ReactNode
}

type LogoConcept = {
  image: string
  description: string
}

const MOOD_OPTIONS = ['Trust', 'Energy', 'Innovation', 'Warmth', 'Luxury', 'Boldness'] as const

const DIRECTIONS: DirectionCard[] = [
  {
    id: 'wordmark',
    title: 'The Wordmark',
    description: "Your name IS the logo. Think Stripe, Google, Supreme. Clean typography with one subtle custom touch that makes it ownable. No icon needed — the typography does all the work.",
    keywords: ['minimal', 'typographic', 'modern'],
    approach: 'Custom letter modification, premium weight, generous spacing',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--ink-soft)" strokeWidth="1.5">
        <rect x="4" y="14" width="40" height="20" rx="3" />
        <text x="24" y="29" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink-soft)" stroke="none">Aa</text>
      </svg>
    ),
  },
  {
    id: 'symbol',
    title: 'The Symbol',
    description: "A distinctive mark that becomes iconic over time. Think Apple, Nike, Twitter. Works at any size. The name sits beside it, but the symbol can stand alone.",
    keywords: ['geometric', 'memorable', 'versatile'],
    approach: 'Abstract geometric form derived from your initial or industry',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--ink-soft)" strokeWidth="1.5">
        <circle cx="24" cy="20" r="12" />
        <rect x="12" y="36" width="24" height="4" rx="2" />
      </svg>
    ),
  },
  {
    id: 'combination',
    title: 'The Combination',
    description: "Icon and text working together as one unit. Think Slack, Dropbox, Spotify. Flexible — can split apart or stay together.",
    keywords: ['balanced', 'friendly', 'adaptable'],
    approach: 'Custom icon paired with complementary typography',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--ink-soft)" strokeWidth="1.5">
        <circle cx="16" cy="24" r="10" />
        <rect x="30" y="18" width="14" height="3" rx="1.5" />
        <rect x="30" y="24" width="10" height="3" rx="1.5" />
        <rect x="30" y="30" width="12" height="3" rx="1.5" />
      </svg>
    ),
  },
]

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Hey, I'm Marcus. Before I design anything, I need to understand your brand deeply. Let's start — what's the name of the company and what do you do in one sentence?",
}

function VoiceInputButton({ onResult, disabled }: { onResult: (text: string) => void; disabled?: boolean }) {
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
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  )
}

export default function LogoCreatorPage() {
  // Phase & brief state
  const [phase, setPhase] = useState<Phase>('discovery')
  const [designBrief, setDesignBrief] = useState<Partial<DesignBrief>>({})
  const [readyForDirection, setReadyForDirection] = useState(false)

  // Discovery chat state
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [selectedMoods, setSelectedMoods] = useState<string[]>([])

  // Direction state
  const [selectedDirection, setSelectedDirection] = useState<DirectionChoice | null>(null)

  // Concepts state
  const [concepts, setConcepts] = useState<LogoConcept[]>([])
  const [generatingConcepts, setGeneratingConcepts] = useState(false)
  const [conceptsGenerated, setConceptsGenerated] = useState(0)
  const [selectedConcept, setSelectedConcept] = useState<number | null>(null)

  // Refine state
  const [refineHistory, setRefineHistory] = useState<LogoConcept[]>([])
  const [refineCount, setRefineCount] = useState(0)
  const [refineLoading, setRefineLoading] = useState(false)
  const [showBefore, setShowBefore] = useState(false)

  // Final state
  const [darkVersion, setDarkVersion] = useState<string | null>(null)
  const [loadingDark, setLoadingDark] = useState(false)

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading, concepts, refineHistory])

  useEffect(() => {
    chatInputRef.current?.focus()
  }, [messages, chatLoading])

  // ── Image handling ──

  const processImageFile = useCallback((file: File | Blob) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setPendingImage(reader.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    processImageFile(file)
    e.target.value = ''
  }, [processImageFile])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (blob) processImageFile(blob)
        return
      }
    }
  }, [processImageFile])

  const [dragOver, setDragOver] = useState(false)
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) processImageFile(file)
  }, [processImageFile])

  // ── Discovery chat ──

  async function sendMessage(text: string, attachedImage?: string | null) {
    if ((!text.trim() && !attachedImage) || chatLoading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    if (attachedImage) userMsg.referenceImage = attachedImage

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setPendingImage(null)
    setChatLoading(true)

    const updatedRefs = attachedImage ? [...referenceImages, attachedImage] : referenceImages
    if (attachedImage) setReferenceImages(updatedRefs)

    try {
      const res = await fetch('/api/logo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content,
            ...(m.referenceImage ? { referenceImage: m.referenceImage } : {}),
          })),
          designBrief,
          referenceImages: updatedRefs,
          selectedMoods,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chat failed')

      if (data.designBrief) setDesignBrief(data.designBrief)

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply,
        ...(data.showMoodChips ? { moodChips: true } : {}),
      }
      setMessages(prev => [...prev, assistantMsg])

      if (data.readyForDirection) setReadyForDirection(true)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    }
    setChatLoading(false)
  }

  function handleMoodSelect(mood: string) {
    setSelectedMoods(prev => {
      if (prev.includes(mood)) return prev.filter(m => m !== mood)
      if (prev.length >= 2) return prev
      return [...prev, mood]
    })
  }

  function handleMoodSubmit() {
    if (selectedMoods.length !== 2) return
    sendMessage(`My two feelings: ${selectedMoods.join(' and ')}`)
  }

  // ── Direction ──

  async function lockDirection() {
    if (!selectedDirection) return
    setPhase('concepts')
    generateConcepts()
  }

  // ── Concept generation ──

  async function generateConcepts() {
    setGeneratingConcepts(true)
    setConcepts([])
    setConceptsGenerated(0)

    for (let i = 0; i < 4; i++) {
      try {
        const res = await fetch('/api/logo-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate-concepts',
            designBrief,
            direction: selectedDirection,
            conceptIndex: i,
            referenceImages,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Generation failed')

        setConcepts(prev => [...prev, { image: data.image, description: data.description }])
        setConceptsGenerated(i + 1)
      } catch (err) {
        console.error(`Concept ${i + 1} failed:`, err)
      }
    }

    setGeneratingConcepts(false)
  }

  function selectConcept(idx: number) {
    setSelectedConcept(idx)
  }

  function proceedToRefine() {
    if (selectedConcept === null) return
    const chosen = concepts[selectedConcept]
    setRefineHistory([chosen])
    setRefineCount(0)
    setPhase('refine')
  }

  // ── Refine ──

  async function handleRefine(feedback: string) {
    if (!feedback.trim() || refineLoading || refineCount >= 5) return
    setRefineLoading(true)
    setInput('')

    const currentLogo = refineHistory[refineHistory.length - 1].image

    try {
      const res = await fetch('/api/logo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refine',
          designBrief,
          direction: selectedDirection,
          feedback,
          currentLogo,
          referenceImages,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refinement failed')

      setRefineHistory(prev => [...prev, { image: data.image, description: data.reply }])
      setRefineCount(prev => prev + 1)
    } catch {
      // noop
    }
    setRefineLoading(false)
    chatInputRef.current?.focus()
  }

  function goToFinal() {
    setPhase('final')
    generateDarkVersion()
  }

  // ── Final ──

  async function generateDarkVersion() {
    setLoadingDark(true)
    const currentLogo = refineHistory[refineHistory.length - 1].image

    try {
      const res = await fetch('/api/logo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-dark-version',
          currentLogo,
          designBrief,
        }),
      })
      const data = await res.json()
      if (res.ok) setDarkVersion(data.image)
    } catch {
      // noop
    }
    setLoadingDark(false)
  }

  function downloadImage(dataUrl: string, suffix: string) {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${designBrief.name || 'logo'}-${suffix}.png`
    link.click()
  }

  async function downloadFavicon() {
    const currentLogo = refineHistory[refineHistory.length - 1].image
    // Create a canvas to resize
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, 512, 512)
      const faviconUrl = canvas.toDataURL('image/png')
      downloadImage(faviconUrl, 'favicon-512')
    }
    img.src = currentLogo
  }

  function resetAll() {
    setPhase('discovery')
    setDesignBrief({})
    setReadyForDirection(false)
    setMessages([INITIAL_MESSAGE])
    setInput('')
    setReferenceImages([])
    setPendingImage(null)
    setSelectedMoods([])
    setSelectedDirection(null)
    setConcepts([])
    setGeneratingConcepts(false)
    setConceptsGenerated(0)
    setSelectedConcept(null)
    setRefineHistory([])
    setRefineCount(0)
    setDarkVersion(null)
  }

  // ── Render ──

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 152px)', maxWidth: 960, margin: '-40px auto 0', padding: '0 16px', overflow: 'hidden' }}>

      {/* ═══ PHASE: DISCOVERY ═══ */}
      {phase === 'discovery' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 12,
                animation: 'fadeIn 0.3s ease',
              }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '12px 18px',
                  borderRadius: 10,
                  background: msg.role === 'user' ? 'var(--mint, #A8F0D4)' : 'white',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border-light, #e2e8f0)',
                  fontSize: 14,
                  lineHeight: 1.6,
                }}>
                  {msg.referenceImage && (
                    <div style={{ marginBottom: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border, #e2e8f0)', maxWidth: 200 }}>
                      <img src={msg.referenceImage} alt="Reference upload" style={{ width: '100%', display: 'block' }} />
                    </div>
                  )}
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                  {/* Mood chips */}
                  {msg.moodChips && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                      {MOOD_OPTIONS.map(mood => (
                        <button
                          key={mood}
                          onClick={() => handleMoodSelect(mood)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 10,
                            border: selectedMoods.includes(mood) ? '2px solid var(--mint-darker, #4a7c59)' : '1px solid var(--border, #e2e8f0)',
                            background: selectedMoods.includes(mood) ? 'var(--mint, #A8F0D4)' : 'white',
                            fontSize: 13,
                            fontWeight: selectedMoods.includes(mood) ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {mood}
                        </button>
                      ))}
                      {selectedMoods.length === 2 && (
                        <button onClick={handleMoodSubmit} className="btn btn-primary btn-sm" style={{ marginLeft: 8 }}>
                          Confirm
                        </button>
                      )}
                    </div>
                  )}
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

            <div ref={scrollRef} />
          </div>

          {/* "See My Directions" button */}
          {readyForDirection && (
            <div style={{ padding: '12px 0', textAlign: 'center' }}>
              <button
                onClick={() => setPhase('direction')}
                className="btn btn-primary"
                style={{ padding: '12px 32px', fontSize: 15, fontWeight: 600 }}
              >
                See My Directions &rarr;
              </button>
            </div>
          )}

          {/* Pending image preview */}
          {pendingImage && (
            <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', width: 56, height: 56, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border, #e2e8f0)', flexShrink: 0 }}>
                <img src={pendingImage} alt="Pending upload" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => setPendingImage(null)} style={{
                  position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderRadius: '0 0 0 6px',
                  background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', cursor: 'pointer',
                  fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                }}>x</button>
              </div>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Reference attached</span>
            </div>
          )}

          {/* Input bar */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              display: 'flex', gap: 8, padding: '12px 0 20px',
              borderTop: '1px solid var(--border-light, #e2e8f0)',
              ...(dragOver ? { background: 'rgba(168,240,212,0.1)', borderRadius: 10, outline: '2px dashed var(--mint)' } : {}),
            }}
          >
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={chatLoading}
              title="Upload reference image"
              style={{
                padding: '8px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--surface-raised, #f1f5f9)', border: '1px solid var(--border, #e2e8f0)',
                borderRadius: 10, cursor: chatLoading ? 'not-allowed' : 'pointer',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              ref={chatInputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage(input, pendingImage) }}
              onPaste={handlePaste}
              className="input"
              placeholder="Type your answer or paste a reference image..."
              style={{ flex: 1 }}
              disabled={chatLoading}
            />
            <VoiceInputButton onResult={text => { setInput(text); sendMessage(text) }} disabled={chatLoading} />
            <button
              onClick={() => sendMessage(input, pendingImage)}
              disabled={chatLoading || (!input.trim() && !pendingImage)}
              className="btn btn-primary"
            >
              Send
            </button>
          </div>
        </>
      )}

      {/* ═══ PHASE: DIRECTION ═══ */}
      {phase === 'direction' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 0' }}>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink)', marginBottom: 28 }}>
            Based on everything you told me, I have <strong>3 creative directions</strong> in mind. Each one is a completely different approach. Pick the one that speaks to you.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {DIRECTIONS.map(dir => (
              <div
                key={dir.id}
                onClick={() => setSelectedDirection(dir.id)}
                style={{
                  padding: 24,
                  borderRadius: 10,
                  border: selectedDirection === dir.id ? '3px solid var(--mint-darker, #4a7c59)' : '1px solid var(--border, #e2e8f0)',
                  background: selectedDirection === dir.id ? 'rgba(168,240,212,0.08)' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ marginBottom: 14, opacity: 0.6 }}>{dir.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{dir.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)', marginBottom: 12 }}>{dir.description}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {dir.keywords.map(kw => (
                    <span key={kw} style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 10,
                      background: 'var(--bg-soft, #f8fafc)', border: '1px solid var(--border, #e2e8f0)',
                      color: 'var(--ink-soft)',
                    }}>{kw}</span>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink-light)', fontStyle: 'italic' }}>{dir.approach}</p>
              </div>
            ))}
          </div>

          {selectedDirection && (
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <button onClick={lockDirection} className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 15, fontWeight: 600 }}>
                Lock This Direction &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ PHASE: CONCEPTS ═══ */}
      {phase === 'concepts' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 0' }}>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink)', marginBottom: 6 }}>
            {generatingConcepts
              ? `Designing concept ${conceptsGenerated + 1} of 4 in the ${selectedDirection} style...`
              : concepts.length > 0
              ? "Pick your favorite — we'll refine it together."
              : 'Starting generation...'}
          </p>

          {generatingConcepts && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
              padding: '10px 16px', borderRadius: 10, background: 'var(--bg-soft, #f8fafc)',
              border: '1px solid var(--border, #e2e8f0)',
            }}>
              <span className="spinner" style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Marcus is designing... {conceptsGenerated}/4 complete</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            {concepts.map((concept, idx) => (
              <div
                key={idx}
                onClick={() => selectConcept(idx)}
                style={{
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: selectedConcept === idx ? '3px solid var(--mint-darker, #4a7c59)' : '1px solid var(--border, #e2e8f0)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  animation: 'fadeIn 0.5s ease',
                  background: 'white',
                }}
              >
                <img src={concept.image} alt={`Concept ${idx + 1}`} style={{ width: '100%', display: 'block', aspectRatio: '1/1', objectFit: 'contain', background: '#fff' }} />
                <div style={{ padding: '10px 14px' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Concept {idx + 1}</p>
                  <p style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.4 }}>{concept.description}</p>
                </div>
              </div>
            ))}
          </div>

          {selectedConcept !== null && !generatingConcepts && (
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <button onClick={proceedToRefine} className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 15, fontWeight: 600 }}>
                Refine This One &rarr;
              </button>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      )}

      {/* ═══ PHASE: REFINE ═══ */}
      {phase === 'refine' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 0' }}>
            {/* Current logo large */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{
                width: '100%', maxWidth: 420, borderRadius: 10, overflow: 'hidden',
                border: '1px solid var(--border, #e2e8f0)', background: '#fff',
              }}>
                <img
                  src={showBefore && refineHistory.length > 1 ? refineHistory[refineHistory.length - 2].image : refineHistory[refineHistory.length - 1].image}
                  alt="Current logo"
                  style={{ width: '100%', display: 'block', aspectRatio: '1/1', objectFit: 'contain' }}
                />
              </div>
            </div>

            {/* Before/after toggle */}
            {refineHistory.length > 1 && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <button
                  onClick={() => setShowBefore(!showBefore)}
                  className="btn btn-sm"
                  style={{
                    fontSize: 12, padding: '5px 14px',
                    background: showBefore ? 'var(--mint, #A8F0D4)' : 'var(--bg-soft, #f8fafc)',
                    border: '1px solid var(--border, #e2e8f0)',
                  }}
                >
                  {showBefore ? 'Showing: Before' : 'Showing: After'} (click to toggle)
                </button>
              </div>
            )}

            {/* Marcus message */}
            <div style={{
              padding: '12px 18px', borderRadius: 10,
              background: 'white', border: '1px solid var(--border-light, #e2e8f0)',
              fontSize: 14, lineHeight: 1.6, marginBottom: 16,
            }}>
              {refineHistory.length === 1
                ? "Great pick. What should I adjust? I can change colors, typography, spacing, icon style — whatever you need. Up to 5 refinements."
                : refineHistory[refineHistory.length - 1].description || "Done. What else?"}
            </div>

            {/* History strip */}
            {refineHistory.length > 1 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 0', marginBottom: 16 }}>
                {refineHistory.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: 56, height: 56, flexShrink: 0, borderRadius: 8, overflow: 'hidden',
                      border: idx === refineHistory.length - 1 ? '2px solid var(--mint-darker, #4a7c59)' : '1px solid var(--border, #e2e8f0)',
                      opacity: idx === refineHistory.length - 1 ? 1 : 0.6,
                    }}
                  >
                    <img src={item.image} alt={`Version ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }} />
                  </div>
                ))}
              </div>
            )}

            {refineCount >= 5 && (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', textAlign: 'center', marginBottom: 12 }}>
                Maximum refinements reached.
              </p>
            )}

            {refineLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'var(--bg-soft)', border: '1px solid var(--border)' }}>
                <span className="spinner" style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Refining...</span>
              </div>
            )}

            <div ref={scrollRef} />
          </div>

          {/* Action bar */}
          <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border-light, #e2e8f0)', alignItems: 'center' }}>
            <button onClick={goToFinal} className="btn btn-mint btn-sm" style={{ fontWeight: 600 }}>
              Finalize Logo &rarr;
            </button>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              {refineCount}/5 refinements used
            </span>
          </div>

          {/* Refine input */}
          {refineCount < 5 && (
            <div style={{ display: 'flex', gap: 8, padding: '12px 0 20px' }}>
              <input
                ref={chatInputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRefine(input) }}
                className="input"
                placeholder="Make the text bolder, try blue, tighter spacing..."
                style={{ flex: 1 }}
                disabled={refineLoading}
              />
              <button
                onClick={() => handleRefine(input)}
                disabled={refineLoading || !input.trim()}
                className="btn btn-primary"
              >
                Refine
              </button>
            </div>
          )}
        </>
      )}

      {/* ═══ PHASE: FINAL ═══ */}
      {phase === 'final' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 0' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>Your logo is ready.</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', textAlign: 'center', marginBottom: 28 }}>
            Logo Design &mdash; <strong style={{ color: 'var(--ink)' }}>$49</strong>
          </p>

          {/* White background */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>On white</p>
            <div style={{
              borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border, #e2e8f0)',
              background: '#ffffff', display: 'flex', justifyContent: 'center', padding: 32,
            }}>
              <img src={refineHistory[refineHistory.length - 1].image} alt="Final logo on white" style={{ maxWidth: 400, width: '100%', objectFit: 'contain' }} />
            </div>
          </div>

          {/* Dark background */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>On dark</p>
            <div style={{
              borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border, #e2e8f0)',
              background: '#1a1a2e', display: 'flex', justifyContent: 'center', padding: 32,
              minHeight: 200, alignItems: 'center',
            }}>
              {loadingDark ? (
                <span className="spinner" style={{ width: 24, height: 24 }} />
              ) : darkVersion ? (
                <img src={darkVersion} alt="Final logo on dark" style={{ maxWidth: 400, width: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Dark version unavailable</span>
              )}
            </div>
          </div>

          {/* Small size preview */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>At small size</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border, #e2e8f0)', background: '#fff', flexShrink: 0 }}>
                <img src={refineHistory[refineHistory.length - 1].image} alt="Favicon preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>32px preview</span>
            </div>
          </div>

          {/* Download buttons */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <button
              onClick={() => downloadImage(refineHistory[refineHistory.length - 1].image, 'highres')}
              className="btn btn-primary"
              style={{ flex: 1, minWidth: 180 }}
            >
              Download PNG (high-res)
            </button>
            <button
              onClick={downloadFavicon}
              className="btn btn-mint"
              style={{ flex: 1, minWidth: 180 }}
            >
              Download PNG (favicon 512x512)
            </button>
          </div>

          {/* Start over */}
          <div style={{ textAlign: 'center', paddingBottom: 20 }}>
            <button onClick={resetAll} className="btn btn-sm" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              Start a new logo
            </button>
          </div>

          <div ref={scrollRef} />
        </div>
      )}

      {/* Global animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
