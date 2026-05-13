'use client'

import { useState, useEffect } from 'react'
import BrandStylePicker from '../../_components/BrandStylePicker'

type Step = 'content' | 'style' | 'results'

interface InfographicSize {
  id: string
  label: string
  aspectRatio: string
  width: number
  height: number
  previewW: number
  previewH: number
}

const INFOGRAPHIC_SIZES: InfographicSize[] = [
  { id: 'portrait',  label: 'Standard (1080x1920)',   aspectRatio: '9:16', width: 1080, height: 1920, previewW: 40, previewH: 72 },
  { id: 'square',    label: 'Square (1080x1080)',      aspectRatio: '1:1',  width: 1080, height: 1080, previewW: 56, previewH: 56 },
  { id: 'landscape', label: 'Landscape (1920x1080)',  aspectRatio: '16:9', width: 1920, height: 1080, previewW: 72, previewH: 40 },
  { id: 'a4',        label: 'A4 Portrait (2480x3508)', aspectRatio: '3:4', width: 2480, height: 3508, previewW: 46, previewH: 66 },
  { id: 'letter',    label: 'Letter (2550x3300)',      aspectRatio: '3:4', width: 2550, height: 3300, previewW: 50, previewH: 66 },
  { id: 'custom',    label: 'Custom',                  aspectRatio: '1:1', width: 1080, height: 1080, previewW: 56, previewH: 56 },
]

const STEP_LABELS = [
  { key: 'content', label: '1. Your Infographic' },
  { key: 'style', label: '2. Pick a Look' },
  { key: 'results', label: '3. Your Infographic' },
]

function getStepIndex(step: Step): number {
  const idx = STEP_LABELS.findIndex(s => s.key === step)
  return idx >= 0 ? idx : 0
}

function InfographicProgress() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(prev => prev + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const pct = Math.min(elapsed / 60, 0.95) * 100
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ maxWidth: 360, margin: '0 auto 20px', height: 6, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 10, background: 'var(--mint)',
          transition: 'width 1s ease',
          width: `${Math.max(5, pct)}%`,
        }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
        Generating your infographic...
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 6 }}>
        {elapsed}s elapsed
      </div>
    </div>
  )
}

export default function InfographicCreatorPage() {
  const [step, setStep] = useState<Step>('content')

  // Step 1 state
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedSize, setSelectedSize] = useState<string>('portrait')

  const [customWidth, setCustomWidth] = useState(1080)
  const [customHeight, setCustomHeight] = useState(1080)

  // Step 2 state
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string>('executive')
  const [customStylePrompt, setCustomStylePrompt] = useState('')

  // Step 3 state
  const [generating, setGenerating] = useState(false)
  const [resultImage, setResultImage] = useState<{ imageUrl: string; width: number; height: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setStep('results')
    setGenerating(true)
    setError(null)
    setResultImage(null)

    try {
      const res = await fetch('/api/generate-infographic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedBrand,
          styleId: selectedStyle,
          customStylePrompt: customStylePrompt || undefined,
          title,
          subtitle,
          content,
          size: selectedSize,
          ...(selectedSize === 'custom' ? { width: customWidth, height: customHeight } : {}),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate infographic')
      }

      const data = await res.json()
      setResultImage({ imageUrl: data.imageUrl, width: data.width, height: data.height })
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!resultImage) return
    const link = document.createElement('a')
    link.href = resultImage.imageUrl
    link.download = `infographic-${selectedSize}-${resultImage.width}x${resultImage.height}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleRestart = () => {
    setStep('content')
    setResultImage(null)
    setTitle('')
    setSubtitle('')
    setContent('')
    setSelectedSize('portrait')
    setCustomWidth(1080)
    setCustomHeight(1080)
  }

  const currentStepIndex = getStepIndex(step)

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    fontSize: 15,
    background: 'var(--bg-card, #fff)',
    color: 'var(--ink)',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
        Infographic Creator
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 32 }}>
        Turn your data into a stunning single-page infographic.
      </p>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
        {STEP_LABELS.map((s, i) => (
          <div
            key={s.key}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i <= currentStepIndex ? 'var(--mint)' : 'var(--border)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {/* Step 1: Content */}
      {step === 'content' && (
        <div className="wizard-card">
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>What&apos;s your infographic about?</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            Enter the title and content for your infographic.
          </p>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Title <span style={{ color: 'var(--error, #e53e3e)' }}>*</span>
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="Infographic title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Subtitle
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="Optional subtitle"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Content <span style={{ color: 'var(--error, #e53e3e)' }}>*</span>
            </label>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>
              Paste your data, stats, or key points here. The AI will organize it visually.
            </p>
            <textarea
              className="input-textarea"
              placeholder="e.g. Revenue grew 18% to $1.5M. Customer retention at 94%. Expanded to 3 new markets. Team grew from 25 to 35 employees..."
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              style={{
                ...inputStyle,
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 10, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Size
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
            }}>
              {INFOGRAPHIC_SIZES.map(size => {
                const isSelected = selectedSize === size.id
                return (
                  <div
                    key={size.id}
                    onClick={() => setSelectedSize(size.id)}
                    style={{
                      border: isSelected ? '2px solid var(--mint)' : '2px solid var(--border)',
                      borderRadius: 10,
                      padding: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      background: isSelected ? 'rgba(0,210,150,0.05)' : 'var(--bg-card, #fff)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{
                      width: size.previewW,
                      height: size.previewH,
                      border: '2px solid var(--border)',
                      borderRadius: 3,
                      background: isSelected ? 'rgba(0,210,150,0.1)' : 'var(--bg, #f5f5f5)',
                      flexShrink: 0,
                    }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{size.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{size.width} x {size.height}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {selectedSize === 'custom' && (
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    Width (px)
                  </label>
                  <input
                    type="number"
                    className="input-text"
                    min={200}
                    max={5000}
                    value={customWidth}
                    onChange={e => setCustomWidth(Math.max(200, Math.min(5000, parseInt(e.target.value) || 200)))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    Height (px)
                  </label>
                  <input
                    type="number"
                    className="input-text"
                    min={200}
                    max={5000}
                    value={customHeight}
                    onChange={e => setCustomHeight(Math.max(200, Math.min(5000, parseInt(e.target.value) || 200)))}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            disabled={!title.trim() || !content.trim()}
            onClick={() => setStep('style')}
            style={{ width: '100%', padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
          >
            Next
          </button>
        </div>
      )}

      {/* Step 2: Style */}
      {step === 'style' && (
        <div className="wizard-card">
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Pick a style</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            Choose a visual style for your infographic. Your brand colors will be applied automatically.
          </p>

          <BrandStylePicker
            onSelect={({ brandId: b, styleId: s, customStylePrompt: p }) => {
              setSelectedBrand(b)
              setSelectedStyle(s)
              if (p) setCustomStylePrompt(p)
            }}
          />

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-soft"
              onClick={() => setStep('content')}
              style={{ flex: 1, padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
            >
              Back
            </button>
            <button
              className="btn btn-mint"
              onClick={handleGenerate}
              style={{ flex: 2, padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
            >
              Generate Infographic
            </button>
          </div>
          <div style={{
            textAlign: 'center', marginTop: 12, padding: '10px 16px',
            background: 'var(--bg-soft, #f8fafc)', borderRadius: 10,
            border: '1px solid var(--border, #e2e8f0)',
            fontSize: 13, color: 'var(--ink-soft)',
          }}>
            Infographic — <strong style={{ color: 'var(--ink)' }}>$19</strong>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 'results' && (
        <div className="wizard-card">
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Your infographic</h2>

          {generating && <InfographicProgress />}

          {error && !generating && (
            <div style={{
              padding: '16px 20px',
              borderRadius: 10,
              background: 'rgba(229,62,62,0.08)',
              border: '1px solid rgba(229,62,62,0.2)',
              color: '#e53e3e',
              fontSize: 14,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {!generating && resultImage && (
            <>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
                Your infographic is ready.
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleDownload}
                  style={{ padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
                >
                  Download
                </button>
                <button
                  className="btn btn-soft"
                  onClick={handleRestart}
                  style={{ padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
                >
                  Create Another
                </button>
              </div>

              <div style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
                background: 'var(--bg-card, #fff)',
              }}>
                <img
                  src={resultImage.imageUrl}
                  alt="Generated infographic"
                  style={{ width: '100%', display: 'block' }}
                />
                <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                  {resultImage.width} x {resultImage.height}
                </div>
              </div>
            </>
          )}

          {!generating && !resultImage && !error && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              No infographic generated yet.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
