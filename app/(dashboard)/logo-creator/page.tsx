'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  images?: string[]          // generated logo images
  referenceImage?: string    // user-uploaded reference (base64 data URL)
}

type DesignBrief = {
  name: string
  industry: string
  style: string
  logoType: string
  colors: string
  font: string
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Let's design your logo. What's the company name and what do you do?",
}

export default function LogoCreatorPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [logoResults, setLogoResults] = useState<string[]>([])
  const [selectedLogo, setSelectedLogo] = useState<number>(0)
  const [generating, setGenerating] = useState(false)
  const [designBrief, setDesignBrief] = useState<Partial<DesignBrief>>({})
  const [chatLoading, setChatLoading] = useState(false)
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setPendingImage(dataUrl)
    }
    reader.readAsDataURL(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }, [])

  function removePendingImage() {
    setPendingImage(null)
  }

  async function sendMessage(text: string, attachedImage?: string | null) {
    if ((!text.trim() && !attachedImage) || chatLoading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    if (attachedImage) {
      userMsg.referenceImage = attachedImage
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setPendingImage(null)
    setChatLoading(true)

    // Track all reference images for generation
    const updatedRefs = attachedImage ? [...referenceImages, attachedImage] : referenceImages
    if (attachedImage) setReferenceImages(updatedRefs)

    try {
      const res = await fetch('/api/logo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content,
            ...(m.referenceImage ? { referenceImage: m.referenceImage } : {}),
          })),
          designBrief,
          action: 'chat',
          referenceImages: updatedRefs,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chat failed')

      if (data.designBrief) {
        setDesignBrief(data.designBrief)
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply,
      }
      setMessages(prev => [...prev, assistantMsg])

      // If brief is complete, auto-generate
      if (data.readyToGenerate) {
        await generateLogos(data.designBrief, updatedRefs)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    }
    setChatLoading(false)
  }

  async function generateLogos(brief: DesignBrief, refs: string[]) {
    setGenerating(true)
    const genMsg: ChatMessage = { role: 'assistant', content: 'Generating 4 logo concepts for you... This may take a moment.' }
    setMessages(prev => [...prev, genMsg])

    try {
      const res = await fetch('/api/logo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          designBrief: brief,
          action: 'generate',
          referenceImages: refs,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setLogoResults(data.images)
      setSelectedLogo(0)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Here are your concepts. Click one to select it, or tell me what to change.',
        images: data.images,
      }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.` }])
    }
    setGenerating(false)
  }

  async function handleRefine(feedback: string, attachedImage?: string | null) {
    if ((!feedback.trim() && !attachedImage) || generating) return
    setGenerating(true)

    const userMsg: ChatMessage = { role: 'user', content: feedback }
    if (attachedImage) userMsg.referenceImage = attachedImage

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setPendingImage(null)

    const updatedRefs = attachedImage ? [...referenceImages, attachedImage] : referenceImages
    if (attachedImage) setReferenceImages(updatedRefs)

    try {
      const res = await fetch('/api/logo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          designBrief,
          action: 'refine',
          feedback,
          currentLogo: logoResults[selectedLogo],
          referenceImages: updatedRefs,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refinement failed')

      const newResults = [...logoResults]
      newResults[selectedLogo] = data.image
      setLogoResults(newResults)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply || 'Here\'s the refined version. Want more changes, or is this the one?',
        images: [data.image],
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Refinement failed. Please try again.' }])
    }
    setGenerating(false)
  }

  function handleDownload() {
    if (!logoResults[selectedLogo]) return
    const link = document.createElement('a')
    link.href = logoResults[selectedLogo]
    link.download = `logo-${designBrief.name || 'design'}.png`
    link.click()
  }

  function handleSend() {
    if (hasLogos) {
      handleRefine(input, pendingImage)
    } else {
      sendMessage(input, pendingImage)
    }
  }

  const hasLogos = logoResults.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', maxWidth: 900, margin: '0 auto', padding: '0 16px' }}>
      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: 12,
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
              {/* User-uploaded reference image */}
              {msg.referenceImage && (
                <div style={{ marginBottom: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border, #e2e8f0)', maxWidth: 200 }}>
                  <img src={msg.referenceImage} alt="Reference upload" style={{ width: '100%', display: 'block' }} />
                </div>
              )}

              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

              {/* Render logo images */}
              {msg.images && msg.images.length > 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                  {msg.images.map((img, idx) => (
                    <div key={idx} onClick={() => setSelectedLogo(idx)}
                      style={{
                        borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                        border: selectedLogo === idx ? '3px solid var(--mint-darker, #4a7c59)' : '2px solid var(--border, #e2e8f0)',
                        transition: 'border 0.2s',
                      }}>
                      <img src={img} alt={`Logo concept ${idx + 1}`} style={{ width: '100%', display: 'block' }} />
                    </div>
                  ))}
                </div>
              )}
              {msg.images && msg.images.length === 1 && (
                <div style={{ marginTop: 14, borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border, #e2e8f0)' }}>
                  <img src={msg.images[0]} alt="Refined logo" style={{ width: '100%', display: 'block' }} />
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
        {generating && (
          <div style={{ display: 'flex' }}>
            <div style={{ padding: '12px 18px', borderRadius: 10, background: 'white', border: '1px solid var(--border-light, #e2e8f0)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="spinner" style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Generating logo...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Logo actions bar */}
      {hasLogos && (
        <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border-light, #e2e8f0)' }}>
          <button onClick={handleDownload} className="btn btn-mint btn-sm">Download Selected</button>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', alignSelf: 'center' }}>
            Logo {selectedLogo + 1} of {logoResults.length} selected
          </span>
        </div>
      )}

      {/* Pending image preview */}
      {pendingImage && (
        <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 56, height: 56, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border, #e2e8f0)', flexShrink: 0 }}>
            <img src={pendingImage} alt="Pending upload" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button onClick={removePendingImage} style={{
              position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderRadius: '0 0 0 6px',
              background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', cursor: 'pointer',
              fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}>x</button>
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Reference attached</span>
        </div>
      )}

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 0 20px', borderTop: hasLogos && !pendingImage ? 'none' : '1px solid var(--border-light, #e2e8f0)' }}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />

        {/* Upload button - always visible */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={chatLoading || generating}
          title="Upload reference image"
          className="btn"
          style={{
            padding: '8px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-raised, #f1f5f9)', border: '1px solid var(--border, #e2e8f0)',
            borderRadius: 10, cursor: chatLoading || generating ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSend()
          }}
          className="input"
          placeholder={hasLogos ? 'Describe changes: "make it bolder", "try blue"...' : 'Type your answer...'}
          style={{ flex: 1 }}
          disabled={chatLoading || generating}
        />
        <button
          onClick={handleSend}
          disabled={chatLoading || generating || (!input.trim() && !pendingImage)}
          className="btn btn-primary"
        >
          Send
        </button>
      </div>
    </div>
  )
}
