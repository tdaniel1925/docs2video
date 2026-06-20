'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import WizardProgress from '../_components/WizardProgress'

type ThemeId = 'cinematic' | 'editorial' | 'time'

const THEMES: { id: ThemeId; name: string; tagline: string; previewable: boolean }[] = [
  { id: 'cinematic', name: 'Cinematic', tagline: 'Film-style imagery, kinetic text, motion. Best for story-led, emotive videos.', previewable: false },
  { id: 'editorial', name: 'Editorial', tagline: 'Clean, warm magazine layout. Refined typography on your brand color.', previewable: true },
  { id: 'time', name: 'Newsmagazine', tagline: 'Bold red-framed report — drop caps, big numbers, charts. Authoritative.', previewable: true },
]

export default function ThemePage() {
  const router = useRouter()
  const params = useSearchParams()
  const videoId = params.get('id')

  const [draft, setDraft] = useState<any>(null)
  const [outputType, setOutputType] = useState<'video' | 'pptx' | 'pdf'>('video')
  const [selected, setSelected] = useState<ThemeId>('cinematic')
  const [loading, setLoading] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [previews, setPreviews] = useState<Record<string, string[]>>({})
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load the draft (script + brand + presenter prefs saved earlier).
  useEffect(() => {
    if (!videoId) { setLoading(false); return }
    fetch(`/api/videos/draft?videoId=${videoId}`).then(r => r.json()).then((v) => {
      const d = v?.draft_data || v || {}
      setDraft(d)
      setOutputType(d.outputType || v?.output_type || 'video')
      if (d.videoStyle) setSelected(d.videoStyle)
      setLoading(false)
    }).catch(() => { setError('Could not load your draft.'); setLoading(false) })
  }, [videoId])

  const runPreview = useCallback(async (theme: ThemeId) => {
    if (!videoId || !draft) return
    const t = THEMES.find(x => x.id === theme)
    if (!t?.previewable) return            // cinematic → static sample, no live render
    if (previews[theme]) return            // cached
    setPreviewing(true); setError(null)
    try {
      const res = await fetch('/api/preview-theme', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId, variant: theme, scenes: draft.scenes || [],
          brandId: draft.brandId || draft.selectedBrand || undefined,
          extracted: draft.extractedData || {},
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setPreviews((p) => ({ ...p, [theme]: data.stills || [] }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally { setPreviewing(false) }
  }, [videoId, draft, previews])

  function selectTheme(theme: ThemeId) {
    setSelected(theme)
    runPreview(theme)
  }

  async function handleGenerate() {
    if (!videoId || !draft) return
    setSubmitting(true); setError(null)
    try {
      // Persist the choice + trigger generation with the per-video videoStyle.
      await fetch('/api/videos/draft', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, updates: { videoStyle: selected } }),
      })
      const genRes = await fetch('/api/generate-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          outputType,
          videoStyle: selected,
          policyData: draft.extractedData || {},
          purpose: draft.purpose || 'Create a professional video',
          recipientName: draft.recipientName || undefined,
          preGeneratedScenes: draft.scenes || [],
          brandId: draft.brandId || draft.selectedBrand || draft.autoBrandId || undefined,
          voiceId: draft.voiceId || 'nova',
          narrationStyle: draft.narrationStyle || 'solo',
          detailLevel: draft.detailLevel,
          industry: (draft.extractedData as any)?.industry || 'general',
          aiMusic: draft.aiMusic ?? false,
          musicPrompt: draft.aiMusic ? 'Professional ambient background music, subtle and warm' : undefined,
          styleId: draft.styleId || undefined,
          customStylePrompt: draft.customStylePrompt || undefined,
          presenterIntro: draft.presenterIntro || undefined,
          introduceInOpening: draft.introduceInOpening,
          showContactClosing: draft.showContactClosing,
          photoPlacement: draft.photoPlacement || undefined,
        }),
      })
      if (!genRes.ok) {
        const g = await genRes.json().catch(() => ({}))
        throw new Error(g.error || 'Failed to start generation')
      }
      router.push(`/create/generating?id=${videoId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate')
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner" /></div>
  }

  const sel = THEMES.find(t => t.id === selected)!
  const selStills = previews[selected] || []

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px 40px', maxWidth: 920, margin: '0 auto', width: '100%' }}>
      <WizardProgress currentStep={outputType === 'video' ? 5 : 4} outputType={outputType} />

      <div style={{ width: '100%', marginTop: 8, marginBottom: 8 }}>
        <button onClick={() => router.push(`/create/script?id=${videoId}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink-light)', fontFamily: 'inherit', padding: 0 }}>&larr; Back</button>
      </div>

      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 8, color: 'var(--ink)' }}>Choose a style</h1>
      <p style={{ fontSize: 17, color: 'var(--ink-soft)', textAlign: 'center', marginBottom: 28, lineHeight: 1.6 }}>
        Pick the look for your video. Editorial &amp; Newsmagazine show a live preview of your real content &mdash; free, no image credits used.
      </p>

      {/* Theme cards */}
      <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {THEMES.map((t) => {
          const isSel = selected === t.id
          return (
            <button key={t.id} onClick={() => selectTheme(t.id)} style={{
              padding: '20px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              border: isSel ? '2px solid var(--mint)' : '1.5px solid var(--border-light)',
              background: isSel ? 'rgba(199, 232, 168, 0.10)' : 'white', transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>{t.name}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.45 }}>{t.tagline}</div>
            </button>
          )
        })}
      </div>

      {/* Preview area */}
      <div style={{ width: '100%', minHeight: 220, background: 'white', border: '1.5px solid var(--border-light)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
        {!sel.previewable ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14, padding: '40px 0' }}>
            <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Cinematic uses AI-generated imagery</div>
            A live preview isn&apos;t shown for Cinematic (it would use image credits). You&apos;ll see the finished video after generating.
          </div>
        ) : previewing ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14, padding: '40px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} /> Rendering a preview of your content…
          </div>
        ) : selStills.length ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {selStills.map((url, i) => (
              <img key={i} src={url} alt={`Preview ${i + 1}`} onClick={() => setLightbox(url)} style={{ width: 260, borderRadius: 6, border: '1px solid var(--border-light)', cursor: 'zoom-in' }} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14, padding: '40px 0' }}>
            <button onClick={() => runPreview(selected)} style={{ background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              Generate preview
            </button>
          </div>
        )}
      </div>

      {error ? <div style={{ color: '#b91c1c', fontSize: 14, marginBottom: 16 }}>{error}</div> : null}

      <button onClick={handleGenerate} disabled={submitting} style={{
        width: '100%', maxWidth: 520, padding: '16px', borderRadius: 10, border: 'none',
        background: 'var(--ink)', color: 'white', fontSize: 16, fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
        fontFamily: 'inherit', opacity: submitting ? 0.6 : 1,
      }}>
        {submitting ? 'Starting…' : `Generate with ${sel.name} →`}
      </button>

      {/* Lightbox */}
      {lightbox ? (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,12,16,0.88)', padding: 24, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="Preview" style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      ) : null}
    </div>
  )
}
