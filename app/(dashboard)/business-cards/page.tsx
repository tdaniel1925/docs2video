'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../_lib/supabase/client'
import type { Brand } from '../../_lib/types'
import { SLIDE_STYLES } from '../../_lib/types'

type Step = 'info' | 'style' | 'results'

interface CardResult {
  imageUrl: string
  width: number
  height: number
}

const STEP_LABELS = [
  { key: 'info', label: '1. Your Info' },
  { key: 'style', label: '2. Pick a Look' },
  { key: 'results', label: '3. Your Business Card' },
]

function getStepIndex(step: Step): number {
  const idx = STEP_LABELS.findIndex(s => s.key === step)
  return idx >= 0 ? idx : 0
}

function CardGeneratingProgress({ side }: { side: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(prev => prev + 1), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => { setElapsed(0) }, [side])
  const pct = Math.min(Math.max(5, (elapsed / 60) * 100), 97)
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ maxWidth: 360, margin: '0 auto 20px', height: 6, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 10, background: 'var(--mint)',
          transition: 'width 1s ease',
          width: `${pct}%`,
        }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
        Generating {side}...
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 6 }}>
        {elapsed}s elapsed
      </div>
    </div>
  )
}

export default function BusinessCardsPage() {
  const [step, setStep] = useState<Step>('info')

  // Step 1 state
  const [fullName, setFullName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')
  const [tagline, setTagline] = useState('')

  // Step 2 state
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string>('executive')
  const [withBleeds, setWithBleeds] = useState(false)

  // Step 3 state
  const [generating, setGenerating] = useState(false)
  const [generatingSide, setGeneratingSide] = useState('front and back')
  const [front, setFront] = useState<CardResult | null>(null)
  const [back, setBack] = useState<CardResult | null>(null)
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

  const handleGenerate = async () => {
    setStep('results')
    setGenerating(true)
    setError(null)
    setFront(null)
    setBack(null)
    setGeneratingSide('front and back')

    try {
      const res = await fetch('/api/generate-business-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedBrand,
          styleId: selectedStyle,
          fullName,
          title: jobTitle,
          company,
          phone,
          email,
          website,
          address,
          tagline,
          withBleeds,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate business card')
      }

      const data = await res.json()
      setFront(data.front)
      setBack(data.back)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setGenerating(false)
      setGeneratingSide('')
    }
  }

  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadBoth = () => {
    if (front) handleDownload(front.imageUrl, 'business-card-front.png')
    if (back) handleDownload(back.imageUrl, 'business-card-back.png')
  }

  const handleRestart = () => {
    setStep('info')
    setFront(null)
    setBack(null)
    setFullName('')
    setJobTitle('')
    setCompany('')
    setPhone('')
    setEmail('')
    setWebsite('')
    setAddress('')
    setTagline('')
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
        Business Card Creator
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 32 }}>
        Create professional business cards with a front and back design.
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

      {/* Step 1: Info */}
      {step === 'info' && (
        <div className="wizard-card">
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Your info</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            Enter the details for your business card.
          </p>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Full Name <span style={{ color: 'var(--error, #e53e3e)' }}>*</span>
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="Your full name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Job Title
              </label>
              <input
                type="text"
                className="input-text"
                placeholder="e.g. Marketing Director"
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Company Name
              </label>
              <input
                type="text"
                className="input-text"
                placeholder="Your company"
                value={company}
                onChange={e => setCompany(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Phone
              </label>
              <input
                type="text"
                className="input-text"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Email
              </label>
              <input
                type="text"
                className="input-text"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Website
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="www.yourcompany.com"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Address
            </label>
            <textarea
              className="input-textarea"
              placeholder="123 Business Ave&#10;Suite 100, City, ST 12345"
              value={address}
              onChange={e => setAddress(e.target.value)}
              rows={2}
              style={{
                ...inputStyle,
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Tagline
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="Your company tagline or slogan"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              style={inputStyle}
            />
          </div>

          <button
            className="btn btn-primary"
            disabled={!fullName.trim()}
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
            Choose a visual style for your business card. Your brand colors will be applied automatically.
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

          {/* Bleed option */}
          <div style={{
            marginBottom: 24,
            padding: '16px 20px',
            background: 'var(--bg-soft, #f8fafc)',
            borderRadius: 10,
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
              Print Size
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setWithBleeds(false)}
                className={`btn ${!withBleeds ? 'btn-primary' : 'btn-soft'}`}
                type="button"
                style={{ flex: 1, padding: '10px 14px', fontSize: 13 }}
              >
                <div style={{ fontWeight: 700 }}>Standard</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>3.5 x 2 in &middot; No bleeds</div>
              </button>
              <button
                onClick={() => setWithBleeds(true)}
                className={`btn ${withBleeds ? 'btn-primary' : 'btn-soft'}`}
                type="button"
                style={{ flex: 1, padding: '10px 14px', fontSize: 13 }}
              >
                <div style={{ fontWeight: 700 }}>With Bleeds</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>3.625 x 2.125 in &middot; Print-ready</div>
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 8 }}>
              All cards are generated at 300 DPI for professional printing.
              {withBleeds && ' Includes 1/16" bleed on all sides.'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-soft"
              onClick={() => setStep('info')}
              style={{ flex: 1, padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
            >
              Back
            </button>
            <button
              className="btn btn-mint"
              onClick={handleGenerate}
              style={{ flex: 2, padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
            >
              Generate Business Card
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 'results' && (
        <div className="wizard-card">
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Your business card</h2>

          {generating && (
            <CardGeneratingProgress side={generatingSide} />
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

          {!generating && front && back && (
            <>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
                Your business card has been generated at 300 DPI ({withBleeds ? '3.625 x 2.125"' : '3.5 x 2"'}{withBleeds ? ' with bleeds' : ''}).
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleDownloadBoth}
                  style={{ padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
                >
                  Download Both
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
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}>
                {/* Front */}
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: 'var(--bg-card, #fff)',
                }}>
                  <div style={{ padding: '8px 14px 0', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                    Front
                  </div>
                  <img
                    src={front.imageUrl}
                    alt="Business card front"
                    style={{ width: '100%', display: 'block', padding: '8px 14px' }}
                  />
                  <div style={{ padding: '8px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {front.width} x {front.height}
                    </div>
                    <button
                      className="btn btn-soft"
                      onClick={() => handleDownload(front.imageUrl, 'business-card-front.png')}
                      style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13 }}
                    >
                      Download
                    </button>
                  </div>
                </div>

                {/* Back */}
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: 'var(--bg-card, #fff)',
                }}>
                  <div style={{ padding: '8px 14px 0', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                    Back
                  </div>
                  <img
                    src={back.imageUrl}
                    alt="Business card back"
                    style={{ width: '100%', display: 'block', padding: '8px 14px' }}
                  />
                  <div style={{ padding: '8px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {back.width} x {back.height}
                    </div>
                    <button
                      className="btn btn-soft"
                      onClick={() => handleDownload(back.imageUrl, 'business-card-back.png')}
                      style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13 }}
                    >
                      Download
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {!generating && !front && !back && !error && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              No business card generated yet.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
