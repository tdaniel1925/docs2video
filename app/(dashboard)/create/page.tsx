'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../_lib/supabase/client'
import { SLIDE_STYLES } from '../../_lib/types'
import { autoSelectStyle, autoSelectFromBrand } from '../../_lib/style-picker'
import { getUserTier, type PlanTier } from '../../_lib/pricing'
import type { Brand } from '../../_lib/types'
import Step1Content from './_components/Step1Content'
import UpgradeModal from '../../_components/UpgradeModal'

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
  const useNewFlow = process.env.NEXT_PUBLIC_USE_NEW_CREATE_FLOW === 'true'
  if (useNewFlow) {
    return <Step1Content />
  }

  const router = useRouter()
  const searchParams = useSearchParams()
  const clientId = searchParams.get('clientId')
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
  const [bookingUrl, setBookingUrl] = useState('')
  const [paymentLink, setPaymentLink] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showLengthUpgrade, setShowLengthUpgrade] = useState(false)
  const [freeRemaining, setFreeRemaining] = useState<number | null>(null)
  const [isPaid, setIsPaid] = useState(false)
  const [userTier, setUserTier] = useState<PlanTier>('free')
  const [detailLevel, setDetailLevel] = useState<'quick' | 'standard' | 'detailed'>('quick')
  // Style picker state
  const [styleTab, setStyleTab] = useState<'auto' | 'browse' | 'upload'>('auto')
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null)
  const [styleReferenceUrl, setStyleReferenceUrl] = useState<string | null>(null)
  const [stylePreviewImages, setStylePreviewImages] = useState<string[]>([])
  const [stylePreviewLoading, setStylePreviewLoading] = useState(false)
  const [stylePreviewError, setStylePreviewError] = useState<string | null>(null)
  const [styleProgress, setStyleProgress] = useState<string>('')
  const [styleProgressPct, setStyleProgressPct] = useState(0)
  const [styleSearchQuery, setStyleSearchQuery] = useState('')
  const [styleMatchedSite, setStyleMatchedSite] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const styleFileRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const purposeRef = useRef<HTMLTextAreaElement>(null)

  // Load client name if creating for a specific client
  useEffect(() => {
    if (!clientId) return
    fetch(`/api/clients/${clientId}`).then(r => r.json()).then(d => {
      if (d.client?.name) setClientName(d.client.name)
    }).catch(() => {})
  }, [clientId])

  // Load brands + check credits
  useEffect(() => {
    const supabase = createClient()
    supabase.from('brands').select('*').order('is_default', { ascending: false }).then(({ data }) => {
      if (data) setBrands(data as Brand[])
    })
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('subscription_status, free_videos_remaining').eq('id', user.id).single().then(({ data }) => {
        if (!data) return
        const status = (data.subscription_status ?? '').toLowerCase()
        const paid = ['active', 'professional', 'pro', 'business', 'enterprise', 'starter'].includes(status)
        setIsPaid(paid)
        setFreeRemaining(data.free_videos_remaining ?? 0)
        const tier = getUserTier(data.subscription_status)
        setUserTier(tier)
        // Default to standard for paid users
        if (tier !== 'free') setDetailLevel('standard')
      })
    })
  }, [])

  // Auto-select style based on selected brand
  useEffect(() => {
    if (selectedStyleId && styleTab !== 'auto') return // user already picked manually
    const brand = brands.find(b => b.id === selectedBrand)
    const picked = autoSelectStyle(brand?.primary_color, brand?.industry)
    setSelectedStyleId(picked)
  }, [selectedBrand, brands]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle reference image upload for custom style
  const handleStyleImageUpload = useCallback(async (file: File) => {
    setStylePreviewLoading(true)
    setStylePreviewError(null)
    setStylePreviewImages([])
    setStyleProgress('Uploading image...')
    setStyleProgressPct(10)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1]) // strip data:... prefix
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setStyleProgress('Analyzing visual style...')
      setStyleProgressPct(25)
      const res = await fetch('/api/style-preview-from-ref', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceImageBase64: base64 }),
      })
      // Show estimated progress while waiting for response
      const progressInterval = setInterval(() => {
        setStyleProgressPct(prev => {
          if (prev < 50) return prev + 5
          if (prev < 75) return prev + 3
          return Math.min(prev + 1, 90)
        })
        setStyleProgress(prev => {
          if (prev === 'Analyzing visual style...') return 'Extracting colors and layout...'
          if (prev === 'Extracting colors and layout...') return 'Illustrating preview scenes...'
          return prev
        })
      }, 3000)
      const data = await res.json()
      clearInterval(progressInterval)
      if (!res.ok) {
        setStylePreviewError(data.error || 'Preview generation failed')
        setStyleProgress('')
        setStyleProgressPct(0)
        return
      }
      setStyleProgress('Done!')
      setStyleProgressPct(100)
      setStylePreviewImages(data.previews || [])
      setStyleReferenceUrl(data.referenceUrl || null)
      setSelectedStyleId(null) // using custom reference, not a built-in style
    } catch (err) {
      setStylePreviewError(err instanceof Error ? err.message : 'Upload failed')
      setStyleProgress('')
      setStyleProgressPct(0)
    } finally {
      setStylePreviewLoading(false)
    }
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
      setTimeout(() => fileRef.current?.click(), 300)
    }
  }

  function selectMethod(m: InputMethod) {
    setMethod(m)
    setError(null)
  }

  async function handleGo() {
    if (!purpose.trim()) { setError('Describe what you want first'); return }
    setError(null)

    // Check credits before doing anything
    if (!isPaid && freeRemaining !== null && freeRemaining <= 0) {
      setShowUpgrade(true)
      return
    }

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
      // Step 1: Extract content
      let extractedData: any = null

      if (method === 'url') {
        let cleanUrl = urlInput.trim()
        if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = `https://${cleanUrl}`
        setStageMsg('Scraping website...')
        const extractRes = await fetch('/api/extract-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: cleanUrl }),
                  })
        const extractResult = await extractRes.json()
        if (!extractRes.ok) { setError(extractResult.error || 'Extraction failed'); setStage('idle'); return }
        const { suggestedTheme, autoBrandId, autoLogoUrl, autoBrandInfo, ...contentData } = extractResult
        extractedData = contentData
        // Use auto-detected brand if user didn't pick one
        if (!selectedBrand && autoBrandId) extractedData._autoBrandId = autoBrandId
        if (suggestedTheme?.prompt) extractedData._customStylePrompt = suggestedTheme.prompt
        // Auto-pick slide style from the scraped website's brand data
        if (autoBrandInfo && styleTab === 'auto') {
          const picked = autoSelectFromBrand(autoBrandInfo)
          setSelectedStyleId(picked)
          setStyleMatchedSite(autoBrandInfo.name || cleanUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''))
        }
      } else if (method === 'text') {
        setStageMsg('Analyzing text...')
        const extractRes = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textInput.trim(), purpose: purpose.trim() }),
                  })
        const extractResult = await extractRes.json()
        if (!extractRes.ok) { setError(extractResult.error || 'Extraction failed'); setStage('idle'); return }
        extractedData = extractResult
      } else if (method === 'idea' || !method) {
        setStageMsg('AI is researching your topic...')
        const extractRes = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea: purpose.trim(), purpose: purpose.trim() }),
                  })
        const extractResult = await extractRes.json()
        if (!extractRes.ok) { setError(extractResult.error || 'Content generation failed'); setStage('idle'); return }
        extractedData = extractResult
      } else if (method === 'upload') {
        // Upload handled by handleUploadFlow
        await handleUploadFlow()
        return
      }

      if (!extractedData) { setError('No content could be extracted'); setStage('idle'); return }

      // Step 2: Create video record
      setStageMsg('Setting up your video...')
      const effectiveBrand = selectedBrand || extractedData._autoBrandId || null
      const customStyle = extractedData._customStylePrompt || undefined
      delete extractedData._autoBrandId
      delete extractedData._customStylePrompt

      // Promote nested contactInfo to top-level so generate-video finds it
      const ci = extractedData.contactInfo || {}
      const policyData = {
        ...extractedData,
        contactPhone: ci.phone || undefined,
        contactEmail: ci.email || undefined,
        contactWebsite: ci.website || undefined,
      }
      const createRes = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyData, brandId: effectiveBrand, voiceId: 'nova', clientId: clientId || undefined }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) { setError(createData.error || 'Failed to create video'); setStage('idle'); return }

      // Step 3: Save pipeline input + trigger generation
      setStageMsg('Starting video generation...')
      const genRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: createData.id, policyData, brandId: effectiveBrand, voiceId: 'nova',
          styleId: customStyle ? 'custom-url-theme' : (selectedStyleId || undefined),
          customStylePrompt: customStyle,
          styleReferenceUrl: styleReferenceUrl || undefined,
          narrationStyle: 'solo', aiMusic, purpose: purpose.trim(),
          detailLevel,
          musicPrompt: aiMusic ? 'Professional ambient background music, subtle and warm' : undefined,
          industry: extractedData?.industry || 'general',
          bookingUrl: bookingUrl.trim() || undefined,
          paymentLink: paymentLink.trim() || undefined,
        }),
      })
      const genData = await genRes.json()
      if (!genRes.ok) {
        if (genRes.status === 403) { setShowUpgrade(true); setStage('idle'); return }
        router.push(`/create/generating?id=${createData.id}`)
        return
      }

      router.push(`/create/generating?id=${createData.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('idle')
    }
  }

  async function handleUploadFlow() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('No file selected. Please choose a file first.'); return }

    setStage('extracting')
    setStageMsg('Reading your document...')
    setElapsed(0)

    try {
      // Step 1: Extract content via VPS
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('purpose', purpose.trim())

      const extractRes = await fetch('/api/extract-doc', {
        method: 'POST',
        body: uploadFormData,
      })
      const extractText = await extractRes.text()
      let extractData: any
      try { extractData = JSON.parse(extractText) } catch { setError(`Extraction failed: ${extractText.slice(0, 200)}`); setStage('idle'); return }
      if (!extractRes.ok) { setError(extractData.error || 'Extraction failed'); setStage('idle'); return }

      // Step 2: Create video record — promote contactInfo to top-level
      setStageMsg('Setting up your video...')
      const uci = extractData.contactInfo || {}
      const policyData = {
        ...extractData,
        contactPhone: uci.phone || undefined,
        contactEmail: uci.email || undefined,
        contactWebsite: uci.website || undefined,
      }
      const createRes = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyData, brandId: selectedBrand, voiceId: 'nova' }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) { setError(createData.error || 'Failed to create video'); setStage('idle'); return }

      // Step 3: Trigger pipeline
      setStageMsg('Starting video generation...')
      const genRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: createData.id, policyData, brandId: selectedBrand, voiceId: 'nova',
          styleId: selectedStyleId || undefined,
          styleReferenceUrl: styleReferenceUrl || undefined,
          narrationStyle: 'solo', aiMusic, purpose: purpose.trim(),
          detailLevel,
          musicPrompt: aiMusic ? 'Professional ambient background music, subtle and warm' : undefined,
          industry: extractData?.industry || 'general',
          bookingUrl: bookingUrl.trim() || undefined,
          paymentLink: paymentLink.trim() || undefined,
        }),
      })
      const genData = await genRes.json()
      if (!genRes.ok) {
        if (genRes.status === 403) { setShowUpgrade(true); setStage('idle'); return }
        router.push(`/create/generating?id=${createData.id}`)
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

      {/* Back to dashboard */}
      <div style={{ width: '100%', marginBottom: 8 }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink-light)', fontFamily: 'inherit', padding: 0 }}
        >
          &larr; Dashboard
        </button>
      </div>

      {/* Heading */}
      {clientName && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 8, marginBottom: 12,
          background: 'rgba(199,232,168,0.15)', border: '1px solid var(--mint)',
          fontSize: 13, fontWeight: 600, color: 'var(--ink)',
        }}>
          Creating video for <strong>{clientName}</strong>
        </div>
      )}
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
            How do you want to submit the video content?
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

              {/* Booking & Payment links */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Share page links <span style={{ fontWeight: 500, color: 'var(--ink-light)' }}>(optional)</span></div>
                <input
                  type="url"
                  value={bookingUrl}
                  onChange={e => setBookingUrl(e.target.value)}
                  placeholder="Booking link (Calendly, Cal.com, etc.)"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 8 }}
                />
                <input
                  type="url"
                  value={paymentLink}
                  onChange={e => setPaymentLink(e.target.value)}
                  placeholder="Payment link (Stripe, PayPal, etc.)"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Style Picker */}
      {purpose && (
        <div style={{ width: '100%', marginBottom: 20, animation: 'fadeInUp 0.3s ease' }}>
          <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 10 }}>
            Choose your illustration style
          </label>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-soft)', borderRadius: 10, padding: 4 }}>
            {([
              { id: 'auto' as const, label: 'Auto Pick' },
              { id: 'browse' as const, label: 'Browse Styles' },
              { id: 'upload' as const, label: 'Upload Your Own' },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setStyleTab(t.id)}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  background: styleTab === t.id ? 'white' : 'transparent',
                  color: styleTab === t.id ? 'var(--ink)' : 'var(--ink-light)',
                  boxShadow: styleTab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Auto Pick */}
          {styleTab === 'auto' && (() => {
            const picked = SLIDE_STYLES.find(s => s.id === selectedStyleId) || SLIDE_STYLES[0]
            return (
              <div style={{ padding: '20px', borderRadius: 10, background: 'var(--bg-soft)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{
                    width: 120, height: 68, borderRadius: 8, overflow: 'hidden',
                    background: 'var(--border-light)', flexShrink: 0,
                  }}>
                    <img
                      src={`/style-previews/${picked.id}.png`}
                      alt={picked.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                      {picked.name}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                      {picked.description}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 6 }}>
                      {styleMatchedSite
                        ? <>Styled to match <strong>{styleMatchedSite}</strong></>
                        : <>We suggest <strong>{picked.name}</strong> for your content</>
                      }
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button
                    onClick={() => { /* already selected */ }}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: '2px solid var(--mint)',
                      background: 'rgba(59,181,200,0.06)', fontSize: 13, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)',
                    }}
                  >
                    Use this style
                  </button>
                  <button
                    onClick={() => setStyleTab('browse')}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-light)',
                      background: 'white', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink-soft)',
                    }}
                  >
                    Browse other styles
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Tab 2: Browse Styles */}
          {styleTab === 'browse' && (
            <div>
              <input
                type="text"
                value={styleSearchQuery}
                onChange={e => setStyleSearchQuery(e.target.value)}
                placeholder="Search styles..."
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  border: '1.5px solid var(--border-light)', fontSize: 13, fontFamily: 'inherit',
                  outline: 'none', marginBottom: 12, transition: 'border-color 0.2s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
              />
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
                maxHeight: 360, overflowY: 'auto', paddingRight: 4,
              }}>
                {SLIDE_STYLES
                  .filter(s => {
                    if (!styleSearchQuery) return true
                    const q = styleSearchQuery.toLowerCase()
                    return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
                  })
                  .map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedStyleId(s.id); setStyleReferenceUrl(null); setStylePreviewImages([]) }}
                      style={{
                        padding: 0, borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                        border: selectedStyleId === s.id ? '2px solid var(--mint)' : '1.5px solid var(--border-light)',
                        background: 'white', fontFamily: 'inherit', textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ width: '100%', height: 80, background: 'var(--bg-soft)', overflow: 'hidden' }}>
                        <img
                          src={`/style-previews/${s.id}.png`}
                          alt={s.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      </div>
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-light)', lineHeight: 1.3 }}>
                          {s.description}
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Tab 3: Upload Your Own */}
          {styleTab === 'upload' && (
            <div>
              <div
                onClick={() => styleFileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--mint)' }}
                onDragLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.style.borderColor = 'var(--border)'
                  const file = e.dataTransfer.files[0]
                  if (file && file.type.startsWith('image/')) handleStyleImageUpload(file)
                }}
                style={{
                  padding: '32px 24px', borderRadius: 10, border: '2px dashed var(--border)',
                  background: 'var(--bg-soft)', cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>&#127912;</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                  Drop a reference image or click to browse
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>
                  Upload a slide, poster, or design you love. We&apos;ll match its style.
                </div>
              </div>
              <input
                ref={styleFileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleStyleImageUpload(f) }}
              />

              {stylePreviewLoading && (
                <div style={{ marginTop: 16, background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto 16px' }} />
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{styleProgress}</div>
                  <div style={{ maxWidth: 300, margin: '0 auto' }}>
                    <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: styleProgressPct + '%', background: 'var(--mint)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 8 }}>This usually takes 30-60 seconds</div>
                </div>
              )}

              {stylePreviewError && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 8,
                  background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 13,
                }}>
                  {stylePreviewError}
                </div>
              )}

              {stylePreviewImages.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
                    Preview slides
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {stylePreviewImages.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt={`Preview ${i + 1}`}
                        style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-light)' }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => { setSelectedStyleId(null); /* styleReferenceUrl already set */ }}
                    style={{
                      marginTop: 12, padding: '8px 16px', borderRadius: 8,
                      border: '2px solid var(--mint)', background: 'rgba(59,181,200,0.06)',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      color: 'var(--ink)',
                    }}
                  >
                    Use this style
                  </button>
                </div>
              )}

              {!isPaid && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-light)' }}>
                  Free accounts: 3 style previews per day.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Video Length */}
      {purpose && (
        <div style={{ width: '100%', marginBottom: 20, animation: 'fadeInUp 0.3s ease' }}>
          <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 10 }}>
            Video length
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {([
              { id: 'quick' as const, title: 'Short', time: '1-2 min', desc: 'Quick overview of key points', minTier: 'free' as PlanTier },
              { id: 'standard' as const, title: 'Standard', time: '3-4 min', desc: 'Detailed walkthrough', minTier: 'starter' as PlanTier },
              { id: 'detailed' as const, title: 'Detailed', time: '4-6 min', desc: 'Comprehensive deep-dive', minTier: 'pro' as PlanTier },
            ]).map(level => {
              const selected = detailLevel === level.id
              const tierOrder: PlanTier[] = ['free', 'starter', 'pro', 'business', 'enterprise']
              const allowed = tierOrder.indexOf(userTier) >= tierOrder.indexOf(level.minTier)
              return (
                <button
                  key={level.id}
                  onClick={() => {
                    if (allowed) {
                      setDetailLevel(level.id)
                    } else {
                      setShowLengthUpgrade(true)
                    }
                  }}
                  style={{
                    padding: '14px 12px', borderRadius: 10, cursor: 'pointer',
                    border: selected ? '2px solid var(--mint)' : '1.5px solid var(--border-light)',
                    background: selected ? 'rgba(199, 232, 168, 0.08)' : 'white',
                    fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
                    opacity: allowed ? 1 : 0.7, position: 'relative',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
                    {!allowed && <span style={{ marginRight: 4 }}>&#128274;</span>}
                    {level.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>{level.time}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)', lineHeight: 1.3 }}>{level.desc}</div>
                  {!allowed && (
                    <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 4 }}>
                      {level.minTier === 'starter' ? 'Starter+ plan' : 'Pro+ plan'}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
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
        <>
          {!isPaid && freeRemaining !== null && freeRemaining > 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-light)', textAlign: 'center', marginBottom: 8 }}>
              {freeRemaining} free video{freeRemaining !== 1 ? 's' : ''} remaining
            </div>
          )}
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
        </>
      )}

      {/* Upgrade modal */}
      {showUpgrade && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }} onClick={() => setShowUpgrade(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 10, padding: '36px 32px', maxWidth: 440, width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#127916;</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>
              You&apos;ve used your free videos
            </h2>
            <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 8 }}>
              Your 2 free videos are used up. Upgrade to keep creating professional explainer videos for your clients.
            </p>
            <p style={{ fontSize: 14, color: 'var(--ink-light)', marginBottom: 24 }}>
              Plans start at $29/mo for 5 videos, or pay $10 per video with no subscription.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowUpgrade(false); router.push('/pricing') }}
                style={{
                  flex: 1, padding: '14px', borderRadius: 8, border: 'none',
                  background: 'var(--ink)', color: 'white', fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                View plans
              </button>
              <button
                onClick={async () => {
                  setShowUpgrade(false)
                  setStage('extracting')
                  setStageMsg('Processing payment...')
                  try {
                    const res = await fetch('/api/pay-project', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ projectType: 'video' }),
                    })
                    const data = await res.json()
                    if (data.url) window.location.href = data.url
                    else { setError('Could not start payment'); setStage('idle') }
                  } catch { setError('Payment failed'); setStage('idle') }
                }}
                style={{
                  flex: 1, padding: '14px', borderRadius: 8, border: '2px solid var(--mint)',
                  background: 'white', color: 'var(--ink)', fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Pay $10 for this video
              </button>
            </div>
          </div>
        </div>
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

      {/* Length upgrade modal */}
      <UpgradeModal open={showLengthUpgrade} onClose={() => setShowLengthUpgrade(false)} />
    </div>
  )
}
