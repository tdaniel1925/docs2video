'use client'

import { useState, useRef } from 'react'

interface ExtractedSlide {
  index: number
  imageBase64: string
  type: 'cover' | 'content' | 'data' | 'closing' | 'unknown'
  detectedText: string[]
}

interface SlideEdit {
  headline: string
  bullets: string[]
  generateImage: boolean
  imagePrompt: string
}

export default function TemplateDemoPage() {
  const [uploading, setUploading] = useState(false)
  const [extractedSlides, setExtractedSlides] = useState<ExtractedSlide[]>([])
  const [edits, setEdits] = useState<SlideEdit[]>([])
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<'upload' | 'edit' | 'generating' | 'done'>('upload')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/template-demo/extract', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')

      setExtractedSlides(data.slides)
      setEdits(data.slides.map((s: ExtractedSlide) => ({
        headline: s.detectedText[0] || '',
        bullets: s.detectedText.slice(1, 5),
        generateImage: false,
        imagePrompt: '',
      })))
      setStage('edit')
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function updateEdit(idx: number, field: keyof SlideEdit, value: any) {
    setEdits(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      return updated
    })
  }

  function updateBullet(slideIdx: number, bulletIdx: number, value: string) {
    setEdits(prev => {
      const updated = [...prev]
      const bullets = [...updated[slideIdx].bullets]
      bullets[bulletIdx] = value
      updated[slideIdx] = { ...updated[slideIdx], bullets }
      return updated
    })
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    setStage('generating')

    try {
      const res = await fetch('/api/template-demo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: extractedSlides.map((s, i) => ({
            index: s.index,
            originalImage: s.imageBase64,
            type: s.type,
            edit: edits[i],
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setGeneratedUrl(data.downloadUrl)
      setStage('done')
    } catch (err: any) {
      setError(err.message || 'Generation failed')
      setStage('edit')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>
        Template Slide Demo
      </h1>
      <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 32 }}>
        Upload a PowerPoint template, edit the text, optionally generate AI images for placeholders, and download the result.
      </p>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14, marginBottom: 20 }}>
          {typeof error === 'string' ? error : 'Something went wrong'}
        </div>
      )}

      {/* STAGE 1: Upload */}
      {stage === 'upload' && (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed var(--border)', borderRadius: 10, background: 'white' }}>
          <input ref={fileRef} type="file" accept=".pptx" style={{ display: 'none' }} onChange={() => {}} />
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#128196;</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--ink)' }}>
            Upload a PowerPoint template
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 20 }}>
            .pptx files only. We'll extract the slides and let you edit the text.
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              padding: '12px 28px', borderRadius: 10, border: 'none',
              background: 'var(--ink)', color: 'white', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', marginRight: 12,
            }}
          >
            Choose File
          </button>
          {fileRef.current?.files?.[0] && (
            <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
              {fileRef.current.files[0].name}
            </span>
          )}
          <div style={{ marginTop: 16 }}>
            <button
              onClick={handleUpload}
              disabled={uploading || !fileRef.current?.files?.[0]}
              style={{
                padding: '14px 32px', borderRadius: 10, border: 'none',
                background: uploading ? 'var(--border)' : '#C7E8A8',
                color: 'var(--ink)', fontSize: 16, fontWeight: 700,
                cursor: uploading ? 'wait' : 'pointer',
              }}
            >
              {uploading ? 'Extracting slides...' : 'Extract Slides'}
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: Edit slides */}
      {stage === 'edit' && extractedSlides.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
              {extractedSlides.length} slides extracted — edit the text below
            </div>
            <button
              onClick={() => { setStage('upload'); setExtractedSlides([]); setEdits([]) }}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'white', fontSize: 13, cursor: 'pointer', color: 'var(--ink-soft)' }}
            >
              Upload different template
            </button>
          </div>

          {extractedSlides.map((slide, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20,
              marginBottom: 20, padding: 20, borderRadius: 10,
              background: 'white', border: '1px solid var(--border-light)',
            }}>
              {/* Slide preview */}
              <div>
                <img
                  src={`data:image/png;base64,${slide.imageBase64}`}
                  alt={`Slide ${i + 1}`}
                  style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border-light)' }}
                />
                <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 6, textAlign: 'center' }}>
                  Slide {i + 1} — {slide.type}
                </div>
              </div>

              {/* Edit form */}
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 4 }}>
                    Headline
                  </label>
                  <input
                    value={edits[i]?.headline || ''}
                    onChange={e => updateEdit(i, 'headline', e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 8,
                      border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 4 }}>
                    Bullet points
                  </label>
                  {(edits[i]?.bullets || []).map((b, j) => (
                    <input
                      key={j}
                      value={b}
                      onChange={e => updateBullet(i, j, e.target.value)}
                      placeholder={`Bullet ${j + 1}`}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        border: '1px solid var(--border-light)', fontSize: 13,
                        fontFamily: 'inherit', marginBottom: 6,
                      }}
                    />
                  ))}
                  <button
                    onClick={() => updateEdit(i, 'bullets', [...(edits[i]?.bullets || []), ''])}
                    style={{ fontSize: 12, color: 'var(--ink-light)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    + Add bullet
                  </button>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={edits[i]?.generateImage || false}
                      onChange={e => updateEdit(i, 'generateImage', e.target.checked)}
                      style={{ accentColor: 'var(--mint)' }}
                    />
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Generate AI image for this slide</span>
                  </label>
                  {edits[i]?.generateImage && (
                    <input
                      value={edits[i]?.imagePrompt || ''}
                      onChange={e => updateEdit(i, 'imagePrompt', e.target.value)}
                      placeholder="Describe the image you want (e.g. 'family protected by insurance')"
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        border: '1px solid var(--border-light)', fontSize: 13,
                        fontFamily: 'inherit', marginTop: 8,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={handleGenerate}
            style={{
              width: '100%', padding: '16px', borderRadius: 10, border: 'none',
              background: 'var(--ink)', color: 'white', fontSize: 17, fontWeight: 700,
              cursor: 'pointer', marginTop: 8,
            }}
          >
            Generate PPTX with edits
          </button>
        </div>
      )}

      {/* STAGE 3: Generating */}
      {stage === 'generating' && (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div className="spinner" style={{ marginBottom: 20 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>Generating your presentation...</div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 8 }}>This may take a minute if AI images are being generated.</div>
        </div>
      )}

      {/* STAGE 4: Done */}
      {stage === 'done' && generatedUrl && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: 10, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10004;</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
            Your presentation is ready!
          </div>
          <a
            href={generatedUrl}
            download
            style={{
              display: 'inline-block', padding: '14px 32px', borderRadius: 10,
              background: '#C7E8A8', color: 'var(--ink)', fontSize: 16, fontWeight: 700,
              textDecoration: 'none', marginRight: 12,
            }}
          >
            Download PPTX
          </a>
          <button
            onClick={() => { setStage('upload'); setExtractedSlides([]); setEdits([]); setGeneratedUrl(null) }}
            style={{
              padding: '14px 24px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-soft)',
            }}
          >
            Start over
          </button>
        </div>
      )}
    </div>
  )
}
