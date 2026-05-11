'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { CustomTemplate } from '../../_lib/types'

type View = 'gallery' | 'create'
type CreateStep = 'describe' | 'choose' | 'save'

function TemplateGeneratingProgress() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(prev => prev + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{ marginTop: 24, textAlign: 'center', padding: '24px 0' }}>
      <div style={{ maxWidth: 360, margin: '0 auto 20px', height: 6, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 10, background: 'var(--mint)',
          transition: 'width 1s ease',
          width: elapsed < 5 ? '10%' : elapsed < 15 ? '30%' : elapsed < 30 ? '55%' : elapsed < 50 ? '75%' : elapsed < 70 ? '90%' : '95%',
        }} />
      </div>
      <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
        {elapsed < 5 ? 'Interpreting your style description...' :
         elapsed < 15 ? 'Generating style variations...' :
         elapsed < 30 ? 'Rendering 4 preview slides...' :
         elapsed < 50 ? 'Applying finishing touches...' :
         'Almost done \u2014 finalizing your templates...'}
      </p>
      <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        {elapsed}s elapsed
      </p>
    </div>
  )
}

export default function TemplatesPage() {
  const [view, setView] = useState<View>('gallery')
  const [templates, setTemplates] = useState<CustomTemplate[]>([])
  const [loading, setLoading] = useState(true)

  // Create state
  const [createStep, setCreateStep] = useState<CreateStep>('describe')
  const [description, setDescription] = useState('')
  const [refImage, setRefImage] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [stylePrompt, setStylePrompt] = useState('')
  const [previews, setPreviews] = useState<string[]>([])
  const [selectedPreview, setSelectedPreview] = useState<number>(0)
  const [refineFeedback, setRefineFeedback] = useState('')
  const [refining, setRefining] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDesc, setTemplateDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Chat state
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: "Hi! Tell me about the style you want. Describe colors, mood, typography, or share a reference image — I'll help you nail it down." }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [detectedStylePrompt, setDetectedStylePrompt] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadTemplates() }, [])

  async function loadTemplates() {
    setLoading(true)
    const res = await fetch('/api/templates')
    const data = await res.json()
    if (Array.isArray(data)) setTemplates(data)
    setLoading(false)
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  async function sendChatMessage() {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)
    try {
      // Send full conversation (skip the initial greeting from assistant)
      const historyToSend = [...chatMessages.slice(1), { role: 'user' as const, content: userMsg }]
      const res = await fetch('/api/template-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyToSend.map(m => ({ role: m.role, content: m.content })),
          referenceImageBase64: refImage || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (data.stylePrompt) {
        setDetectedStylePrompt(data.stylePrompt)
        setDescription(data.stylePrompt)
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    }
    setChatLoading(false)
  }

  async function handleGenerate() {
    const prompt = detectedStylePrompt || description
    if (!prompt.trim()) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/templates/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: prompt, referenceImageBase64: refImage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStylePrompt(data.prompt)
      setPreviews(data.previews)
      setSelectedPreview(0)
      setCreateStep('choose')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    }
    setGenerating(false)
  }

  async function handleRefine() {
    if (!refineFeedback.trim()) return
    setRefining(true)
    setError(null)
    try {
      const res = await fetch('/api/templates/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPrompt: stylePrompt, feedback: refineFeedback }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStylePrompt(data.prompt)
      const newPreviews = [...previews]
      newPreviews[selectedPreview] = data.preview
      setPreviews(newPreviews)
      setRefineFeedback('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed')
    }
    setRefining(false)
  }

  async function handleSave() {
    if (!templateName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description: templateDesc || null,
          prompt: stylePrompt,
          previewDataUri: previews[selectedPreview],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Reset and go back to gallery
      resetCreate()
      setView('gallery')
      loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return
    await fetch(`/api/templates?id=${id}`, { method: 'DELETE' })
    loadTemplates()
  }

  function resetCreate() {
    setCreateStep('describe')
    setDescription('')
    setRefImage(null)
    setStylePrompt('')
    setPreviews([])
    setSelectedPreview(0)
    setRefineFeedback('')
    setTemplateName('')
    setTemplateDesc('')
    setError(null)
    setChatMessages([{ role: 'assistant', content: "Hi! Tell me about the style you want. Describe colors, mood, typography, or share a reference image — I'll help you nail it down." }])
    setChatInput('')
    setChatLoading(false)
    setDetectedStylePrompt(null)
  }

  function handleRefImageUpload(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      const base64 = result.replace(/^data:image\/\w+;base64,/, '')
      setRefImage(base64)
    }
    reader.readAsDataURL(file)
  }

  // Gallery View
  if (view === 'gallery') {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>Your templates</h1>
            <p>Custom AI-generated styles for your presentations.</p>
          </div>
          <button onClick={() => { resetCreate(); setView('create') }} className="btn btn-primary btn-lg">
            + Create template
          </button>
        </div>

        {/* Built-in templates note */}
        <div style={{ marginBottom: 32, padding: '16px 20px', background: 'var(--bg-soft)', borderRadius: 10, fontSize: 14, color: 'var(--ink-soft)' }}>
          You also have access to <strong>22 built-in templates</strong> when creating content. Custom templates appear first in the style picker.
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--ink-light)' }}>Loading...</div>
        ) : !templates.length ? (
          <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: '64px 32px', textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No custom templates yet</p>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 18 }}>Describe your ideal look and AI will create a template for you.</p>
            <button onClick={() => { resetCreate(); setView('create') }} className="btn btn-primary">Create your first template</button>
          </div>
        ) : (
          <div className="brands-grid">
            {templates.map((t) => (
              <div key={t.id} className="card" style={{ overflow: 'hidden', padding: 0 }}>
                {t.preview_url ? (
                  <img src={t.preview_url} alt={t.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)', fontSize: 13 }}>No preview</div>
                )}
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t.name}</div>
                  {t.description && <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>{t.description}</div>}
                  <button onClick={() => handleDelete(t.id)} className="btn btn-danger btn-sm">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Create View
  return (
    <div>
      <button onClick={() => setView('gallery')} className="back-link">&larr; Back to templates</button>

      {/* Step: Describe */}
      {createStep === 'describe' && (
        <div className="wizard-card">
          <h2>Describe your <em>template</em></h2>
          <p className="wizard-sub">Chat with AI to refine your vision, or describe it directly below.</p>

          {/* AI Chat Section */}
          <div style={{ marginBottom: 24 }}>
            <label className="input-label" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Chat with AI designer
            </label>
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
              background: 'var(--bg-soft)',
            }}>
              {/* Messages area */}
              <div style={{
                maxHeight: 320,
                overflowY: 'auto',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{
                      maxWidth: '80%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      fontSize: 14,
                      lineHeight: 1.5,
                      background: msg.role === 'user' ? 'var(--mint)' : 'white',
                      color: 'var(--ink)',
                      border: msg.role === 'user' ? 'none' : '1px solid var(--border-light)',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      fontSize: 14,
                      background: 'white',
                      border: '1px solid var(--border-light)',
                      color: 'var(--ink-light)',
                    }}>
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input */}
              <div style={{
                display: 'flex',
                gap: 8,
                padding: '10px 12px',
                borderTop: '1px solid var(--border-light)',
                background: 'white',
              }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                  className="input"
                  style={{ flex: 1, borderRadius: 8, fontSize: 14 }}
                  placeholder="e.g., Dark blue professional with gold accents..."
                  disabled={chatLoading}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="btn btn-primary"
                  style={{ flexShrink: 0, borderRadius: 8, padding: '8px 16px' }}
                >
                  Send
                </button>
              </div>
            </div>

            {detectedStylePrompt && (
              <div style={{
                marginTop: 10,
                padding: '10px 14px',
                background: 'rgba(166,216,124,0.15)',
                border: '1px solid var(--mint-deep)',
                borderRadius: 10,
                fontSize: 13,
                color: 'var(--ink-soft)',
              }}>
                AI has prepared a style description. Click <strong>Generate previews</strong> when ready.
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 20px', color: 'var(--ink-light)', fontSize: 13 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            or describe it manually
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <div className="form-group">
            <label className="input-label">Describe the look you want</label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); if (detectedStylePrompt) setDetectedStylePrompt(null) }}
              className="input"
              style={{ borderRadius: 10, minHeight: 100, resize: 'vertical' }}
              placeholder="e.g., Dark blue professional with gold accents, like a luxury financial report. Clean typography, generous spacing, subtle gradients..."
            />
          </div>

          <div className="form-group">
            <label className="input-label">Reference image <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(optional)</span></label>
            {refImage ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--bg-soft)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
                <img src={`data:image/png;base64,${refImage}`} alt="Reference" style={{ height: 80, borderRadius: 10, border: '1px solid var(--border)' }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Reference uploaded</p>
                  <button type="button" onClick={() => setRefImage(null)} className="btn btn-danger btn-sm">Remove</button>
                </div>
              </div>
            ) : (
              <label style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px 20px',
                border: '2px dashed var(--border)',
                borderRadius: 10,
                background: 'var(--bg-soft)',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
                textAlign: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2" style={{ marginBottom: 8 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4 }}>Upload a reference image</p>
                <p style={{ fontSize: 12, color: 'var(--ink-light)' }}>Drop an image or click to browse — we&apos;ll match the style</p>
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRefImageUpload(f) }} />
              </label>
            )}
          </div>

          {error && <div style={{ color: '#C03A1F', fontSize: 14, marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={handleGenerate} disabled={generating || (!description.trim() && !detectedStylePrompt)} className="btn btn-primary btn-lg">
              {generating ? 'Generating 4 variations...' : 'Generate previews \u2192'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>Uses 1 credit</span>
          </div>

          {generating && (
            <TemplateGeneratingProgress />
          )}
        </div>
      )}

      {/* Step: Choose & Refine */}
      {createStep === 'choose' && (
        <div className="wizard-card">
          <h2>Pick your <em>favorite</em></h2>
          <p className="wizard-sub">Click a variation to select it. Want tweaks? Type your feedback below.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
            {previews.map((preview, i) => (
              <div
                key={i}
                onClick={() => setSelectedPreview(i)}
                style={{
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: selectedPreview === i ? '3px solid var(--mint-deep)' : '2px solid var(--border-light)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedPreview === i ? '0 0 0 3px rgba(166,216,124,0.3)' : 'none',
                }}
              >
                <img src={preview} alt={`Variation ${i + 1}`} style={{ width: '100%', display: 'block' }} loading="lazy" />
                <div style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, textAlign: 'center', background: selectedPreview === i ? 'var(--mint)' : 'white' }}>
                  Variation {i + 1} {selectedPreview === i && '\u2713'}
                </div>
              </div>
            ))}
          </div>

          {/* Refine */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            <input
              value={refineFeedback}
              onChange={(e) => setRefineFeedback(e.target.value)}
              className="input"
              placeholder="Want changes? e.g., &quot;Make text bigger&quot;, &quot;More whitespace&quot;, &quot;Change to red accents&quot;"
              onKeyDown={(e) => { if (e.key === 'Enter') handleRefine() }}
            />
            <button onClick={handleRefine} disabled={refining || !refineFeedback.trim()} className="btn btn-soft" style={{ flexShrink: 0 }}>
              {refining ? 'Refining...' : 'Refine'}
            </button>
          </div>

          {error && <div style={{ color: '#C03A1F', fontSize: 14, marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setCreateStep('describe')} className="btn btn-soft">&larr; Back</button>
            <button onClick={() => setCreateStep('save')} className="btn btn-primary" style={{ flex: 1 }}>I&apos;m happy with this &rarr;</button>
          </div>
        </div>
      )}

      {/* Step: Save */}
      {createStep === 'save' && (
        <div className="wizard-card">
          <h2>Name your <em>template</em></h2>
          <p className="wizard-sub">Give it a name so you can find it later.</p>

          {previews[selectedPreview] && (
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-light)', marginBottom: 24 }}>
              <img src={previews[selectedPreview]} alt="Selected" style={{ width: '100%', display: 'block' }} />
            </div>
          )}

          <div className="form-group">
            <label className="input-label">Template name</label>
            <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="input" placeholder="e.g., My Agency Style" />
          </div>

          <div className="form-group">
            <label className="input-label">Description <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(optional)</span></label>
            <input value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)} className="input" placeholder="Dark blue with gold accents..." />
          </div>

          {error && <div style={{ color: '#C03A1F', fontSize: 14, marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setCreateStep('choose')} className="btn btn-soft">&larr; Back</button>
            <button onClick={handleSave} disabled={saving || !templateName.trim()} className="btn btn-primary" style={{ flex: 1 }}>
              {saving ? 'Saving...' : 'Save template \u2192'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
