'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import WizardProgress from '../_components/WizardProgress'
import QuickPreview from '../../../_components/QuickPreview'
import BuyCreditsModal from '../../../_components/BuyCreditsModal'

// Build the default cover/closing copy and ensure the editable scene list has an
// editable Cover (first) + Closing (last). Idempotent: if bookends already exist
// (by _role), it leaves them. This makes the front/back slides editable like any
// content scene; generate-video uses the edited versions (by _role) at submit.
function addBookends(
  scenes: any[],
  opts: { title?: string; brandName?: string; recipientName?: string; contactLine?: string }
): any[] {
  if (!Array.isArray(scenes) || scenes.length === 0) return scenes
  const hasCover = scenes.some(s => s?._role === 'cover')
  const hasClosing = scenes.some(s => s?._role === 'closing')
  const title = opts.title || scenes[0]?.title || 'Presentation'
  const greeting = opts.recipientName
    ? `Hello ${opts.recipientName}, thank you for your time today.`
    : 'Thank you for your time today.'
  const cover = {
    _role: 'cover',
    title,
    narration: `${greeting} ${title}.`,
    slideData: { headline: title },
  }
  const contactSentence = opts.contactLine ? ` To learn more, reach out: ${opts.contactLine}.` : ''
  const closing = {
    _role: 'closing',
    title: 'Thank You',
    narration: `Thank you for watching.${contactSentence} ${opts.brandName ? `${opts.brandName} looks forward to serving you.` : 'We appreciate your time.'}`.replace(/\s+/g, ' ').trim(),
    slideData: { headline: 'Thank You', cta: 'Reach out to take the next step.' },
  }
  let out = scenes
  if (!hasCover) out = [cover, ...out]
  if (!hasClosing) out = [...out, closing]
  return out
}

export default function ScriptPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const videoId = searchParams.get('id')

  // Out-of-credits modal (opened when generation is blocked for low balance)
  const [buyCredits, setBuyCredits] = useState<{ needed?: number; balance?: number } | null>(null)

  // Wizard mode = videoId present
  const isWizard = !!videoId

  const [createState, setCreateState] = useState<any>(null)
  const [detailLevel, setDetailLevel] = useState<'quick' | 'standard' | 'detailed'>('standard')
  const [narrationStyle, setNarrationStyle] = useState<'solo' | 'podcast'>('solo')
  const [outputType, setOutputType] = useState<'video' | 'pptx' | 'pdf'>('video')
  const [scenes, setScenes] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedScene, setSavedScene] = useState<number | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)
  const [previewImg, setPreviewImg] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [draftLoading, setDraftLoading] = useState(isWizard)
  const [draftData, setDraftData] = useState<any>(null)

  // Quick preview state
  const [showQuickPreview, setShowQuickPreview] = useState(false)
  const [quickPreviewData, setQuickPreviewData] = useState<{
    scenes: any[]; slides: (string | null)[]; totalScenes: number; allScenes: any[]
  } | null>(null)
  const [quickPreviewLoading, setQuickPreviewLoading] = useState(false)
  const [quickPreviewApproving, setQuickPreviewApproving] = useState(false)

  // Auto-save scenes to localStorage — debounced for typing, instant for other actions
  const autoSave = useCallback((updatedScenes: any[], sceneIdx: number, instant?: boolean) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const doSave = () => {
      if (!isWizard) {
        const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
        state.scenes = updatedScenes
        localStorage.setItem('d2v_create', JSON.stringify(state))
      }
      setSavedScene(sceneIdx)
      setTimeout(() => setSavedScene(null), 1500)
    }
    if (instant) {
      doSave()
    } else {
      saveTimer.current = setTimeout(doSave, 800)
    }
  }, [isWizard])

  // Safety net: save on page unload
  useEffect(() => {
    const handleUnload = () => {
      if (scenes.length > 0 && !isWizard) {
        const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
        state.scenes = scenes
        localStorage.setItem('d2v_create', JSON.stringify(state))
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  })

  // Wizard flow: load draft from API
  useEffect(() => {
    if (!isWizard) return
    async function loadDraft() {
      try {
        const res = await fetch(`/api/videos/draft?videoId=${videoId}`)
        if (!res.ok) throw new Error('Failed to load draft')
        const video = await res.json()
        const draft = video.draft_data
        if (!draft) throw new Error('No draft data')

        setDraftData(draft)
        const ot = draft.outputType || video.output_type || 'video'
        setOutputType(ot)
        if (draft.detailLevel) setDetailLevel(draft.detailLevel)
        if (draft.narrationStyle) setNarrationStyle(draft.narrationStyle)

        // If draft already has scenes, restore them (with editable cover/closing)
        if (draft.scenes && draft.scenes.length > 0) {
          const contactLine = [draft.contactPhone, draft.contactEmail, draft.contactWebsite].filter(Boolean).join(' | ')
          setScenes(addBookends(draft.scenes, {
            title: draft.title || video.title,
            brandName: draft.inlineBrand?.name || undefined,
            recipientName: draft.recipientName || undefined,
            contactLine: contactLine || undefined,
          }))
        }
        // Build a createState-like object from draft data for script generation
        setCreateState({
          extractedData: draft.extractedData || draft.inlineBrand || {},
          intentType: draft.intentType || draft.purpose,
          purpose: draft.purpose,
          contactPhone: draft.contactPhone,
          contactEmail: draft.contactEmail,
          contactWebsite: draft.contactWebsite,
          selectedBrand: draft.brandId,
          autoBrandId: draft.autoBrandId,
          customStylePrompt: draft.customStylePrompt || undefined,
          detailLevel: draft.detailLevel,
          narrationStyle: draft.narrationStyle,
          voiceId: draft.voiceId || 'nova',
          aiMusic: draft.aiMusic ?? false,
          styleId: draft.styleId || undefined,
          recipientName: draft.recipientName || undefined,
        })
      } catch (err) {
        console.error('[script] load draft error:', err)
        setError('Could not load your draft. Please go back and try again.')
      } finally {
        setDraftLoading(false)
      }
    }
    loadDraft()
  }, [isWizard, videoId])

  // Legacy flow: load from localStorage
  useEffect(() => {
    if (isWizard) return
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    if (!state.extractedData && !state.scenes) {
      // No data — redirect back
      router.push('/create')
      return
    }
    setCreateState(state)
    if (state.detailLevel) setDetailLevel(state.detailLevel)
    if (state.narrationStyle) setNarrationStyle(state.narrationStyle)
    if (state.scenes) setScenes(addBookends(state.scenes, {
      title: state.title,
      brandName: state.brandName || state.inlineBrand?.name,
      recipientName: state.recipientName,
      contactLine: [state.contactPhone, state.contactEmail, state.contactWebsite].filter(Boolean).join(' | ') || undefined,
    }))
  }, [router, isWizard])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const state = isWizard ? createState : JSON.parse(localStorage.getItem('d2v_create') || '{}')
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyData: {
            ...state.extractedData,
            intentType: state.intentType,
            contactPhone: state.contactPhone,
            contactEmail: state.contactEmail,
            contactWebsite: state.contactWebsite,
          },
          brandId: state.selectedBrand || state.autoBrandId,
          detailed: detailLevel === 'detailed',
          detailLevel,
          narrationStyle,
          purpose: state.purpose,
          contactInfo: {
            phone: state.contactPhone || undefined,
            email: state.contactEmail || undefined,
            website: state.contactWebsite || undefined,
          },
          industry: state.extractedData?.industry || 'general',
          classification: state.extractedData?.classification || state.classification || null,
          outputType,
        }),
      })
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch { throw new Error('Server error — please try again') }
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || 'Script generation failed')

      // ── Wizard path: server runs generation in the BACKGROUND (202) and writes
      // scenes to the draft. Poll the draft until ready/failed so the browser
      // never hits the ~60s synchronous-response timeout. ──
      const bookendOpts = {
        title: state.title || (createState?.extractedData as any)?.title,
        brandName: state.brandName || draftData?.inlineBrand?.name,
        recipientName: state.recipientName || createState?.recipientName,
        contactLine: [state.contactPhone, state.contactEmail, state.contactWebsite].filter(Boolean).join(' | ') || undefined,
      }
      if (data.status === 'generating' && videoId) {
        const scenes = await pollForScenes(videoId)
        setScenes(addBookends(scenes, bookendOpts))
        // scenes are already persisted to the draft by the background job.
      } else {
        // Legacy synchronous path (non-wizard): scenes returned inline.
        if (!data.scenes || !Array.isArray(data.scenes)) throw new Error('No script was generated — please try again')
        setScenes(addBookends(data.scenes, bookendOpts))
        state.scenes = data.scenes
        state.detailLevel = detailLevel
        state.narrationStyle = narrationStyle
        localStorage.setItem('d2v_create', JSON.stringify(state))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to generate script')
    }
    setGenerating(false)
  }

  // Poll the draft for the background script job. Resolves with scenes when
  // ready, throws on failure or timeout (~8 min ceiling).
  async function pollForScenes(vid: string): Promise<any[]> {
    const start = Date.now()
    const TIMEOUT_MS = 8 * 60 * 1000
    while (Date.now() - start < TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const res = await fetch(`/api/videos/draft?videoId=${vid}`)
        if (!res.ok) continue
        const video = await res.json()
        const d = video?.draft_data || {}
        if (d.scriptStatus === 'ready' && Array.isArray(d.scenes) && d.scenes.length > 0) return d.scenes
        if (d.scriptStatus === 'failed') throw new Error(d.scriptError || 'Script generation failed')
      } catch (e) {
        if (e instanceof Error && e.message !== 'Failed to fetch') throw e
        // transient network error — keep polling
      }
    }
    throw new Error('Script is taking longer than expected. Check your Library in a few minutes.')
  }

  async function handlePreviewSlide(idx: number) {
    setPreviewIdx(idx)
    setPreviewImg(null)
    setPreviewLoading(true)
    try {
      const scene = scenes[idx]
      const state = isWizard ? createState : JSON.parse(localStorage.getItem('d2v_create') || '{}')
      const brandColors = state.extractedData?.primaryColor ? { primary: state.extractedData.primaryColor, secondary: state.extractedData.secondaryColor || '#4A90D9' } : { primary: '#1B365D', secondary: '#4A90D9' }

      const res = await fetch('/api/style-previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${state.customStylePrompt || 'Modern professional style'}\nColors: primary ${brandColors.primary}, accent ${brandColors.secondary}.\nGlossy polished finish.`,
          name: scene.title,
        }),
      })
      const data = await res.json()
      if (data.previewUrl) setPreviewImg(data.previewUrl)
    } catch { /* skip */ }
    setPreviewLoading(false)
  }

  // Legacy flow: continue to options
  function handleContinue() {
    if (isWizard) {
      handleWizardGenerate()
      return
    }
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    state.scenes = scenes
    state.detailLevel = detailLevel
    state.narrationStyle = narrationStyle
    localStorage.setItem('d2v_create', JSON.stringify(state))
    router.push('/create/generating')
  }

  // Wizard flow: save script to draft, then trigger generation and redirect
  async function handleWizardGenerate() {
    if (!videoId) return
    setSubmitting(true)
    setError(null)
    try {
      // 1. Save script and advance step
      const wizardStep = outputType === 'video' ? 5 : 4
      const patchRes = await fetch('/api/videos/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          updates: {
            scenes,
            detailLevel,
            narrationStyle,
            step: wizardStep,
          },
        }),
      })
      if (!patchRes.ok) throw new Error('Failed to save script')

      // 2. Trigger generation
      const genRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          outputType,
          policyData: createState?.extractedData || {},
          purpose: createState?.purpose || 'Create a professional video',
          recipientName: (createState as any)?.recipientName || (draftData as any)?.recipientName || undefined,
          preGeneratedScenes: scenes,
          brandId: createState?.selectedBrand || createState?.autoBrandId || undefined,
          voiceId: (createState as any)?.voiceId || 'nova',
          narrationStyle,
          detailLevel,
          industry: (createState?.extractedData as Record<string, unknown>)?.industry || 'general',
          aiMusic: (createState as any)?.aiMusic ?? false,
          musicPrompt: (createState as any)?.aiMusic ? 'Professional ambient background music, subtle and warm' : undefined,
          styleId: (createState as any)?.styleId || undefined,
          customStylePrompt: (createState as any)?.customStylePrompt || undefined,
          companyName: (createState as any)?.companyName || undefined,
          noContactBar: (createState as any)?.noContactBar || undefined,
          // Colors come solely from the selected brand (single source of truth).
          // The styling step chooses visual STYLE only — it no longer overrides colors.
        }),
      })
      if (!genRes.ok) {
        const genData = await genRes.json().catch(() => ({}))
        // Insufficient credits → offer a top-up instead of a dead-end error.
        if (genRes.status === 402) {
          const m = /Need\s+(\d+),\s*have\s+(\d+)/i.exec(genData.error || '')
          setBuyCredits({ needed: m ? Number(m[1]) : undefined, balance: m ? Number(m[2]) : undefined })
          setSubmitting(false)
          return
        }
        throw new Error(genData.error || 'Failed to start generation')
      }

      // 3. Redirect to generating page
      router.push(`/create/generating?id=${videoId}`)
    } catch (err) {
      console.error('[script] generate error:', err)
      setError(err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to generate. Please try again.')
      setSubmitting(false)
    }
  }

  // Quick Preview: generate a fast 3-slide preview
  async function handleQuickPreview() {
    setQuickPreviewLoading(true)
    setError(null)
    try {
      const state = isWizard ? createState : JSON.parse(localStorage.getItem('d2v_create') || '{}')
      const res = await fetch('/api/quick-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyData: {
            ...state.extractedData,
            intentType: state.intentType,
          },
          brandId: state.selectedBrand || state.autoBrandId || undefined,
          styleId: (state as any)?.styleId || undefined,
          customStylePrompt: (state as any)?.customStylePrompt || undefined,
          purpose: state.purpose,
          industry: state.extractedData?.industry || 'general',
          detailLevel,
          narrationStyle,
          voiceId: (state as any)?.voiceId || 'nova',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview generation failed')

      setQuickPreviewData(data)
      setShowQuickPreview(true)

      // Also populate scenes with the full script from the preview
      if (data.allScenes && data.allScenes.length > 0) {
        setScenes(data.allScenes)
        if (isWizard) {
          await fetch('/api/videos/draft', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoId,
              updates: { scenes: data.allScenes, detailLevel, narrationStyle },
            }),
          })
        } else {
          state.scenes = data.allScenes
          state.detailLevel = detailLevel
          state.narrationStyle = narrationStyle
          localStorage.setItem('d2v_create', JSON.stringify(state))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : typeof err === 'string' ? err : 'Preview generation failed')
    } finally {
      setQuickPreviewLoading(false)
    }
  }

  // Approve quick preview: go straight to generation
  async function handleApprovePreview() {
    setQuickPreviewApproving(true)
    setShowQuickPreview(false)
    // Scenes are already loaded from preview — use the normal continue flow
    handleContinue()
  }

  // Determine wizard step number for progress bar
  const wizardStep = outputType === 'video' ? 4 : 3
  const backPath = isWizard
    ? (outputType === 'video' ? `/create/voice?id=${videoId}` : `/create/brand?id=${videoId}`)
    : '/create'

  // Loading state for wizard
  if (draftLoading) {
    return (
      <div style={pageStyles.page}>
        <div style={pageStyles.container}>
          <div style={pageStyles.loadingText}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, padding: '40px 24px', maxWidth: scenes.length > 0 ? 1100 : 800, margin: '0 auto', width: '100%', transition: 'max-width 0.3s',
    }}>

      {/* Wizard progress bar — only in wizard mode */}
      {isWizard && (
        <WizardProgress currentStep={wizardStep} outputType={outputType} />
      )}

      <div style={{ animation: 'fadeInUp 0.4s ease' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
          {scenes.length > 0 ? 'Your script' : 'Configure your video'}
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 40, lineHeight: 1.6 }}>
          {scenes.length > 0
            ? outputType === 'video'
              ? 'Edit the narration for each scene. This is what the voice will say.'
              : 'Edit the content for each slide. Headlines and bullets will appear on your slides.'
            : 'Choose the length and style, then generate your script.'}
        </p>

        {scenes.length === 0 && (
          <>
            {/* Back button */}
            <button onClick={() => router.push(backPath)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink-light)', marginBottom: 24, fontFamily: 'inherit' }}>
              &larr; Back
            </button>

            {/* Detail level + narration style — only show in legacy (non-wizard) mode */}
            {!isWizard && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  {outputType === 'video' ? 'Video length' : 'Document length'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
                  {[
                    { id: 'quick' as const, title: 'Highlights', desc: outputType === 'video' ? 'Under 60 seconds' : '3-5 slides' },
                    { id: 'standard' as const, title: 'Standard', desc: outputType === 'video' ? '2-5 minutes' : '8-15 slides' },
                    { id: 'detailed' as const, title: 'Detailed', desc: outputType === 'video' ? '5-15 minutes' : '15-30 slides' },
                  ].map(level => (
                    <button key={level.id} onClick={() => setDetailLevel(level.id)} style={{
                      padding: '20px', borderRadius: 10,
                      border: detailLevel === level.id ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                      background: detailLevel === level.id ? 'rgba(168,240,212,0.06)' : 'white',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    }}>
                      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{level.title}</div>
                      <div style={{ fontSize: 14, color: 'var(--ink-light)' }}>{level.desc}</div>
                    </button>
                  ))}
                </div>
                {outputType === 'video' && (
                  <>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Narration style</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
                      <button onClick={() => setNarrationStyle('solo')} style={{
                        padding: '20px', borderRadius: 10,
                        border: narrationStyle === 'solo' ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                        background: narrationStyle === 'solo' ? 'rgba(168,240,212,0.06)' : 'white',
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      }}>
                        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Solo Narrator</div>
                        <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>One professional voice.</div>
                      </button>
                      <button onClick={() => setNarrationStyle('podcast')} style={{
                        padding: '20px', borderRadius: 10,
                        border: narrationStyle === 'podcast' ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                        background: narrationStyle === 'podcast' ? 'rgba(168,240,212,0.06)' : 'white',
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      }}>
                        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Two Narrators</div>
                        <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>Professional discussion format.</div>
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14, marginBottom: 20 }}>
                {typeof error === 'string' ? error : 'Something went wrong. Please try again.'}
              </div>
            )}

            {generating ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <style>{`
                  @keyframes scriptPulse {
                    0%, 100% { transform: scale(1); opacity: 0.7; }
                    50% { transform: scale(1.05); opacity: 1; }
                  }
                  @keyframes dotBounce {
                    0%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-8px); }
                  }
                `}</style>
                <div style={{ animation: 'scriptPulse 2s ease infinite', marginBottom: 20 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>&#9998;&#65039;</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Writing your script</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>AI is analyzing your content and crafting the narration</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%', background: 'var(--mint)',
                      animation: `dotBounce 1.4s infinite ${i * 0.2}s`,
                    }} />
                  ))}
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 16 }}>This usually takes under a minute — please keep this tab open</p>
              </div>
            ) : quickPreviewLoading ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <style>{`
                  @keyframes previewPulse {
                    0%, 100% { transform: scale(1); opacity: 0.7; }
                    50% { transform: scale(1.05); opacity: 1; }
                  }
                `}</style>
                <div style={{ animation: 'previewPulse 2s ease infinite', marginBottom: 20 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>&#128064;</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Generating quick preview</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>Writing script and creating 3 preview slides</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%', background: 'var(--mint)',
                      animation: `dotBounce 1.4s infinite ${i * 0.2}s`,
                    }} />
                  ))}
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 16 }}>This usually takes 30-60 seconds</p>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={handleQuickPreview}
                  style={{
                    flex: 1, padding: '18px', borderRadius: 10,
                    border: '2px solid var(--mint)',
                    background: 'rgba(168,240,212,0.08)', color: 'var(--ink)', fontSize: 15, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Quick Preview
                </button>
                <button
                  onClick={handleGenerate}
                  style={{
                    flex: 1, padding: '18px', borderRadius: 10, border: 'none',
                    background: 'var(--ink)', color: 'white', fontSize: 17, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Generate Script &rarr;
                </button>
              </div>
            )}
          </>
        )}

        {/* Two-column: Script editor + AI chat */}
        {scenes.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
                {scenes.length} scenes &middot; ~{Math.round(scenes.reduce((sum: number, s: any) => sum + (s.narration?.split(/\s+/).length || 0), 0) / 2.5)}s estimated
              </div>
              <button
                onClick={() => setEditMode(!editMode)}
                style={{
                  padding: '6px 14px', borderRadius: 8,
                  border: editMode ? '2px solid var(--mint)' : '1px solid var(--border)',
                  background: editMode ? 'rgba(199, 232, 168, 0.1)' : 'white',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  color: 'var(--ink)',
                }}
              >
                {editMode ? '✓ Editing' : '✎ Edit script'}
              </button>
            </div>

            {/* Read-only summary view */}
            {!editMode && (
              <div style={{ marginBottom: 16 }}>
                {scenes.map((scene: any, i: number) => (
                  <div key={i} style={{
                    padding: '14px 18px', marginBottom: 8, borderRadius: 10,
                    background: 'white', border: '1px solid var(--border-light)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%', background: 'var(--mint)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 11, flexShrink: 0,
                      }}>{i + 1}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{scene.title}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>~{Math.round((scene.narration?.split(/\s+/).length || 0) / 2.5)}s</span>
                    </div>
                    {scene.narration && (
                      <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, margin: 0 }}>
                        {scene.narration.length > 180 ? scene.narration.slice(0, 180) + '...' : scene.narration}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Full editor view */}
            {editMode && (
            <div className="create-script-layout" style={{ display: 'block' }}>
              {/* Script editor — accordion with narration + slide content */}
              <div>
                {scenes.map((scene: any, i: number) => {
                  const sd = scene.slideData || {}
                  const bullets = sd.bullets || []
                  const stats = sd.stats || []
                  const role = scene._role as ('cover' | 'closing' | undefined)
                  const isBookend = role === 'cover' || role === 'closing'
                  return (
                    <div
                      key={i}
                      draggable={!isBookend}
                      onDragStart={() => { if (!isBookend) setDragIdx(i) }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => {
                        if (dragIdx === null || dragIdx === i || isBookend) return
                        // Never move a content scene before the cover or after the closing.
                        const firstContent = scenes.findIndex(s => s._role !== 'cover')
                        const lastContent = scenes.length - 1 - [...scenes].reverse().findIndex(s => s._role !== 'closing')
                        const target = Math.min(Math.max(i, firstContent), lastContent)
                        const updated = [...scenes]
                        const [moved] = updated.splice(dragIdx, 1)
                        updated.splice(target, 0, moved)
                        updated.forEach((s, idx) => { s.scene = idx + 1 })
                        setScenes(updated)
                        autoSave(updated, target, true)
                        setDragIdx(null)
                      }}
                      onDragEnd={() => setDragIdx(null)}
                      style={{
                        marginBottom: 12, borderRadius: 10, overflow: 'hidden',
                        background: 'white',
                        border: dragIdx === i ? '2px solid var(--mint)' : isBookend ? '1px solid var(--mint)' : '1px solid var(--border-light)',
                        opacity: dragIdx === i ? 0.6 : 1,
                        transition: 'opacity 0.2s, border-color 0.2s',
                      }}
                    >
                      {/* Scene header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', cursor: isBookend ? 'default' : 'grab' }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: isBookend ? 'var(--ink)' : 'var(--mint)', color: isBookend ? 'white' : 'inherit',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 12, flexShrink: 0,
                        }}>{i + 1}</span>
                        {isBookend && (
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink)', background: 'var(--mint)', padding: '2px 8px', borderRadius: 6 }}>
                            {role === 'cover' ? 'Cover slide' : 'Closing slide'}
                          </span>
                        )}
                        <input
                          type="text"
                          value={scene.title}
                          onChange={e => {
                            const updated = [...scenes]
                            updated[i] = { ...updated[i], title: e.target.value }
                            setScenes(updated)
                            autoSave(updated, i)
                          }}
                          style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 15, flex: 1, outline: 'none', color: 'var(--ink)', fontFamily: 'inherit' }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>~{Math.round((scene.narration?.split(/\s+/).length || 0) / 2.5)}s</span>
                        {savedScene === i && <span style={{ fontSize: 11, color: 'var(--mint-darker, #2d7a4f)', fontWeight: 600 }}>&#10003;</span>}
                      </div>

                      {/* Narration section — always shown for video, shown as speaker notes for pptx */}
                      {(outputType === 'video' || outputType === 'pptx') && (
                        <div style={{ padding: '0 16px 8px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-light)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {outputType === 'video' ? 'Narration' : 'Speaker Notes'}
                          </div>
                          <textarea
                            value={scene.narration}
                            onChange={e => {
                              const updated = [...scenes]
                              updated[i] = { ...updated[i], narration: e.target.value }
                              setScenes(updated)
                              autoSave(updated, i)
                            }}
                            placeholder={outputType === 'pptx' ? 'Speaker notes for this slide (optional)' : ''}
                            style={{
                              width: '100%', minHeight: 60, resize: 'vertical', border: '1px solid var(--border-light)',
                              borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 1.6,
                              fontFamily: 'inherit', outline: 'none',
                            }}
                          />
                        </div>
                      )}

                      {/* Slide content section */}
                      <div style={{ padding: '0 16px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-light)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Slide Content</div>
                        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-soft)', border: '1px solid var(--border-light)', fontSize: 13 }}>
                          <input
                            type="text"
                            value={sd.headline || scene.title || ''}
                            onChange={e => {
                              const updated = [...scenes]
                              updated[i] = { ...updated[i], slideData: { ...sd, headline: e.target.value } }
                              setScenes(updated)
                              autoSave(updated, i)
                            }}
                            placeholder="Slide headline"
                            style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 14, width: '100%', outline: 'none', color: 'var(--ink)', fontFamily: 'inherit', marginBottom: 6 }}
                          />
                          {/* Closing CTA text (on-slide) — closing bookend only */}
                          {role === 'closing' && (
                            <input
                              type="text"
                              value={sd.cta || ''}
                              onChange={e => {
                                const updated = [...scenes]
                                updated[i] = { ...updated[i], slideData: { ...sd, cta: e.target.value } }
                                setScenes(updated)
                                autoSave(updated, i)
                              }}
                              placeholder="Call-to-action text (e.g. Reach out to take the next step)"
                              style={{ border: '1px solid var(--border-light)', borderRadius: 6, background: 'white', fontSize: 12, width: '100%', outline: 'none', color: 'var(--ink-soft)', fontFamily: 'inherit', marginBottom: 6, padding: '6px 8px' }}
                            />
                          )}
                          {/* Stats/bullets are for content slides only, not cover/closing */}
                          {!isBookend && stats.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                              {stats.map((st: any, j: number) => (
                                <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 6, background: 'white', border: '1px solid var(--border)', fontSize: 12 }}>
                                  <input
                                    type="text"
                                    value={st.value || ''}
                                    onChange={e => {
                                      const updated = [...scenes]
                                      const newStats = stats.map((s: any, k: number) => k === j ? { ...s, value: e.target.value } : s)
                                      updated[i] = { ...updated[i], slideData: { ...sd, stats: newStats } }
                                      setScenes(updated)
                                      autoSave(updated, i)
                                    }}
                                    placeholder="value"
                                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 700, width: 56, outline: 'none', color: 'var(--ink)', fontFamily: 'inherit' }}
                                  />
                                  <input
                                    type="text"
                                    value={st.label || ''}
                                    onChange={e => {
                                      const updated = [...scenes]
                                      const newStats = stats.map((s: any, k: number) => k === j ? { ...s, label: e.target.value } : s)
                                      updated[i] = { ...updated[i], slideData: { ...sd, stats: newStats } }
                                      setScenes(updated)
                                      autoSave(updated, i)
                                    }}
                                    placeholder="label"
                                    style={{ border: 'none', background: 'transparent', fontSize: 12, width: 70, outline: 'none', color: 'var(--ink-soft)', fontFamily: 'inherit' }}
                                  />
                                  <button
                                    onClick={() => {
                                      const updated = [...scenes]
                                      const newStats = stats.filter((_: any, k: number) => k !== j)
                                      updated[i] = { ...updated[i], slideData: { ...sd, stats: newStats } }
                                      setScenes(updated)
                                      autoSave(updated, i, true)
                                    }}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-light)', fontSize: 13, lineHeight: 1, padding: 0 }}
                                    title="Remove stat"
                                  >&times;</button>
                                </span>
                              ))}
                            </div>
                          )}
                          {!isBookend && (
                          <button
                            onClick={() => {
                              const updated = [...scenes]
                              const newStats = [...stats, { value: '', label: '' }]
                              updated[i] = { ...updated[i], slideData: { ...sd, stats: newStats } }
                              setScenes(updated)
                              autoSave(updated, i, true)
                            }}
                            style={{ border: '1px dashed var(--border)', background: 'none', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--ink-light)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}
                          >+ Add stat</button>
                          )}

                          {/* Editable bullets — content slides only */}
                          {!isBookend && bullets.length > 0 && (
                            <div>
                              {bullets.map((b: string, j: number) => (
                                <div key={j} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                                  <span style={{ color: 'var(--mint)', fontSize: 10 }}>&#9679;</span>
                                  <input
                                    type="text"
                                    value={typeof b === 'string' ? b : (b as any)?.text || ''}
                                    onChange={e => {
                                      const updated = [...scenes]
                                      const newBullets = [...bullets]
                                      newBullets[j] = e.target.value
                                      updated[i] = { ...updated[i], slideData: { ...sd, bullets: newBullets } }
                                      setScenes(updated)
                                      autoSave(updated, i)
                                    }}
                                    style={{ border: 'none', background: 'transparent', fontSize: 12, flex: 1, outline: 'none', color: 'var(--ink-soft)', fontFamily: 'inherit' }}
                                  />
                                  <button
                                    onClick={() => {
                                      const updated = [...scenes]
                                      const newBullets = bullets.filter((_: any, k: number) => k !== j)
                                      updated[i] = { ...updated[i], slideData: { ...sd, bullets: newBullets } }
                                      setScenes(updated)
                                      autoSave(updated, i, true)
                                    }}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-light)', fontSize: 14, lineHeight: 1, padding: 0 }}
                                    title="Remove bullet"
                                  >&times;</button>
                                </div>
                              ))}
                            </div>
                          )}
                          {!isBookend && (
                          <button
                            onClick={() => {
                              const updated = [...scenes]
                              const newBullets = [...bullets, '']
                              updated[i] = { ...updated[i], slideData: { ...sd, bullets: newBullets } }
                              setScenes(updated)
                              autoSave(updated, i, true)
                            }}
                            style={{ border: '1px dashed var(--border)', background: 'none', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--ink-light)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}
                          >+ Add bullet point</button>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePreviewSlide(i) }}
                            style={{
                              background: 'none', border: '1px solid var(--border)',
                              borderRadius: 6, padding: '3px 10px', fontSize: 11, color: 'var(--ink-light)',
                              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                            }}
                          >
                            Preview slide
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            )}

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14, marginTop: 16 }}>
                {typeof error === 'string' ? error : 'Something went wrong. Please try again.'}
              </div>
            )}

            {/* Quick Preview display */}
            {showQuickPreview && quickPreviewData && (
              <div style={{ marginTop: 24 }}>
                <QuickPreview
                  scenes={quickPreviewData.scenes}
                  slides={quickPreviewData.slides}
                  totalScenes={quickPreviewData.totalScenes}
                  onApprove={handleApprovePreview}
                  onEditScript={() => setShowQuickPreview(false)}
                  approving={quickPreviewApproving}
                />
              </div>
            )}

            {!showQuickPreview && (
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button onClick={() => router.push(backPath)} style={{
                  padding: '16px 28px', borderRadius: 10, border: '2px solid var(--border)',
                  background: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-soft)', fontFamily: 'inherit',
                }}>
                  &larr; Back
                </button>
                {quickPreviewData && !showQuickPreview && (
                  <button
                    onClick={() => setShowQuickPreview(true)}
                    style={{
                      padding: '16px 20px', borderRadius: 10,
                      border: '2px solid var(--mint)',
                      background: 'rgba(168,240,212,0.08)', color: 'var(--ink)',
                      fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    View Preview
                  </button>
                )}
                <button
                  onClick={handleContinue}
                  disabled={submitting}
                  style={{
                    flex: 1, padding: '16px 28px', borderRadius: 10, border: 'none',
                    background: submitting ? 'var(--ink-light)' : 'var(--ink)', color: 'white', fontSize: 17, fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    opacity: submitting ? 0.7 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {submitting ? 'Generating...' : 'Generate \u2192'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Out-of-credits top-up modal */}
      <BuyCreditsModal
        open={buyCredits !== null}
        onClose={() => setBuyCredits(null)}
        needed={buyCredits?.needed}
        balance={buyCredits?.balance}
      />

      {/* Preview modal */}
      {previewIdx !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => { setPreviewIdx(null); setPreviewImg(null) }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', background: 'white', borderRadius: 10, padding: 24,
            maxWidth: 700, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Slide {(previewIdx ?? 0) + 1} Preview</div>
                <div style={{ fontSize: 13, color: 'var(--ink-light)' }}>{scenes[previewIdx ?? 0]?.title}</div>
              </div>
              <button onClick={() => { setPreviewIdx(null); setPreviewImg(null) }} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink-light)', padding: 4,
              }}>&times;</button>
            </div>
            {previewLoading ? (
              <div style={{ aspectRatio: '16/9', borderRadius: 10, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ marginRight: 8 }} /> Generating preview...
              </div>
            ) : previewImg ? (
              <img src={previewImg} alt="Slide preview" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10 }} />
            ) : (
              <div style={{ aspectRatio: '16/9', borderRadius: 10, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)' }}>
                Preview failed — try again
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 10, textAlign: 'center' }}>
              This is an approximate preview. Final slides may vary slightly.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

const pageStyles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#F4F1EC',
    padding: '24px 16px 48px',
    fontFamily: 'var(--font-sans, "Plus Jakarta Sans", sans-serif)',
  },
  container: {
    maxWidth: 720,
    margin: '0 auto',
  },
  loadingText: {
    textAlign: 'center' as const,
    padding: 48,
    fontSize: 15,
    color: 'var(--ink-light, #8899AA)',
  },
}
