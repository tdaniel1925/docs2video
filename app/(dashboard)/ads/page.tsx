'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../_lib/supabase/client'
import type { Brand } from '../../_lib/types'
import { SLIDE_STYLES } from '../../_lib/types'

type Step = 'content' | 'style' | 'platforms' | 'results'

interface Platform {
  id: string
  name: string
  width: number
  height: number
  icon: string
}

const PLATFORMS: Platform[] = [
  { id: 'instagram-post', name: 'Instagram Post', width: 1080, height: 1080, icon: '\u25A3' },
  { id: 'instagram-story', name: 'Instagram Story', width: 1080, height: 1920, icon: '\u25AE' },
  { id: 'facebook-post', name: 'Facebook Post', width: 1200, height: 1500, icon: '\u25AE' },
  { id: 'linkedin-post', name: 'LinkedIn Post', width: 1200, height: 627, icon: '\u25AD' },
  { id: 'youtube-thumbnail', name: 'YouTube Thumbnail', width: 1280, height: 720, icon: '\u25AD' },
  { id: 'google-display', name: 'Google Display', width: 1200, height: 628, icon: '\u25AD' },
]

interface GeneratedAd {
  platform: string
  imageUrl: string
  width: number
  height: number
}

const STEP_LABELS = [
  { key: 'content', label: '1. Your Ad' },
  { key: 'style', label: '2. Pick a Look' },
  { key: 'platforms', label: '3. Platforms' },
  { key: 'results', label: '4. Your Ads' },
]

function getStepIndex(step: Step): number {
  const idx = STEP_LABELS.findIndex(s => s.key === step)
  return idx >= 0 ? idx : 0
}

export default function AdsPage() {
  const [step, setStep] = useState<Step>('content')

  // Step 1 state
  const [headline, setHeadline] = useState('')
  const [description, setDescription] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Step 2 state
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string>('executive')

  // Step 3 state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

  // Step 4 state
  const [generating, setGenerating] = useState(false)
  const [currentPlatform, setCurrentPlatform] = useState('')
  const [generatedAds, setGeneratedAds] = useState<GeneratedAd[]>([])
  const [error, setError] = useState<string | null>(null)

  // Load brands
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase
        .from('brands')
        .select('*')
        .eq('user_id', data.user.id)
        .order('is_default', { ascending: false })
        .then(({ data: brandData }) => {
          if (brandData && brandData.length > 0) {
            setBrands(brandData)
            const defaultBrand = brandData.find(b => b.is_default) ?? brandData[0]
            setSelectedBrand(defaultBrand.id)
          }
        })
    })
  }, [])

  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setImageBase64(e.target?.result as string)
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

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    setSelectedPlatforms(PLATFORMS.map(p => p.id))
  }

  const handleGenerate = async () => {
    setStep('results')
    setGenerating(true)
    setError(null)
    setGeneratedAds([])

    try {
      for (const platformId of selectedPlatforms) {
        const platform = PLATFORMS.find(p => p.id === platformId)
        setCurrentPlatform(platform?.name ?? platformId)
      }

      const res = await fetch('/api/generate-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedBrand,
          styleId: selectedStyle,
          headline,
          description,
          ctaText: ctaText || 'Shop Now',
          platforms: selectedPlatforms,
          imageBase64,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate ads')
      }

      const data = await res.json()
      setGeneratedAds(data.ads)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setGenerating(false)
      setCurrentPlatform('')
    }
  }

  const handleDownload = async (ad: GeneratedAd) => {
    const link = document.createElement('a')
    link.href = ad.imageUrl
    link.download = `${ad.platform}-${ad.width}x${ad.height}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadAll = () => {
    generatedAds.forEach(ad => handleDownload(ad))
  }

  const currentStepIndex = getStepIndex(step)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
        Ad Creator
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 32 }}>
        Create scroll-stopping social media ads in seconds.
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
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>What&apos;s your ad about?</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            Enter your headline and supporting details.
          </p>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Headline <span style={{ color: 'var(--error, #e53e3e)' }}>*</span>
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="Enter your headline"
              value={headline}
              onChange={e => setHeadline(e.target.value)}
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
              placeholder="Supporting text or offer details"
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
              Call to Action
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="Shop Now"
              value={ctaText}
              onChange={e => setCtaText(e.target.value)}
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

          <div style={{ marginBottom: 24 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Product Image (optional)
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
                padding: imageBase64 ? 12 : 32,
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(0,210,150,0.05)' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              {imageBase64 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img
                    src={imageBase64}
                    alt="Preview"
                    style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }}
                  />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{imageName}</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setImageBase64(null); setImageName(null) }}
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
                    Drag & drop or click to upload
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            className="btn btn-primary"
            disabled={!headline.trim()}
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
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Pick a look</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            Choose a visual style for your ads. Your brand colors will be applied automatically.
          </p>

          {brands.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Brand
              </label>
              <select
                className="input-select"
                value={selectedBrand ?? ''}
                onChange={e => setSelectedBrand(e.target.value || null)}
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
              >
                <option value="">No brand</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}{b.is_default ? ' (default)' : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}>
            {SLIDE_STYLES.map(style => (
              <div
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                style={{
                  border: selectedStyle === style.id ? '2px solid var(--mint)' : '2px solid var(--border)',
                  borderRadius: 10,
                  padding: 0,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s',
                  background: 'var(--bg-card, #fff)',
                }}
              >
                <img
                  src={`/style-previews/${style.id}.png`}
                  alt={style.name}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                />
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{style.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{style.description}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-soft"
              onClick={() => setStep('content')}
              style={{ flex: 1, padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
            >
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setStep('platforms')}
              style={{ flex: 2, padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Platforms */}
      {step === 'platforms' && (
        <div className="wizard-card">
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Choose your platforms</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
            Select the platforms you want to generate ads for.
          </p>

          <button
            className="btn btn-soft"
            onClick={selectAll}
            style={{ marginBottom: 16, padding: '6px 16px', borderRadius: 8, fontSize: 13 }}
          >
            Select All
          </button>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}>
            {PLATFORMS.map(platform => {
              const isSelected = selectedPlatforms.includes(platform.id)
              return (
                <div
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  style={{
                    border: isSelected ? '2px solid var(--mint)' : '2px solid var(--border)',
                    borderRadius: 10,
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: isSelected ? 'rgba(0,210,150,0.05)' : 'var(--bg-card, #fff)',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: isSelected ? '2px solid var(--mint)' : '2px solid var(--border)',
                    background: isSelected ? 'var(--mint)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                  }}>
                    {isSelected ? '\u2713' : ''}
                  </div>
                  <div style={{ fontSize: 24 }}>{platform.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{platform.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{platform.width} x {platform.height}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-soft"
              onClick={() => setStep('style')}
              style={{ flex: 1, padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
            >
              Back
            </button>
            <button
              className="btn btn-mint"
              disabled={selectedPlatforms.length === 0}
              onClick={handleGenerate}
              style={{ flex: 2, padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
            >
              Generate Ads
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Results */}
      {step === 'results' && (
        <div className="wizard-card">
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Your ads</h2>

          {generating && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{
                width: 48,
                height: 48,
                border: '4px solid var(--border)',
                borderTopColor: 'var(--mint)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px',
              }} />
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>
                Generating {currentPlatform}...
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                This may take a minute
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

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

          {!generating && generatedAds.length > 0 && (
            <>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
                {generatedAds.length} ad{generatedAds.length !== 1 ? 's' : ''} generated successfully.
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleDownloadAll}
                  style={{ padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
                >
                  Download All
                </button>
                <button
                  className="btn btn-soft"
                  onClick={() => {
                    setStep('content')
                    setGeneratedAds([])
                    setHeadline('')
                    setDescription('')
                    setCtaText('')
                    setImageBase64(null)
                    setImageName(null)
                    setSelectedPlatforms([])
                  }}
                  style={{ padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
                >
                  Generate More
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 16,
              }}>
                {generatedAds.map((ad, i) => {
                  const platform = PLATFORMS.find(p => p.id === ad.platform)
                  return (
                    <div
                      key={i}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: 'var(--bg-card, #fff)',
                      }}
                    >
                      <img
                        src={ad.imageUrl}
                        alt={platform?.name ?? ad.platform}
                        style={{ width: '100%', display: 'block' }}
                      />
                      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                            {platform?.name ?? ad.platform}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {ad.width} x {ad.height}
                          </div>
                        </div>
                        <button
                          className="btn btn-soft"
                          onClick={() => handleDownload(ad)}
                          style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13 }}
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {!generating && generatedAds.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              No ads generated yet.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
