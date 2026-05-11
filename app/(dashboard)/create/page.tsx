'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../_lib/supabase/client'
import type { Brand, ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'
import { VOICE_OPTIONS, SLIDE_STYLES } from '../../_lib/types'

type InputTab = 'upload' | 'text' | 'idea' | 'proposal'

type Step = 'upload' | 'extracting' | 'review' | 'choose-brand' | 'choose-style' | 'approve-slides' | 'choose-voice' | 'generating' | 'done'

const STEP_LABELS = [
  { key: 'upload', label: '1. Your Content' },
  { key: 'review', label: '2. Confirm Data' },
  { key: 'choose-brand', label: '3. Brand' },
  { key: 'choose-style', label: '4. Pick a Look' },
  { key: 'approve-slides', label: '5. Preview' },
  { key: 'choose-voice', label: '6. Voice & Tone' },
  { key: 'generating', label: '7. Create Video' },
]

function getStepIndex(step: Step): number {
  if (step === 'extracting') return 0
  const idx = STEP_LABELS.findIndex(s => s.key === step)
  return idx >= 0 ? idx : 0
}

// Voice avatar color mapping
const VOICE_COLORS: Record<string, string> = {}
VOICE_OPTIONS.forEach((v, i) => {
  const colors = ['', 'peach', 'lilac', 'sky', 'rose', '']
  VOICE_COLORS[v.id] = colors[i % colors.length]
})

function StylePicker({ selectedStyle, onSelect, onBack, onNext, customStylePrompt, onCustomStylePrompt, brands, selectedBrand, onBrandSelect }: {
  selectedStyle: string
  onSelect: (id: string) => void
  onBack: () => void
  onNext: () => void
  customStylePrompt?: string
  onCustomStylePrompt?: (prompt: string) => void
  brands?: Brand[]
  selectedBrand?: string | null
  onBrandSelect?: (id: string | null) => void
}) {
  const [customTemplates, setCustomTemplates] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCustomTemplates(data)
    }).catch(() => {})
  }, [])

  return (
    <div className="wizard-card">
      <h2>Pick a visual style</h2>
      <p className="wizard-sub">Choose how your slides will look. Your brand colors and logo will be applied automatically.</p>

      {/* Brand selector */}
      {brands && brands.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <label className="input-label">Brand</label>
          <select
            className="input-select"
            value={selectedBrand ?? ''}
            onChange={(e) => onBrandSelect?.(e.target.value || null)}
          >
            <option value="">No brand</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name}{b.is_default ? ' (default)' : ''}</option>
            ))}
          </select>
        </div>
      )}

      <div className="style-grid">
        {/* Custom templates first */}
        {customTemplates.map((t) => (
          <div
            key={`custom-${t.id}`}
            className={`style-card${selectedStyle === `custom:${t.id}` ? ' selected' : ''}`}
            onClick={() => {
              onSelect(`custom:${t.id}`)
              onCustomStylePrompt?.(t.prompt)
            }}
          >
            {t.preview_url ? (
              <img src={t.preview_url} alt={t.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} loading="lazy" />
            ) : (
              <div className="style-preview">{t.name[0]}</div>
            )}
            <div className="style-name">{t.name}</div>
            <div className="style-desc">{t.description ?? 'Custom template'}</div>
          </div>
        ))}

        {/* Built-in templates */}
        {SLIDE_STYLES.map((style) => (
          <div
            key={style.id}
            className={`style-card${selectedStyle === style.id ? ' selected' : ''}`}
            onClick={() => {
              onSelect(style.id)
              onCustomStylePrompt?.('')
            }}
          >
            <img src={`/style-previews/${style.id}.png`} alt={style.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} loading="lazy" />
            <div className="style-name">{style.name}</div>
            <div className="style-desc">{style.description}</div>
          </div>
        ))}

        {/* Create Your Own card */}
        <a href="/templates" className="style-card create-own" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
          <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 10, border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 8, background: 'var(--bg-soft)' }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>AI Template Maker</span>
          </div>
          <div className="style-name">Create Your Own</div>
          <div className="style-desc">Describe it, AI builds it</div>
        </a>
      </div>

      <div className="wizard-actions">
        <button onClick={onBack} className="btn btn-soft">&larr; Back</button>
        <button onClick={onNext} className="btn btn-primary">Next: generate slides &rarr;</button>
      </div>
    </div>
  )
}

const DEFAULT_MUSIC = [
  { id: 'corporate-1', name: 'Business Agreement', mood: 'Corporate', url: '/music/grand_project-business-agreement-329277.mp3' },
  { id: 'corporate-2', name: 'Business Professional', mood: 'Corporate', url: '/music/nastelbom-business-291626.mp3' },
  { id: 'warm-1', name: 'Business Warm', mood: 'Warm', url: '/music/nastelbom-business-443091.mp3' },
  { id: 'upbeat-1', name: 'Business Upbeat', mood: 'Upbeat', url: '/music/nastelbom-business-454615.mp3' },
  { id: 'cinematic-1', name: 'Business Cinematic', mood: 'Cinematic', url: '/music/the_mountain-business-business-music-489995.mp3' },
  { id: 'inspirational-1', name: 'Online Business', mood: 'Inspirational', url: '/music/the_mountain-online-business-144097.mp3' },
]

export default function CreatePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedPolicyData | null>(null)
  const [generalData, setGeneralData] = useState<ExtractedData | null>(null)
  const [inputTab, setInputTab] = useState<InputTab>('upload')
  const [rawText, setRawText] = useState('')
  const [ideaTopic, setIdeaTopic] = useState('')
  const [ideaAudience, setIdeaAudience] = useState('')
  const [ideaTone, setIdeaTone] = useState('Professional')
  const [ideaKeyPoints, setIdeaKeyPoints] = useState('')
  const [textExtracting, setTextExtracting] = useState(false)

  // Proposal chat state
  const [proposalMessages, setProposalMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: "Hi! I'll help you create a professional proposal. What type of proposal are you putting together? (e.g., insurance policy, financial plan, consulting project, real estate listing...)" }
  ])
  const [proposalInput, setProposalInput] = useState('')
  const [proposalLoading, setProposalLoading] = useState(false)
  const [proposalReady, setProposalReady] = useState(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  // Video-specific state
  const [selectedStyle, setSelectedStyle] = useState<string>('luxury')
  const [customStylePrompt, setCustomStylePrompt] = useState<string>('')
  const [slideCount, setSlideCount] = useState(0)
  const [slides, setSlides] = useState<(string | null)[]>([])
  const [slidesLoading, setSlidesLoading] = useState<boolean[]>([])
  const [slideLabels, setSlideLabels] = useState<{ title: string; content: string }[]>([])
  const [generatedScenes, setGeneratedScenes] = useState<any[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>(VOICE_OPTIONS[0].id)
  const [detailedMode, setDetailedMode] = useState(false)
  const [selectedMusic, setSelectedMusic] = useState<string | null>(null)
  const [previewingMusic, setPreviewingMusic] = useState<string | null>(null)
  const musicAudioRef = useRef<HTMLAudioElement | null>(null)
  const [playingVoice, setPlayingVoice] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const [audioGenerating, setAudioGenerating] = useState(false)

  const [userPlan, setUserPlan] = useState<string>('trial')
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [extractingElapsed, setExtractingElapsed] = useState(0)
  const extractingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [generatingElapsed, setGeneratingElapsed] = useState(0)
  const generatingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      // Load brands
      const { data } = await supabase
        .from('brands')
        .select('*')
        .order('is_default', { ascending: false })
      if (data) {
        setBrands(data as Brand[])
        const defaultBrand = data.find((b: Brand) => b.is_default)
        if (defaultBrand) setSelectedBrand(defaultBrand.id)
      }
      // Load user's default style and plan
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('default_style, subscription_status').eq('id', user.id).single()
        if (profile?.default_style) setSelectedStyle(profile.default_style)
        if (profile?.subscription_status) setUserPlan(profile.subscription_status)
      }
    }
    loadData()
  }, [])

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') { setError('Please upload a PDF file'); return }
    if (selectedFile.size > 20 * 1024 * 1024) { setError('File must be under 20MB'); return }
    setFile(selectedFile)
    setError(null)
  }, [])

  async function handleExtract() {
    if (!file) return
    setStep('extracting')
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extract', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      // The API now returns { general, insurance? }
      // If insurance data with meaningful values exists, use it; otherwise use general
      if (data.insurance && data.insurance.deathBenefit > 0) {
        setExtractedData(data.insurance)
        setGeneralData(null)
      } else {
        setGeneralData(data.general)
        setExtractedData(null)
      }
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
      setStep('upload')
    }
  }

  async function handleExtractText() {
    if (!rawText.trim()) return
    setTextExtracting(true)
    setStep('extracting')
    setError(null)
    try {
      const res = await fetch('/api/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      setGeneralData(data)
      setExtractedData(null)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Text extraction failed')
      setStep('upload')
    } finally {
      setTextExtracting(false)
    }
  }

  async function handleGenerateFromIdea() {
    if (!ideaTopic.trim() || !ideaAudience.trim()) return
    setTextExtracting(true)
    setStep('extracting')
    setError(null)
    try {
      const keyPoints = ideaKeyPoints.trim()
        ? ideaKeyPoints.split('\n').map(l => l.trim()).filter(Boolean)
        : undefined
      const res = await fetch('/api/generate-from-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: ideaTopic,
          audience: ideaAudience,
          tone: ideaTone,
          keyPoints,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setGeneralData(data)
      setExtractedData(null)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Idea generation failed')
      setStep('upload')
    } finally {
      setTextExtracting(false)
    }
  }

  async function sendProposalMessage() {
    if (!proposalInput.trim() || proposalLoading) return
    const userMsg = proposalInput.trim()
    setProposalInput('')
    const newMessages = [...proposalMessages, { role: 'user' as const, content: userMsg }]
    setProposalMessages(newMessages)
    setProposalLoading(true)

    try {
      const res = await fetch('/api/proposal-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      if (data.reply) {
        setProposalMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      }
      if (data.proposal) {
        setGeneralData(data.proposal)
        setExtractedData(null)
        setProposalReady(true)
      }
    } catch {
      setProposalMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    }
    setProposalLoading(false)
  }

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [proposalMessages, proposalLoading])

  // Track extracting elapsed time
  useEffect(() => {
    if (step === 'extracting') {
      setExtractingElapsed(0)
      extractingTimerRef.current = setInterval(() => {
        setExtractingElapsed(prev => prev + 1)
      }, 1000)
    } else {
      if (extractingTimerRef.current) {
        clearInterval(extractingTimerRef.current)
        extractingTimerRef.current = null
      }
    }
    return () => {
      if (extractingTimerRef.current) clearInterval(extractingTimerRef.current)
    }
  }, [step === 'extracting'])

  // Track generating elapsed time
  useEffect(() => {
    if (step === 'generating') {
      setGeneratingElapsed(0)
      generatingTimerRef.current = setInterval(() => {
        setGeneratingElapsed(prev => prev + 1)
      }, 1000)
    } else {
      if (generatingTimerRef.current) {
        clearInterval(generatingTimerRef.current)
        generatingTimerRef.current = null
      }
    }
    return () => {
      if (generatingTimerRef.current) clearInterval(generatingTimerRef.current)
    }
  }, [step === 'generating'])

  // Determine which data format we're working with
  const activeData = extractedData || generalData
  const isGeneralData = !extractedData && !!generalData

  async function handleGenerateSlides() {
    setStep('approve-slides')
    setError(null)
    // Clear any stale pre-generated audio from previous sessions
    sessionStorage.removeItem('pregenerated_audio_id')
    setAudioReady(false)

    try {
      const scriptRes = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyData: activeData, brandId: selectedBrand, detailed: detailedMode }),
      })
      const scriptData = await scriptRes.json()
      if (!scriptRes.ok) throw new Error(scriptData.error || 'Script generation failed')

      const scenes = scriptData.scenes as { scene: number; title: string; slidePrompt: string; narration: string }[]
      const count = scenes.length
      setSlideCount(count)
      setGeneratedScenes(scenes)
      setSlideLabels(scenes.map(s => ({ title: s.title, content: s.slidePrompt.slice(0, 80) })))

      // Pre-generate audio in background while user reviews slides
      setAudioGenerating(true)
      setAudioReady(false)
      fetch('/api/pre-generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes, voiceId: selectedVoice }),
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          // Clear any old audio ID first, then set new one
          sessionStorage.removeItem('pregenerated_audio_id')
          sessionStorage.setItem('pregenerated_audio_id', data.audioId)
          setAudioReady(true)
        }
        setAudioGenerating(false)
      }).catch(() => setAudioGenerating(false))

      const newSlides: (string | null)[] = Array(count).fill(null)
      const loading = Array(count).fill(true)
      setSlidesLoading([...loading])
      setSlides([...newSlides])

      for (let i = 0; i < count; i++) {
        try {
          const res = await fetch('/api/generate-slide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              policyData: activeData,
              slideIndex: i,
              styleId: selectedStyle,
              brandId: selectedBrand,
              slidePrompt: scenes[i].slidePrompt,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          newSlides[i] = data.image
          setSlides([...newSlides])
        } catch (err) {
          console.error(`Slide ${i + 1} failed:`, err)
        }
        loading[i] = false
        setSlidesLoading([...loading])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate slides')
      setStep('choose-style')
    }
  }

  async function handleRegenerateSlide(index: number) {
    const loading = [...slidesLoading]
    loading[index] = true
    setSlidesLoading(loading)

    try {
      const res = await fetch('/api/generate-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyData: activeData,
          slideIndex: index,
          styleId: selectedStyle,
          brandId: selectedBrand,
          slidePrompt: generatedScenes[index]?.slidePrompt,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const newSlides = [...slides]
      newSlides[index] = data.image
      setSlides(newSlides)
    } catch (err) {
      console.error(`Slide ${index + 1} regen failed:`, err)
    }

    loading[index] = false
    setSlidesLoading([...loading])
  }

  function handlePreviewVoice(voiceId: string) {
    if (playingVoice === voiceId) {
      audioRef.current?.pause()
      setPlayingVoice(null)
      return
    }
    if (audioRef.current) audioRef.current.pause()
    const audio = new Audio(`/voice-previews/${voiceId}.mp3`)
    audio.onended = () => setPlayingVoice(null)
    audio.play()
    audioRef.current = audio
    setPlayingVoice(voiceId)
  }

  async function handleGenerate() {
    if (!activeData) return
    setStep('generating')
    setError(null)

    try {
      // 1. Create the video record
      const createRes = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyData: activeData,
          brandId: selectedBrand,
          voiceId: selectedVoice,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create video')

      const approvedSlides = slides.filter(Boolean) as string[]

      const supabase = createClient()
      await supabase.from('videos').update({
        script: {
          _pipeline_input: {
            policyData: activeData,
            brandId: selectedBrand,
            voiceId: selectedVoice,
            styleId: selectedStyle,
            detailed: detailedMode,
            musicUrl: selectedMusic ?? undefined,
            approvedSlides: approvedSlides.length >= 4 ? approvedSlides : undefined,
            scenes: generatedScenes,
            preGeneratedAudioId: sessionStorage.getItem('pregenerated_audio_id') ?? undefined,
          },
        },
      }).eq('id', createData.id)

      // 2. Navigate to the video detail page
      router.push(`/videos/${createData.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setStep('choose-voice')
    }
  }

  function formatCurrency(n: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  }

  const allSlidesReady = slides.every(Boolean) && !slidesLoading.some(Boolean)
  const currentStepIdx = getStepIndex(step)

  return (
    <div className="wizard-container">
      {/* Progress Pill */}
      <div className="progress-pill">
        {STEP_LABELS.map((s, i) => {
          const sIdx = STEP_LABELS.findIndex(sl => sl.key === s.key)
          const isDone = currentStepIdx > sIdx
          const isActive = (step === s.key) || (step === 'extracting' && s.key === 'upload')
          return (
            <div key={s.key} className={`pp-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}>
              <div className="pp-dot">
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className="pp-label">{s.label}</span>
            </div>
          )
        })}
      </div>

      {/* Step: Upload / Text / Idea */}
      {step === 'upload' && (
        <div className="wizard-card">
          <h2>What would you like to explain?</h2>
          <p className="wizard-sub">Drop in your document and we&apos;ll handle the rest. Your video will be ready in about 2 minutes.</p>

          {/* Tab pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: 'var(--surface-raised, #f1f5f9)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {([
              { key: 'upload' as InputTab, label: 'Upload PDF', accent: false },
              { key: 'text' as InputTab, label: 'Type or Paste', accent: false },
              { key: 'idea' as InputTab, label: 'Start from Idea', accent: false },
              ...(['professional', 'active', 'agency'].includes(userPlan.toLowerCase())
                ? [{ key: 'proposal' as InputTab, label: 'AI Proposal', accent: true }]
                : []),
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setInputTab(tab.key)}
                className="btn btn-sm"
                style={{
                  borderRadius: 10,
                  background: inputTab === tab.key
                    ? (tab.accent ? 'var(--lilac, #C4B5FD)' : 'var(--mint, #A8F0D4)')
                    : 'transparent',
                  color: inputTab === tab.key ? 'var(--ink, #1a1a2e)' : 'var(--ink-soft, #64748b)',
                  fontWeight: inputTab === tab.key ? 700 : 500,
                  border: 'none',
                  padding: '8px 18px',
                  cursor: 'pointer',
                  fontSize: 14,
                  transition: 'all 0.2s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Upload PDF */}
          {inputTab === 'upload' && (
            <div
              className={`upload-zone${dragOver ? ' dragover' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }}
            >
              {file ? (
                <>
                  <div className="upload-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{file.name}</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-light)', marginBottom: 18 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button onClick={() => { setFile(null); setError(null) }} className="btn btn-soft btn-sm">Change</button>
                    <button onClick={handleExtract} className="btn btn-primary btn-sm">Extract Data</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="upload-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Drop your document here</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-light)', marginBottom: 18 }}>PDF up to 20 MB</div>
                  <label className="btn btn-mint btn-sm" style={{ cursor: 'pointer' }}>
                    Choose File
                    <input type="file" accept=".pdf" className="hidden" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} />
                  </label>
                </>
              )}
            </div>
          )}

          {/* Tab: Type or Paste */}
          {inputTab === 'text' && (
            <div>
              <div className="form-group">
                <textarea
                  className="input"
                  style={{ minHeight: 220, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
                  placeholder="Paste meeting notes, email content, bullet points, or any text..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
                  {rawText.length.toLocaleString()} / 50,000 characters
                </div>
              </div>
              <div className="wizard-actions" style={{ marginTop: 16 }}>
                <button
                  onClick={handleExtractText}
                  disabled={!rawText.trim() || textExtracting}
                  className="btn btn-primary"
                >
                  {textExtracting ? 'Extracting...' : 'Extract & Continue \u2192'}
                </button>
              </div>
            </div>
          )}

          {/* Tab: Start from Idea */}
          {inputTab === 'idea' && (
            <div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="input-label">What&apos;s this about?</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Q3 Sales Performance, Benefits of Solar Energy, Company Culture..."
                  value={ideaTopic}
                  onChange={(e) => setIdeaTopic(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Who is this for?</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Executive team, Prospective clients, New employees..."
                  value={ideaAudience}
                  onChange={(e) => setIdeaAudience(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Tone</label>
                <select
                  className="input"
                  value={ideaTone}
                  onChange={(e) => setIdeaTone(e.target.value)}
                >
                  <option value="Professional">Professional</option>
                  <option value="Casual">Casual</option>
                  <option value="Educational">Educational</option>
                  <option value="Persuasive">Persuasive</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Key points to include (optional, one per line)</label>
                <textarea
                  className="input"
                  style={{ minHeight: 100, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
                  placeholder={"Revenue grew 25% YoY\nNew product launched in March\nCustomer satisfaction at 94%"}
                  value={ideaKeyPoints}
                  onChange={(e) => setIdeaKeyPoints(e.target.value)}
                />
              </div>
              <div className="wizard-actions" style={{ marginTop: 16 }}>
                <button
                  onClick={handleGenerateFromIdea}
                  disabled={!ideaTopic.trim() || !ideaAudience.trim() || textExtracting}
                  className="btn btn-primary"
                >
                  {textExtracting ? 'Generating...' : 'Generate Content \u2192'}
                </button>
              </div>
            </div>
          )}

          {/* Tab: AI Proposal */}
          {inputTab === 'proposal' && (
            <div>
              <h2>AI Proposal <em>Interview</em></h2>
              <p className="wizard-sub">Answer a few questions and I&apos;ll create a complete proposal for you.</p>

              {/* Chat messages */}
              <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16, padding: '12px 0' }}>
                {proposalMessages.map((msg, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: 8,
                  }}>
                    <div style={{
                      maxWidth: '80%',
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: msg.role === 'user' ? 'var(--mint)' : 'white',
                      border: msg.role === 'user' ? 'none' : '1px solid var(--border-light)',
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {proposalLoading && <div style={{ display: 'flex' }}><span className="spinner" /></div>}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              {!proposalReady ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={proposalInput} onChange={e => setProposalInput(e.target.value)}
                    className="input" placeholder="Type your answer..."
                    onKeyDown={e => { if (e.key === 'Enter') sendProposalMessage() }}
                    style={{ flex: 1 }} />
                  <button onClick={sendProposalMessage} disabled={proposalLoading || !proposalInput.trim()}
                    className="btn btn-primary">Send</button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--mint-darker)' }}>
                    Proposal ready!
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>
                    Your proposal has been generated. Continue to review and create your explainer.
                  </p>
                  <button onClick={() => setStep('review')} className="btn btn-primary btn-lg">
                    Continue to explainer &rarr;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step: Extracting */}
      {step === 'extracting' && (
        <div className="wizard-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          {/* Progress bar */}
          <div style={{ maxWidth: 400, margin: '0 auto 28px', height: 6, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 10, background: 'var(--mint)',
              transition: 'width 1s ease',
              width: extractingElapsed < 3 ? '10%'
                : extractingElapsed < 8 ? '30%'
                : extractingElapsed < 15 ? '55%'
                : extractingElapsed < 25 ? '75%'
                : extractingElapsed < 40 ? '88%'
                : '95%',
            }} />
          </div>

          {/* Stage indicators */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 28 }}>
            {[
              { label: inputTab === 'upload' ? 'Uploading' : 'Reading', threshold: 0 },
              { label: 'Analyzing', threshold: 5 },
              { label: 'Extracting', threshold: 12 },
            ].map((stage, i) => {
              const isActive = extractingElapsed >= stage.threshold
              const isDone = i < 2 && extractingElapsed >= [5, 12, 999][i]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: isDone ? 'var(--mint)' : isActive ? 'var(--ink)' : 'var(--border)',
                    color: isDone ? 'var(--ink)' : isActive ? 'white' : 'var(--ink-light)',
                    transition: 'all 0.3s ease',
                  }}>
                    {isDone ? '\u2713' : i + 1}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--ink)' : 'var(--ink-light)',
                    transition: 'all 0.3s ease',
                  }}>
                    {stage.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Status message */}
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
            {extractingElapsed < 3 ? (inputTab === 'upload' ? 'Uploading your document...' : 'Reading your content...') :
             extractingElapsed < 8 ? 'AI is analyzing the document structure...' :
             extractingElapsed < 15 ? 'Extracting key data points and metrics...' :
             extractingElapsed < 25 ? 'Almost there — organizing your data...' :
             extractingElapsed < 60 ? 'Still working — complex documents take a little longer...' :
             'Taking longer than expected — please wait...'}
          </p>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-light)' }}>
            {extractingElapsed}s elapsed
          </p>
        </div>
      )}

      {/* Step: Review extracted data */}
      {step === 'review' && activeData && (
        <div className="wizard-card">
          <h2>Does this look right?</h2>
          <p className="wizard-sub">
            {isGeneralData
              ? 'Here\'s what we put together. Make sure everything looks correct before we design your slides.'
              : 'Here\'s what we found in your document. Review and correct anything that\'s off — this data will appear in your video.'}
          </p>

          {/* Insurance-specific (ExtractedPolicyData) review */}
          {extractedData && !isGeneralData && (
            <>
              <div className="extracted-grid">
                <div className="data-card">
                  <div className="data-label">Policy Type</div>
                  <div className="data-value">{extractedData.policyType}</div>
                </div>
                <div className="data-card">
                  <div className="data-label">Source</div>
                  <div className="data-value">{extractedData.carrier}</div>
                </div>
                <div className="data-card">
                  <div className="data-label">Insured</div>
                  <div className="data-value">{extractedData.insuredName}</div>
                </div>
                <div className="data-card">
                  <div className="data-label">Death Benefit</div>
                  <div className="data-value mint">{formatCurrency(extractedData.deathBenefit)}</div>
                </div>
                <div className="data-card">
                  <div className="data-label">Annual Premium</div>
                  <div className="data-value mint">{formatCurrency(extractedData.annualPremium)}</div>
                </div>
                <div className="data-card">
                  <div className="data-label">Payment Mode</div>
                  <div className="data-value">{extractedData.paymentMode}</div>
                </div>
              </div>

              {extractedData.riders.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div className="data-label" style={{ marginBottom: 10 }}>Riders</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {extractedData.riders.map((r, i) => (
                      <span key={i} className="tag">{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Generalized (ExtractedData) review */}
          {isGeneralData && generalData && (
            <>
              {/* Title */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{generalData.title}</h3>
                {generalData.subtitle && (
                  <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: 0 }}>{generalData.subtitle}</p>
                )}
                {generalData.source && (
                  <p style={{ fontSize: 13, color: 'var(--ink-light)', margin: '6px 0 0' }}>Source: {generalData.source}</p>
                )}
              </div>

              {/* Key Metrics grid */}
              {generalData.keyMetrics.length > 0 && (
                <div className="extracted-grid">
                  {generalData.keyMetrics.map((m, i) => (
                    <div key={i} className="data-card">
                      <div className="data-label">{m.label}</div>
                      <div className={`data-value${m.highlight ? ' mint' : ''}`}>{m.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sections as cards */}
              {generalData.sections.length > 0 && (
                <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
                  {generalData.sections.map((s, i) => (
                    <div key={i} style={{
                      background: 'var(--surface-raised, #f8fafc)',
                      borderRadius: 10,
                      padding: '16px 20px',
                      border: '1px solid var(--border, #e2e8f0)',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{s.title}</div>
                      <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{s.content}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bullet points as tags */}
              {generalData.bulletPoints.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div className="data-label" style={{ marginBottom: 10 }}>Key Takeaways</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {generalData.bulletPoints.map((bp, i) => (
                      <span key={i} className="tag">{bp}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Brand nudge */}
          {brands.length === 0 && (
            <div style={{
              padding: '14px 18px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(109,211,161,0.08)', border: '1px solid rgba(109,211,161,0.2)',
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-soft)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker, #4a7c59)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Want your logo and brand colors on the video? <a href="/brands/new" style={{color:'var(--ink)',fontWeight:700,textDecoration:'underline'}}>Set up a brand</a> first for the best results.</span>
            </div>
          )}

          <div className="wizard-actions">
            <button onClick={() => { setStep('upload') }} className="btn btn-soft">&larr; Back</button>
            <button onClick={() => setStep(brands.length > 0 ? 'choose-brand' : 'choose-style')} className="btn btn-primary">Looks good, next &rarr;</button>
          </div>
        </div>
      )}

      {/* Step: Choose brand */}
      {step === 'choose-brand' && (
        <div className="wizard-card">
          <h2>Which brand is this for?</h2>
          <p className="wizard-sub">Select a brand to apply its logo, colors, and contact info to your video.</p>
          {brands.length === 0 ? (
            <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>No brands yet. <a href="/brands/new" style={{ color: 'var(--mint-darker)', fontWeight: 600 }}>Create one</a></p>
          ) : (
            <div className="brand-grid-wiz">
              {brands.map((brand) => (
                <div key={brand.id}
                  className={`brand-option${selectedBrand === brand.id ? ' selected' : ''}`}
                  onClick={() => setSelectedBrand(brand.id)}
                >
                  <div className="name">{brand.name}</div>
                  <div className="swatches">
                    {[brand.primary_color, brand.secondary_color, brand.accent_color].map((c, i) => (
                      <div key={i} className="swatch" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="wizard-actions">
            <button onClick={() => setStep('review')} className="btn btn-soft">&larr; Back</button>
            <button onClick={() => setStep('choose-style')} className="btn btn-primary">Next: pick a style &rarr;</button>
          </div>
        </div>
      )}

      {/* Step: Choose style */}
      {step === 'choose-style' && (
        <StylePicker
          selectedStyle={selectedStyle}
          onSelect={setSelectedStyle}
          onBack={() => setStep(brands.length > 0 ? 'choose-brand' : 'review')}
          onNext={handleGenerateSlides}
          customStylePrompt={customStylePrompt}
          onCustomStylePrompt={setCustomStylePrompt}
          brands={brands}
          selectedBrand={selectedBrand}
          onBrandSelect={setSelectedBrand}
        />
      )}

      {/* Step: Approve slides */}
      {step === 'approve-slides' && (
        <div className="wizard-card">
          <h2>Here&apos;s what we designed</h2>
          <p className="wizard-sub">Preview your slides below. Don&apos;t love one? Hit Redo to regenerate it.</p>

          <div className="slides-info">
            <span style={{ width: 8, height: 8, background: 'var(--ink)', borderRadius: '50%', display: 'inline-block' }} />
            {slides.filter(Boolean).length} of {slideCount} slides generated
            {allSlidesReady ? ' \u00B7 ready to continue' : ''}
            {audioGenerating && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--mint-darker)', marginLeft: 12 }}>
                <span className="pulse-dot" />
                Pre-generating audio...
              </span>
            )}
            {audioReady && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--mint-darker)', marginLeft: 12 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
                Audio ready
              </span>
            )}
          </div>

          <div className="slides-grid">
            {slides.map((slide, i) => {
              const label = slideLabels[i] ?? { title: `Slide ${i + 1}`, content: '' }
              return (
                <div key={i} className="slide-card">
                  <div className={`slide-thumb${slidesLoading[i] ? ' loading' : ''}${!slidesLoading[i] && !slide ? ' error' : ''}`}>
                    {slidesLoading[i] ? (
                      <>
                        <div className="spinner" style={{ marginBottom: 8 }} />
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Slide {i + 1} of {slides.length} generating...</div>
                        <div style={{ maxWidth: 80, margin: '8px auto 0', height: 3, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 10, background: 'var(--mint)', animation: 'slideProgress 2s ease-in-out infinite', width: '60%' }} />
                        </div>
                        <style>{`@keyframes slideProgress { 0%,100% { width: 30% } 50% { width: 80% } }`}</style>
                      </>
                    ) : slide ? (
                      <img src={slide} alt={label.title} />
                    ) : (
                      <div style={{ fontSize: 14 }}>Failed -- click Redo</div>
                    )}
                  </div>
                  <div className="ctrl-row">
                    <div className="titles">
                      <div className="t">{label.title}</div>
                      <div className="d">{label.content}</div>
                    </div>
                    <button
                      onClick={() => handleRegenerateSlide(i)}
                      disabled={slidesLoading[i]}
                      className="btn btn-soft btn-sm"
                    >
                      {slidesLoading[i] ? '...' : 'Redo'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="wizard-actions">
            <button onClick={() => setStep('choose-style')} className="btn btn-soft">&larr; Back</button>
            <button onClick={() => setStep('choose-voice')} disabled={!allSlidesReady}
              className="btn btn-primary">
              {allSlidesReady ? 'Next: pick a voice \u2192' : 'Waiting for slides...'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Choose voice */}
      {step === 'choose-voice' && (
        <div className="wizard-card">
          <h2>Who should narrate your video?</h2>
          <p className="wizard-sub">Pick a voice and duration. Click any voice to hear a preview.</p>

          {/* Duration */}
          <div style={{ marginBottom: 24 }}>
            <label className="input-label">Video Length</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDetailedMode(false)}
                className={`btn ${!detailedMode ? 'btn-primary' : 'btn-soft'}`}
                type="button"
              >
                Standard (2-3 min) — 1 credit
              </button>
              <button
                onClick={() => setDetailedMode(true)}
                className={`btn ${detailedMode ? 'btn-primary' : 'btn-soft'}`}
                type="button"
              >
                Detailed (5-7 min) — 2 credits
              </button>
            </div>
          </div>

          <div className="voice-grid">
            {VOICE_OPTIONS.map((voice) => (
              <div
                key={voice.id}
                className={`voice-card${selectedVoice === voice.id ? ' selected' : ''}${playingVoice === voice.id ? ' playing' : ''}`}
                onClick={() => setSelectedVoice(voice.id)}
              >
                <div className="head">
                  <div className={`v-avatar${VOICE_COLORS[voice.id] ? ` ${VOICE_COLORS[voice.id]}` : ''}`}>
                    {voice.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="v-tag">{voice.gender}</span>
                </div>
                <div className="v-name">{voice.name}</div>
                <p className="v-desc">{voice.description}</p>
                <button
                  className="v-play"
                  onClick={(e) => { e.stopPropagation(); handlePreviewVoice(voice.id) }}
                >
                  {playingVoice === voice.id ? (
                    <><span className="pulse-dot" /> Playing...</>
                  ) : (
                    <>{'\u25B6'} Preview</>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Background Music */}
          <div style={{ marginTop: 32 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Background music <span style={{ fontWeight: 400, color: 'var(--ink-light)', fontSize: 13 }}>(optional)</span></h3>
            <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 14 }}>Add subtle background music to your video</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              <div
                onClick={() => { setSelectedMusic(null); if (musicAudioRef.current) { musicAudioRef.current.pause(); setPreviewingMusic(null) } }}
                style={{
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  border: selectedMusic === null ? '2px solid var(--mint)' : '1px solid var(--border)',
                  background: selectedMusic === null ? 'rgba(59,181,200,0.06)' : 'white',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                <span style={{ fontSize: 13, fontWeight: 600 }}>No music</span>
              </div>
              {DEFAULT_MUSIC.map(track => (
                <div
                  key={track.id}
                  onClick={() => setSelectedMusic(track.url)}
                  style={{
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    border: selectedMusic === track.url ? '2px solid var(--mint)' : '1px solid var(--border)',
                    background: selectedMusic === track.url ? 'rgba(59,181,200,0.06)' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{track.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>{track.mood}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (previewingMusic === track.id) {
                        musicAudioRef.current?.pause()
                        setPreviewingMusic(null)
                      } else {
                        if (musicAudioRef.current) musicAudioRef.current.pause()
                        const audio = new Audio(track.url)
                        audio.volume = 0.3
                        audio.play()
                        audio.onended = () => setPreviewingMusic(null)
                        musicAudioRef.current = audio
                        setPreviewingMusic(track.id)
                      }
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--mint-darker, var(--mint))', fontWeight: 600 }}
                  >
                    {previewingMusic === track.id ? '■ Stop' : '▶ Play'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="wizard-actions">
            <button onClick={() => setStep('approve-slides')} className="btn btn-soft">&larr; Back</button>
            <button onClick={handleGenerate} className="btn btn-primary btn-lg">Create my video &rarr;</button>
          </div>
        </div>
      )}

      {/* Step: Generating */}
      {step === 'generating' && (
        <div className="wizard-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          {/* Progress bar */}
          <div style={{ maxWidth: 400, margin: '0 auto 28px', height: 6, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 10, background: 'var(--mint)',
              transition: 'width 1s ease',
              width: generatingElapsed < 5 ? '10%'
                : generatingElapsed < 15 ? '25%'
                : generatingElapsed < 30 ? '45%'
                : generatingElapsed < 50 ? '65%'
                : generatingElapsed < 75 ? '80%'
                : '92%',
            }} />
          </div>

          {/* Stage indicators */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 28, flexWrap: 'wrap' }}>
            {[
              { label: 'Writing script', threshold: 0 },
              { label: 'Generating audio', threshold: 10 },
              { label: 'Designing slides', threshold: 25 },
              { label: 'Assembling video', threshold: 45 },
            ].map((stage, i) => {
              const isActive = generatingElapsed >= stage.threshold
              const thresholds = [10, 25, 45, 999]
              const isDone = generatingElapsed >= thresholds[i]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: isDone ? 'var(--mint)' : isActive ? 'var(--ink)' : 'var(--border)',
                    color: isDone ? 'var(--ink)' : isActive ? 'white' : 'var(--ink-light)',
                    transition: 'all 0.3s ease',
                  }}>
                    {isDone ? '\u2713' : i + 1}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--ink)' : 'var(--ink-light)',
                    transition: 'all 0.3s ease',
                  }}>
                    {stage.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Status message */}
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
            {generatingElapsed < 5 ? 'Writing your video script...' :
             generatingElapsed < 15 ? 'Generating voiceover audio...' :
             generatingElapsed < 30 ? 'Designing slide visuals...' :
             generatingElapsed < 50 ? 'Assembling your video...' :
             generatingElapsed < 75 ? 'Almost there \u2014 finalizing...' :
             'Still working \u2014 longer videos take a bit more time...'}
          </p>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-light)' }}>
            {generatingElapsed}s elapsed
          </p>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(255, 199, 194, 0.15)',
          border: '1px solid var(--rose)',
          borderRadius: 10,
          padding: '16px 22px',
          fontSize: 14,
          color: '#C03A1F',
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <span>{error}</span>
          {step === 'upload' && (
            <button
              onClick={() => setError(null)}
              className="btn btn-soft btn-sm"
              style={{ flexShrink: 0 }}
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  )
}
