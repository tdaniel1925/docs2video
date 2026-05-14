'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../_lib/supabase/client'
import { SLIDE_STYLES } from '../../_lib/types'
import type { Profile } from '../../_lib/types'

type SetupStep = 1 | 2 | 3 | 4

const COLOR_LABELS: Record<string, string> = {
  primary_color: 'Primary',
  secondary_color: 'Secondary',
  accent_color: 'Accent',
  background_color: 'Background',
  text_color: 'Text',
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<SetupStep>(1)
  const [loading, setLoading] = useState(false)

  // Step 1: Profile
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')

  // Step 2: Photos
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoMidlevelUrl, setPhotoMidlevelUrl] = useState<string | null>(null)
  const [photoStandingUrl, setPhotoStandingUrl] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState<string | null>(null)

  // Step 3: Brand
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [colors, setColors] = useState({
    primary_color: '#1B365D',
    secondary_color: '#4A90D9',
    accent_color: '#FFB347',
    background_color: '#0a1628',
    text_color: '#FFFFFF',
  })

  // Step 4: Style
  const [selectedStyle, setSelectedStyle] = useState('luxury')
  const [expandedStyle, setExpandedStyle] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

      // Redirect to card collection if no card on file
      if (profile && !profile.card_on_file) {
        router.push('/setup-payment')
        return
      }

      if (profile) {
        setFullName(profile.full_name ?? '')
        setCompanyName(profile.company_name ?? '')
        setRole(profile.role ?? '')
        setPhone(profile.phone ?? '')
        setPhotoUrl(profile.photo_url ?? null)
        setPhotoMidlevelUrl(profile.photo_midlevel_url ?? null)
        setPhotoStandingUrl(profile.photo_standing_url ?? null)
        setBrandName(profile.company_name ?? '')
        if (profile.default_style) setSelectedStyle(profile.default_style)
      }

      // Load existing default brand
      const { data: brand } = await supabase
        .from('brands')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .single()

      if (brand) {
        setBrandName(brand.name)
        setLogoUrl(brand.logo_file_url ?? brand.logo_url ?? null)
        setColors({
          primary_color: brand.primary_color,
          secondary_color: brand.secondary_color,
          accent_color: brand.accent_color,
          background_color: brand.background_color,
          text_color: brand.text_color,
        })
      }
    }
    loadProfile()
  }, [router])

  async function saveProfile() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      company_name: companyName,
      role: role || null,
      phone: phone || null,
    }).eq('id', user.id)

    if (error) { setError(error.message); setLoading(false); return }
    if (!brandName) setBrandName(companyName)
    setLoading(false)
    setStep(2)
  }

  async function handlePhotoUpload(file: File, type: 'headshot' | 'midlevel' | 'standing' = 'headshot') {
    setPhotoUploading(type)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    try {
      const res = await fetch('/api/upload-photo', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (type === 'headshot') setPhotoUrl(data.url)
      else if (type === 'midlevel') setPhotoMidlevelUrl(data.url)
      else if (type === 'standing') setPhotoStandingUrl(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed')
    }
    setPhotoUploading(null)
  }

  async function handleLogoUpload(file: File) {
    setLogoUploading(true)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload-logo', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLogoUrl(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed')
    }
    setLogoUploading(false)
  }

  async function saveBrand() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check for existing default brand
    const { data: existing } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single()

    const brandData = {
      user_id: user.id,
      name: brandName || companyName || 'My Brand',
      logo_url: logoUrl,
      logo_file_url: logoUrl,
      is_default: true,
      ...colors,
    }

    if (existing) {
      await supabase.from('brands').update(brandData).eq('id', existing.id)
    } else {
      await supabase.from('brands').insert(brandData)
    }

    setLoading(false)
    setStep(4)
  }

  async function skipSetup() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)
    router.push('/dashboard')
  }

  async function finishSetup() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('profiles').update({
      default_style: selectedStyle,
      onboarding_completed: true,
    }).eq('id', user.id)

    router.push('/dashboard')
  }

  function scrollCarousel(dir: 'left' | 'right') {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' })
  }

  const stepLabels = ['Profile', 'Photo', 'Brand', 'Style']

  return (
    <div className="wizard-card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ marginBottom: 0 }}>
            <em>Docs2Video</em> Setup
          </h2>
          <button onClick={skipSetup} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--ink-light)', cursor: 'pointer' }}>
            Skip for now
          </button>
        </div>
        <p style={{ marginTop: 6, fontSize: 14, color: 'var(--ink-soft)' }}>
          {step === 1 && "Let's get your profile set up"}
          {step === 2 && 'Upload a professional headshot for your videos'}
          {step === 3 && 'Set up your brand identity'}
          {step === 4 && 'Choose your default presentation style'}
        </p>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 4, marginTop: 18 }}>
          {stepLabels.map((label, i) => (
            <div key={label} style={{ flex: 1, height: 6, borderRadius: 100, background: i + 1 <= step ? 'var(--mint)' : 'var(--bg)', transition: 'background 0.3s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          {stepLabels.map((label, i) => (
            <span key={label} style={{ fontSize: 10, fontWeight: 600, color: i + 1 <= step ? 'var(--ink)' : 'var(--ink-light)' }}>{label}</span>
          ))}
        </div>
      </div>

      {/* Step 1: Profile */}
      {step === 1 && (
        <div>
          <div className="form-group">
            <label className="input-label">Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required
              className="input" placeholder="John Smith" />
          </div>
          <div className="form-group">
            <label className="input-label">Company / Organization Name</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
              className="input" placeholder="Acme Group" />
          </div>
          <div className="form-group">
            <label className="input-label">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="input-select">
              <option value="">Select your role</option>
              <option value="agent">Insurance Agent</option>
              <option value="agency_owner">Agency Owner</option>
              <option value="broker">Broker</option>
              <option value="financial_advisor">Financial Advisor</option>
              <option value="consultant">Consultant</option>
              <option value="real_estate">Real Estate Professional</option>
              <option value="healthcare">Healthcare Professional</option>
              <option value="legal">Legal Professional</option>
              <option value="educator">Educator</option>
              <option value="marketer">Marketer</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="input-label">Phone (optional)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel"
              className="input" placeholder="(555) 123-4567" />
          </div>
          <button onClick={saveProfile} disabled={loading || !fullName}
            className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Saving...' : 'Next \u2192'}
          </button>
        </div>
      )}

      {/* Step 2: Photos */}
      {step === 2 && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 20, textAlign: 'center' }}>
            Upload professional photos for your presentations. Only the headshot is required.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
            {/* Headshot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {photoUrl ? (
                <div style={{ position: 'relative' }}>
                  <img src={photoUrl} alt="Headshot" style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--mint)' }} />
                  <button onClick={() => setPhotoUrl(null)}
                    style={{ position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: '50%', background: 'var(--rose)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                </div>
              ) : (
                <label style={{
                  width: 110, height: 110, borderRadius: '50%', border: '2px dashed var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', background: 'var(--bg-soft)', transition: 'border-color 0.2s',
                }}>
                  {photoUploading === 'headshot' ? (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--ink)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  ) : (
                    <>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--ink-light)' }}>
                        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.31 3.58-6 8-6s8 2.69 8 6"/>
                      </svg>
                      <span style={{ marginTop: 4, fontSize: 10, color: 'var(--ink-light)', fontWeight: 600 }}>Upload</span>
                    </>
                  )}
                  <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f, 'headshot') }} />
                </label>
              )}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>Headshot</p>
                <p style={{ fontSize: 10, color: 'var(--ink-light)' }}>(required)</p>
              </div>
            </div>

            {/* Mid-level */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {photoMidlevelUrl ? (
                <div style={{ position: 'relative' }}>
                  <img src={photoMidlevelUrl} alt="Mid-level" style={{ width: 90, height: 110, borderRadius: 10, objectFit: 'cover', border: '3px solid var(--mint)' }} />
                  <button onClick={() => setPhotoMidlevelUrl(null)}
                    style={{ position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: '50%', background: 'var(--rose)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                </div>
              ) : (
                <label style={{
                  width: 90, height: 110, borderRadius: 10, border: '2px dashed var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', background: 'var(--bg-soft)', transition: 'border-color 0.2s',
                }}>
                  {photoUploading === 'midlevel' ? (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--ink)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  ) : (
                    <>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--ink-light)' }}>
                        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.31 3.58-6 8-6s8 2.69 8 6"/>
                      </svg>
                      <span style={{ marginTop: 4, fontSize: 10, color: 'var(--ink-light)', fontWeight: 600 }}>Upload</span>
                    </>
                  )}
                  <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f, 'midlevel') }} />
                </label>
              )}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>Mid-level</p>
                <p style={{ fontSize: 10, color: 'var(--ink-light)' }}>(optional)</p>
              </div>
            </div>

            {/* Standing */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {photoStandingUrl ? (
                <div style={{ position: 'relative' }}>
                  <img src={photoStandingUrl} alt="Standing" style={{ width: 90, height: 110, borderRadius: 10, objectFit: 'cover', border: '3px solid var(--mint)' }} />
                  <button onClick={() => setPhotoStandingUrl(null)}
                    style={{ position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: '50%', background: 'var(--rose)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                </div>
              ) : (
                <label style={{
                  width: 90, height: 110, borderRadius: 10, border: '2px dashed var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', background: 'var(--bg-soft)', transition: 'border-color 0.2s',
                }}>
                  {photoUploading === 'standing' ? (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--ink)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  ) : (
                    <>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--ink-light)' }}>
                        <rect x="6" y="2" width="12" height="20" rx="2"/><circle cx="12" cy="8" r="3"/>
                      </svg>
                      <span style={{ marginTop: 4, fontSize: 10, color: 'var(--ink-light)', fontWeight: 600 }}>Upload</span>
                    </>
                  )}
                  <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f, 'standing') }} />
                </label>
              )}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>Standing</p>
                <p style={{ fontSize: 10, color: 'var(--ink-light)' }}>(optional)</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(1)} className="btn btn-soft" style={{ flex: 1 }}>Back</button>
            <button onClick={() => setStep(3)} className="btn btn-primary" style={{ flex: 1 }}>
              {photoUrl ? 'Next \u2192' : 'Skip for now'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Brand */}
      {step === 3 && (
        <div>
          <div className="form-group">
            <label className="input-label">Brand / Organization Name</label>
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)}
              className="input" placeholder="Your organization name" />
          </div>

          {/* Logo upload */}
          <div className="form-group">
            <label className="input-label">Company Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {logoUrl ? (
                <div style={{ position: 'relative' }}>
                  <img src={logoUrl} alt="Logo" style={{ height: 56, maxWidth: 200, borderRadius: 10, border: '1px solid var(--border-light)', background: 'var(--bg-soft)', padding: 8, objectFit: 'contain' }} />
                  <button onClick={() => setLogoUrl(null)}
                    style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: '50%', background: 'var(--rose)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                </div>
              ) : (
                <label style={{
                  height: 56, width: 140, borderRadius: 10, border: '2px dashed var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', background: 'var(--bg-soft)', transition: 'border-color 0.2s',
                }}>
                  {logoUploading ? (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--ink)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--ink-light)', fontWeight: 600 }}>Upload Logo</span>
                  )}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }} />
                </label>
              )}
            </div>
          </div>

          {/* Colors */}
          <div className="section-title" style={{ marginTop: 4 }}>Brand Colors</div>
          <div className="color-pickers">
            {Object.entries(colors).map(([key, value]) => (
              <div key={key} className="color-picker">
                <div className="lbl">{COLOR_LABELS[key]}</div>
                <label style={{ display: 'block', position: 'relative', cursor: 'pointer' }}>
                  <div className="color-input" style={{
                    background: value,
                    ...(value.toLowerCase() === '#ffffff' ? { boxShadow: 'inset 0 0 0 3px white, 0 0 0 1px var(--border)' } : {}),
                  }} />
                  <input type="color" value={value}
                    onChange={(e) => setColors(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                </label>
                <div className="color-hex">{value.toUpperCase()}</div>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="brand-preview">
            <div className="brand-preview-label">Live Preview</div>
            <div className="preview-card-mini">
              <div className="pcm-row" style={{ background: colors.primary_color }}>
                <span>Primary</span>
                <span style={{ opacity: 0.85, fontSize: 12, fontWeight: 500 }}>Headers</span>
              </div>
              <div className="pcm-row" style={{ background: colors.secondary_color }}>
                <span>Secondary</span>
                <span style={{ opacity: 0.85, fontSize: 12, fontWeight: 500 }}>Highlights</span>
              </div>
              <div className="pcm-row" style={{ background: colors.accent_color }}>
                <span>Accent</span>
                <span style={{ opacity: 0.85, fontSize: 12, fontWeight: 500 }}>Tags</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(2)} className="btn btn-soft" style={{ flex: 1 }}>Back</button>
            <button onClick={saveBrand} disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
              {loading ? 'Saving...' : 'Next \u2192'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Style */}
      {step === 4 && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>Pick your default style. You can change this per project later.</p>

          {/* Carousel */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <button onClick={() => scrollCarousel('left')}
              style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 10, width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button onClick={() => scrollCarousel('right')}
              style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 10, width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <div ref={scrollRef} style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '8px 40px', scrollbarWidth: 'none' }}>
              {SLIDE_STYLES.map((style) => (
                <button key={style.id} onClick={() => { setSelectedStyle(style.id); setExpandedStyle(expandedStyle === style.id ? null : style.id) }}
                  style={{
                    flexShrink: 0, width: 200, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg-card)',
                    border: selectedStyle === style.id ? '2px solid var(--ink)' : '1px solid var(--border-light)',
                    transition: 'all 0.2s',
                  }}>
                  <img src={`/style-previews/${style.id}.png`} alt={style.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                  <div style={{ padding: 8, textAlign: 'left' }}>
                    <p style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink)' }}>{style.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {expandedStyle && (
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-light)', marginBottom: 16, background: 'var(--bg-card)' }}>
              <img src={`/style-previews/${expandedStyle}.png`} alt="" style={{ width: '100%' }} />
              <div style={{ padding: 12 }}>
                <p style={{ fontWeight: 700, fontSize: 14 }}>{SLIDE_STYLES.find(s => s.id === expandedStyle)?.name}</p>
                <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{SLIDE_STYLES.find(s => s.id === expandedStyle)?.description}</p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(3)} className="btn btn-soft" style={{ flex: 1 }}>Back</button>
            <button onClick={finishSetup} disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
              {loading ? 'Finishing...' : 'Finish Setup \u2192'}
            </button>
          </div>

          {/* Pre-launch welcome note */}
          <div style={{ marginTop: 24, padding: '20px 24px', background: 'var(--bg-soft)', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
            Welcome to Docs2Video! You have 5 free explainer videos to create. After that, each video is just $10 charged to your card on file.
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 16, borderRadius: 10, background: 'var(--rose-light, #fde8e8)', padding: '10px 16px', fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>
          {error}
        </div>
      )}
    </div>
  )
}
