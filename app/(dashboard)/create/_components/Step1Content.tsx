'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type OutputType = 'video' | 'pptx' | 'pdf'
type InputMethod = 'url' | 'upload' | 'text' | 'idea' | null
type Stage = 'idle' | 'extracting' | 'error'

const OUTPUT_OPTIONS: { type: OutputType; label: string; desc: string }[] = [
  { type: 'video', label: 'Video', desc: 'Narrated explainer with slides, voice, and music' },
  { type: 'pptx', label: 'Slide Deck', desc: 'Editable PowerPoint with speaker notes' },
  { type: 'pdf', label: 'PDF Document', desc: 'Printable slide deck as PDF' },
]

const CONTENT_METHODS: { id: InputMethod; label: string }[] = [
  { id: 'url', label: 'Website URL' },
  { id: 'upload', label: 'Upload file' },
  { id: 'text', label: 'Paste text' },
  { id: 'idea', label: 'AI writes it' },
]

export default function Step1Content() {
  const router = useRouter()
  const [outputType, setOutputType] = useState<OutputType>('video')
  const [purpose, setPurpose] = useState('')
  const [method, setMethod] = useState<InputMethod>(null)
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [stageMsg, setStageMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleNext() {
    setError(null)

    if (!purpose.trim()) { setError('Describe what you want first'); return }
    if (method === 'url' && !urlInput.trim()) { setError('Paste a URL to continue'); return }
    if (method === 'text' && textInput.trim().length < 50) { setError('Paste at least 50 characters'); return }
    if (method === 'upload' && !fileRef.current?.files?.[0]) { setError('Select a file to continue'); return }

    setStage('extracting')

    try {
      // Extract content based on method
      let extractedData: Record<string, unknown> | null = null
      let autoBrandInfo: Record<string, unknown> | null = null

      if (method === 'url') {
        setStageMsg('Scraping website...')
        let cleanUrl = urlInput.trim()
        if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = `https://${cleanUrl}`
        const res = await fetch('/api/extract-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: cleanUrl }),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Extraction failed')
        const { suggestedTheme, autoBrandId, autoLogoUrl, autoBrandInfo: abi, ...contentData } = result
        extractedData = contentData as Record<string, unknown>
        if (abi) autoBrandInfo = abi as Record<string, unknown>
        if (autoBrandId) extractedData['_autoBrandId'] = autoBrandId
        if (suggestedTheme?.prompt) extractedData['_customStylePrompt'] = suggestedTheme.prompt
      } else if (method === 'text') {
        setStageMsg('Analyzing text...')
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textInput.trim(), purpose: purpose.trim() }),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Extraction failed')
        extractedData = result
      } else if (method === 'upload') {
        setStageMsg('Processing file...')
        const file = fileRef.current?.files?.[0]
        if (!file) throw new Error('No file selected')
        const formData = new FormData()
        formData.append('file', file)
        formData.append('purpose', purpose.trim())
        const res = await fetch('/api/extract-text', { method: 'POST', body: formData })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'File processing failed')
        extractedData = result
      } else {
        setStageMsg('AI is writing content...')
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea: purpose.trim(), purpose: purpose.trim() }),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Content generation failed')
        extractedData = result
      }

      if (!extractedData) throw new Error('No content could be extracted')

      // Create draft video record
      setStageMsg('Setting up your project...')
      const draftRes = await fetch('/api/videos/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outputType,
          purpose: purpose.trim(),
          extractedData,
          contentMethod: method || 'idea',
          autoBrandInfo,
        }),
      })
      const draftData = await draftRes.json()
      if (!draftRes.ok) {
        if (draftRes.status === 402) { setError('Not enough credits. Upgrade your plan or buy more credits.'); setStage('idle'); return }
        throw new Error(draftData.error || 'Failed to create project')
      }

      // Redirect to Step 2: Brand
      router.push(`/create/brand?id=${draftData.videoId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('idle')
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      {/* Output type selector */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
          What are you creating?
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {OUTPUT_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => setOutputType(opt.type)}
              style={{
                padding: '20px 16px',
                borderRadius: 10,
                border: outputType === opt.type ? '2px solid var(--mint)' : '1px solid var(--border)',
                background: outputType === opt.type ? 'var(--mint-light, #f0fae4)' : 'var(--bg)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-light)', lineHeight: 1.4 }}>
                {opt.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Purpose input */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
          What should this {outputType === 'video' ? 'video' : outputType === 'pptx' ? 'deck' : 'document'} do?
        </label>
        <textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Create a video that explains what this company does"
          rows={3}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            fontSize: 15,
            fontFamily: 'inherit',
            resize: 'vertical',
            background: 'var(--bg)',
          }}
        />
      </div>

      {/* Content source */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
          Add your content
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {CONTENT_METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => { setMethod(m.id); setError(null) }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: method === m.id ? '2px solid var(--mint)' : '1px solid var(--border)',
                background: method === m.id ? 'var(--mint-light, #f0fae4)' : 'var(--bg)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--ink)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* URL input */}
        {method === 'url' && (
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com"
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              fontSize: 15,
              background: 'var(--bg)',
            }}
          />
        )}

        {/* File upload */}
        {method === 'upload' && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.csv,.xlsx"
              onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%',
                padding: '24px',
                borderRadius: 10,
                border: '2px dashed var(--border)',
                background: 'var(--bg-soft)',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {fileName ? (
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{fileName}</div>
              ) : (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    Click to upload
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>
                    PDF, DOCX, PPTX, TXT, CSV, XLSX
                  </div>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Text paste */}
        {method === 'text' && (
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste your content here (at least 50 characters)"
            rows={6}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
              background: 'var(--bg)',
            }}
          />
        )}

        {/* AI writes it — no extra input needed */}
        {method === 'idea' && (
          <div style={{
            padding: 16,
            borderRadius: 10,
            background: 'var(--bg-soft)',
            border: '1px solid var(--border-light)',
            fontSize: 13,
            color: 'var(--ink-light)',
          }}>
            AI will generate content based on your description above.
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#DC2626',
          fontSize: 13,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Extracting state */}
      {stage === 'extracting' && (
        <div style={{
          padding: '20px',
          borderRadius: 10,
          background: 'var(--bg-soft)',
          border: '1px solid var(--border-light)',
          textAlign: 'center',
          marginBottom: 16,
        }}>
          <div style={{
            width: 24,
            height: 24,
            border: '3px solid var(--border)',
            borderTopColor: 'var(--mint)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{stageMsg}</div>
        </div>
      )}

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={stage === 'extracting'}
        style={{
          width: '100%',
          padding: '14px 24px',
          borderRadius: 10,
          border: 'none',
          background: stage === 'extracting' ? 'var(--border)' : 'var(--ink)',
          color: '#fff',
          fontSize: 16,
          fontWeight: 700,
          cursor: stage === 'extracting' ? 'not-allowed' : 'pointer',
        }}
      >
        {stage === 'extracting' ? 'Processing...' : 'Next'}
      </button>
    </div>
  )
}
