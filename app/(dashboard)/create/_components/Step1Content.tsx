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
  const [recipientName, setRecipientName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [method, setMethod] = useState<InputMethod>(null)
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [stageMsg, setStageMsg] = useState('')
  const [progressPct, setProgressPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Style suggestion state (shown after URL scrape)
  const [suggestedSiteName, setSuggestedSiteName] = useState<string>('')
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [previewStyleDesc, setPreviewStyleDesc] = useState<string>('')
  const [pendingExtractedData, setPendingExtractedData] = useState<Record<string, unknown> | null>(null)
  const [pendingAutoBrandInfo, setPendingAutoBrandInfo] = useState<Record<string, unknown> | null>(null)

  // Branding toggle
  const [useBranding, setUseBranding] = useState(true)

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
          recipientName: recipientName.trim() || undefined,
          extractedData,
          contentMethod: method || 'idea',
          autoBrandInfo,
          ...(overrides?.styleId ? { styleId: overrides.styleId } : {}),
          ...(extractedData?.classification ? { classification: extractedData.classification } : {}),
        }),
      })
      const draftData = await draftRes.json()
      if (!draftRes.ok) {
        if (draftRes.status === 402) { setError('Not enough credits. Upgrade your plan or buy more credits.'); setStage('idle'); return }
        throw new Error(draftData.error || 'Failed to create project')
      }

      // If style was pre-selected, save it to the draft and skip brand+style steps
      if (overrides?.styleId) {
        // Extract autoBrandId from extracted data (created by extract-url API)
        const autoBrandId = extractedData['_autoBrandId'] as string | undefined
        await fetch('/api/videos/draft', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId: draftData.videoId,
            updates: {
              styleId: overrides.styleId,
              customStylePrompt: overrides.customStylePrompt || undefined,
              brandId: autoBrandId || undefined,
              inlineBrand: autoBrandInfo,
              step: outputType === 'video' ? 3 : 4,
            },
          }),
        })
        // Also update the video record's brand_id directly
        if (autoBrandId) {
          await fetch('/api/videos/draft', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoId: draftData.videoId,
              updates: { brandId: autoBrandId },
            }),
          })
        }
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
    const brandInfo = useBranding ? pendingAutoBrandInfo : null
    const extractedData = { ...pendingExtractedData }
    if (!useBranding) {
      delete extractedData['_autoBrandId']
    }
    await createDraftAndRedirect(extractedData, brandInfo, {
      styleId: 'custom-brand-preview',
      customStylePrompt: previewStyleDesc,
      skipToStep: skipTo,
    })
  }

  async function handleChooseDifferentStyle() {
    if (!pendingExtractedData) return
    const brandInfo = useBranding ? pendingAutoBrandInfo : null
    const extractedData = { ...pendingExtractedData }
    if (!useBranding) {
      delete extractedData['_autoBrandId']
    }
    await createDraftAndRedirect(extractedData, brandInfo)
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

  async function handleQuickMode() {
    setError(null)
    if (!purpose.trim()) { setError('Describe what you want first'); return }
    if (method === 'url' && !urlInput.trim()) { setError('Paste a URL to continue'); return }
    if (method === 'text' && textInput.trim().length < 50) { setError('Paste at least 50 characters'); return }
    if (method === 'upload' && !fileRef.current?.files?.[0]) { setError('Select a file to continue'); return }

    // Run extraction, then skip brand+voice and go straight to script
    setStage('extracting')
    setProgressPct(5)
    setStageMsg('Quick mode — extracting content...')

    const progressTimer = setInterval(() => {
      setProgressPct(prev => prev < 85 ? prev + 2 : Math.min(prev + 0.5, 95))
    }, 1000)

    try {
      let extractedData: Record<string, unknown> | null = null
      let autoBrandInfo: Record<string, unknown> | null = null

      if (method === 'url') {
        setStageMsg('Reading website...')
        let cleanUrl = urlInput.trim()
        if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = `https://${cleanUrl}`
        const res = await fetch('/api/extract-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: cleanUrl }),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Extraction failed')
        const { autoBrandId, autoBrandInfo: abi, ...contentData } = result
        extractedData = contentData as Record<string, unknown>
        if (abi) autoBrandInfo = abi as Record<string, unknown>
        if (autoBrandId) extractedData['_autoBrandId'] = autoBrandId
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
        const res = await fetch('/api/extract-doc', { method: 'POST', body: formData })
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

      clearInterval(progressTimer)
      setProgressPct(90)
      setStageMsg('Creating project with defaults...')

      // Skip brand+voice — go straight to script with defaults
      const skipTo = outputType === 'video' ? 'script' : 'script'
      await createDraftAndRedirect(extractedData, autoBrandInfo, { skipToStep: skipTo })
    } catch (err) {
      clearInterval(progressTimer)
      setProgressPct(0)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('idle')
    }
  }

  async function handleNext() {
    setError(null)

    if (!purpose.trim()) { setError('Describe what you want first'); return }
    if (method === 'url' && !urlInput.trim()) { setError('Paste a URL to continue'); return }
    if (method === 'text' && textInput.trim().length < 50) { setError('Paste at least 50 characters'); return }
    if (method === 'upload' && !fileRef.current?.files?.[0]) { setError('Select a file to continue'); return }

    setStage('extracting')
    setProgressPct(5)
    setStageMsg('Starting...')

    // Simulate progress while waiting for API calls
    const progressTimer = setInterval(() => {
      setProgressPct(prev => {
        if (prev < 30) return prev + 3
        if (prev < 60) return prev + 2
        if (prev < 85) return prev + 1
        return Math.min(prev + 0.5, 95)
      })
    }, 1000)

    try {
      // Extract content based on method
      let extractedData: Record<string, unknown> | null = null
      let autoBrandInfo: Record<string, unknown> | null = null

      if (method === 'url') {
        setStageMsg('Connecting to website...')
        setProgressPct(5)
        const scrapeTimers = [
          setTimeout(() => { setStageMsg('Reading page content...'); setProgressPct(20) }, 3000),
          setTimeout(() => { setStageMsg('Extracting brand info...'); setProgressPct(40) }, 8000),
          setTimeout(() => { setStageMsg('Almost there...'); setProgressPct(60) }, 15000),
        ]
        let cleanUrl = urlInput.trim()
        if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = `https://${cleanUrl}`
        const res = await fetch('/api/extract-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: cleanUrl }),
        })
        scrapeTimers.forEach(t => clearTimeout(t))
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
        const res = await fetch('/api/extract-doc', { method: 'POST', body: formData })
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

      // All methods go straight to draft creation → styling step
      clearInterval(progressTimer)

      // Create draft video record
      clearInterval(progressTimer)
      setProgressPct(98)
      await createDraftAndRedirect(extractedData, autoBrandInfo)
    } catch (err) {
      clearInterval(progressTimer)
      setProgressPct(0)
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

      {/* Recipient name */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
          Who is this for? <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-light)' }}>(optional)</span>
        </label>
        <input
          type="text"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="e.g. John Smith"
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            fontSize: 15,
            fontFamily: 'inherit',
            background: 'var(--bg)',
          }}
        />
      </div>

      {/* Purpose input */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
          What should this {outputType === 'video' ? 'video' : outputType === 'pptx' ? 'deck' : 'document'} do?
        </label>
        <textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder={outputType === 'video' ? 'e.g. "Explain our services to potential clients" or "Train new agents on this product"' : outputType === 'pptx' ? 'e.g. "Summarize this report for executives" or "Create a sales pitch deck"' : 'e.g. "Turn this document into a client-ready PDF" or "Create a printable summary"'}
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
      {(stage === 'extracting' || stage === 'generating-preview') && (
        <div style={{
          padding: '28px 24px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'white',
          textAlign: 'center',
          marginBottom: 16,
        }}>
          {/* Percentage display */}
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 8 }}>
            {progressPct}%
          </div>
          {/* Progress bar */}
          <div style={{
            width: '100%', height: 8, background: 'var(--border)', borderRadius: 4,
            overflow: 'hidden', marginBottom: 16,
          }}>
            <div style={{
              width: `${progressPct}%`, height: '100%', background: '#C7E8A8',
              borderRadius: 4, transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{stageMsg}</div>
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
          {/* Brand info card */}
          {pendingAutoBrandInfo && (() => {
            const bi = pendingAutoBrandInfo as Record<string, unknown>
            const logoSrc = (bi.logoFileUrl as string) || (bi.logoUrl as string) || ''
            const brandName = (bi.name as string) || suggestedSiteName || ''
            const tagline = bi.tagline as string | undefined
            const industry = bi.industry as string | undefined
            const phone = bi.phone as string | undefined
            const brandEmail = bi.email as string | undefined
            const website = bi.website as string | undefined
            const hasContact = phone || brandEmail || website
            return (
              <div style={{
                padding: '16px 20px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'white',
                textAlign: 'left',
                marginBottom: 20,
              }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {logoSrc && (
                    <img
                      src={logoSrc}
                      alt={`${brandName} logo`}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 8,
                        objectFit: 'contain',
                        flexShrink: 0,
                        background: '#f5f5f5',
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
                      {brandName}
                    </div>
                    {tagline && (
                      <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 2, lineHeight: 1.4 }}>
                        {tagline}
                      </div>
                    )}
                    {industry && (
                      <span style={{
                        display: 'inline-block',
                        marginTop: 6,
                        padding: '2px 10px',
                        borderRadius: 6,
                        background: '#F0F9E8',
                        color: '#3D7A3F',
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {industry}
                      </span>
                    )}
                  </div>
                </div>
                {hasContact && (
                  <div style={{
                    display: 'flex',
                    gap: 16,
                    flexWrap: 'wrap',
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid var(--border-light, #eee)',
                  }}>
                    {phone && (
                      <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{phone}</span>
                    )}
                    {brandEmail && (
                      <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{brandEmail}</span>
                    )}
                    {website && (
                      <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{website}</span>
                    )}
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border-light, #eee)',
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--ink)',
                  }}>
                    <input
                      type="checkbox"
                      checked={useBranding}
                      onChange={(e) => setUseBranding(e.target.checked)}
                      style={{
                        width: 18,
                        height: 18,
                        accentColor: '#C7E8A8',
                        cursor: 'pointer',
                      }}
                    />
                    Include branding in video
                  </label>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 8 }}>
                  This info was found on the website. You can edit it in the Brand step.
                </div>
              </div>
            )
          })()}

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
                alt={idx === 0 ? 'Opening scene preview' : 'Content scene preview'}
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
            Here&apos;s how your video will look
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 24 }}>
            Illustrated scenes matched to <strong>{suggestedSiteName}</strong>&apos;s brand style
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

      {/* Action buttons */}
      {stage !== 'style-suggest' && stage !== 'generating-preview' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleNext}
            disabled={stage === 'extracting'}
            style={{
              flex: 1,
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
          {stage === 'idle' && method && (
            <button
              onClick={handleQuickMode}
              style={{
                padding: '14px 20px',
                borderRadius: 10,
                border: '1.5px solid var(--border)',
                background: 'white',
                color: 'var(--ink-soft)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
              title="Skip brand and voice setup — use defaults and go straight to script review"
            >
              Quick mode
            </button>
          )}
        </div>
      )}
    </div>
  )
}
