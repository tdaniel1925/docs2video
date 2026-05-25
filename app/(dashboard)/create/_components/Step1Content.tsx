'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SLIDE_STYLES } from '../../../_lib/types'
type OutputType = 'video' | 'pptx' | 'pdf'
type InputMethod = 'url' | 'upload' | 'text' | 'idea' | null
type Stage = 'idle' | 'extracting' | 'error' | 'generating-preview' | 'style-suggest'

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

  // Style suggestion state (shown after URL scrape)
  const [suggestedSiteName, setSuggestedSiteName] = useState<string>('')
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [previewStyleDesc, setPreviewStyleDesc] = useState<string>('')
  const [pendingExtractedData, setPendingExtractedData] = useState<Record<string, unknown> | null>(null)
  const [pendingAutoBrandInfo, setPendingAutoBrandInfo] = useState<Record<string, unknown> | null>(null)

  // New style option state
  const refImageInputRef = useRef<HTMLInputElement>(null)
  const [refImageLoading, setRefImageLoading] = useState(false)
  const [refImageError, setRefImageError] = useState<string | null>(null)
  const [showStylesGrid, setShowStylesGrid] = useState(false)

  async function createDraftAndRedirect(
    extractedData: Record<string, unknown>,
    autoBrandInfo: Record<string, unknown> | null,
    overrides?: { styleId?: string; customStylePrompt?: string; skipToStep?: string },
  ) {
    setStageMsg('Setting up your project...')
    setStage('extracting')
    try {
      const draftRes = await fetch('/api/videos/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outputType,
          purpose: purpose.trim(),
          extractedData,
          contentMethod: method || 'idea',
          autoBrandInfo,
          ...(overrides?.styleId ? { styleId: overrides.styleId } : {}),
        }),
      })
      const draftData = await draftRes.json()
      if (!draftRes.ok) {
        if (draftRes.status === 402) { setError('Not enough credits. Upgrade your plan or buy more credits.'); setStage('idle'); return }
        throw new Error(draftData.error || 'Failed to create project')
      }

      // If style was pre-selected, save it to the draft and skip brand+style steps
      if (overrides?.styleId) {
        await fetch('/api/videos/draft', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId: draftData.videoId,
            updates: {
              styleId: overrides.styleId,
              customStylePrompt: overrides.customStylePrompt || undefined,
              inlineBrand: autoBrandInfo,
              step: outputType === 'video' ? 3 : 4, // voice step for video, script step for doc
            },
          }),
        })
      }

      if (overrides?.skipToStep) {
        router.push(`/create/${overrides.skipToStep}?id=${draftData.videoId}`)
      } else {
        router.push(`/create/brand?id=${draftData.videoId}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('idle')
    }
  }

  async function handleUseThisStyle() {
    if (!pendingExtractedData) return
    const skipTo = outputType === 'video' ? 'voice' : 'script'
    await createDraftAndRedirect(pendingExtractedData, pendingAutoBrandInfo, {
      styleId: 'custom-brand-preview',
      customStylePrompt: previewStyleDesc,
      skipToStep: skipTo,
    })
  }

  async function handleChooseDifferentStyle() {
    if (!pendingExtractedData) return
    // Proceed normally through brand → voice → style
    await createDraftAndRedirect(pendingExtractedData, pendingAutoBrandInfo)
  }

  async function handleReferenceImageUpload(file: File) {
    if (!pendingExtractedData) return
    setRefImageError(null)
    setRefImageLoading(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/style-preview-from-ref', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceImageBase64: base64 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate preview from reference')
      if (data.previews?.length > 0) {
        setPreviewImages(data.previews)
        setPreviewStyleDesc(data.styleDescription || '')
      } else {
        throw new Error('No preview images returned')
      }
    } catch (err) {
      setRefImageError(err instanceof Error ? err.message : 'Failed to generate preview')
    } finally {
      setRefImageLoading(false)
    }
  }

  async function handleSelectPresetStyle(styleId: string) {
    if (!pendingExtractedData) return
    const style = SLIDE_STYLES.find(s => s.id === styleId)
    const skipTo = outputType === 'video' ? 'voice' : 'script'
    await createDraftAndRedirect(pendingExtractedData, pendingAutoBrandInfo, {
      styleId,
      customStylePrompt: style?.prompt || '',
      skipToStep: skipTo,
    })
  }

  async function handleCreateBrand() {
    if (!pendingExtractedData) return
    await createDraftAndRedirect(pendingExtractedData, pendingAutoBrandInfo)
  }

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

      // For URL scrape with brand info, generate real preview slides
      if (method === 'url' && autoBrandInfo) {
        const bi = autoBrandInfo as Record<string, unknown>
        const siteName = (bi.name as string) || (bi.companyName as string) ||
          new URL(urlInput.trim().startsWith('http') ? urlInput.trim() : `https://${urlInput.trim()}`).hostname
        setSuggestedSiteName(siteName)
        setPendingExtractedData(extractedData)
        setPendingAutoBrandInfo(autoBrandInfo)
        setStage('generating-preview')
        setStageMsg('Analyzing brand style...')
        // Timed progress steps to show activity
        const progressSteps = [
          { msg: 'Extracting brand colors and typography...', delay: 3000 },
          { msg: 'Designing cover slide...', delay: 8000 },
          { msg: 'Designing content slide...', delay: 20000 },
          { msg: 'Almost done...', delay: 35000 },
        ]
        const timers = progressSteps.map(s => setTimeout(() => setStageMsg(s.msg), s.delay))
        const cleanupTimers = () => timers.forEach(t => clearTimeout(t))

        try {
          const previewRes = await fetch('/api/style-preview-from-brand', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              primaryColor: bi.primary_color || bi.primaryColor || null,
              secondaryColor: bi.secondary_color || bi.secondaryColor || null,
              companyName: siteName,
              industry: bi.industry || null,
              tone: bi.tone || null,
            }),
          })
          const previewData = await previewRes.json()
          cleanupTimers()
          if (previewRes.ok && previewData.previews?.length > 0) {
            setPreviewImages(previewData.previews)
            setPreviewStyleDesc(previewData.styleDescription || '')
            setStage('style-suggest')
          } else {
            await createDraftAndRedirect(extractedData, autoBrandInfo)
          }
        } catch {
          cleanupTimers()
          await createDraftAndRedirect(extractedData, autoBrandInfo)
        }
        return
      }

      // Create draft video record
      await createDraftAndRedirect(extractedData, autoBrandInfo)
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

      {/* Generating preview progress */}
      {stage === 'generating-preview' && (
        <div style={{
          padding: '28px 24px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'white',
          textAlign: 'center',
          marginBottom: 16,
        }}>
          <div style={{
            width: 32, height: 32,
            border: '3px solid var(--border)',
            borderTopColor: '#C7E8A8',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{stageMsg}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-light)' }}>This usually takes 30-60 seconds</div>
        </div>
      )}

      {/* Style preview after URL scrape — shows AI-generated slides */}
      {stage === 'style-suggest' && previewImages.length > 0 && (
        <div style={{
          padding: '28px 24px',
          borderRadius: 10,
          border: '2px solid #C7E8A8',
          background: 'white',
          textAlign: 'center',
          marginBottom: 16,
        }}>
          <div style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: 8,
            background: '#F0F9E8',
            color: '#3D7A3F',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}>
            Style preview
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            {previewImages.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={idx === 0 ? 'Cover slide preview' : 'Content slide preview'}
                style={{
                  width: 300,
                  maxWidth: '48%',
                  height: 'auto',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.1)',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            Here&apos;s how your slides will look
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 24 }}>
            Generated to match <strong>{suggestedSiteName}</strong>&apos;s brand style
          </p>
            {error && (
              <div style={{
                padding: '10px 14px',
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
            {refImageError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: 13,
                marginBottom: 16,
              }}>
                {refImageError}
              </div>
            )}

            {refImageLoading ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{
                  width: 24, height: 24,
                  border: '3px solid var(--border)',
                  borderTopColor: '#C7E8A8',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 12px',
                }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Generating new preview...</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
                {/* Option 1: Use this style */}
                <button
                  onClick={handleUseThisStyle}
                  style={{
                    width: '100%',
                    padding: '12px 28px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#C7E8A8',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                  }}
                >
                  Use this style
                </button>

                {/* Option 2: Upload a reference image */}
                <input
                  ref={refImageInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleReferenceImageUpload(file)
                  }}
                />
                <button
                  onClick={() => refImageInputRef.current?.click()}
                  style={{
                    width: '100%',
                    padding: '12px 28px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'white',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3M11 5L8 2M8 2L5 5M8 2v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Upload a reference image
                </button>

                {/* Row: Browse styles + Create a brand */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <button
                    onClick={() => setShowStylesGrid(!showStylesGrid)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--ink-light)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    Browse {SLIDE_STYLES.length} styles
                  </button>
                  <button
                    onClick={handleCreateBrand}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 13,
                      color: 'var(--ink-light)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    Create a brand
                  </button>
                </div>
              </div>
            )}

            {/* Styles grid */}
            {showStylesGrid && (
              <div style={{
                marginTop: 16,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
              }}>
                {SLIDE_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => handleSelectPresetStyle(style.id)}
                    style={{
                      padding: 0,
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      background: 'white',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textAlign: 'center',
                    }}
                  >
                    <img
                      src={`/style-previews/${style.id}.png`}
                      alt={style.name}
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                    <div style={{
                      padding: '8px 6px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--ink)',
                    }}>
                      {style.name}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
      )}

      {/* Next button */}
      {stage !== 'style-suggest' && stage !== 'generating-preview' && (
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
      )}
    </div>
  )
}
