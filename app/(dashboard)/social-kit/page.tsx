'use client'

import { useState, useCallback } from 'react'
import BrandStylePicker from '../../_components/BrandStylePicker'

type Step = 'input' | 'generating' | 'results'

interface GeneratedImage {
  platform: string
  label: string
  width: number
  height: number
  imageUrl: string
}

interface PlatformResult {
  platform: string
  images: GeneratedImage[]
}

const STEP_LABELS = [
  { key: 'input', label: '1. Brand Info' },
  { key: 'generating', label: '2. Generating' },
  { key: 'results', label: '3. Your Kit' },
]

const MASTER_LABELS = [
  'Generating landscape master...',
  'Generating square master...',
  'Generating vertical master...',
  'Resizing for all platforms...',
]

function getStepIndex(step: Step): number {
  const idx = STEP_LABELS.findIndex(s => s.key === step)
  return idx >= 0 ? idx : 0
}

export default function SocialKitPage() {
  const [step, setStep] = useState<Step>('input')

  // Step 1 state
  const [companyName, setCompanyName] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#1B3A5C')
  const [brandId, setBrandId] = useState<string | null>(null)
  const [styleId, setStyleId] = useState('modern')
  const [customStylePrompt, setCustomStylePrompt] = useState('')
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Step 2 state
  const [generatingIndex, setGeneratingIndex] = useState(0)

  // Step 3 state
  const [platformResults, setPlatformResults] = useState<PlatformResult[]>([])
  const [totalImages, setTotalImages] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({})

  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setReferenceImage(e.target?.result as string)
      setImageName(file.name)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImageUpload(file)
  }, [handleImageUpload])

  const handleGenerate = async () => {
    setStep('generating')
    setError(null)
    setPlatformResults([])
    setGeneratingIndex(0)

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setGeneratingIndex(prev => {
        if (prev < MASTER_LABELS.length - 1) return prev + 1
        return prev
      })
    }, 12000)

    try {
      const res = await fetch('/api/generate-social-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          tagline: tagline || undefined,
          description: description || undefined,
          primaryColor,
          brandId,
          styleId,
          customStylePrompt: customStylePrompt || undefined,
          referenceImage: referenceImage || undefined,
        }),
      })

      clearInterval(progressInterval)

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate social media kit')
      }

      const data = await res.json()
      setPlatformResults(data.platforms)
      setTotalImages(data.totalImages)

      // Expand all platforms by default
      const expanded: Record<string, boolean> = {}
      for (const p of data.platforms) {
        expanded[p.platform] = true
      }
      setExpandedPlatforms(expanded)

      setStep('results')
    } catch (err: any) {
      clearInterval(progressInterval)
      setError(err.message || 'Something went wrong')
      setStep('results')
    }
  }

  const handleDownload = async (img: GeneratedImage) => {
    try {
      const response = await fetch(img.imageUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${img.platform.toLowerCase().replace(/[\s\/]+/g, '-')}-${img.label.toLowerCase().replace(/\s+/g, '-')}-${img.width}x${img.height}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      // Fallback to direct link
      const link = document.createElement('a')
      link.href = img.imageUrl
      link.download = `${img.platform}-${img.label}.png`
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleDownloadAll = () => {
    const allImages = platformResults.flatMap(p => p.images)
    allImages.forEach((img, i) => {
      setTimeout(() => handleDownload(img), i * 300)
    })
  }

  const togglePlatform = (platform: string) => {
    setExpandedPlatforms(prev => ({ ...prev, [platform]: !prev[platform] }))
  }

  const currentStepIndex = getStepIndex(step)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
        Social Media Kit
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 32 }}>
        Generate branded graphics for every social platform in one go. 3 credits per kit.
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

      {/* Step 1: Brand Info */}
      {step === 'input' && (
        <div className="wizard-card">
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Your brand details</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            Tell us about your brand and we will create graphics for 7 platforms, 20+ sizes.
          </p>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Company Name <span style={{ color: 'var(--error, #e53e3e)' }}>*</span>
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="e.g. Acme Corp"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                fontSize: 15,
                background: 'var(--bg-card, #fff)',
                color: 'var(--ink)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Tagline
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="e.g. Innovation starts here"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                fontSize: 15,
                background: 'var(--bg-card, #fff)',
                color: 'var(--ink)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Description
            </label>
            <textarea
              className="input-textarea"
              placeholder="What does your company do? This helps us design more relevant graphics."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                fontSize: 15,
                background: 'var(--bg-card, #fff)',
                color: 'var(--ink)',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Primary Brand Color
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                style={{
                  width: 44,
                  height: 44,
                  padding: 0,
                  border: '2px solid var(--border)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: 'none',
                }}
              />
              <input
                type="text"
                className="input-text"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  fontSize: 15,
                  background: 'var(--bg-card, #fff)',
                  color: 'var(--ink)',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace',
                }}
              />
            </div>
          </div>

          {/* Brand & Style picker */}
          <div style={{ marginBottom: 20 }}>
            <BrandStylePicker
              onSelect={({ brandId: b, styleId: s, customStylePrompt: p }) => {
                setBrandId(b)
                setStyleId(s)
                if (p) setCustomStylePrompt(p)
              }}
              initialStyleId="modern"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Reference Image (optional)
            </label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/*'
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (file) handleImageUpload(file)
                }
                input.click()
              }}
              style={{
                border: `2px dashed ${dragOver ? 'var(--mint)' : 'var(--border)'}`,
                borderRadius: 10,
                padding: referenceImage ? 12 : 32,
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(0,210,150,0.05)' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              {referenceImage ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img
                    src={referenceImage}
                    alt="Preview"
                    style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }}
                  />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{imageName}</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReferenceImage(null); setImageName(null) }}
                      style={{ fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>+</div>
                  <div style={{ fontSize: 14, color: 'var(--muted)' }}>
                    Drag &amp; drop a logo or brand image, or click to upload
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            className="btn btn-primary"
            disabled={!companyName.trim()}
            onClick={handleGenerate}
            style={{ width: '100%', padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
          >
            Generate Social Media Kit (3 credits)
          </button>
        </div>
      )}

      {/* Step 2: Generating */}
      {step === 'generating' && (
        <div className="wizard-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{
            width: 48,
            height: 48,
            border: '4px solid var(--border)',
            borderTopColor: 'var(--mint)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 24px',
          }} />
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Creating your kit...</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            This takes about 30-60 seconds. We are generating 3 master designs and resizing them for every platform.
          </p>

          <div style={{ maxWidth: 400, margin: '0 auto' }}>
            {MASTER_LABELS.map((label, i) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  color: i <= generatingIndex ? 'var(--ink)' : 'var(--muted)',
                  opacity: i <= generatingIndex ? 1 : 0.4,
                  transition: 'all 0.3s',
                }}
              >
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  background: i < generatingIndex ? 'var(--mint)' : i === generatingIndex ? 'var(--border)' : 'transparent',
                  border: i < generatingIndex ? 'none' : '2px solid var(--border)',
                  color: i < generatingIndex ? '#fff' : 'var(--muted)',
                  flexShrink: 0,
                }}>
                  {i < generatingIndex ? '\u2713' : ''}
                </div>
                <span style={{ fontSize: 14 }}>{label}</span>
                {i === generatingIndex && (
                  <div style={{
                    width: 12,
                    height: 12,
                    border: '2px solid var(--border)',
                    borderTopColor: 'var(--mint)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    flexShrink: 0,
                  }} />
                )}
              </div>
            ))}
          </div>

          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 'results' && (
        <div>
          {error && (
            <div className="wizard-card" style={{ borderColor: 'var(--error, #e53e3e)', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--error, #e53e3e)', marginBottom: 8 }}>
                Generation failed
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>{error}</p>
              <button
                className="btn btn-primary"
                onClick={() => { setStep('input'); setError(null) }}
                style={{ padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}
              >
                Try Again
              </button>
            </div>
          )}

          {platformResults.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Your Social Media Kit</h2>
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                    {totalImages} images across {platformResults.length} platforms
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-soft"
                    onClick={() => { setStep('input'); setPlatformResults([]); setError(null) }}
                    style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}
                  >
                    New Kit
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleDownloadAll}
                    style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}
                  >
                    Download All
                  </button>
                </div>
              </div>

              {platformResults.map(pr => (
                <div
                  key={pr.platform}
                  className="wizard-card"
                  style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}
                >
                  <button
                    onClick={() => togglePlatform(pr.platform)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 20px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--ink)',
                    }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 600 }}>
                      {pr.platform}
                      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>
                        {pr.images.length} {pr.images.length === 1 ? 'image' : 'images'}
                      </span>
                    </span>
                    <span style={{
                      fontSize: 18,
                      transition: 'transform 0.2s',
                      transform: expandedPlatforms[pr.platform] ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}>
                      &#9660;
                    </span>
                  </button>

                  {expandedPlatforms[pr.platform] && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                      gap: 16,
                      padding: '0 20px 20px',
                    }}>
                      {pr.images.map(img => (
                        <div
                          key={`${img.platform}-${img.label}`}
                          style={{
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            overflow: 'hidden',
                            background: 'var(--bg-card, #fff)',
                          }}
                        >
                          <div style={{
                            width: '100%',
                            aspectRatio: `${img.width} / ${img.height}`,
                            maxHeight: 200,
                            overflow: 'hidden',
                            background: '#f0f0f0',
                          }}>
                            <img
                              src={img.imageUrl}
                              alt={`${img.platform} ${img.label}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                          </div>
                          <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{img.label}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{img.width} x {img.height}</div>
                            </div>
                            <button
                              className="btn btn-soft"
                              onClick={() => handleDownload(img)}
                              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
