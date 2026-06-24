'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type ThemeId = 'aurora' | 'cinematic' | 'editorial' | 'explainer'

// Static sample images live in /public/style-samples/<id>-{cover,data,closing}.png
// (rendered once — no live preview, so picking a style is instant + adds no
// production time). Newsmagazine ('time') exists in the engine but is no longer
// offered (it overlapped Editorial too much).
const THEMES: { id: ThemeId; name: string; tagline: string }[] = [
  { id: 'aurora', name: 'Aurora', tagline: 'Modern motion-graphics — one flowing branded backdrop, kinetic type, no stock imagery. Clean, cohesive, premium.' },
  { id: 'cinematic', name: 'Cinematic', tagline: 'Film-style imagery, kinetic text, motion. Best for story-led, emotive videos.' },
  { id: 'editorial', name: 'Editorial', tagline: 'Clean, warm magazine layout. Refined serif typography on your brand color.' },
  { id: 'explainer', name: 'Explainer', tagline: 'Friendly modern deck — navy + color accents, big rounded cards, charts. Great for how-it-works.' },
]
const SAMPLE_KINDS = ['cover', 'data', 'closing']

export default function ThemePage() {
  const router = useRouter()
  const params = useSearchParams()
  const videoId = params.get('id')

  const [draft, setDraft] = useState<any>(null)
  const [outputType, setOutputType] = useState<'video' | 'pptx' | 'pdf'>('video')
  const [selected, setSelected] = useState<ThemeId>('cinematic')
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!videoId) { setLoading(false); return }
    fetch(`/api/videos/draft?videoId=${videoId}`).then(r => r.json()).then((v) => {
      const d = v?.draft_data || v || {}
      setDraft(d)
      setOutputType(d.outputType || v?.output_type || 'video')
      if (d.videoStyle && THEMES.some(t => t.id === d.videoStyle)) setSelected(d.videoStyle)
      setLoading(false)
    }).catch(() => { setError('Could not load your draft.'); setLoading(false) })
  }, [videoId])

  async function handleGenerate() {
    if (!videoId || !draft) return
    setSubmitting(true); setError(null)
    try {
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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px 40px', maxWidth: 920, margin: '0 auto', width: '100%' }}>

      <div style={{ width: '100%', marginTop: 8, marginBottom: 8 }}>
        <button onClick={() => router.push(`/create/script?id=${videoId}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink-light)', fontFamily: 'inherit', padding: 0 }}>&larr; Back</button>
      </div>

      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 8, color: 'var(--ink)' }}>Choose a style</h1>
      <p style={{ fontSize: 17, color: 'var(--ink-soft)', textAlign: 'center', marginBottom: 28, lineHeight: 1.6 }}>
        Pick the look for your video. The samples below show how each style renders.
      </p>

      {/* Theme cards */}
      <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {THEMES.map((t) => {
          const isSel = selected === t.id
          return (
            <button key={t.id} onClick={() => setSelected(t.id)} style={{
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

      {/* Static samples for the selected style */}
      <div style={{ width: '100%', background: 'white', border: '1.5px solid var(--border-light)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          {sel.name} — sample slides
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {SAMPLE_KINDS.map((kind) => {
            const url = `/style-samples/${selected}-${kind}.png`
            return (
              <img
                key={kind}
                src={url}
                alt={`${sel.name} ${kind}`}
                onClick={() => setLightbox(url)}
                style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border-light)', cursor: 'zoom-in', display: 'block' }}
              />
            )
          })}
        </div>
      </div>

      {error ? <div style={{ color: '#b91c1c', fontSize: 14, marginBottom: 16 }}>{error}</div> : null}

      <button onClick={handleGenerate} disabled={submitting} style={{
        width: '100%', maxWidth: 520, padding: '16px', borderRadius: 10, border: 'none',
        background: 'var(--ink)', color: 'white', fontSize: 16, fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
        fontFamily: 'inherit', opacity: submitting ? 0.6 : 1,
      }}>
        {submitting ? 'Starting…' : `Generate with ${sel.name} →`}
      </button>

      {lightbox ? (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,12,16,0.88)', padding: 24, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="Sample" style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      ) : null}
    </div>
  )
}
