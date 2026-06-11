'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import BrandStylePicker from '../../_components/BrandStylePicker'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  image?: string
}

export default function ImageRemixPage() {
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [remixResult, setRemixResult] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const processImageFile = useCallback((file: File | Blob) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setReferenceImage(dataUrl)
      setRemixResult(null)
      setMessages([{
        role: 'assistant',
        content: "Great, I can see your image! What would you like to change? For example: change the title, swap colors, update dates, translate text, adjust the style, etc.",
      }])
    }
    reader.readAsDataURL(file)
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.')
      return
    }
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) {
      processImageFile(file)
    }
  }, [processImageFile])

  async function handleSend() {
    if (!input.trim() || loading || !referenceImage) return

    const userText = input.trim()
    const userMsg: ChatMessage = { role: 'user', content: userText }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/image-remix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImage,
          brandId,
          instructions: userText,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Remix failed')

      setRemixResult(data.imageUrl)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Here\'s your remixed design! Want to make more changes? Each remix costs 1 credit.',
        image: data.imageUrl,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
      }])
    }
    setLoading(false)
  }

  function handleDownload() {
    if (!remixResult) return
    const link = document.createElement('a')
    link.href = remixResult
    link.download = `remix-${Date.now()}.png`
    link.click()
  }

  function handleReset() {
    setReferenceImage(null)
    setRemixResult(null)
    setMessages([])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 152px)', maxWidth: 1200, margin: '-40px auto 0', padding: '0 16px', overflow: 'hidden' }}>
      {/* Left Panel - Images (60%) */}
      <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', padding: '24px 0' }}>
        {!referenceImage ? (
          /* Upload Zone */
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="wizard-card"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: dragOver ? '2px dashed var(--mint, #A8F0D4)' : '2px dashed var(--border, #e2e8f0)',
              background: dragOver ? 'rgba(168,240,212,0.08)' : 'transparent',
              borderRadius: 10,
              transition: 'all 0.2s',
              minHeight: 300,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft, #94a3b8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink, #1e293b)', margin: '0 0 6px' }}>
              Upload a reference image
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft, #94a3b8)', margin: 0, textAlign: 'center', maxWidth: 300 }}>
              Drag and drop, click to browse, or paste from clipboard. Works with flyers, posters, menus, ads, and more.
            </p>
          </div>
        ) : (
          <>
            {/* Reference Image */}
            <div className="wizard-card" style={{ padding: 16, borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reference</span>
                <button onClick={handleReset} className="btn" style={{ fontSize: 12, padding: '4px 12px', background: 'var(--surface-raised, #f1f5f9)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, cursor: 'pointer' }}>
                  Change Image
                </button>
              </div>
              <img src={referenceImage} alt="Reference" style={{ width: '100%', borderRadius: 10, display: 'block' }} />
            </div>

            {/* Brand Picker */}
            <div className="wizard-card" style={{ padding: 16, borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Brand</div>
              <BrandStylePicker
                showStyle={false}
                onSelect={({ brandId: b }) => {
                  setBrandId(b)
                }}
              />
            </div>

            {/* Remix Result */}
            {remixResult && (
              <div className="wizard-card" style={{ padding: 16, borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mint-darker, #4a7c59)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remix Result</span>
                  <button onClick={handleDownload} className="btn btn-mint btn-sm">
                    Download
                  </button>
                </div>
                <img src={remixResult} alt="Remix result" style={{ width: '100%', borderRadius: 10, display: 'block' }} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Right Panel - Chat (40%) */}
      <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-light, #e2e8f0)', paddingLeft: 20 }}>
        {/* Chat Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
          {!referenceImage && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ fontSize: 14, color: 'var(--ink-soft, #94a3b8)', textAlign: 'center', lineHeight: 1.7 }}>
                Upload an image to get started. I will help you remix it into a new original design.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
            }}>
              <div style={{
                maxWidth: '90%',
                padding: '10px 14px',
                borderRadius: 10,
                background: msg.role === 'user' ? 'var(--mint, #A8F0D4)' : 'white',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-light, #e2e8f0)',
                fontSize: 13,
                lineHeight: 1.6,
              }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex' }}>
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'white', border: '1px solid var(--border-light, #e2e8f0)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Creating your remix...</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input Bar */}
        <div
          onPaste={handlePaste}
          style={{ display: 'flex', gap: 8, padding: '12px 0 20px', borderTop: '1px solid var(--border-light, #e2e8f0)' }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            onPaste={handlePaste}
            className="input"
            placeholder={referenceImage ? 'Describe what to change...' : 'Upload an image first...'}
            style={{ flex: 1 }}
            disabled={loading || !referenceImage}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || !referenceImage}
            className="btn btn-primary"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
