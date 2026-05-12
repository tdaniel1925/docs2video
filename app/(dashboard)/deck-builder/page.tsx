'use client'

import { useState, useCallback } from 'react'
import BrandStylePicker from '../../_components/BrandStylePicker'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SlideType = 'cover' | 'content' | 'data' | 'closing'

interface Slide {
  id: string
  type: SlideType
  headline: string
  subheadline: string
  bodyPoints: string
  stats: string
}

type Step = 'content' | 'style' | 'generating' | 'done'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function blankSlide(type: SlideType = 'content'): Slide {
  return { id: uid(), type, headline: '', subheadline: '', bodyPoints: '', stats: '' }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DeckBuilderPage() {
  const [step, setStep] = useState<Step>('content')

  // Content state
  const [title, setTitle] = useState('')
  const [slides, setSlides] = useState<Slide[]>([
    blankSlide('cover'),
    blankSlide('content'),
  ])

  // Auto-generate
  const [autoTopic, setAutoTopic] = useState('')
  const [autoLoading, setAutoLoading] = useState(false)

  // Style state
  const [brandId, setBrandId] = useState<string | null>(null)
  const [styleId, setStyleId] = useState('executive')
  const [primaryColor, setPrimaryColor] = useState('#1a1a2e')
  const [secondaryColor, setSecondaryColor] = useState('#16213e')
  const [accentColor, setAccentColor] = useState('#0f3460')
  const [referenceImage, setReferenceImage] = useState<string | null>(null)

  // Generate state
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  /* ---- Slide helpers ---- */

  function updateSlide(id: string, patch: Partial<Slide>) {
    setSlides(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
  }

  function addSlide() {
    if (slides.length >= 20) return
    setSlides(prev => [...prev, blankSlide()])
  }

  function removeSlide(id: string) {
    if (slides.length <= 2) return
    setSlides(prev => prev.filter(s => s.id !== id))
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= slides.length) return
    const next = [...slides]
    ;[next[index], next[target]] = [next[target], next[index]]
    setSlides(next)
  }

  /* ---- Auto-generate slides from topic ---- */

  async function handleAutoGenerate() {
    if (!autoTopic.trim()) return
    setAutoLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: autoTopic, format: 'deck' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate slides')

      const generated: Slide[] = []
      if (Array.isArray(data.slides)) {
        data.slides.forEach((s: any, i: number) => {
          generated.push({
            id: uid(),
            type: i === 0 ? 'cover' : i === data.slides.length - 1 ? 'closing' : (s.type ?? 'content'),
            headline: s.headline ?? s.title ?? '',
            subheadline: s.subheadline ?? '',
            bodyPoints: Array.isArray(s.bodyPoints) ? s.bodyPoints.join('\n') : (s.bodyPoints ?? s.body ?? ''),
            stats: s.stats ?? '',
          })
        })
      }
      if (generated.length >= 2) {
        setSlides(generated)
        if (data.title) setTitle(data.title)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-generate failed')
    } finally {
      setAutoLoading(false)
    }
  }

  /* ---- Reference image upload ---- */

  const handleRefUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setReferenceImage(reader.result as string)
    reader.readAsDataURL(file)
  }, [])

  /* ---- Generate deck ---- */

  async function handleGenerate() {
    setStep('generating')
    setProgress(0)
    setError(null)

    // Simulate progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) { clearInterval(interval); return 90 }
        return prev + Math.random() * 15
      })
    }, 800)

    try {
      const payload = {
        title,
        slides: slides.map(s => ({
          type: s.type,
          headline: s.headline,
          subheadline: s.subheadline || undefined,
          bodyPoints: s.bodyPoints.split('\n').filter(Boolean),
          stats: s.stats || undefined,
        })),
        brandId,
        styleId,
        primaryColor: !brandId ? primaryColor : undefined,
        secondaryColor: !brandId ? secondaryColor : undefined,
        accentColor: !brandId ? accentColor : undefined,
        referenceImage: referenceImage || undefined,
      }

      const res = await fetch('/api/generate-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      clearInterval(interval)
      setProgress(100)
      setDownloadUrl(data.downloadUrl || data.url || null)
      setTimeout(() => setStep('done'), 400)
    } catch (err) {
      clearInterval(interval)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('style')
    }
  }

  /* ---- Validation ---- */

  const contentValid = title.trim().length > 0 && slides.length >= 2 && slides.every(s => s.headline.trim().length > 0)

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>Deck Builder</h1>
          <p>Create editable PowerPoint decks with AI-generated backgrounds. Build slides, pick your brand style, and download a polished PPTX.</p>
        </div>
        <div style={{
          background: 'rgba(168,240,212,0.15)', border: '1px solid var(--mint)',
          borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          2 credits per deck
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,199,194,0.15)', border: '1px solid var(--rose)',
          borderRadius: 10, padding: '14px 20px', fontSize: 14, color: '#C03A1F', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn btn-soft btn-sm">Dismiss</button>
        </div>
      )}

      {/* Step indicator */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
      }}>
        {(['content', 'style', 'generating', 'done'] as Step[]).map((s, i) => (
          <div key={s} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= ['content', 'style', 'generating', 'done'].indexOf(step) ? 'var(--mint)' : 'var(--border-light)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* ========== STEP 1: CONTENT ========== */}
      {step === 'content' && (
        <div>
          {/* Auto-generate bar */}
          <div className="wizard-card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Auto-Generate from Topic</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
              Enter a topic and AI will create a full set of slides for you to customize.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="input"
                placeholder="e.g., Q3 2026 Marketing Strategy, Benefits of Cloud Migration..."
                value={autoTopic}
                onChange={e => setAutoTopic(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAutoGenerate() }}
                style={{ flex: 1 }}
              />
              <button
                onClick={handleAutoGenerate}
                disabled={!autoTopic.trim() || autoLoading}
                className="btn btn-soft"
                style={{ whiteSpace: 'nowrap' }}
              >
                {autoLoading ? 'Generating...' : 'Auto-Generate'}
              </button>
            </div>
            {autoLoading && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <div className="spinner" style={{ margin: '0 auto 6px' }} />
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>AI is researching and structuring your deck...</div>
              </div>
            )}
          </div>

          {/* Deck title */}
          <div className="wizard-card" style={{ marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Deck Title *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., Q3 Marketing Strategy Review"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
          </div>

          {/* Slides */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                Slides ({slides.length})
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-soft)', marginLeft: 8 }}>
                  min 2, max 20
                </span>
              </h3>
              <button
                onClick={addSlide}
                disabled={slides.length >= 20}
                className="btn btn-soft btn-sm"
              >
                + Add Slide
              </button>
            </div>

            {slides.map((slide, i) => (
              <div key={slide.id} style={{
                background: 'white', border: '1px solid var(--border-light)',
                borderRadius: 12, padding: '20px 20px 16px', marginBottom: 10,
              }}>
                {/* Slide header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: 'var(--mint)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 13, flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>

                  <select
                    className="input"
                    value={slide.type}
                    onChange={e => updateSlide(slide.id, { type: e.target.value as SlideType })}
                    style={{ width: 130, flex: 'none' }}
                  >
                    <option value="cover">Cover</option>
                    <option value="content">Content</option>
                    <option value="data">Data</option>
                    <option value="closing">Closing</option>
                  </select>

                  <div style={{ flex: 1 }} />

                  {/* Reorder buttons */}
                  <button
                    onClick={() => moveSlide(i, -1)}
                    disabled={i === 0}
                    style={{
                      background: 'none', border: '1px solid var(--border-light)',
                      borderRadius: 6, width: 28, height: 28, cursor: i === 0 ? 'default' : 'pointer',
                      opacity: i === 0 ? 0.3 : 1, fontSize: 12, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                    title="Move up"
                  >
                    &#9650;
                  </button>
                  <button
                    onClick={() => moveSlide(i, 1)}
                    disabled={i === slides.length - 1}
                    style={{
                      background: 'none', border: '1px solid var(--border-light)',
                      borderRadius: 6, width: 28, height: 28,
                      cursor: i === slides.length - 1 ? 'default' : 'pointer',
                      opacity: i === slides.length - 1 ? 0.3 : 1, fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="Move down"
                  >
                    &#9660;
                  </button>
                  <button
                    onClick={() => removeSlide(slide.id)}
                    disabled={slides.length <= 2}
                    style={{
                      background: 'none', border: '1px solid var(--border-light)',
                      borderRadius: 6, width: 28, height: 28, cursor: 'pointer',
                      color: '#C03A1F', fontSize: 13, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      opacity: slides.length <= 2 ? 0.3 : 1,
                    }}
                    title="Remove slide"
                  >
                    &#10005;
                  </button>
                </div>

                {/* Slide fields */}
                <div style={{ display: 'grid', gap: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Headline *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Slide headline"
                      value={slide.headline}
                      onChange={e => updateSlide(slide.id, { headline: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Subheadline</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Optional subheadline"
                      value={slide.subheadline}
                      onChange={e => updateSlide(slide.id, { subheadline: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Body Points <span style={{ fontWeight: 400, color: 'var(--ink-light)' }}>(one per line)</span></label>
                    <textarea
                      className="input"
                      style={{ minHeight: 70, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
                      placeholder={"First bullet point\nSecond bullet point\nThird bullet point"}
                      value={slide.bodyPoints}
                      onChange={e => updateSlide(slide.id, { bodyPoints: e.target.value })}
                    />
                  </div>

                  {(slide.type === 'data' || slide.stats) && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">Stats / Data Points</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g., Revenue: $2.4M, Growth: +18%, Users: 50K"
                        value={slide.stats}
                        onChange={e => updateSlide(slide.id, { stats: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep('style')}
            disabled={!contentValid}
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
          >
            Continue to Style &amp; Brand &rarr;
          </button>
          {!contentValid && (
            <div style={{ fontSize: 12, color: 'var(--ink-light)', textAlign: 'center', marginTop: 8 }}>
              Enter a deck title and a headline for every slide to continue.
            </div>
          )}
        </div>
      )}

      {/* ========== STEP 2: STYLE & BRAND ========== */}
      {step === 'style' && (
        <div>
          <div className="wizard-card" style={{ marginBottom: 20 }}>
            <h2>Style &amp; Brand</h2>
            <p className="wizard-sub">Choose a brand and visual style for your deck. You can also upload a reference image for template inspiration.</p>

            <BrandStylePicker
              onSelect={({ brandId: b, styleId: s }) => { setBrandId(b); setStyleId(s) }}
              initialBrandId={brandId}
              initialStyleId={styleId}
            />
          </div>

          {/* Manual colors (when no brand selected) */}
          {!brandId && (
            <div className="wizard-card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Custom Colors</h3>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>
                No brand selected — pick colors manually for your deck.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Primary', value: primaryColor, setter: setPrimaryColor },
                  { label: 'Secondary', value: secondaryColor, setter: setSecondaryColor },
                  { label: 'Accent', value: accentColor, setter: setAccentColor },
                ].map(c => (
                  <div key={c.label} className="form-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">{c.label}</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="color"
                        value={c.value}
                        onChange={e => c.setter(e.target.value)}
                        style={{ width: 40, height: 36, padding: 0, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        className="input"
                        value={c.value}
                        onChange={e => c.setter(e.target.value)}
                        style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reference image upload */}
          <div className="wizard-card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Reference Image (Optional)</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
              Upload an image for template inspiration. AI will match its visual style.
            </p>
            {!referenceImage ? (
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleRefUpload(f) }}
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleRefUpload(f) }
                  input.click()
                }}
                style={{
                  border: '2px dashed var(--border)', borderRadius: 10, padding: '28px 20px',
                  textAlign: 'center', background: 'var(--bg-soft)', cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 6 }}>&#128247;</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Drop or click to upload</div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>Any image — slide template, poster, screenshot</div>
              </div>
            ) : (
              <div>
                <img src={referenceImage} alt="Reference" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 10 }} />
                <button onClick={() => setReferenceImage(null)} className="btn btn-soft btn-sm" style={{ marginTop: 8 }}>Remove</button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setStep('content')} className="btn btn-soft" style={{ flex: 1 }}>
              &larr; Back to Slides
            </button>
            <button
              onClick={handleGenerate}
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              Generate Deck ({slides.length} slides, 2 credits)
            </button>
          </div>
        </div>
      )}

      {/* ========== STEP 3: GENERATING ========== */}
      {step === 'generating' && (
        <div className="wizard-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Building Your Deck</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 24, maxWidth: 420, margin: '0 auto 24px' }}>
            AI is generating backgrounds and assembling your {slides.length}-slide presentation. This usually takes 30-60 seconds.
          </p>

          {/* Progress bar */}
          <div style={{
            width: '100%', maxWidth: 400, height: 8, borderRadius: 4,
            background: 'var(--border-light)', margin: '0 auto 12px', overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(progress, 100)}%`, height: '100%',
              background: 'var(--mint)', borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-light)' }}>
            {progress < 30 ? 'Generating AI backgrounds...' :
             progress < 60 ? 'Laying out slides...' :
             progress < 90 ? 'Assembling PPTX file...' :
             'Finalizing...'}
          </div>
        </div>
      )}

      {/* ========== STEP 4: DONE ========== */}
      {step === 'done' && (
        <div className="wizard-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>&#9989;</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Your Deck is Ready!</h2>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 8, maxWidth: 480, margin: '0 auto 8px' }}>
            <strong>{title}</strong> &mdash; {slides.length} slides
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 28 }}>
            Download your PPTX file and open it in PowerPoint, Google Slides, or Keynote. All text is fully editable.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="btn btn-primary btn-lg"
                style={{ textDecoration: 'none' }}
              >
                Download PPTX
              </a>
            )}
            <button
              onClick={() => {
                setStep('content')
                setTitle('')
                setSlides([blankSlide('cover'), blankSlide('content')])
                setAutoTopic('')
                setProgress(0)
                setDownloadUrl(null)
                setReferenceImage(null)
                setError(null)
              }}
              className="btn btn-soft btn-lg"
            >
              Create Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
