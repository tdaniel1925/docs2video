'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../_lib/supabase/client'
import type { Brand, ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'
import { VOICE_OPTIONS, SLIDE_STYLES } from '../../_lib/types'
import { INDUSTRIES } from '../../_lib/industries'

type InputTab = 'upload' | 'slides' | 'text' | 'idea' | 'url' | 'research' | 'proposal'

type Step = 'upload' | 'extracting' | 'script' | 'options' | 'generating' | 'done' | 'review' | 'review-script' | 'choose-brand' | 'choose-style' | 'approve-slides' | 'choose-voice'

const STEP_LABELS = [
  { key: 'upload', label: 'Upload' },
  { key: 'script', label: 'Script' },
  { key: 'options', label: 'Options' },
  { key: 'generating', label: 'Create' },
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
      <p className="wizard-sub">Choose how your slides will look.</p>

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

const SUPABASE_STORAGE = 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos'

const DEFAULT_MUSIC = [
  { id: 'corporate-1', name: 'Business Agreement', mood: 'Corporate', url: `${SUPABASE_STORAGE}/music/grand_project-business-agreement-329277.mp3` },
  { id: 'corporate-2', name: 'Business Professional', mood: 'Corporate', url: `${SUPABASE_STORAGE}/music/nastelbom-business-291626.mp3` },
  { id: 'warm-1', name: 'Business Warm', mood: 'Warm', url: `${SUPABASE_STORAGE}/music/nastelbom-business-443091.mp3` },
  { id: 'upbeat-1', name: 'Business Upbeat', mood: 'Upbeat', url: `${SUPABASE_STORAGE}/music/nastelbom-business-454615.mp3` },
  { id: 'cinematic-1', name: 'Business Cinematic', mood: 'Cinematic', url: `${SUPABASE_STORAGE}/music/the_mountain-business-business-music-489995.mp3` },
  { id: 'inspirational-1', name: 'Online Business', mood: 'Inspirational', url: `${SUPABASE_STORAGE}/music/the_mountain-online-business-144097.mp3` },
]

const DRAFT_KEY = 'docs2video_draft'

export default function CreatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [draftBanner, setDraftBanner] = useState<string | null>(null)
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [multiDocData, setMultiDocData] = useState<ExtractedData[]>([])
  const [comparisonNotes, setComparisonNotes] = useState('')
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
  const [urlInput, setUrlInput] = useState('')
  const [researchTopic, setResearchTopic] = useState('')
  const [researchLoading, setResearchLoading] = useState(false)
  const [researchDepth, setResearchDepth] = useState<'quick' | 'detailed'>('quick')

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
  const [detailLevel, setDetailLevel] = useState<'quick' | 'standard' | 'detailed'>('standard')
  const [recommendedLevel, setRecommendedLevel] = useState<'quick' | 'standard' | 'detailed'>('standard')
  const [videoPurpose, setVideoPurpose] = useState('')
  const [uploadMode, setUploadMode] = useState<'summarize' | 'redesign' | 'narrate'>('summarize')
  const [selectedIndustry, setSelectedIndustry] = useState('general')
  const [originalSlideImages, setOriginalSlideImages] = useState<string[]>([]) // base64 PNGs from PPTX conversion
  const [selectedMusic, setSelectedMusic] = useState<string | null>(null)
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null)
  const [customTheme, setCustomTheme] = useState(false)
  const [suggestedTheme, setSuggestedTheme] = useState<{ name: string; description: string; prompt: string; colors: any; previewUrl?: string } | null>(null)
  const [themeAccepted, setThemeAccepted] = useState(false)
  const [generatingThemePreview, setGeneratingThemePreview] = useState(false)
  const [uploadedSlides, setUploadedSlides] = useState<string[]>([]) // base64 data URLs
  const [slidesMode, setSlidesMode] = useState(false) // true = user uploaded their own slides
  const [previewingMusic, setPreviewingMusic] = useState<string | null>(null)
  const musicAudioRef = useRef<HTMLAudioElement | null>(null)
  const [aiMusic, setAiMusic] = useState(false)
  const [musicPrompt, setMusicPrompt] = useState('')
  const [playingVoice, setPlayingVoice] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const [audioGenerating, setAudioGenerating] = useState(false)

  // Asset upload state
  const [assets, setAssets] = useState<{url: string, tag: string, name: string}[]>([])
  const [assetUploading, setAssetUploading] = useState(false)
  const assetInputRef = useRef<HTMLInputElement>(null)

  const [editableScenes, setEditableScenes] = useState<{scene: number, title: string, slidePrompt: string, narration: string}[]>([])
  const [scriptGenerating, setScriptGenerating] = useState(false)
  const [reviewReady, setReviewReady] = useState(false)
  const [reviewEditing, setReviewEditing] = useState(false)

  // Preview slide state
  const [previewSlide, setPreviewSlide] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const carouselRef = useRef<HTMLDivElement | null>(null)

  const [userPlan, setUserPlan] = useState<string>('trial')
  const [projectPrice, setProjectPrice] = useState<{ price: number; priceFormatted: string; isPro: boolean } | null>(null)
  const [trialStatus, setTrialStatus] = useState<{ isTrial: boolean; isPaid: boolean; hasReferral: boolean; cardOnFile: boolean; freeVideosRemaining: number; videosUsed: number; videosRemaining: number; trialExhausted?: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [extractingElapsed, setExtractingElapsed] = useState(0)
  const extractingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [generatingElapsed, setGeneratingElapsed] = useState(0)
  const generatingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Profile completeness modal (Option B)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileCompany, setProfileCompany] = useState('')
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

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
        // Don't auto-select default brand — let user choose on Options page
        // const defaultBrand = data.find((b: Brand) => b.is_default)
        // if (defaultBrand) setSelectedBrand(defaultBrand.id)
      }
      // Load user's default style and plan
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('default_style, subscription_status, full_name, company_name').eq('id', user.id).single()
        if (profile?.default_style) setSelectedStyle(profile.default_style)
        if (profile?.subscription_status) setUserPlan(profile.subscription_status)
        setProfileName(profile?.full_name ?? '')
        setProfileCompany(profile?.company_name ?? '')
        setProfileLoaded(true)
      }
      // Fetch project pricing
      try {
        const priceRes = await fetch('/api/pay-project?type=video')
        if (priceRes.ok) {
          const priceData = await priceRes.json()
          setProjectPrice(priceData)
        }
      } catch {}
      // Fetch trial status
      try {
        const trialRes = await fetch('/api/trial-status')
        if (trialRes.ok) {
          const trialData = await trialRes.json()
          setTrialStatus(trialData)
        }
      } catch {}
    }
    loadData()

    // --- Duplicate: load video data from ?duplicate= param ---
    const duplicateId = new URLSearchParams(window.location.search).get('duplicate')
    if (duplicateId) {
      ;(async () => {
        const supabase = createClient()
        const { data: vid } = await supabase
          .from('videos')
          .select('script, title')
          .eq('id', duplicateId)
          .single()
        if (vid?.script) {
          const script = vid.script as any
          const input = script._pipeline_input
          if (input) {
            if (input.policyData) {
              if (input.policyData.deathBenefit) {
                setExtractedData(input.policyData)
              } else {
                setGeneralData(input.policyData)
              }
            }
            if (input.voiceId) setSelectedVoice(input.voiceId)
            if (input.styleId) setSelectedStyle(input.styleId)
            if (input.customStylePrompt) setCustomStylePrompt(input.customStylePrompt)
            if (input.scenes && Array.isArray(input.scenes)) {
              setEditableScenes(input.scenes)
            }
            setReviewReady(true)
          } else if (Array.isArray(script)) {
            setEditableScenes(script.map((s: any, i: number) => ({
              scene: i + 1,
              title: s.title || '',
              slidePrompt: s.slidePrompt || '',
              narration: s.narration || '',
            })))
          }
        }
      })()
      // Clear the URL param without reload
      window.history.replaceState({}, '', '/create')
    }

    // --- Draft restore: check localStorage ---
    if (!duplicateId) {
      try {
        const saved = localStorage.getItem(DRAFT_KEY)
        if (saved) {
          const draft = JSON.parse(saved)
          if (draft.savedAt) {
            setDraftBanner(new Date(draft.savedAt).toLocaleString())
          }
        }
      } catch {}
    }
  }, [])

  // --- Auto-save draft (debounced 1s after last change) ---
  useEffect(() => {
    // Don't save during generation or if on the done step
    if (step === 'generating' || step === 'done') return
    // Only save if there is meaningful data
    if (!extractedData && !generalData && editableScenes.length === 0) return

    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current)
    draftSaveTimer.current = setTimeout(() => {
      try {
        const draft = {
          extractedData,
          generalData,
          editableScenes,
          selectedVoice,
          selectedStyle,
          step,
          savedAt: new Date().toISOString(),
        }
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      } catch {}
    }, 1000)

    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current)
    }
  }, [extractedData, generalData, editableScenes, selectedVoice, selectedStyle, step])

  function restoreDraft() {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (!saved) return
      const draft = JSON.parse(saved)
      if (draft.extractedData) setExtractedData(draft.extractedData)
      if (draft.generalData) setGeneralData(draft.generalData)
      if (draft.editableScenes) setEditableScenes(draft.editableScenes)
      if (draft.selectedVoice) setSelectedVoice(draft.selectedVoice)
      if (draft.selectedStyle) setSelectedStyle(draft.selectedStyle)
      if (draft.step) setStep(draft.step)
      if (draft.extractedData || draft.generalData) setReviewReady(true)
    } catch {}
    setDraftBanner(null)
  }

  function discardDraft() {
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
    setDraftBanner(null)
  }

  const ACCEPTED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint']
  const SLIDE_EXTENSIONS = ['.pptx', '.ppt']

  const isSlideFile = useCallback((f: File) => {
    return SLIDE_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext)) ||
      f.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      f.type === 'application/vnd.ms-powerpoint'
  }, [])

  const handleFileSelect = useCallback((selectedFile: File) => {
    const validType = ACCEPTED_TYPES.includes(selectedFile.type) || SLIDE_EXTENSIONS.some(ext => selectedFile.name.toLowerCase().endsWith(ext))
    if (!validType) { setError('Please upload a PDF or PowerPoint file'); return }
    if (selectedFile.size > 50 * 1024 * 1024) { setError('File must be under 50MB'); return }
    setFile(selectedFile)
    if (isSlideFile(selectedFile)) setUploadMode('narrate')
    else setUploadMode('summarize')
    setError(null)
  }, [isSlideFile])

  const handleMultiFileSelect = useCallback((selectedFiles: FileList | File[]) => {
    const newFiles: File[] = []
    let hasSlides = false
    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i]
      const validType = ACCEPTED_TYPES.includes(f.type) || SLIDE_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
      if (!validType) { setError('Please upload PDF or PowerPoint files'); return }
      if (f.size > 50 * 1024 * 1024) { setError('Each file must be under 50MB'); return }
      newFiles.push(f)
      if (isSlideFile(f)) hasSlides = true
    }
    setFiles(prev => [...prev, ...newFiles])
    if (newFiles.length === 1 && files.length === 0) {
      setFile(newFiles[0])
    }
    if (hasSlides) setUploadMode('narrate')
    setError(null)
  }, [files.length, isSlideFile])

  function handleRemoveFile(index: number) {
    setFiles(prev => {
      const updated = prev.filter((_, i) => i !== index)
      // Keep single file in sync
      if (updated.length === 1) setFile(updated[0])
      else if (updated.length === 0) setFile(null)
      return updated
    })
  }

  async function handleExtract() {
    // Multi-doc extraction
    if (files.length > 1) {
      setStep('extracting')
      setError(null)
      try {
        const results = await Promise.all(
          files.map(async (f) => {
            const formData = new FormData()
            formData.append('file', f)
            const res = await fetch('/api/extract', { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || `Extraction failed for ${f.name}`)
            return data.general as ExtractedData
          })
        )
        setMultiDocData(results)
        // Set the first doc as the active general data for backward compat
        setGeneralData(results[0])
        setExtractedData(null)
        setReviewReady(true)
        setStep('upload')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Extraction failed')
        setStep('upload')
      }
      return
    }

    // Single file extraction (original flow)
    if (!file) return
    setStep('extracting')
    setError(null)
    try {
      // If narrate-only mode with a slide deck, convert slides to images in parallel with extraction
      let convertPromise: Promise<string[]> | null = null
      if (uploadMode === 'narrate') {
        const convertForm = new FormData()
        convertForm.append('file', file)
        convertPromise = fetch('/api/convert-slides', { method: 'POST', body: convertForm })
          .then(async (r) => {
            const d = await r.json()
            if (!r.ok) throw new Error(d.error || 'Slide conversion failed')
            return d.slides as string[]
          })
      }

      const formData = new FormData()
      formData.append('file', file)
      const extractUrl = uploadMode !== 'summarize' ? `/api/extract?mode=${uploadMode}` : '/api/extract'
      const res = await fetch(extractUrl, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')

      // If insurance data with meaningful values exists, use it; otherwise use general
      if (data.insurance && data.insurance.deathBenefit > 0) {
        setExtractedData(data.insurance)
        setGeneralData(null)
      } else {
        setGeneralData(data.general)
        setExtractedData(null)
      }

      // Wait for slide conversion if narrate-only
      if (convertPromise) {
        try {
          const slideImages = await convertPromise
          setOriginalSlideImages(slideImages)
          console.log(`[create] Converted ${slideImages.length} slide images for narrate-only mode`)
        } catch (err) {
          console.error('[create] Slide conversion failed, falling back to redesign:', err)
          setError('Slide conversion failed — your slides will be redesigned with AI instead.')
          setUploadMode('summarize')
          setOriginalSlideImages([])
        }
      }

      setMultiDocData([])
      setReviewReady(true)
      setStep('upload')
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
      setReviewReady(true)
      setStep('upload')
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
      setReviewReady(true)
      setStep('upload')
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
  }, [step])

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
  }, [step])

  // Auto-scroll to top when step changes so new content is always visible
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  // Determine which data format we're working with
  const activeData = extractedData || generalData
  const isGeneralData = !extractedData && !!generalData

  // Smart detail level recommendation based on data complexity
  useEffect(() => {
    if (!activeData) return
    let rec: 'quick' | 'standard' | 'detailed' = 'standard'

    if (extractedData) {
      const ins = extractedData as any
      const projCount = ins.cashValueProjections?.length ?? 0
      const riderCount = ins.riders?.length ?? 0
      if (projCount > 5 && riderCount > 3) rec = 'detailed'
      else if (projCount <= 2 && riderCount <= 1) rec = 'quick'
    } else if (generalData) {
      const gen = generalData as any
      const metricCount = gen.keyMetrics?.length ?? 0
      const sectionCount = gen.sections?.length ?? 0
      if (metricCount <= 3 && sectionCount <= 2) rec = 'quick'
      else if (metricCount > 8 || sectionCount > 5) rec = 'detailed'
    }

    if (inputTab === 'research') rec = 'detailed'
    if (inputTab === 'idea' && rec === 'detailed') rec = 'standard'

    setRecommendedLevel(rec)
    setDetailLevel(rec)
    setDetailedMode(rec === 'detailed')
  }, [activeData, extractedData, generalData, inputTab])

  async function handleGenerateScript() {
    setStep('script')
    setScriptGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyData: multiDocData.length > 1 ? multiDocData : activeData,
          brandId: null,
          detailed: detailedMode,
          comparisonMode: multiDocData.length > 1,
          comparisonNotes: comparisonNotes || undefined,
          purpose: videoPurpose.trim() || undefined,
          uploadMode,
          industry: selectedIndustry,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Script generation failed')
      const scenes = data.scenes as { scene: number; title: string; slidePrompt: string; narration: string }[]
      setEditableScenes(scenes)
    } catch (err) {
      console.error('[create] Script generation failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate script')
      // Stay on script step so user sees the error + retry button
    } finally {
      setScriptGenerating(false)
    }
  }

  function prepareSlidePreview() {
    // Content preview only — no Gemini image generation
    // Slides are generated during final video creation
    const scenes = editableScenes.length > 0 ? editableScenes : []
    if (scenes.length > 0) {
      setSlideCount(scenes.length)
      setGeneratedScenes(scenes)
      setSlideLabels(scenes.map(s => ({ title: s.title, content: s.slidePrompt?.slice(0, 80) ?? '' })))
    }
  }

  // Edit slide state
  const [editingSlide, setEditingSlide] = useState<number | null>(null)
  const [editInstruction, setEditInstruction] = useState('')
  const [editingSlideLoading, setEditingSlideLoading] = useState(false)

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
          brandId: null,
          slidePrompt: generatedScenes[index]?.slidePrompt,
          previousSlideBase64: slides[0] || undefined,
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

  async function handleEditSlide(index: number) {
    if (!editInstruction.trim() || !slides[index]) return
    setEditingSlideLoading(true)
    try {
      const res = await fetch('/api/edit-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentSlideBase64: slides[index],
          editInstruction: editInstruction.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const newSlides = [...slides]
      newSlides[index] = data.image
      setSlides(newSlides)
      setEditingSlide(null)
      setEditInstruction('')
    } catch (err) {
      console.error(`Slide ${index + 1} edit failed:`, err)
    } finally {
      setEditingSlideLoading(false)
    }
  }

  function handleDeleteSlide(index: number) {
    const scenes = editableScenes.length > 0 ? editableScenes : generatedScenes
    if (scenes.length <= 2) return
    const newScenes = scenes.filter((_: any, i: number) => i !== index)
    if (editableScenes.length > 0) setEditableScenes(newScenes)
    else setGeneratedScenes(newScenes)
    const newSlides = slides.filter((_, i) => i !== index)
    setSlides(newSlides)
    const newLabels = slideLabels.filter((_, i) => i !== index)
    setSlideLabels(newLabels)
    setSlideCount(prev => prev - 1)
  }

  async function handlePreviewVoice(voiceId: string) {
    if (playingVoice === voiceId) {
      audioRef.current?.pause()
      setPlayingVoice(null)
      return
    }
    if (audioRef.current) audioRef.current.pause()

    // Try to use the first sentence of the user's actual script
    const firstNarration = editableScenes?.[0]?.narration ?? ''
    const firstSentence = firstNarration.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? ''

    if (firstSentence && firstSentence.length > 10) {
      // Use the API to generate a preview with their actual script
      setPlayingVoice(voiceId)
      try {
        const res = await fetch('/api/voice-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceId, text: firstSentence }),
        })
        if (res.ok) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audio.onended = () => { setPlayingVoice(null); URL.revokeObjectURL(url) }
          audio.play()
          audioRef.current = audio
          return
        }
      } catch {}
      // Fall through to generic preview on error
      setPlayingVoice(null)
    }

    // Fallback: generic preview clip
    const audio = new Audio(`/voice-previews/${voiceId}.mp3`)
    audio.onended = () => setPlayingVoice(null)
    audio.play()
    audioRef.current = audio
    setPlayingVoice(voiceId)
  }

  async function handlePreviewSlide() {
    if (!activeData) return
    setPreviewLoading(true)
    setPreviewSlide(null)
    try {
      const res = await fetch('/api/preview-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyData: activeData,
          styleId: selectedStyle,
          customStylePrompt: customStylePrompt || undefined,
          brandId: null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setPreviewSlide(data.image)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleAssetUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    const remaining = 5 - assets.length
    const toUpload = Array.from(files).slice(0, remaining)
    if (toUpload.length === 0) return

    setAssetUploading(true)
    for (const f of toUpload) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) continue
      if (f.size > 10 * 1024 * 1024) continue

      const formData = new FormData()
      formData.append('file', f)
      formData.append('tag', 'product')
      try {
        const res = await fetch('/api/upload-asset', { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          setAssets(prev => [...prev, { url: data.url, tag: 'product', name: f.name }])
        }
      } catch { /* skip failed uploads */ }
    }
    setAssetUploading(false)
  }

  function removeAsset(index: number) {
    setAssets(prev => prev.filter((_, i) => i !== index))
  }

  function updateAssetTag(index: number, tag: string) {
    setAssets(prev => prev.map((a, i) => i === index ? { ...a, tag } : a))
  }

  const [generating, setGenerating] = useState(false)

  async function handleGenerate() {
    if (!activeData) return
    if (generating) return // Prevent duplicate submissions

    // GUARD: Purpose is required
    if (!videoPurpose.trim()) {
      setError('Please describe what this video should accomplish before generating.')
      return
    }

    // GUARD: Minimum content check
    const data = activeData as any
    const hasEnoughContent = (data.sections?.length > 0) || (data.keyMetrics?.length > 0) || (data.bulletPoints?.length > 0) || data.policyType || (editableScenes?.length > 0)
    if (!hasEnoughContent) {
      setError('Not enough content extracted. Try pasting more text or uploading a different document.')
      return
    }

    // Option B: Check profile completeness before first video
    if (profileLoaded && !profileName.trim() && !profileCompany.trim()) {
      setShowProfileModal(true)
      return
    }

    setGenerating(true)

    // Clear draft when generation starts
    try { localStorage.removeItem(DRAFT_KEY) } catch {}

    setStep('generating')
    setError(null)

    try {
      // 1. Create the video record
      const assetPayload = assets.length > 0 ? assets.map(a => ({ url: a.url, tag: a.tag })) : undefined
      const createRes = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyData: activeData,
          brandId: null,
          voiceId: selectedVoice,
          assets: assetPayload,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        // If trial exhausted, refresh trial status and show paywall
        if (createData.code === 'TRIAL_EXHAUSTED' || createData.code === 'PAYMENT_FAILED' || createData.code === 'NO_PAYMENT_METHOD') {
          setTrialStatus(prev => prev ? { ...prev, trialExhausted: true, videosRemaining: 0, freeVideosRemaining: 0, videosUsed: 5 } : prev)
        }
        throw new Error(createData.error || 'Failed to create video')
      }

      const approvedSlides = slides.filter(Boolean) as string[]

      // In narrate-only mode, use the converted original slide images
      const finalApprovedSlides = uploadMode === 'narrate' && originalSlideImages.length > 0
        ? originalSlideImages.map(b64 => `data:image/png;base64,${b64}`)
        : slidesMode ? uploadedSlides : (approvedSlides.length >= 4 ? approvedSlides : undefined)

      const supabase = createClient()
      await supabase.from('videos').update({
        script: {
          _pipeline_input: {
            policyData: activeData,
            brandId: null,
            voiceId: selectedVoice,
            styleId: uploadMode === 'narrate' ? undefined : selectedStyle,
            customStylePrompt: uploadMode === 'narrate' ? undefined : (customStylePrompt || undefined),
            aiMusic: true,
            approvedSlides: finalApprovedSlides,
            scenes: editableScenes.length > 0 ? editableScenes : generatedScenes,
            assets: assetPayload,
            purpose: videoPurpose.trim() || undefined,
            uploadMode,
            industry: selectedIndustry,
          },
        },
      }).eq('id', createData.id)

      // 2. Navigate to video detail page — it triggers the pipeline directly
      // (calling generate-video from the client is proven reliable)
      router.push(`/videos/${createData.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setStep('options')
    } finally {
      setGenerating(false)
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

      {/* Draft restore banner */}
      {draftBanner && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', marginBottom: 16, borderRadius: 10,
          background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
          border: '1px solid #93c5fd', fontSize: 13,
        }}>
          <span>You have an unsaved draft from {draftBanner}.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={restoreDraft} className="btn btn-primary btn-sm">Resume</button>
            <button onClick={discardDraft} className="btn btn-soft btn-sm">Discard</button>
          </div>
        </div>
      )}

      {/* Step: Upload / Text / Idea */}
      {step === 'upload' && (
        <>
        <div className="wizard-card">
          <h2>What would you like to explain?</h2>
          <p className="wizard-sub">Drop in your document and we&apos;ll handle the rest. Your video will be ready in about 2 minutes.</p>

          {/* Input method cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {([
              { key: 'upload' as InputTab, title: 'Upload Document', desc: 'PDF, PPTX, images', icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker, #2d7a4f)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
              )},
              { key: 'text' as InputTab, title: 'Write Your Own', desc: 'Paste text, notes, bullets', icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--lilac, #C4B5FD)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              )},
              { key: 'idea' as InputTab, title: 'Start from Idea', desc: 'Describe a topic, AI creates content', icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--peach, #FBBF77)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
              )},
              { key: 'url' as InputTab, title: 'Website Scraper', desc: 'Enter a URL, we extract it', icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sky, #7DD3FC)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              )},
              { key: 'research' as InputTab, title: 'AI Research', desc: 'AI researches and compiles', icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--lilac, #C4B5FD)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              )},
              ...(['professional', 'active', 'agency'].includes(userPlan.toLowerCase())
                ? [{ key: 'proposal' as InputTab, title: 'Proposal Builder', desc: 'Create a client proposal', icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--peach, #FBBF77)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
                )}]
                : []),
              { key: 'slides' as InputTab, title: 'Narrate Slides', desc: 'Upload slides, AI adds voiceover', icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sky, #7DD3FC)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              )},
            ]).map(card => (
              <button
                key={card.key}
                onClick={() => setInputTab(card.key)}
                style={{
                  background: inputTab === card.key ? 'rgba(199,232,168,0.05)' : 'white',
                  border: `1px solid ${inputTab === card.key ? 'var(--mint-deep, #6DBE47)' : 'var(--border-light, #e2e8f0)'}`,
                  borderRadius: 10,
                  padding: 24,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, background: inputTab === card.key ? 'rgba(199,232,168,0.15)' : 'var(--bg-soft, #f8fafc)' }}>
                  {card.icon}
                </span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink, #1a1a2e)' }}>{card.title}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-soft, #64748b)', lineHeight: 1.4 }}>{card.desc}</span>
              </button>
            ))}
          </div>

          {/* Video Purpose — required, shapes extraction + script */}
          <div style={{ marginBottom: 20 }}>
            <label className="input-label">
              What should this video accomplish? <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 8, lineHeight: 1.5 }}>
              This shapes the narrative, tone, and emphasis of your video.
            </div>
            <input
              type="text"
              className="input"
              placeholder="e.g. Convince my client to sign, Train new hires, Summarize for investors, Explain this to me simply"
              value={videoPurpose}
              onChange={e => setVideoPurpose(e.target.value)}
              required
            />
          </div>

          {/* Tab: Upload PDF */}
          {inputTab === 'upload' && (
            <div>
              <div
                className={`upload-zone${dragOver ? ' dragover' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOver(false)
                  const droppedFiles = e.dataTransfer.files
                  if (droppedFiles.length > 0) handleMultiFileSelect(droppedFiles)
                }}
              >
                {files.length > 0 ? (
                  <>
                    {/* File list */}
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {files.map((f, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: 'var(--surface-raised, #f8fafc)', borderRadius: 8,
                          padding: '10px 14px', border: '1px solid var(--border, #e2e8f0)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>{(f.size / 1024 / 1024).toFixed(1)} MB</div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveFile(i) }}
                            className="btn btn-soft btn-sm"
                            style={{ padding: '4px 10px', fontSize: 12, minWidth: 'auto' }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* What would you like to do with this file? — must be selected before action buttons */}
                    <div style={{
                      marginTop: 16,
                      padding: '20px',
                      background: 'var(--surface-raised, #f8fafc)',
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: 10,
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: 'var(--ink)' }}>
                        What would you like to do with this file?
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                        {([
                          // Only show "narrate only" for PPTX files — doesn't make sense for PDFs/text
                          ...(files.some(f => isSlideFile(f)) ? [{
                            mode: 'narrate' as const,
                            icon: '\uD83C\uDF99\uFE0F',
                            title: 'Add narration only',
                            desc: 'Keep your slides exactly as they are. We add professional voiceover and background music — no visual changes.',
                          }] : []),
                          {
                            mode: 'redesign' as const,
                            icon: '\uD83C\uDFA8',
                            title: 'Redesign every slide + add narration',
                            desc: 'Keep all your content but redesign each slide with AI using a new template style. Every slide gets a fresh look — nothing is removed.',
                          },
                          {
                            mode: 'summarize' as const,
                            icon: '\u2728',
                            title: 'Summarize, redesign + add narration',
                            desc: 'AI reads your document, pulls out the key points, and creates a concise set of new slides. Best for long documents, reports, and proposals.',
                          },
                        ]).map(opt => (
                          <button
                            key={opt.mode}
                            onClick={() => setUploadMode(opt.mode)}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
                              border: uploadMode === opt.mode ? '2px solid var(--accent, #4A90D9)' : '1px solid var(--border)',
                              borderRadius: 10,
                              background: uploadMode === opt.mode ? 'rgba(74,144,217,0.06)' : 'white',
                              cursor: 'pointer', textAlign: 'left', width: '100%',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span style={{ fontSize: 22, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{opt.icon}</span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 3 }}>
                                {opt.title}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                                {opt.desc}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Actions — below options so user picks a mode first */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
                      <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
                        + Add more files
                        <input type="file" accept=".pdf,.pptx,.ppt" multiple className="hidden" style={{ display: 'none' }} onChange={(e) => { if (e.target.files) handleMultiFileSelect(e.target.files); e.target.value = '' }} />
                      </label>
                      <button onClick={() => { setFiles([]); setFile(null); setError(null); setUploadMode('summarize') }} className="btn btn-soft btn-sm">Clear all</button>
                      <button onClick={handleExtract} className="btn btn-primary btn-sm" disabled={!videoPurpose.trim()}>
                        {uploadMode === 'narrate' ? 'Narrate My Slides' : files.length > 1 ? 'Extract & Compare' : 'Extract Data'} &rarr;
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="upload-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Drop your documents here</div>
                    <div style={{ fontSize: 14, color: 'var(--ink-light)', marginBottom: 18 }}>PDF or PowerPoint up to 50 MB. Upload multiple to compare.</div>
                    <label className="btn btn-mint btn-sm" style={{ cursor: 'pointer' }}>
                      Choose Files
                      <input type="file" accept=".pdf,.pptx,.ppt" multiple className="hidden" style={{ display: 'none' }} onChange={(e) => { if (e.target.files) handleMultiFileSelect(e.target.files); e.target.value = '' }} />
                    </label>
                  </>
                )}
              </div>
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
                  disabled={!rawText.trim() || textExtracting || !videoPurpose.trim()}
                  className="btn btn-primary"
                >
                  {textExtracting ? 'Extracting...' : 'Extract & Continue \u2192'}
                </button>
              </div>
            </div>
          )}

          {/* Tab: From URL */}
          {inputTab === 'url' && (
            <div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Page URL</label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
                  We&apos;ll extract the page content and structure it for your video.
                </div>
              </div>
              <div className="wizard-actions" style={{ marginTop: 16 }}>
                <button
                  onClick={async () => {
                    if (!urlInput.trim()) return
                    let url = urlInput.trim()
                    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
                    setUrlInput(url)
                    setTextExtracting(true)
                    setStep('extracting')
                    setError(null)
                    try {
                      const res = await fetch('/api/extract-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url }),
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error || 'Extraction failed')
                      // Separate suggestedTheme from content data
                      const { suggestedTheme: theme, ...contentData } = data
                      setGeneralData(contentData)
                      setExtractedData(null)
                      setReviewReady(true)
                      // If theme was generated, store it and generate a preview
                      if (theme?.prompt) {
                        setSuggestedTheme(theme)
                        setThemeAccepted(false)
                        // Generate a preview slide in the background
                        setGeneratingThemePreview(true)
                        fetch('/api/style-previews', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ prompt: theme.prompt, name: theme.name }),
                        }).then(r => r.json()).then(preview => {
                          if (preview.previewUrl) {
                            setSuggestedTheme(prev => prev ? { ...prev, previewUrl: preview.previewUrl } : null)
                          }
                        }).catch(() => {}).finally(() => setGeneratingThemePreview(false))
                      }
                      setStep('upload')
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'URL extraction failed')
                      setStep('upload')
                    } finally {
                      setTextExtracting(false)
                    }
                  }}
                  disabled={!urlInput.trim() || textExtracting || !videoPurpose.trim()}
                  className="btn btn-primary"
                >
                  {textExtracting ? 'Extracting...' : 'Extract & Continue \u2192'}
                </button>
              </div>
            </div>
          )}

          {/* Tab: Narrate Slides */}
          {inputTab === 'slides' && (
            <div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Upload your presentation slides</label>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
                  Upload images of your slides (PNG, JPG) or a PowerPoint file. We&apos;ll add AI narration and turn them into a video — no new slides generated.
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setDragOver(false)
                    const droppedFiles = Array.from(e.dataTransfer.files)
                    droppedFiles.forEach(f => {
                      if (f.type.startsWith('image/')) {
                        const reader = new FileReader()
                        reader.onload = () => setUploadedSlides(prev => [...prev, reader.result as string])
                        reader.readAsDataURL(f)
                      }
                    })
                  }}
                  style={{
                    border: dragOver ? '2px solid var(--mint)' : '2px dashed var(--border)',
                    borderRadius: 10, padding: '32px 24px', textAlign: 'center',
                    background: dragOver ? 'rgba(168,240,212,0.1)' : 'var(--bg-soft)',
                    cursor: 'pointer', marginBottom: 16,
                  }}
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*'
                    input.multiple = true
                    input.onchange = (e) => {
                      const selectedFiles = Array.from((e.target as HTMLInputElement).files ?? [])
                      selectedFiles.forEach(f => {
                        const reader = new FileReader()
                        reader.onload = () => setUploadedSlides(prev => [...prev, reader.result as string])
                        reader.readAsDataURL(f)
                      })
                    }
                    input.click()
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>+</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Drop slide images here or click to upload</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>PNG, JPG — upload in order (slide 1 first)</div>
                </div>

                {/* Uploaded slides preview */}
                {uploadedSlides.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {uploadedSlides.map((slide, i) => (
                      <div key={i} style={{ position: 'relative', width: 120, height: 68, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                        <img src={slide} alt={`Slide ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', bottom: 2, left: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>{i + 1}</div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setUploadedSlides(prev => prev.filter((_, j) => j !== i)) }}
                          style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >x</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="wizard-actions" style={{ marginTop: 16 }}>
                <button
                  onClick={async () => {
                    if (uploadedSlides.length < 2) { setError('Please upload at least 2 slides'); return }
                    setSlidesMode(true)
                    // Create a general data structure from the slides for script generation
                    setGeneralData({
                      title: 'Presentation Voiceover',
                      subtitle: `${uploadedSlides.length} slides uploaded`,
                      source: 'User uploaded slides',
                      keyMetrics: [],
                      sections: uploadedSlides.map((_, i) => ({ title: `Slide ${i + 1}`, content: `Content for slide ${i + 1}` })),
                      bulletPoints: [],
                    } as any)
                    setExtractedData(null)
                    setReviewReady(true)
                  }}
                  disabled={uploadedSlides.length < 2}
                  className="btn btn-primary"
                >
                  {uploadedSlides.length < 2 ? 'Upload at least 2 slides' : `Continue with ${uploadedSlides.length} slides →`}
                </button>
              </div>
            </div>
          )}

          {/* Tab: AI Research */}
          {inputTab === 'research' && (
            <div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="input-label">What should we research?</label>
                <textarea
                  className="input"
                  style={{ minHeight: 80, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
                  placeholder="e.g., Benefits of whole life insurance vs term life&#10;or: Solar energy market trends 2025&#10;or: How AI is transforming healthcare"
                  value={researchTopic}
                  onChange={(e) => setResearchTopic(e.target.value)}
                />
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
                  AI will research this topic, find real data and statistics, and structure it for your video.
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Research Depth</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setResearchDepth('quick')}
                    className={`btn ${researchDepth === 'quick' ? 'btn-primary' : 'btn-soft'}`}
                    type="button"
                    style={{ flex: 1 }}
                  >
                    Quick (4-6 data points)
                  </button>
                  <button
                    onClick={() => setResearchDepth('detailed')}
                    className={`btn ${researchDepth === 'detailed' ? 'btn-primary' : 'btn-soft'}`}
                    type="button"
                    style={{ flex: 1 }}
                  >
                    Detailed (8-12 data points)
                  </button>
                </div>
              </div>
              <div className="wizard-actions" style={{ marginTop: 16 }}>
                <button
                  onClick={async () => {
                    if (!researchTopic.trim()) return
                    setResearchLoading(true)
                    setStep('extracting')
                    setError(null)
                    try {
                      const res = await fetch('/api/ai-research', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ topic: researchTopic, depth: researchDepth }),
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error || 'Research failed')
                      setGeneralData(data.research)
                      setExtractedData(null)
                      setReviewReady(true)
                      setStep('upload')
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Research failed')
                      setStep('upload')
                    } finally {
                      setResearchLoading(false)
                    }
                  }}
                  disabled={!researchTopic.trim() || researchLoading || !videoPurpose.trim()}
                  className="btn btn-primary"
                >
                  {researchLoading ? 'Researching...' : 'Research & Continue \u2192'}
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
                  disabled={!ideaTopic.trim() || !ideaAudience.trim() || textExtracting || !videoPurpose.trim()}
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
                  <button onClick={() => { setReviewReady(true) }} className="btn btn-primary btn-lg">
                    Continue to explainer &rarr;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Inline review after extraction */}
        {/* Suggested Theme from URL */}
        {reviewReady && suggestedTheme && !themeAccepted && (
          <div className="wizard-card" style={{ marginTop: 20, border: '2px solid var(--mint)', background: 'rgba(168,240,212,0.04)' }}>
            <h2 style={{ margin: '0 0 4px' }}>We designed a theme from this website</h2>
            <p className="wizard-sub">Based on the site&apos;s colors and design, we created a custom slide theme. Want to use it?</p>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: 16 }}>
              <div style={{ flex: 1 }}>
                {generatingThemePreview ? (
                  <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 10, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-light)' }}>
                    <div className="spinner" style={{ marginRight: 8 }} /> Generating preview...
                  </div>
                ) : suggestedTheme.previewUrl ? (
                  <img src={suggestedTheme.previewUrl} alt={suggestedTheme.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border-light)' }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 10, background: suggestedTheme.colors?.background || '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: suggestedTheme.colors?.text || '#fff', fontWeight: 700, fontSize: 18, border: '1px solid var(--border-light)' }}>
                    {suggestedTheme.name}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{suggestedTheme.name}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 12, lineHeight: 1.5 }}>{suggestedTheme.description}</div>
                {suggestedTheme.colors && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                    {Object.entries(suggestedTheme.colors).map(([key, hex]) => (
                      <div key={key} style={{ width: 28, height: 28, borderRadius: 6, background: hex as string, border: '1px solid var(--border-light)' }} title={`${key}: ${hex}`} />
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={async () => {
                      setThemeAccepted(true)
                      setSelectedStyle(`custom-url-theme`)
                      setCustomStylePrompt(suggestedTheme.prompt)
                      // Save to template library
                      try {
                        await fetch('/api/templates', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: suggestedTheme.name,
                            description: suggestedTheme.description,
                            prompt: suggestedTheme.prompt,
                            previewUrl: suggestedTheme.previewUrl || null,
                          }),
                        })
                      } catch {}
                    }}
                    className="btn btn-primary"
                  >
                    Use this theme
                  </button>
                  <button onClick={() => setSuggestedTheme(null)} className="btn btn-soft">
                    No thanks
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {themeAccepted && suggestedTheme && (
          <div style={{ marginTop: 12, padding: '10px 16px', background: 'rgba(168,240,212,0.1)', borderRadius: 10, border: '1px solid var(--mint)', fontSize: 13, color: 'var(--ink)' }}>
            Theme &ldquo;{suggestedTheme.name}&rdquo; selected and saved to your template library.
          </div>
        )}

        {reviewReady && activeData && (
          <div className="wizard-card" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Extracted Content</h2>
              <button onClick={() => setReviewEditing(!reviewEditing)} className="btn btn-soft btn-sm">
                {reviewEditing ? 'Done Editing' : 'Edit'}
              </button>
            </div>

            {multiDocData.length > 1 ? (
              <>
                <p className="wizard-sub">Comparing {multiDocData.length} documents. Key differences highlighted below.</p>
                {/* Comparison summary card */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(168,240,212,0.12), rgba(196,181,253,0.12))',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: 12, padding: '18px 22px', marginBottom: 20,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker, #4a7c59)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Comparison Summary
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                    {(() => {
                      const titles = multiDocData.map(d => d.title).filter(Boolean)
                      const allMetricLabels = [...new Set(multiDocData.flatMap(d => d.keyMetrics.map(m => m.label)))]
                      const diffs: string[] = []
                      allMetricLabels.forEach(label => {
                        const values = multiDocData.map(d => {
                          const m = d.keyMetrics.find(km => km.label === label)
                          return m ? m.value : 'N/A'
                        })
                        const unique = [...new Set(values)]
                        if (unique.length > 1) {
                          diffs.push(`${label}: ${values.join(' vs ')}`)
                        }
                      })
                      return (
                        <>
                          <div style={{ marginBottom: 6 }}><strong>Documents:</strong> {titles.join(', ') || `${multiDocData.length} documents`}</div>
                          {diffs.length > 0 ? (
                            <>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>Key differences:</div>
                              <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {diffs.slice(0, 8).map((d, i) => <li key={i}>{d}</li>)}
                              </ul>
                            </>
                          ) : (
                            <div>No major metric differences detected between documents.</div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>

                {/* Each document as collapsible */}
                {multiDocData.map((doc, docIdx) => (
                  <details key={docIdx} style={{
                    marginBottom: 12, border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: 10, overflow: 'hidden',
                  }} open={docIdx === 0}>
                    <summary style={{
                      padding: '14px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 15,
                      background: 'var(--surface-raised, #f8fafc)',
                      display: 'flex', alignItems: 'center', gap: 10, listStyle: 'none',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      {doc.title || `Document ${docIdx + 1}`}
                    </summary>
                    <div style={{ padding: '16px 18px' }}>
                      {doc.keyMetrics.length > 0 && (
                        <div className="extracted-grid" style={{ marginBottom: 12 }}>
                          {doc.keyMetrics.map((m, i) => (
                            <div key={i} className="data-card">
                              <div className="data-label">{m.label}</div>
                              <div className={`data-value${m.highlight ? ' mint' : ''}`}>{m.value}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {doc.sections.length > 0 && (
                        <div style={{ display: 'grid', gap: 8 }}>
                          {doc.sections.map((s, i) => (
                            <div key={i} style={{ background: 'var(--surface-raised, #f8fafc)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border, #e2e8f0)' }}>
                              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.title}</div>
                              <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{s.content}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                ))}

                {/* Comparison notes */}
                <div style={{ marginTop: 20, marginBottom: 8 }}>
                  <label className="input-label">Add instructions for the comparison (optional)</label>
                  <textarea
                    className="input"
                    style={{ minHeight: 80, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
                    placeholder="e.g., Focus on premium differences, highlight Plan A's better cash value..."
                    value={comparisonNotes}
                    onChange={(e) => setComparisonNotes(e.target.value)}
                  />
                </div>
              </>
            ) : extractedData && !isGeneralData ? (
              <>
                <div className="extracted-grid">
                  {[
                    { label: 'Policy Type', key: 'policyType', value: extractedData.policyType },
                    { label: 'Source', key: 'carrier', value: extractedData.carrier },
                    { label: 'Insured', key: 'insuredName', value: extractedData.insuredName },
                    { label: 'Death Benefit', key: 'deathBenefit', value: String(extractedData.deathBenefit), isCurrency: true },
                    { label: 'Annual Premium', key: 'annualPremium', value: String(extractedData.annualPremium), isCurrency: true },
                    { label: 'Payment Mode', key: 'paymentMode', value: extractedData.paymentMode },
                  ].map(field => (
                    <div key={field.key} className="data-card">
                      <div className="data-label">{field.label}</div>
                      {reviewEditing ? (
                        <input
                          className="input"
                          style={{ fontSize: 14, fontWeight: 600, padding: '6px 10px' }}
                          value={field.value}
                          onChange={e => {
                            const val = field.isCurrency ? Number(e.target.value.replace(/[^0-9.]/g, '')) : e.target.value
                            setExtractedData(prev => prev ? { ...prev, [field.key]: val } : prev)
                          }}
                        />
                      ) : (
                        <div className={`data-value${field.isCurrency ? ' mint' : ''}`}>
                          {field.isCurrency ? formatCurrency(Number(field.value) || 0) : field.value}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Riders */}
                <div style={{ marginTop: 24 }}>
                  <div className="data-label" style={{ marginBottom: 10 }}>Riders</div>
                  {reviewEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(extractedData.riders ?? []).map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6 }}>
                          <input
                            className="input"
                            style={{ flex: 1, fontSize: 13, padding: '6px 10px' }}
                            value={r}
                            onChange={e => {
                              const updated = [...(extractedData.riders ?? [])]
                              updated[i] = e.target.value
                              setExtractedData(prev => prev ? { ...prev, riders: updated } : prev)
                            }}
                          />
                          <button className="btn btn-soft btn-sm" onClick={() => {
                            const updated = (extractedData.riders ?? []).filter((_, j) => j !== i)
                            setExtractedData(prev => prev ? { ...prev, riders: updated } : prev)
                          }}>x</button>
                        </div>
                      ))}
                      <button className="btn btn-soft btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => {
                        setExtractedData(prev => prev ? { ...prev, riders: [...(prev.riders ?? []), ''] } : prev)
                      }}>+ Add rider</button>
                    </div>
                  ) : (extractedData.riders ?? []).length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(extractedData.riders ?? []).map((r, i) => (
                        <span key={i} className="tag">{r}</span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--ink-light)' }}>None detected</div>
                  )}
                </div>
              </>
            ) : isGeneralData && generalData ? (
              <>
                <div style={{ marginBottom: 20 }}>
                  {reviewEditing ? (
                    <>
                      <input className="input" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }} value={generalData.title} onChange={e => setGeneralData(prev => prev ? { ...prev, title: e.target.value } : prev)} placeholder="Title" />
                      <input className="input" style={{ fontSize: 14, marginBottom: 6 }} value={generalData.subtitle ?? ''} onChange={e => setGeneralData(prev => prev ? { ...prev, subtitle: e.target.value || null } : prev)} placeholder="Subtitle (optional)" />
                      <input className="input" style={{ fontSize: 13 }} value={generalData.source ?? ''} onChange={e => setGeneralData(prev => prev ? { ...prev, source: e.target.value || null } : prev)} placeholder="Source (optional)" />
                    </>
                  ) : (
                    <>
                      <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{generalData.title}</h3>
                      {generalData.subtitle && <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: 0 }}>{generalData.subtitle}</p>}
                      {generalData.source && <p style={{ fontSize: 13, color: 'var(--ink-light)', margin: '6px 0 0' }}>Source: {generalData.source}</p>}
                    </>
                  )}
                </div>
                {/* Key Metrics */}
                {(generalData.keyMetrics ?? []).length > 0 && (
                  <div className="extracted-grid">
                    {(generalData.keyMetrics ?? []).map((m, i) => (
                      <div key={i} className="data-card">
                        {reviewEditing ? (
                          <>
                            <input className="input" style={{ fontSize: 12, fontWeight: 600, padding: '4px 8px', marginBottom: 4 }} value={m.label} onChange={e => {
                              const updated = [...generalData.keyMetrics]; updated[i] = { ...m, label: e.target.value }; setGeneralData(prev => prev ? { ...prev, keyMetrics: updated } : prev)
                            }} />
                            <input className="input" style={{ fontSize: 14, fontWeight: 700, padding: '4px 8px' }} value={m.value} onChange={e => {
                              const updated = [...generalData.keyMetrics]; updated[i] = { ...m, value: e.target.value }; setGeneralData(prev => prev ? { ...prev, keyMetrics: updated } : prev)
                            }} />
                          </>
                        ) : (
                          <>
                            <div className="data-label">{m.label}</div>
                            <div className={`data-value${m.highlight ? ' mint' : ''}`}>{m.value}</div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* Sections */}
                {(generalData.sections ?? []).length > 0 && (
                  <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
                    {(generalData.sections ?? []).map((s, i) => (
                      <div key={i} style={{ background: 'var(--surface-raised, #f8fafc)', borderRadius: 10, padding: '16px 20px', border: '1px solid var(--border, #e2e8f0)' }}>
                        {reviewEditing ? (
                          <>
                            <input className="input" style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, padding: '4px 8px' }} value={s.title} onChange={e => {
                              const updated = [...generalData.sections]; updated[i] = { ...s, title: e.target.value }; setGeneralData(prev => prev ? { ...prev, sections: updated } : prev)
                            }} />
                            <textarea className="input" style={{ fontSize: 14, lineHeight: 1.6, minHeight: 60, resize: 'vertical', padding: '6px 8px' }} value={s.content} onChange={e => {
                              const updated = [...generalData.sections]; updated[i] = { ...s, content: e.target.value }; setGeneralData(prev => prev ? { ...prev, sections: updated } : prev)
                            }} />
                          </>
                        ) : (
                          <>
                            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{s.title}</div>
                            <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{s.content}</div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* Bullet Points */}
                <div style={{ marginTop: 24 }}>
                  <div className="data-label" style={{ marginBottom: 10 }}>Key Takeaways</div>
                  {reviewEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(generalData.bulletPoints ?? []).map((bp, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6 }}>
                          <input className="input" style={{ flex: 1, fontSize: 13, padding: '6px 10px' }} value={bp} onChange={e => {
                            const updated = [...(generalData.bulletPoints ?? [])]; updated[i] = e.target.value; setGeneralData(prev => prev ? { ...prev, bulletPoints: updated } : prev)
                          }} />
                          <button className="btn btn-soft btn-sm" onClick={() => {
                            const updated = (generalData.bulletPoints ?? []).filter((_, j) => j !== i); setGeneralData(prev => prev ? { ...prev, bulletPoints: updated } : prev)
                          }}>x</button>
                        </div>
                      ))}
                      <button className="btn btn-soft btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => {
                        setGeneralData(prev => prev ? { ...prev, bulletPoints: [...(prev.bulletPoints ?? []), ''] } : prev)
                      }}>+ Add takeaway</button>
                    </div>
                  ) : (generalData.bulletPoints ?? []).length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(generalData.bulletPoints ?? []).map((bp, i) => (
                        <span key={i} className="tag">{bp}</span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--ink-light)' }}>None detected</div>
                  )}
                </div>
              </>
            ) : null}

            <div className="wizard-actions">
              <button onClick={() => { if (confirm('Start over? This will clear all your extracted data and edits.')) { setReviewReady(false); setExtractedData(null); setGeneralData(null); setMultiDocData([]); setEditableScenes([]) } }} className="btn btn-soft">&larr; Start Over</button>
              <button onClick={handleGenerateScript} className="btn btn-primary" disabled={!videoPurpose.trim()}>Generate Script &rarr;</button>
            </div>
          </div>
        )}
        </>
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

      {/* Step: Script */}
      {step === 'script' && (
        <div className="wizard-card">
          <h2>Review your script</h2>
          <p className="wizard-sub">Edit the narration for each scene. This is what the voiceover will say.</p>

          {scriptGenerating ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div className="spinner" style={{ marginBottom: 16 }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Generating your script...</p>
              <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>This usually takes 10-20 seconds</p>
            </div>
          ) : editableScenes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Script generation failed</p>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 20 }}>Please try again or go back to edit your content.</p>
              <div className="wizard-actions" style={{ justifyContent: 'center' }}>
                <button onClick={() => setStep('upload')} className="btn btn-soft">&larr; Back to Review</button>
                <button onClick={handleGenerateScript} className="btn btn-primary">Try Again</button>
              </div>
            </div>
          ) : (
            <>
              {/* Insurance disclaimer notice */}
              {extractedData && editableScenes.some(s => s.narration.toLowerCase().includes('before we begin, please note')) && (
                <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef3c7', borderRadius: 10, border: '1px solid #fbbf24', fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
                  This document was identified as an insurance carrier illustration. A required legal disclaimer slide has been added automatically and cannot be edited. Carrier names have been removed from the narration.
                </div>
              )}
              {editableScenes.map((scene, i) => {
                const isDisclaimer = scene.narration.toLowerCase().includes('before we begin, please note')
                return (
                <div key={i} style={{ marginBottom: 16, background: isDisclaimer ? '#fffbeb' : 'var(--bg-soft)', borderRadius: 10, padding: 16, border: isDisclaimer ? '1px solid #fbbf24' : '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: isDisclaimer ? '#fbbf24' : 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                    {isDisclaimer ? (
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e' }}>Legal Disclaimer (required)</div>
                    ) : (
                      <input
                        type="text"
                        value={scene.title}
                        onChange={e => {
                          const updated = [...editableScenes]
                          updated[i] = { ...updated[i], title: e.target.value }
                          setEditableScenes(updated)
                        }}
                        style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 15, flex: 1, outline: 'none', color: 'var(--ink)' }}
                      />
                    )}
                  </div>
                  <textarea
                    value={scene.narration}
                    onChange={isDisclaimer ? undefined : (e => {
                      const updated = [...editableScenes]
                      updated[i] = { ...updated[i], narration: e.target.value }
                      setEditableScenes(updated)
                    })}
                    readOnly={isDisclaimer}
                    className="input"
                    style={{ minHeight: isDisclaimer ? 80 : 100, resize: isDisclaimer ? 'none' : 'vertical', fontFamily: 'inherit', fontSize: isDisclaimer ? 12 : 14, lineHeight: 1.6, background: isDisclaimer ? '#fef9e7' : undefined, color: isDisclaimer ? '#78590a' : undefined, cursor: isDisclaimer ? 'not-allowed' : undefined }}
                  />
                  {!isDisclaimer && (
                    <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>
                      ~{Math.round(scene.narration.split(/\s+/).length / 2.5)}s narration &middot; {scene.narration.split(/\s+/).length} words
                    </div>
                  )}
                </div>
                )
              })}
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16, textAlign: 'center' }}>
                Total: {editableScenes.length} scenes &middot; ~{Math.round(editableScenes.reduce((sum, s) => sum + s.narration.split(/\s+/).length, 0) / 2.5)}s estimated duration
              </div>
              <div className="wizard-actions">
                <button onClick={() => setStep('upload')} className="btn btn-soft">&larr; Back to Review</button>
                <button onClick={() => setStep('options')} className="btn btn-primary">Next: Final Options &rarr;</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* LEGACY: Old review data in script step — disabled */}
      {false && step === 'script' && (
        <div>
          {/* Multi-document comparison view */}
          {multiDocData.length > 1 && (
            <>
              {/* Comparison summary card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(168,240,212,0.12), rgba(196,181,253,0.12))',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: 12, padding: '18px 22px', marginBottom: 20,
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker, #4a7c59)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Comparison Summary
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                  {(() => {
                    const titles = multiDocData.map(d => d.title).filter(Boolean)
                    const allMetricLabels = [...new Set(multiDocData.flatMap(d => d.keyMetrics.map(m => m.label)))]
                    const diffs: string[] = []
                    allMetricLabels.forEach(label => {
                      const values = multiDocData.map(d => {
                        const m = d.keyMetrics.find(km => km.label === label)
                        return m ? m.value : 'N/A'
                      })
                      const unique = [...new Set(values)]
                      if (unique.length > 1) {
                        diffs.push(`${label}: ${values.join(' vs ')}`)
                      }
                    })
                    return (
                      <>
                        <div style={{ marginBottom: 6 }}><strong>Documents:</strong> {titles.join(', ') || `${multiDocData.length} documents`}</div>
                        {diffs.length > 0 ? (
                          <>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>Key differences:</div>
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {diffs.slice(0, 8).map((d, i) => <li key={i}>{d}</li>)}
                            </ul>
                          </>
                        ) : (
                          <div>No major metric differences detected between documents.</div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* Each document as a collapsible card */}
              {multiDocData.map((doc, docIdx) => (
                <details key={docIdx} style={{
                  marginBottom: 12, border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: 10, overflow: 'hidden',
                }} open={docIdx === 0}>
                  <summary style={{
                    padding: '14px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 15,
                    background: 'var(--surface-raised, #f8fafc)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    listStyle: 'none',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    {doc.title || `Document ${docIdx + 1}`}
                    {doc.source && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--ink-light)', marginLeft: 8 }}>({doc.source})</span>}
                  </summary>
                  <div style={{ padding: '16px 18px' }}>
                    {doc.subtitle && <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 12px' }}>{doc.subtitle}</p>}
                    {doc.keyMetrics.length > 0 && (
                      <div className="extracted-grid" style={{ marginBottom: 12 }}>
                        {doc.keyMetrics.map((m, i) => (
                          <div key={i} className="data-card">
                            <div className="data-label">{m.label}</div>
                            <div className={`data-value${m.highlight ? ' mint' : ''}`}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {doc.sections.length > 0 && (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {doc.sections.map((s, i) => (
                          <div key={i} style={{ background: 'var(--surface-raised, #f8fafc)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border, #e2e8f0)' }}>
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.title}</div>
                            <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{s.content}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {doc.bulletPoints.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {doc.bulletPoints.map((bp, i) => <span key={i} className="tag">{bp}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              ))}

              {/* Comparison instructions textarea */}
              <div style={{ marginTop: 20, marginBottom: 8 }}>
                <label className="input-label">Add instructions for the comparison (optional)</label>
                <textarea
                  className="input"
                  style={{ minHeight: 80, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
                  placeholder="e.g., Focus on premium differences, highlight Plan A's better cash value, mention the client is 45 years old..."
                  value={comparisonNotes}
                  onChange={(e) => setComparisonNotes(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Single-document review (only when not in multi-doc comparison mode) */}
          {/* @ts-ignore — dead code in disabled block */}
          {multiDocData.length <= 1 && extractedData && !isGeneralData && (
            <>
              <div className="extracted-grid">
                <div className="data-card">
                  <div className="data-label">Policy Type</div>
                  <div className="data-value">{extractedData?.policyType}</div>
                </div>
                <div className="data-card">
                  <div className="data-label">Source</div>
                  <div className="data-value">{extractedData?.carrier}</div>
                </div>
                <div className="data-card">
                  <div className="data-label">Insured</div>
                  <div className="data-value">{extractedData?.insuredName}</div>
                </div>
                <div className="data-card">
                  <div className="data-label">Death Benefit</div>
                  <div className="data-value mint">{formatCurrency(extractedData?.deathBenefit ?? 0)}</div>
                </div>
                <div className="data-card">
                  <div className="data-label">Annual Premium</div>
                  <div className="data-value mint">{formatCurrency(extractedData?.annualPremium ?? 0)}</div>
                </div>
                <div className="data-card">
                  <div className="data-label">Payment Mode</div>
                  <div className="data-value">{extractedData?.paymentMode}</div>
                </div>
              </div>

              {(extractedData?.riders ?? []).length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div className="data-label" style={{ marginBottom: 10 }}>Riders</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(extractedData?.riders ?? []).map((r, i) => (
                      <span key={i} className="tag">{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Generalized (ExtractedData) review -- single doc only */}
          {multiDocData.length <= 1 && isGeneralData && generalData && (
            <>
              {/* Title */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{generalData?.title}</h3>
                {generalData?.subtitle && (
                  <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: 0 }}>{generalData?.subtitle}</p>
                )}
                {generalData?.source && (
                  <p style={{ fontSize: 13, color: 'var(--ink-light)', margin: '6px 0 0' }}>Source: {generalData?.source}</p>
                )}
              </div>

              {/* Key Metrics grid */}
              {(generalData?.keyMetrics ?? []).length > 0 && (
                <div className="extracted-grid">
                  {(generalData?.keyMetrics ?? []).map((m, i) => (
                    <div key={i} className="data-card">
                      <div className="data-label">{m.label}</div>
                      <div className={`data-value${m.highlight ? ' mint' : ''}`}>{m.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sections as cards */}
              {(generalData?.sections ?? []).length > 0 && (
                <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
                  {(generalData?.sections ?? []).map((s, i) => (
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
              {(generalData?.bulletPoints ?? []).length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div className="data-label" style={{ marginBottom: 10 }}>Key Takeaways</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(generalData?.bulletPoints ?? []).map((bp, i) => (
                      <span key={i} className="tag">{bp}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="wizard-actions">
            <button onClick={() => { setStep('upload') }} className="btn btn-soft">&larr; Back</button>
            <button onClick={handleGenerateScript} className="btn btn-primary" disabled={!videoPurpose.trim()}>Generate Script &rarr;</button>
          </div>
        </div>
      )}

      {/* OLD STEPS REMOVED — replaced by simplified 4-step flow */}
      {/* @ts-ignore — dead code removed */}
      {false && (
        <div className="wizard-card">
          <h2>Review your script</h2>
          <p className="wizard-sub">Edit the narration for each scene. This is what the voiceover will say.</p>

          {scriptGenerating ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div className="spinner" style={{ marginBottom: 16 }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Generating your script...</p>
              <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>This usually takes 10-20 seconds</p>
            </div>
          ) : editableScenes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Script generation failed</p>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 20 }}>We couldn't generate a script. Please try again or go back to edit your content.</p>
              <div className="wizard-actions" style={{ justifyContent: 'center' }}>
                <button onClick={() => setStep('review')} className="btn btn-soft">&larr; Back to Review</button>
                <button onClick={handleGenerateScript} className="btn btn-primary">Try Again</button>
              </div>
            </div>
          ) : (
            <>
              {editableScenes.map((scene, i) => (
                <div key={i} style={{ marginBottom: 16, background: 'var(--bg-soft)', borderRadius: 10, padding: 16, border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                    <input
                      type="text"
                      value={scene.title}
                      onChange={e => {
                        const updated = [...editableScenes]
                        updated[i] = { ...updated[i], title: e.target.value }
                        setEditableScenes(updated)
                      }}
                      style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 15, flex: 1, outline: 'none', color: 'var(--ink)' }}
                    />
                  </div>
                  <textarea
                    value={scene.narration}
                    onChange={e => {
                      const updated = [...editableScenes]
                      updated[i] = { ...updated[i], narration: e.target.value }
                      setEditableScenes(updated)
                    }}
                    className="input"
                    style={{ minHeight: 100, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
                  />
                  <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>
                    ~{Math.round(scene.narration.split(/\s+/).length / 2.5)}s narration &middot; {scene.narration.split(/\s+/).length} words
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16, textAlign: 'center' }}>
                Total: {editableScenes.length} scenes &middot; ~{Math.round(editableScenes.reduce((sum, s) => sum + s.narration.split(/\s+/).length, 0) / 2.5)}s estimated duration
              </div>
              <div className="wizard-actions">
                <button onClick={() => setStep('review')} className="btn btn-soft">&larr; Back</button>
                <button onClick={() => setStep('options')} className="btn btn-primary">Approve Script &rarr;</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step: Choose brand */}
      {false && (
        <div className="wizard-card">
          <h2>Which brand is this for?</h2>
          <p className="wizard-sub">Select a brand to apply its logo, colors, and contact info to your video.</p>
          <div className="brand-grid-wiz">
            {/* No brand option */}
            <div
              className={`brand-option${selectedBrand === null ? ' selected' : ''}`}
              onClick={() => setSelectedBrand(null)}
            >
              <div className="name">No Brand</div>
              <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>Use default colors</div>
            </div>
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
            {brands.length === 0 && (
              <a href="/brands/new" className="brand-option" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                <div className="name">+ Create Brand</div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>Add logo & colors</div>
              </a>
            )}
          </div>

          <div className="wizard-actions">
            <button onClick={() => setStep('review-script')} className="btn btn-soft">&larr; Back</button>
            <button onClick={() => setStep('choose-style')} className="btn btn-primary">Next: pick a style &rarr;</button>
          </div>
        </div>
      )}

      {/* Step: Choose style */}
      {false && (
        <StylePicker
          selectedStyle={selectedStyle}
          onSelect={setSelectedStyle}
          onBack={() => setStep('choose-brand')}
          onNext={() => {}}
          customStylePrompt={customStylePrompt}
          onCustomStylePrompt={setCustomStylePrompt}
        />
      )}

      {/* Step: Approve slides */}
      {step === 'approve-slides' && (
        <div className="wizard-card">
          <h2>Preview your slides</h2>
          <div style={{
            background: 'rgba(168,240,212,0.1)', border: '1px solid var(--mint)',
            borderRadius: 10, padding: '12px 18px', marginBottom: 20,
            fontSize: 13, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker, #2d7a4f)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            These are content drafts — not final designs. The actual slides will have professional styling, brand colors, and AI-generated visuals. Click any text to edit it.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(editableScenes.length > 0 ? editableScenes : generatedScenes).map((scene: any, i: number) => {
              const allScenes = editableScenes.length > 0 ? editableScenes : generatedScenes
              const isFirst = i === 0
              const isLast = i === allScenes.length - 1
              const slideType = isFirst ? 'Cover' : isLast ? 'Closing' : 'Content'
              return (
                <div key={i} style={{
                  background: 'white', border: '1px solid var(--border-light)',
                  borderRadius: 10, overflow: 'hidden',
                }}>
                  {/* Slide header bar */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px', background: 'var(--bg-soft)',
                    borderBottom: '1px solid var(--border-light)',
                  }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'var(--mint)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0,
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{slideType} Slide</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>
                        ~{Math.round((scene.narration?.split(/\s+/).length ?? 0) / 2.5)}s
                      </span>
                      <button
                        title="Thumbs up"
                        onClick={() => {
                          fetch('/api/slide-feedback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ slideIndex: i, styleId: selectedStyle, slidePrompt: scene.slidePrompt, rating: 'thumbs_up' }),
                          })
                        }}
                        style={{ fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', opacity: 0.6 }}
                      >
                        &#128077;
                      </button>
                      <button
                        title="Thumbs down"
                        onClick={() => {
                          fetch('/api/slide-feedback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ slideIndex: i, styleId: selectedStyle, slidePrompt: scene.slidePrompt, rating: 'thumbs_down' }),
                          })
                        }}
                        style={{ fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', opacity: 0.6 }}
                      >
                        &#128078;
                      </button>
                      <button
                        className="btn btn-soft btn-sm"
                        onClick={() => {
                          setEditingSlide(editingSlide === i ? null : i)
                          setEditInstruction('')
                        }}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6 }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-soft btn-sm"
                        onClick={() => {
                          fetch('/api/slide-feedback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ slideIndex: i, styleId: selectedStyle, slidePrompt: scene.slidePrompt, rating: 'redo' }),
                          })
                          handleRegenerateSlide(i)
                        }}
                        disabled={slidesLoading[i]}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, opacity: slidesLoading[i] ? 0.5 : 1 }}
                      >
                        {slidesLoading[i] ? 'Redoing...' : 'Redo'}
                      </button>
                      {allScenes.length > 2 && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteSlide(i)}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6 }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Edit instruction input */}
                  {editingSlide === i && (
                    <div style={{ padding: '10px 16px', background: 'var(--bg-soft)', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="What would you like to change?"
                        value={editInstruction}
                        onChange={e => setEditInstruction(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleEditSlide(i) }}
                        style={{ flex: 1, fontSize: 13, padding: '8px 12px', borderRadius: 8 }}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleEditSlide(i)}
                        disabled={editingSlideLoading || !editInstruction.trim()}
                        style={{ fontSize: 12, padding: '8px 14px', borderRadius: 8, opacity: editingSlideLoading ? 0.5 : 1 }}
                      >
                        {editingSlideLoading ? 'Applying...' : 'Apply'}
                      </button>
                    </div>
                  )}

                  {/* Slide content preview */}
                  <div style={{ padding: 20, aspectRatio: '16/9', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', background: '#f8fafc' }}>
                    {/* Editable headline */}
                    <input
                      type="text"
                      value={scene.title ?? ''}
                      onChange={e => {
                        const updated = [...(editableScenes.length > 0 ? editableScenes : generatedScenes)]
                        updated[i] = { ...updated[i], title: e.target.value }
                        if (editableScenes.length > 0) setEditableScenes(updated)
                        else setGeneratedScenes(updated)
                      }}
                      style={{
                        border: 'none', background: 'transparent', outline: 'none',
                        fontSize: isFirst ? 22 : 18, fontWeight: 800,
                        color: 'var(--ink)', textAlign: isFirst ? 'center' : 'left',
                        marginBottom: 8, width: '100%',
                      }}
                    />

                    {/* Body content from slidePrompt */}
                    {scene.slidePrompt && (
                      <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                        {scene.slidePrompt.split('\n').filter((l: string) => l.trim()).slice(0, 4).map((line: string, j: number) => (
                          <div key={j} style={{ marginBottom: 4 }}>
                            {line.trim().startsWith('-') ? `• ${line.trim().slice(1).trim()}` : line.trim()}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Draft overlay badge */}
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.08em', color: 'var(--ink-light)',
                      background: 'rgba(255,255,255,0.8)', padding: '2px 8px', borderRadius: 6,
                    }}>Draft</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 16, textAlign: 'center' }}>
            {(editableScenes.length > 0 ? editableScenes : generatedScenes).length} slides &middot; Final video will include professional styling, brand colors, voiceover, and background music
          </div>

          <div className="wizard-actions">
            <button onClick={() => setStep('choose-style')} className="btn btn-soft">&larr; Back</button>
            <button onClick={() => {
              const scenes = editableScenes.length > 0 ? editableScenes : generatedScenes
              scenes.forEach((_: any, i: number) => {
                fetch('/api/slide-feedback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ slideIndex: i, styleId: selectedStyle, slidePrompt: scenes[i]?.slidePrompt, rating: 'approve' }),
                })
              })
              setStep('choose-voice')
            }} className="btn btn-primary">
              Approve &amp; Choose Voice &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Step: Choose voice */}
      {false && (
        <div className="wizard-card">
          <h2>Who should narrate your video?</h2>
          <p className="wizard-sub">Pick a voice and duration. Click any voice to hear a preview.</p>

          {/* Detail Level */}
          <div style={{ marginBottom: 28 }}>
            <label className="input-label">Video Detail Level</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <button
                type="button"
                onClick={() => { setDetailedMode(false); setDetailLevel('quick') }}
                style={{
                  padding: '16px 14px',
                  background: detailLevel === 'quick' ? 'rgba(199,232,168,0.12)' : 'white',
                  border: detailLevel === 'quick' ? '2px solid var(--mint-deep)' : '1px solid var(--border-light)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                {recommendedLevel === 'quick' && <span style={{ position: 'absolute', top: -8, right: 10, background: 'var(--mint)', color: 'var(--ink)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>Recommended</span>}
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Highlights</div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 8 }}>30-60 seconds &middot; 3-4 slides</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Key numbers only. Perfect for quick shares, texts, and social media.</div>
              </button>
              <button
                type="button"
                onClick={() => { setDetailedMode(false); setDetailLevel('standard') }}
                style={{
                  padding: '16px 14px',
                  background: detailLevel === 'standard' ? 'rgba(199,232,168,0.12)' : 'white',
                  border: detailLevel === 'standard' ? '2px solid var(--mint-deep)' : '1px solid var(--border-light)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                {recommendedLevel === 'standard' && <span style={{ position: 'absolute', top: -8, right: 10, background: 'var(--mint)', color: 'var(--ink)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>Recommended</span>}
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Overview</div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 8 }}>2-4 minutes &middot; 6-10 slides</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Full overview of key data. Best for client presentations.</div>
              </button>
              <button
                type="button"
                onClick={() => { setDetailedMode(true); setDetailLevel('detailed') }}
                style={{
                  padding: '16px 14px',
                  background: detailLevel === 'detailed' ? 'rgba(199,232,168,0.12)' : 'white',
                  border: detailLevel === 'detailed' ? '2px solid var(--mint-deep)' : '1px solid var(--border-light)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                {recommendedLevel === 'detailed' && <span style={{ position: 'absolute', top: -8, right: 10, background: 'var(--mint)', color: 'var(--ink)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>Recommended</span>}
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Detailed</div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 8 }}>5-10 minutes &middot; 10-16 slides</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Every data point explained. Best for complex documents.</div>
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

            {/* Music type toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                onClick={() => { setAiMusic(false) }}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: !aiMusic ? '2px solid var(--mint)' : '1px solid var(--border)',
                  background: !aiMusic ? 'rgba(59,181,200,0.06)' : 'white',
                  color: 'var(--ink)',
                }}
              >
                Stock Music
              </button>
              <button
                onClick={() => {
                  setAiMusic(true)
                  setSelectedMusic(null)
                  if (musicAudioRef.current) { musicAudioRef.current.pause(); setPreviewingMusic(null) }
                  if (!musicPrompt) {
                    // Auto-generate a default prompt based on content
                    const activeData = extractedData || generalData
                    const titleText = (activeData as any)?.title || (activeData as any)?.policyType || ''
                    const sourceText = (activeData as any)?.source || (activeData as any)?.carrier || ''
                    const allText = `${titleText} ${sourceText}`.toLowerCase()
                    let defaultPrompt = 'Gentle ambient piano with subtle pads, professional and warm, medium tempo'
                    if (allText.includes('insurance') || allText.includes('policy') || allText.includes('life')) {
                      defaultPrompt = 'Gentle piano with soft strings, warm and reassuring, professional corporate tone, slow tempo'
                    } else if (allText.includes('financ') || allText.includes('business') || allText.includes('invest')) {
                      defaultPrompt = 'Modern ambient corporate, subtle synth pads, confident and sophisticated'
                    } else if (allText.includes('educat') || allText.includes('learn') || allText.includes('school')) {
                      defaultPrompt = 'Light acoustic guitar, friendly and approachable, medium tempo'
                    } else if (allText.includes('tech') || allText.includes('software') || allText.includes('digital')) {
                      defaultPrompt = 'Clean electronic ambient, modern and innovative, medium-upbeat tempo'
                    }
                    const sceneCount = (editableScenes.length > 0 ? editableScenes : generatedScenes).length
                    defaultPrompt += `. Instrumental only, no vocals, background music suitable for narration overlay. Target duration: approximately ${sceneCount * 25} seconds`
                    setMusicPrompt(defaultPrompt)
                  }
                }}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: aiMusic ? '2px solid var(--mint)' : '1px solid var(--border)',
                  background: aiMusic ? 'rgba(59,181,200,0.06)' : 'white',
                  color: 'var(--ink)',
                }}
              >
                AI Custom Music
              </button>
            </div>

            {!aiMusic ? (
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
            ) : (
              <div style={{
                padding: '16px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'rgba(59,181,200,0.04)',
              }}>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 10 }}>
                  AI will compose a custom instrumental track matched to your content. Edit the prompt below to adjust the style.
                </div>
                <textarea
                  value={musicPrompt}
                  onChange={e => setMusicPrompt(e.target.value)}
                  rows={3}
                  className="input"
                  style={{ width: '100%', fontSize: 13, resize: 'vertical', minHeight: 70 }}
                  placeholder="Describe the music style..."
                />
                <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 6 }}>
                  Generation takes 30-60 seconds and runs in parallel with narration.
                </div>
              </div>
            )}
          </div>

          {/* Product & Brand Assets (optional) */}
          <div style={{ marginBottom: 24 }}>
            <label className="input-label">Product & Brand Images (optional)</label>
            <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: '0 0 12px' }}>
              Upload photos, product shots, packaging, or lifestyle images to feature in your slides.
            </p>
            <input
              ref={assetInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => handleAssetUpload(e.target.files)}
              style={{ display: 'none' }}
            />

            {assets.length > 0 && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                {assets.map((asset, i) => (
                  <div key={i} style={{ position: 'relative', width: 100, textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: 100, height: 75, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={asset.url} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        onClick={() => removeAsset(i)}
                        style={{
                          position: 'absolute', top: 3, right: 3, width: 20, height: 20,
                          borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)',
                          color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                        }}
                      >x</button>
                    </div>
                    <select
                      value={asset.tag}
                      onChange={(e) => updateAssetTag(i, e.target.value)}
                      style={{
                        marginTop: 4, width: '100%', fontSize: 11, padding: '3px 4px',
                        borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)',
                        color: 'var(--ink)', cursor: 'pointer',
                      }}
                    >
                      <option value="product">product</option>
                      <option value="logo">logo</option>
                      <option value="lifestyle">lifestyle</option>
                      <option value="background">background</option>
                    </select>
                  </div>
                ))}
              </div>
            )}

            {assets.length < 5 && (
              <button
                type="button"
                onClick={() => assetInputRef.current?.click()}
                disabled={assetUploading}
                style={{
                  padding: '10px 16px', fontSize: 13, fontWeight: 500, border: '1px dashed var(--border)',
                  borderRadius: 10, background: 'transparent', cursor: 'pointer', color: 'var(--muted)',
                  opacity: assetUploading ? 0.5 : 1, width: '100%',
                }}
              >
                {assetUploading ? 'Uploading...' : `+ Add photos, logos, or product shots (${5 - assets.length} slots available)`}
              </button>
            )}
          </div>

          <div className="wizard-actions">
            <button onClick={() => setStep('approve-slides')} className="btn btn-soft">&larr; Back</button>
            <button onClick={handleGenerate} className="btn btn-primary btn-lg">Create my video &rarr;</button>
          </div>

          {/* Price summary */}
          {projectPrice && (
            <div style={{
              textAlign: 'center', marginTop: 12, padding: '10px 16px',
              background: 'var(--bg-soft, #f8fafc)', borderRadius: 10,
              border: '1px solid var(--border, #e2e8f0)',
              fontSize: 13, color: 'var(--ink-soft)',
            }}>
              Video Explainer — <strong style={{ color: 'var(--ink)' }}>{projectPrice?.priceFormatted}</strong>
              {projectPrice?.isPro && <span style={{ marginLeft: 6, color: 'var(--mint-darker, #2d7a4f)', fontWeight: 600 }}>Pro price</span>}
            </div>
          )}
        </div>
      )}

      {/* Step: Options (brand + voice + music) */}
      {step === 'options' && (
        <div className="wizard-card">
          <h2>Final options</h2>
          <p className="wizard-sub">Choose a voice and theme. AI will compose custom background music automatically.</p>

          {/* Custom Theme toggle (premium $5 add-on) */}
          {!slidesMode && (
            <div style={{ marginBottom: 24 }}>
              <label className="input-label">Slide Theme</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: customTheme ? 16 : 0 }}>
                <button
                  type="button"
                  onClick={() => { setCustomTheme(false); setSelectedStyle('executive'); setPreviewSlide(null) }}
                  className={`btn btn-sm ${!customTheme ? 'btn-primary' : 'btn-soft'}`}
                >
                  AI picks theme (free)
                </button>
                <button
                  type="button"
                  onClick={() => setCustomTheme(true)}
                  className={`btn btn-sm ${customTheme ? 'btn-primary' : 'btn-soft'}`}
                >
                  Choose custom theme (+$5)
                </button>
              </div>
              {!customTheme && (
                <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 8 }}>AI will select the best visual style based on your content and industry.</div>
              )}
              {customTheme && (
                <div style={{ position: 'relative' }}>
                  {/* Left arrow */}
                  <button
                    onClick={() => carouselRef.current?.scrollBy({ left: -260, behavior: 'smooth' })}
                    style={{
                      position: 'absolute', left: -12, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
                      width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)',
                      background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: 16, color: 'var(--ink)',
                    }}
                    aria-label="Scroll left"
                  >&#8249;</button>
                  {/* Right arrow */}
                  <button
                    onClick={() => carouselRef.current?.scrollBy({ left: 260, behavior: 'smooth' })}
                    style={{
                      position: 'absolute', right: -12, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
                      width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)',
                      background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: 16, color: 'var(--ink)',
                    }}
                    aria-label="Scroll right"
                  >&#8250;</button>
                  <div
                    ref={carouselRef}
                    style={{
                      display: 'flex', gap: 14, overflowX: 'auto', scrollSnapType: 'x mandatory',
                      scrollBehavior: 'smooth', padding: '4px 2px 8px', msOverflowStyle: 'none',
                      scrollbarWidth: 'thin',
                    }}
                  >
                    {SLIDE_STYLES.map(style => {
                      const isSelected = selectedStyle === style.id
                      return (
                        <div
                          key={style.id}
                          onClick={() => {
                            setSelectedStyle(style.id)
                            setPreviewSlide(null)
                          }}
                          style={{
                            minWidth: 240, maxWidth: 240, scrollSnapAlign: 'start',
                            borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                            border: isSelected ? '2px solid var(--mint)' : '1px solid var(--border-light)',
                            transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                            transition: 'all 0.2s ease',
                            background: isSelected ? 'rgba(59,181,200,0.04)' : 'white',
                            boxShadow: isSelected ? '0 4px 16px rgba(59,181,200,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={`/style-previews/${style.id}.png`}
                            alt={style.name}
                            style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                            loading="lazy"
                          />
                          <div style={{ padding: '10px 12px' }}>
                            <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 600, marginBottom: 2 }}>{style.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-light)', lineHeight: 1.3 }}>{style.description}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Voice selector */}
          <div style={{ marginBottom: 24 }}>
            <label className="input-label">Narration Voice</label>
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
          </div>

          {/* Video Length — AI decides based on content, no toggle needed */}

          {/* Background Music — fully automatic */}
          <div style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 10, background: 'rgba(168,240,212,0.06)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>&#127925;</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>AI Background Music</div>
              <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>A custom instrumental track will be composed to match your content.</div>
            </div>
          </div>

          {/* Trial status banner */}
          {trialStatus && !trialStatus.isPaid && !trialStatus.hasReferral && trialStatus.freeVideosRemaining > 0 && (
            <div style={{
              padding: '14px 18px', marginBottom: 16, borderRadius: 10,
              background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
              border: '1px solid #bbf7d0', fontSize: 13,
            }}>
              <strong style={{ color: '#166534' }}>Free videos</strong>
              <span style={{ color: '#15803d', marginLeft: 8 }}>
                {trialStatus.freeVideosRemaining} of 5 free video{trialStatus.freeVideosRemaining !== 1 ? 's' : ''} remaining
              </span>
            </div>
          )}

          {trialStatus && !trialStatus.isPaid && !trialStatus.hasReferral && trialStatus.freeVideosRemaining <= 0 && trialStatus.cardOnFile && (
            <div style={{
              padding: '14px 18px', marginBottom: 16, borderRadius: 10,
              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
              border: '1px solid #93c5fd', fontSize: 13,
            }}>
              <strong style={{ color: '#1e40af' }}>Pay per video</strong>
              <span style={{ color: '#1d4ed8', marginLeft: 8 }}>
                $10 per video &mdash; your card on file will be charged
              </span>
            </div>
          )}

          {trialStatus?.trialExhausted && (
            <div style={{
              padding: '18px 20px', marginBottom: 16, borderRadius: 10,
              background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
              border: '1px solid #fecaca', fontSize: 14, textAlign: 'center',
            }}>
              <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>Free videos used</div>
              <div style={{ color: '#b91c1c', marginBottom: 12 }}>You have used your 5 free videos. Add a card or subscribe to keep creating.</div>
              <a href="/settings?tab=subscription" className="btn btn-primary" style={{ fontSize: 14 }}>View plans &rarr;</a>
            </div>
          )}

          {/* Preview Slide Section */}
          <div style={{
            marginBottom: 24, padding: '20px 24px', borderRadius: 14,
            background: 'var(--bg-soft)', border: '1px solid var(--border-light)',
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>See what your video will look like</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-light)', margin: '0 0 16px' }}>
              Generate a sample cover slide using your content and selected style.
            </p>

            {previewLoading && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '32px 16px', borderRadius: 10, background: 'white', border: '1px solid var(--border-light)',
                marginBottom: 12,
              }}>
                <div className="spinner" style={{ width: 20, height: 20, border: '2.5px solid var(--border)', borderTopColor: 'var(--mint)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>Creating preview slide...</span>
              </div>
            )}

            {previewSlide && !previewLoading && (
              <div style={{ marginBottom: 12 }}>
                <img
                  src={previewSlide}
                  alt="Preview slide"
                  style={{ width: '100%', borderRadius: 10, display: 'block', border: '1px solid var(--border-light)' }}
                />
                <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: '10px 0 0', textAlign: 'center' }}>
                  Happy with this? Click Create below. Want a different look? Change the style above and preview again.
                </p>
              </div>
            )}

            {!previewLoading && (
              <button
                onClick={handlePreviewSlide}
                className="btn"
                style={{
                  background: 'var(--mint)', color: 'var(--ink)', fontWeight: 700,
                  border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13,
                  cursor: 'pointer', width: '100%',
                }}
              >
                {previewSlide ? 'Regenerate Preview' : 'Generate Preview'}
              </button>
            )}
          </div>

          {/* Product & Brand Assets (optional) */}
          <div style={{ marginBottom: 24 }}>
            <label className="input-label">Product & Brand Images (optional)</label>
            <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: '0 0 12px' }}>
              Upload photos, product shots, packaging, or lifestyle images to feature in your slides.
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => handleAssetUpload(e.target.files)}
              style={{ display: 'none' }}
              id="asset-input-options"
            />

            {assets.length > 0 && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                {assets.map((asset, i) => (
                  <div key={i} style={{ position: 'relative', width: 100, textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: 100, height: 75, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={asset.url} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        onClick={() => removeAsset(i)}
                        style={{
                          position: 'absolute', top: 3, right: 3, width: 20, height: 20,
                          borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)',
                          color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                        }}
                      >x</button>
                    </div>
                    <select
                      value={asset.tag}
                      onChange={(e) => updateAssetTag(i, e.target.value)}
                      style={{
                        marginTop: 4, width: '100%', fontSize: 11, padding: '3px 4px',
                        borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)',
                        color: 'var(--ink)', cursor: 'pointer',
                      }}
                    >
                      <option value="product">product</option>
                      <option value="logo">logo</option>
                      <option value="lifestyle">lifestyle</option>
                      <option value="background">background</option>
                    </select>
                  </div>
                ))}
              </div>
            )}

            {assets.length < 5 && (
              <button
                type="button"
                onClick={() => document.getElementById('asset-input-options')?.click()}
                disabled={assetUploading}
                style={{
                  padding: '10px 16px', fontSize: 13, fontWeight: 500, border: '1px dashed var(--border)',
                  borderRadius: 10, background: 'transparent', cursor: 'pointer', color: 'var(--muted)',
                  opacity: assetUploading ? 0.5 : 1, width: '100%',
                }}
              >
                {assetUploading ? 'Uploading...' : `+ Add photos, logos, or product shots (${5 - assets.length} slots available)`}
              </button>
            )}
          </div>

          {/* Price + Generate */}
          <div className="wizard-actions">
            <button onClick={() => setStep('script')} className="btn btn-soft">&larr; Back</button>
            <button
              onClick={handleGenerate}
              className="btn btn-primary btn-lg"
              disabled={trialStatus?.trialExhausted}
              style={trialStatus?.trialExhausted ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              {trialStatus && !trialStatus.isPaid && trialStatus.freeVideosRemaining > 0 ? 'Create free video' : trialStatus && !trialStatus.isPaid && trialStatus.freeVideosRemaining <= 0 && trialStatus.cardOnFile ? 'Create video ($10)' : 'Create my video'} &rarr;
            </button>
          </div>

          {trialStatus && !trialStatus.isPaid && !trialStatus.hasReferral && trialStatus.freeVideosRemaining > 0 ? (
            <div style={{ textAlign: 'center', marginTop: 12, padding: '10px 16px', background: 'var(--bg-soft)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, color: 'var(--ink-soft)' }}>
              Free video ({trialStatus.freeVideosRemaining} remaining) — <a href="/settings?tab=subscription" style={{ color: 'var(--mint-darker, #2d7a4f)', fontWeight: 600 }}>upgrade for a subscription</a>
            </div>
          ) : trialStatus && !trialStatus.isPaid && trialStatus.freeVideosRemaining <= 0 && trialStatus.cardOnFile ? (
            <div style={{ textAlign: 'center', marginTop: 12, padding: '10px 16px', background: 'var(--bg-soft)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, color: 'var(--ink-soft)' }}>
              $10 per video — your card on file will be charged. <a href="/settings?tab=subscription" style={{ color: 'var(--mint-darker, #2d7a4f)', fontWeight: 600 }}>Save with a subscription</a>
            </div>
          ) : projectPrice && !trialStatus?.trialExhausted ? (
            <div style={{ textAlign: 'center', marginTop: 12, padding: '10px 16px', background: 'var(--bg-soft)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, color: 'var(--ink-soft)' }}>
              Video Explainer — <strong style={{ color: 'var(--ink)' }}>{projectPrice?.priceFormatted}</strong>
              {customTheme && <span style={{ marginLeft: 4 }}>+ <strong>$5</strong> custom theme</span>}
              {projectPrice?.isPro && <span style={{ marginLeft: 6, color: 'var(--mint-darker, #2d7a4f)', fontWeight: 600 }}>Pro price</span>}
            </div>
          ) : null}
        </div>
      )}

      {/* Step: Generating */}
      {step === 'generating' && (
        <div className="wizard-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div className="spinner" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--mint)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
            Setting up your video...
          </p>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-light)' }}>
            You'll be redirected to track progress in a moment.
          </p>
          <div style={{
            marginTop: 20,
            padding: '14px 20px',
            background: 'var(--bg-soft)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
            color: 'var(--ink-soft)',
            textAlign: 'left',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker)" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <span><strong>You can leave this page.</strong> Your video will keep generating in the background. Check your <a href="/videos" style={{color: 'var(--mint-darker)', fontWeight: 600}}>library</a> for progress.</span>
          </div>
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

      {/* Profile completeness modal (Option B) */}
      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 10, padding: 32, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Complete your profile</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--ink-soft)' }}>
              Your name and company appear on the share page your clients see. Add them now so your video looks professional.
            </p>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Your name</span>
              <input
                type="text"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                placeholder="Jane Smith"
                className="input"
                style={{ width: '100%' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Company name</span>
              <input
                type="text"
                value={profileCompany}
                onChange={e => setProfileCompany(e.target.value)}
                placeholder="Acme Financial"
                className="input"
                style={{ width: '100%' }}
              />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                disabled={savingProfile || (!profileName.trim() && !profileCompany.trim())}
                onClick={async () => {
                  setSavingProfile(true)
                  try {
                    const supabase = createClient()
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) {
                      await supabase.from('profiles').update({
                        full_name: profileName.trim() || null,
                        company_name: profileCompany.trim() || null,
                      }).eq('id', user.id)
                    }
                    setShowProfileModal(false)
                    // Now proceed with generation
                    handleGenerate()
                  } catch {
                    setShowProfileModal(false)
                  } finally {
                    setSavingProfile(false)
                  }
                }}
              >
                {savingProfile ? 'Saving...' : 'Save & continue'}
              </button>
              <button
                className="btn btn-soft"
                onClick={() => setShowProfileModal(false)}
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
