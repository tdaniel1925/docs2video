'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../_lib/supabase/client'
import type { Brand } from '../../_lib/types'
import { SLIDE_STYLES } from '../../_lib/types'

type Step = 'content' | 'style' | 'sizes' | 'results'

interface FlyerSize {
  id: string
  label: string
  dimensions: string
  width: number
  height: number
  previewW: number
  previewH: number
}

const FLYER_SIZES: FlyerSize[] = [
  { id: 'flyer-full', label: 'Full Page Flyer', dimensions: '8.5 x 11"', width: 2550, height: 3300, previewW: 56, previewH: 72 },
  { id: 'flyer-half', label: 'Half Page Flyer', dimensions: '5.5 x 8.5"', width: 1650, height: 2550, previewW: 46, previewH: 70 },
  { id: 'postcard', label: 'Postcard', dimensions: '4 x 6"', width: 1200, height: 1800, previewW: 48, previewH: 72 },
  { id: 'poster', label: 'Poster', dimensions: '11 x 17"', width: 3300, height: 5100, previewW: 48, previewH: 74 },
  { id: 'social-square', label: 'Social Media Square', dimensions: '1080 x 1080', width: 1080, height: 1080, previewW: 64, previewH: 64 },
  { id: 'social-story', label: 'Social Media Story', dimensions: '1080 x 1920', width: 1080, height: 1920, previewW: 40, previewH: 72 },
]

interface GeneratedFlyer {
  size: string
  label: string
  imageUrl: string
  width: number
  height: number
}

const STEP_LABELS = [
  { key: 'content', label: '1. Your Flyer' },
  { key: 'style', label: '2. Pick a Look' },
  { key: 'sizes', label: '3. Sizes' },
  { key: 'results', label: '4. Your Flyers' },
]

function getStepIndex(step: Step): number {
  const idx = STEP_LABELS.findIndex(s => s.key === step)
  return idx >= 0 ? idx : 0
}

function FlyerGeneratingProgress({ currentSize, completedCount, totalCount }: { currentSize: string; completedCount: number; totalCount: number }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(prev => prev + 1), 1000)
    return () => clearInterval(t)
  }, [])
  // Reset elapsed when a new size starts
  useEffect(() => { setElapsed(0) }, [currentSize])
  const pct = totalCount > 0 ? Math.max(5, ((completedCount + Math.min(elapsed / 60, 0.9)) / totalCount) * 100) : 10
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ maxWidth: 360, margin: '0 auto 20px', height: 6, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 10, background: 'var(--mint)',
          transition: 'width 1s ease',
          width: `${Math.min(pct, 97)}%`,
        }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
        Generating {currentSize}...
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 6 }}>
        {completedCount} of {totalCount} sizes complete &middot; {elapsed}s elapsed
      </div>
    </div>
  )
}

export default function FlyersPage() {
  const [step, setStep] = useState<Step>('content')

  // Step 1 state
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [venue, setVenue] = useState('')
  const [address, setAddress] = useState('')
  const [details, setDetails] = useState('')
  const [contactInfo, setContactInfo] = useState('')

  // Step 2 state
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string>('executive')

  // Step 3 state
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])

  // Step 4 state
  const [generating, setGenerating] = useState(false)
  const [currentSize, setCurrentSize] = useState('')
  const [generatedFlyers, setGeneratedFlyers] = useState<GeneratedFlyer[]>([])
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

  const toggleSize = (id: string) => {
    setSelectedSizes(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    setSelectedSizes(FLYER_SIZES.map(s => s.id))
  }

  const handleGenerate = async () => {
    setStep('results')
    setGenerating(true)
    setError(null)
    setGeneratedFlyers([])

    try {
      for (const sizeId of selectedSizes) {
        const size = FLYER_SIZES.find(s => s.id === sizeId)
        setCurrentSize(size?.label ?? sizeId)
      }

      const res = await fetch('/api/generate-flyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedBrand,
          styleId: selectedStyle,
          eventName,
          eventDate,
          eventTime,
          venue,
          address,
          details,
          contactInfo,
          sizes: selectedSizes,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate flyers')
      }

      const data = await res.json()
      setGeneratedFlyers(data.flyers)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setGenerating(false)
      setCurrentSize('')
    }
  }

  const handleDownload = async (flyer: GeneratedFlyer) => {
    const link = document.createElement('a')
    link.href = flyer.imageUrl
    link.download = `${flyer.size}-${flyer.width}x${flyer.height}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadAll = () => {
    generatedFlyers.forEach(flyer => handleDownload(flyer))
  }

  const handleRestart = () => {
    setStep('content')
    setGeneratedFlyers([])
    setEventName('')
    setEventDate('')
    setEventTime('')
    setVenue('')
    setAddress('')
    setDetails('')
    setContactInfo('')
    setSelectedSizes([])
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
        Flyer Creator
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 32 }}>
        Create eye-catching flyers for events, promotions, and more.
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
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>What&apos;s your flyer about?</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            Enter the event or product details for your flyer.
          </p>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Event or product name <span style={{ color: 'var(--error, #e53e3e)' }}>*</span>
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="Event or product name"
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Date
              </label>
              <input
                type="text"
                className="input-text"
                placeholder="Date (e.g. Saturday, May 15)"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Time
              </label>
              <input
                type="text"
                className="input-text"
                placeholder="Time (e.g. 10PM - 2AM)"
                value={eventTime}
                onChange={e => setEventTime(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Venue or location name
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="Venue or location name"
              value={venue}
              onChange={e => setVenue(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Address
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="Address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Additional details
            </label>
            <textarea
              className="input-textarea"
              placeholder="Additional details (pricing, performers, special offers, etc.)"
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Contact info
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="Phone, website, or booking info"
              value={contactInfo}
              onChange={e => setContactInfo(e.target.value)}
              style={inputStyle}
            />
          </div>

          <button
            className="btn btn-primary"
            disabled={!eventName.trim()}
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
            Choose a visual style for your flyers. Your brand colors will be applied automatically.
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
              onClick={() => setStep('sizes')}
              style={{ flex: 2, padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Sizes */}
      {step === 'sizes' && (
        <div className="wizard-card">
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Choose sizes</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
            Select the flyer sizes you need.
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
            {FLYER_SIZES.map(size => {
              const isSelected = selectedSizes.includes(size.id)
              return (
                <div
                  key={size.id}
                  onClick={() => toggleSize(size.id)}
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
                  <div style={{
                    width: size.previewW,
                    height: size.previewH,
                    border: '2px solid var(--border)',
                    borderRadius: size.id === 'social-story' ? '8px' : 3,
                    background: isSelected ? 'rgba(0,210,150,0.1)' : 'var(--bg, #f5f5f5)',
                    flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{size.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{size.dimensions}</div>
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
              disabled={selectedSizes.length === 0}
              onClick={handleGenerate}
              style={{ flex: 2, padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
            >
              Generate Flyers
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Results */}
      {step === 'results' && (
        <div className="wizard-card">
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Your flyers</h2>

          {generating && (
            <FlyerGeneratingProgress currentSize={currentSize} completedCount={generatedFlyers.length} totalCount={selectedSizes.length} />
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

          {!generating && generatedFlyers.length > 0 && (
            <>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
                {generatedFlyers.length} flyer{generatedFlyers.length !== 1 ? 's' : ''} generated successfully.
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
                  onClick={handleRestart}
                  style={{ padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
                >
                  Create Another
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 16,
              }}>
                {generatedFlyers.map((flyer, i) => {
                  const sizeInfo = FLYER_SIZES.find(s => s.id === flyer.size)
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
                        src={flyer.imageUrl}
                        alt={flyer.label}
                        style={{ width: '100%', display: 'block' }}
                      />
                      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                            {flyer.label}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {flyer.width} x {flyer.height}
                          </div>
                        </div>
                        <button
                          className="btn btn-soft"
                          onClick={() => handleDownload(flyer)}
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

          {!generating && generatedFlyers.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              No flyers generated yet.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
