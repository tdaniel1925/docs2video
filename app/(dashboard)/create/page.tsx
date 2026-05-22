'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../_lib/supabase/client'
import type { Brand } from '../../_lib/types'

const SUGGESTIONS = [
  { icon: '🌐', label: 'Explain my website', method: 'url' as const, placeholder: 'Paste your website URL', prompt: 'Create a video that explains what this company does' },
  { icon: '📄', label: 'Summarize a document', method: 'upload' as const, placeholder: '', prompt: 'Turn this document into a clear video summary' },
  { icon: '🎯', label: 'Sales pitch', method: 'url' as const, placeholder: 'Paste the product or company URL', prompt: 'Create a compelling sales video that drives conversions' },
  { icon: '📚', label: 'Training video', method: 'idea' as const, placeholder: 'What process or topic should it cover?', prompt: 'Create a training video that teaches a process step by step' },
  { icon: '📊', label: 'Present a report', method: 'upload' as const, placeholder: '', prompt: 'Turn this data into a visual video presentation' },
  { icon: '🤝', label: 'Client proposal', method: 'url' as const, placeholder: 'Paste the client or project URL', prompt: 'Create a professional proposal video' },
  { icon: '🏠', label: 'Property listing', method: 'url' as const, placeholder: 'Paste the listing or property URL', prompt: 'Create a property showcase video' },
  { icon: '💼', label: 'Company intro', method: 'url' as const, placeholder: 'Paste the company website URL', prompt: 'Create a company overview video' },
]

type InputMethod = 'url' | 'upload' | 'text' | 'idea' | null
type Stage = 'idle' | 'extracting' | 'generating' | 'done'

export default function CreatePage() {
  const router = useRouter()
  const [purpose, setPurpose] = useState('')
  const [method, setMethod] = useState<InputMethod>(null)
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [ideaInput, setIdeaInput] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [stageMsg, setStageMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [showOptions, setShowOptions] = useState(false)
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [aiMusic, setAiMusic] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const purposeRef = useRef<HTMLTextAreaElement>(null)

  // Load brands
  useEffect(() => {
    const supabase = createClient()
    supabase.from('brands').select('*').order('is_default', { ascending: false }).then(({ data }) => {
      if (data) setBrands(data as Brand[])
    })
  }, [])

  // Elapsed timer during processing
  useEffect(() => {
    if (stage !== 'extracting' && stage !== 'generating') return
    const timer = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timer)
  }, [stage])

  function handleSuggestionClick(s: typeof SUGGESTIONS[0]) {
    setPurpose(s.prompt)
    setMethod(s.method)
    if (s.method === 'upload') {
      setTimeout(() => fileRef.current?.click(), 100)
    }
  }

  function selectMethod(m: InputMethod) {
    setMethod(m)
    setError(null)
  }

  async function handleGo() {
    if (!purpose.trim()) { setError('Describe what you want first'); return }
    setError(null)

    // Validate content input
    if (method === 'url' && !urlInput.trim()) { setError('Paste a URL to continue'); return }
    if (method === 'text' && textInput.trim().length < 50) { setError('Paste at least 50 characters'); return }
    if (method === 'upload' && !fileRef.current?.files?.[0]) { setError('Select a file to continue'); return }

    // For file uploads, we need a different flow — upload first, then use the existing extract route
    if (method === 'upload') {
      await handleUploadFlow()
      return
    }

    setStage('extracting')
    setStageMsg('Reading your content...')
    setElapsed(0)

    try {
      let requestBody: any = { purpose: purpose.trim() }

      if (method === 'url') {
        let url = urlInput.trim()
        if (!/^https?:\/\//i.test(url)) url = `https://${url}`
        requestBody.method = 'url'
        requestBody.url = url
      } else if (method === 'text') {
        requestBody.method = 'text'
        requestBody.text = textInput.trim()
      } else if (method === 'idea' || !method) {
        // No content source — treat purpose as the idea
        requestBody.method = 'idea'
        requestBody.idea = purpose.trim()
      }

      if (selectedBrand) requestBody.brandId = selectedBrand
      if (aiMusic) {
        requestBody.aiMusic = true
        requestBody.musicPrompt = 'Professional ambient background music, subtle and warm'
      }

      setStageMsg('Analyzing content...')
      setTimeout(() => { if (stage === 'extracting') setStageMsg('Writing script and generating slides...') }, 8000)
      setTimeout(() => { if (stage === 'extracting') setStageMsg('Almost there...') }, 20000)

      const res = await fetch('/api/create-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(120000),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setStage('idle')
        return
      }

      if (data.warning) {
        // Video created but pipeline may have issues — navigate anyway
        router.push(`/create/generating?id=${data.videoId}`)
        return
      }

      router.push(`/create/generating?id=${data.videoId}`)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        setError('This is taking too long. Try a shorter document or simpler URL.')
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
      setStage('idle')
    }
  }

  async function handleUploadFlow() {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setStage('extracting')
    setStageMsg('Reading your document...')
    setElapsed(0)

    try {
      // Step 1: Extract content from file
      const formData = new FormData()
      formData.append('file', file)
      formData.append('purpose', purpose.trim())

      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(120000),
      })
      const extractData = await extractRes.json()
      if (!extractRes.ok) { setError(extractData.error || 'Extraction failed'); setStage('idle'); return }

      setStageMsg('Creating your video...')

      // Step 2: Create video record
      const policyData = { ...extractData }
      const createRes = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyData, brandId: selectedBrand, voiceId: 'nova' }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) { setError(createData.error || 'Failed to create video'); setStage('idle'); return }

      // Step 3: Trigger pipeline
      const genRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: createData.id, policyData, brandId: selectedBrand, voiceId: 'nova',
          narrationStyle: 'solo', aiMusic, purpose: purpose.trim(),
          musicPrompt: aiMusic ? 'Professional ambient background music, subtle and warm' : undefined,
          industry: extractData?.industry || 'general',
        }),
      })
      const genData = await genRes.json()
      if (!genRes.ok) {
        setError(genData.error || 'Pipeline failed to start')
        setStage('idle')
        return
      }

      router.push(`/create/generating?id=${createData.id}`)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        setError('Document took too long to process. Try a shorter file.')
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
      setStage('idle')
    }
  }

  // Processing state — full screen
  if (stage === 'extracting' || stage === 'generating') {
    const pct = elapsed < 3 ? 5 : elapsed < 8 ? 15 : elapsed < 15 ? 35 : elapsed < 25 ? 55 : elapsed < 40 ? 75 : elapsed < 60 ? 88 : 95
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', minHeight: '70vh',
      }}>
        {/* Big percentage */}
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--ink)', marginBottom: 8 }}>
          {Math.min(pct, 99)}%
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-light)', marginBottom: 32 }}>
          {elapsed}s elapsed
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', maxWidth: 400, height: 8, background: 'var(--border)', borderRadius: 5, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{
            height: '100%', borderRadius: 5,
            background: 'linear-gradient(90deg, var(--mint), #4ade80)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite',
            transition: 'width 1s ease',
            width: `${pct}%`,
          }} />
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, textAlign: 'center' }}>
          {stageMsg}
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-light)', textAlign: 'center', maxWidth: 400 }}>
          This usually takes 30-90 seconds. We&apos;re extracting content, writing a script, and starting your video.
        </p>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 24px 40px', maxWidth: 720, margin: '0 auto', width: '100%',
    }}>

      {/* Heading */}
      <h1 style={{
        fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em',
        textAlign: 'center', marginBottom: 8, color: 'var(--ink)',
        animation: 'fadeInUp 0.4s ease',
      }}>
        Create a video
      </h1>
      <p style={{
        fontSize: 17, color: 'var(--ink-soft)', textAlign: 'center',
        marginBottom: 32, lineHeight: 1.6, animation: 'fadeInUp 0.4s ease 0.05s both',
      }}>
        Tell us what you need and give us content. We&apos;ll handle the rest.
      </p>

      {/* Purpose input */}
      <div style={{ width: '100%', marginBottom: 24, animation: 'fadeInUp 0.4s ease 0.1s both' }}>
        <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
          What should this video do?
        </label>
        <textarea
          ref={purposeRef}
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
          placeholder='e.g. "Explain our services to potential clients" or "Train new agents on this product"'
          rows={2}
          style={{
            width: '100%', padding: '16px 20px', borderRadius: 10,
            border: '2px solid var(--border)', fontSize: 16, fontFamily: 'inherit',
            outline: 'none', resize: 'none', lineHeight: 1.5,
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Suggestion cards — only show when purpose is empty */}
      {!purpose && !method && (
        <div style={{ width: '100%', marginBottom: 28, animation: 'fadeInUp 0.4s ease 0.15s both' }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: 'var(--ink-light)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
          }}>
            Or pick a quick start
          </div>
          <div className="create-suggestions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {SUGGESTIONS.map(s => (
              <button
                key={s.label}
                onClick={() => handleSuggestionClick(s)}
                style={{
                  padding: '14px 12px', borderRadius: 10,
                  border: '1.5px solid var(--border-light)', background: 'white',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{s.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content source */}
      {purpose && (
        <div style={{ width: '100%', marginBottom: 20, animation: 'fadeInUp 0.3s ease' }}>
          <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 10 }}>
            Add your content
          </label>

          {/* Source type pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[
              { id: 'url' as const, label: 'Website URL', icon: '🌐' },
              { id: 'upload' as const, label: 'Upload file', icon: '📄' },
              { id: 'text' as const, label: 'Paste text', icon: '📝' },
              { id: 'idea' as const, label: 'No content — AI writes it', icon: '💡' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => selectMethod(m.id)}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: method === m.id ? '2px solid var(--mint)' : '1.5px solid var(--border-light)',
                  background: method === m.id ? 'rgba(59,181,200,0.06)' : 'white',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  color: method === m.id ? 'var(--ink)' : 'var(--ink-soft)',
                }}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* URL input */}
          {method === 'url' && (
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleGo() }}
              placeholder="https://example.com"
              autoFocus
              style={{
                width: '100%', padding: '14px 18px', borderRadius: 10,
                border: '2px solid var(--border)', fontSize: 16, fontFamily: 'inherit',
                outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          )}

          {/* Upload */}
          {method === 'upload' && (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: '32px 24px', borderRadius: 10, border: '2px dashed var(--border)',
                  background: 'var(--bg-soft)', cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.2s',
                }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--mint)' }}
                onDragLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.style.borderColor = 'var(--border)'
                  if (e.dataTransfer.files[0] && fileRef.current) {
                    const dt = new DataTransfer()
                    dt.items.add(e.dataTransfer.files[0])
                    fileRef.current.files = dt.files
                    setFileName(e.dataTransfer.files[0].name)
                  }
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                  {fileName || 'Drop a file here or click to browse'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>PDF, DOCX, PPTX</div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.pptx,.txt,.csv"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) setFileName(f.name) }}
              />
            </div>
          )}

          {/* Paste text */}
          {method === 'text' && (
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="Paste your content here..."
              autoFocus
              rows={5}
              style={{
                width: '100%', padding: '14px 18px', borderRadius: 10,
                border: '2px solid var(--border)', fontSize: 15, fontFamily: 'inherit',
                outline: 'none', resize: 'vertical', transition: 'border-color 0.2s',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          )}

          {/* Idea — just show confirmation, purpose IS the idea */}
          {method === 'idea' && (
            <div style={{
              padding: '16px 20px', borderRadius: 10, background: 'rgba(59,181,200,0.06)',
              border: '1px solid var(--mint)', fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5,
            }}>
              AI will research and write the content based on your description above. No source material needed.
            </div>
          )}
        </div>
      )}

      {/* Options toggle */}
      {purpose && (
        <div style={{ width: '100%', marginBottom: 20 }}>
          <button
            onClick={() => setShowOptions(!showOptions)}
            style={{
              background: 'none', border: 'none', fontSize: 13, fontWeight: 600,
              color: 'var(--ink-light)', cursor: 'pointer', fontFamily: 'inherit',
              padding: 0,
            }}
          >
            {showOptions ? '▾ Hide options' : '▸ Voice, music & brand options'}
          </button>

          {showOptions && (
            <div style={{ marginTop: 16, padding: '20px', borderRadius: 10, background: 'var(--bg-soft)', border: '1px solid var(--border-light)' }}>
              {/* Brand */}
              {brands.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Brand</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setSelectedBrand(null)}
                      style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        border: !selectedBrand ? '2px solid var(--mint)' : '1px solid var(--border-light)',
                        background: 'white', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Auto-detect
                    </button>
                    {brands.map(b => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBrand(b.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                          border: selectedBrand === b.id ? '2px solid var(--mint)' : '1px solid var(--border-light)',
                          background: 'white', cursor: 'pointer', fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: b.primary_color }} />
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Music */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Background music</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setAiMusic(false)}
                    style={{
                      padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      border: !aiMusic ? '2px solid var(--mint)' : '1px solid var(--border-light)',
                      background: 'white', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    No music
                  </button>
                  <button
                    onClick={() => setAiMusic(true)}
                    style={{
                      padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      border: aiMusic ? '2px solid var(--mint)' : '1px solid var(--border-light)',
                      background: 'white', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    AI music
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          width: '100%', padding: '12px 16px', borderRadius: 10,
          background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
          fontSize: 14, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Go button */}
      {purpose && (
        <button
          onClick={handleGo}
          disabled={stage !== 'idle'}
          style={{
            width: '100%', padding: '18px', borderRadius: 10, border: 'none',
            background: 'var(--ink)', color: 'white', fontSize: 18, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.02em',
            transition: 'opacity 0.2s', animation: 'fadeInUp 0.3s ease',
          }}
        >
          Create video &rarr;
        </button>
      )}

      {/* Advanced link */}
      {purpose && (
        <button
          onClick={() => {
            localStorage.setItem('d2v_create', JSON.stringify({ purpose: purpose.trim() }))
            router.push('/create/source')
          }}
          style={{
            background: 'none', border: 'none', fontSize: 13, color: 'var(--ink-light)',
            cursor: 'pointer', fontFamily: 'inherit', marginTop: 12, padding: 0,
          }}
        >
          I want to edit the script first &rarr;
        </button>
      )}
    </div>
  )
}
