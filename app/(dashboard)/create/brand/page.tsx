'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../../_lib/supabase/client'
import type { Brand } from '../../../_lib/types'
import WizardProgress from '../_components/WizardProgress'

interface DraftData {
  autoBrandInfo?: {
    name?: string
    logo_url?: string
    primary_color?: string
    secondary_color?: string
    phone?: string
    email?: string
    website?: string
  }
  _autoBrandId?: string
  outputType?: 'video' | 'pptx' | 'pdf'
  [key: string]: unknown
}

export default function BrandPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const videoId = searchParams.get('id')

  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [draftData, setDraftData] = useState<DraftData | null>(null)
  const [outputType, setOutputType] = useState<'video' | 'pptx' | 'pdf'>('video')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Inline brand form state
  const [companyName, setCompanyName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#1B365D')
  const [secondaryColor, setSecondaryColor] = useState('#C7E8A8')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [saveAsDefault, setSaveAsDefault] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Load draft + brands on mount
  useEffect(() => {
    if (!videoId) { setLoading(false); return }

    const supabase = createClient()

    Promise.all([
      fetch(`/api/videos/draft?videoId=${videoId}`).then(r => r.json()),
      supabase.from('brands').select('*').order('is_default', { ascending: false }),
    ]).then(([draftResult, brandsResult]) => {
      // Draft
      const draft = draftResult?.draft_data || draftResult || {}
      setDraftData(draft)
      const ot = draft.outputType || draftResult?.output_type || 'video'
      setOutputType(ot)

      // Pre-fill from auto-detected brand info
      if (draft.autoBrandInfo) {
        const info = draft.autoBrandInfo
        if (info.name) setCompanyName(info.name)
        if (info.primary_color) setPrimaryColor(info.primary_color)
        if (info.secondary_color) setSecondaryColor(info.secondary_color)
        if (info.phone) setPhone(info.phone)
        if (info.email) setEmail(info.email)
        if (info.website) setWebsite(info.website)
        if (info.logo_url) setLogoPreview(info.logo_url)
      }

      // Brands
      if (brandsResult.data) {
        setBrands(brandsResult.data as Brand[])
        // Auto-select the auto-detected brand if present
        if (draft._autoBrandId) {
          const match = brandsResult.data.find((b: Brand) => b.id === draft._autoBrandId)
          if (match) setSelectedBrandId(match.id)
        }
      }

      setLoading(false)
    }).catch(() => {
      setError('Failed to load draft data')
      setLoading(false)
    })
  }, [videoId])

  const handleLogoChange = useCallback((file: File) => {
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleLogoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleLogoChange(file)
    }
  }, [handleLogoChange])

  async function handleSelectBrand(brandId: string) {
    setSelectedBrandId(brandId)
    // Clear inline form when selecting a saved brand
    setCompanyName('')
    setPrimaryColor('#1B365D')
    setSecondaryColor('#C7E8A8')
    setPhone('')
    setEmail('')
    setWebsite('')
    setLogoFile(null)
    setLogoPreview(null)
  }

  async function handleSubmit() {
    if (!videoId) return
    setSubmitting(true)
    setError(null)

    try {
      let brandId: string | null = null

      if (selectedBrandId) {
        // Using a saved brand
        brandId = selectedBrandId
      } else if (companyName.trim()) {
        // Creating inline brand
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('Not signed in'); setSubmitting(false); return }

        let logoUrl: string | null = null

        // Upload logo if provided
        if (logoFile) {
          const ext = logoFile.name.split('.').pop() || 'png'
          const path = `${user.id}/brand-logos/${Date.now()}.${ext}`
          const { error: uploadErr } = await supabase.storage
            .from('brand-assets')
            .upload(path, logoFile, { contentType: logoFile.type })

          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
            logoUrl = urlData.publicUrl
          }
        } else if (logoPreview && logoPreview.startsWith('http')) {
          // Auto-detected logo URL from brand scraping
          logoUrl = logoPreview
        }

        // Create brand record
        const brandRecord: Record<string, unknown> = {
          user_id: user.id,
          name: companyName.trim(),
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          logo_url: logoUrl,
          is_default: saveAsDefault,
        }

        // If saving as default, unset other defaults first
        if (saveAsDefault) {
          await supabase.from('brands').update({ is_default: false }).eq('user_id', user.id)
        }

        const { data: newBrand, error: brandErr } = await supabase
          .from('brands')
          .insert(brandRecord)
          .select()
          .single()

        if (brandErr || !newBrand) {
          setError('Failed to save brand')
          setSubmitting(false)
          return
        }

        brandId = newBrand.id
      }
      // else: skip (brandId stays null)

      // Patch draft with brand info + contact info + step
      const updates: Record<string, unknown> = {
        brandId,
        step: 2,
      }

      // Save contact info if provided via inline form
      if (!selectedBrandId && (phone.trim() || email.trim() || website.trim())) {
        updates.contactPhone = phone.trim() || undefined
        updates.contactEmail = email.trim() || undefined
        updates.contactWebsite = website.trim() || undefined
      }

      const patchRes = await fetch('/api/videos/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, updates }),
      })

      if (!patchRes.ok) {
        const patchData = await patchRes.json()
        setError(patchData.error || 'Failed to update draft')
        setSubmitting(false)
        return
      }

      // Navigate to next step
      if (outputType === 'video') {
        router.push(`/create/voice?id=${videoId}`)
      } else {
        router.push(`/create/script?id=${videoId}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  async function handleSkip() {
    if (!videoId) return
    setSubmitting(true)
    setError(null)

    try {
      await fetch('/api/videos/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, updates: { brandId: null, step: 2 } }),
      })

      if (outputType === 'video') {
        router.push(`/create/voice?id=${videoId}`)
      } else {
        router.push(`/create/script?id=${videoId}`)
      }
    } catch {
      setError('Failed to skip')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh',
      }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!videoId) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', padding: '40px 24px',
      }}>
        <p style={{ fontSize: 16, color: 'var(--ink-soft)' }}>No video ID provided.</p>
        <button
          onClick={() => router.push('/create')}
          style={{
            marginTop: 16, padding: '10px 20px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'white',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
          }}
        >
          Go back
        </button>
      </div>
    )
  }

  const hasInlineInput = companyName.trim().length > 0
  const canProceed = selectedBrandId || hasInlineInput

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 24px 40px', maxWidth: 720, margin: '0 auto', width: '100%',
    }}>
      {/* Wizard Progress */}
      <WizardProgress currentStep={2} outputType={outputType} />

      {/* Back link */}
      <div style={{ width: '100%', marginTop: 8, marginBottom: 8 }}>
        <button
          onClick={() => router.push('/create')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: 'var(--ink-light)', fontFamily: 'inherit', padding: 0,
          }}
        >
          &larr; Back
        </button>
      </div>

      {/* Heading */}
      <h1 style={{
        fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em',
        textAlign: 'center', marginBottom: 8, color: 'var(--ink)',
        fontFamily: 'inherit',
        animation: 'fadeInUp 0.4s ease',
      }}>
        Choose your brand
      </h1>
      <p style={{
        fontSize: 17, color: 'var(--ink-soft)', textAlign: 'center',
        marginBottom: 32, lineHeight: 1.6, animation: 'fadeInUp 0.4s ease 0.05s both',
      }}>
        Select a saved brand or create one for this project.
      </p>

      {/* Saved brands */}
      {brands.length > 0 && (
        <div style={{ width: '100%', marginBottom: 24, animation: 'fadeInUp 0.4s ease 0.1s both' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {brands.map(b => {
              const isSelected = selectedBrandId === b.id
              return (
                <button
                  key={b.id}
                  onClick={() => handleSelectBrand(b.id)}
                  style={{
                    padding: '16px', borderRadius: 10, textAlign: 'left',
                    border: isSelected ? '2px solid var(--mint)' : '1.5px solid var(--border-light)',
                    background: isSelected ? 'rgba(199, 232, 168, 0.08)' : 'white',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s ease', position: 'relative',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--mint)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-light)' }}
                >
                  {b.is_default && (
                    <span style={{
                      position: 'absolute', top: 8, right: 8,
                      fontSize: 10, fontWeight: 700, color: 'var(--mint)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      Default
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    {b.logo_url ? (
                      <img
                        src={b.logo_url}
                        alt={`${b.name} logo`}
                        style={{
                          width: 36, height: 36, borderRadius: 6,
                          objectFit: 'contain', background: 'var(--bg-soft)',
                        }}
                      />
                    ) : (
                      <div style={{
                        width: 36, height: 36, borderRadius: 6,
                        background: b.primary_color || 'var(--bg-soft)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 800, color: 'white',
                      }}>
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                        {b.name}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 4,
                      background: b.primary_color, border: '1px solid rgba(0,0,0,0.1)',
                    }} />
                    {b.secondary_color && (
                      <div style={{
                        width: 16, height: 16, borderRadius: 4,
                        background: b.secondary_color, border: '1px solid rgba(0,0,0,0.1)',
                      }} />
                    )}
                    <span style={{ fontSize: 12, color: 'var(--ink-light)', marginLeft: 4 }}>
                      {b.primary_color}
                    </span>
                  </div>
                  <div style={{
                    marginTop: 10, padding: '6px 12px', borderRadius: 6,
                    background: isSelected ? 'var(--mint)' : 'var(--bg-soft)',
                    color: isSelected ? 'var(--ink)' : 'var(--ink-soft)',
                    fontSize: 12, fontWeight: 700, textAlign: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {isSelected ? 'Selected' : 'Use this brand'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Divider / toggle link */}
      {brands.length > 0 && !selectedBrandId && (
        <div style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 16,
          marginBottom: 24, animation: 'fadeInUp 0.4s ease 0.15s both',
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
          <span style={{ fontSize: 13, color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>
            or create one for this project
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
        </div>
      )}

      {/* "or create new instead" link when a saved brand is selected */}
      {selectedBrandId && (
        <div style={{ width: '100%', textAlign: 'center', marginBottom: 20 }}>
          <button
            onClick={() => setSelectedBrandId(null)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--ink-light)', fontFamily: 'inherit',
              textDecoration: 'underline', padding: 0,
            }}
          >
            or create a new brand instead
          </button>
        </div>
      )}

      {/* Inline brand form — hidden when a saved brand is selected */}
      {!selectedBrandId && (
      <div style={{
        width: '100%', padding: '24px', borderRadius: 10,
        background: 'white',
        border: '1.5px solid var(--border-light)',
        marginBottom: 20,
        animation: 'fadeInUp 0.4s ease 0.2s both',
      }}>
        {/* Company name */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
            Company name <span style={{ color: '#b91c1c' }}>*</span>
          </label>
          <input
            type="text"
            value={companyName}
            onChange={e => { setCompanyName(e.target.value); setSelectedBrandId(null) }}
            placeholder="e.g. Acme Insurance"
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 8,
              border: '2px solid var(--border)', fontSize: 15, fontFamily: 'inherit',
              outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Logo upload */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
            Logo <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-light)' }}>(optional)</span>
          </label>
          <div
            onClick={() => logoInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--mint)' }}
            onDragLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            onDrop={handleLogoDrop}
            style={{
              padding: logoPreview ? '12px' : '24px 16px',
              borderRadius: 8, border: '2px dashed var(--border)',
              background: 'var(--bg-soft)', cursor: 'pointer', textAlign: 'center',
              transition: 'border-color 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            }}
          >
            {logoPreview ? (
              <>
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 6 }}
                />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {logoFile ? logoFile.name : 'Auto-detected logo'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>Click to change</div>
                </div>
              </>
            ) : (
              <div>
                <div style={{ fontSize: 24, marginBottom: 4 }}>&#128247;</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>
                  Drop your logo here or click to browse
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>
                  PNG, JPG, SVG
                </div>
              </div>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) { handleLogoChange(f); setSelectedBrandId(null) }
            }}
          />
        </div>

        {/* Color pickers */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
              Primary color
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={primaryColor}
                onChange={e => { setPrimaryColor(e.target.value); setSelectedBrandId(null) }}
                style={{
                  width: 40, height: 40, borderRadius: 8, border: '2px solid var(--border)',
                  cursor: 'pointer', padding: 2,
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontFamily: 'monospace' }}>
                {primaryColor}
              </span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
              Secondary color <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-light)' }}>(optional)</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={secondaryColor}
                onChange={e => { setSecondaryColor(e.target.value); setSelectedBrandId(null) }}
                style={{
                  width: 40, height: 40, borderRadius: 8, border: '2px solid var(--border)',
                  cursor: 'pointer', padding: 2,
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontFamily: 'monospace' }}>
                {secondaryColor}
              </span>
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div style={{ marginBottom: 0 }}>
          <label style={{
            fontSize: 14, fontWeight: 700, color: 'var(--ink)',
            display: 'block', marginBottom: 10,
          }}>
            Contact info <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-light)' }}>(optional, for CTA slide)</span>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setSelectedBrandId(null) }}
              placeholder="Phone number"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid var(--border-light)', fontSize: 14,
                fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
            />
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setSelectedBrandId(null) }}
              placeholder="Email address"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid var(--border-light)', fontSize: 14,
                fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
            />
            <input
              type="url"
              value={website}
              onChange={e => { setWebsite(e.target.value); setSelectedBrandId(null) }}
              placeholder="Website URL"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid var(--border-light)', fontSize: 14,
                fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
            />
          </div>
        </div>

        {/* Save as default checkbox */}
        <div style={{ marginTop: 16 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', fontSize: 14, color: 'var(--ink-soft)',
          }}>
            <input
              type="checkbox"
              checked={saveAsDefault}
              onChange={e => setSaveAsDefault(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--mint)' }}
            />
            Save as my default brand
          </label>
        </div>
      </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          width: '100%', padding: '12px 16px', borderRadius: 10,
          background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
          fontSize: 14, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div style={{
        width: '100%', display: 'flex', gap: 12,
        animation: 'fadeInUp 0.4s ease 0.25s both',
      }}>
        <button
          onClick={() => router.push('/create')}
          style={{
            padding: '16px 24px', borderRadius: 10,
            border: '1.5px solid var(--border-light)', background: 'white',
            fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            color: 'var(--ink-soft)', transition: 'all 0.15s',
          }}
        >
          &larr; Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || (!canProceed && companyName.trim().length === 0)}
          style={{
            flex: 1, padding: '16px', borderRadius: 10, border: 'none',
            background: 'var(--ink)', color: 'white', fontSize: 18, fontWeight: 800,
            cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit',
            letterSpacing: '-0.02em', transition: 'opacity 0.2s',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Saving...' : 'Next \u2192'}
        </button>
      </div>

      {/* Skip link */}
      <button
        onClick={handleSkip}
        disabled={submitting}
        style={{
          background: 'none', border: 'none', fontSize: 13, color: 'var(--ink-light)',
          cursor: 'pointer', fontFamily: 'inherit', marginTop: 14, padding: 0,
          opacity: submitting ? 0.5 : 1,
        }}
      >
        Skip — use generic styling
      </button>
    </div>
  )
}
