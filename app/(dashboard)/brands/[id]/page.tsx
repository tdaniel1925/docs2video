'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { updateBrand, deleteBrand } from '../../../_actions/brands'
import { createClient } from '../../../_lib/supabase/client'
import { downscaleImage } from '../../../_lib/image-resize'
import type { Brand } from '../../../_lib/types'
import { SLIDE_STYLES } from '../../../_lib/types'
import InlineConfirm from '../../../_components/InlineConfirm'

const COLOR_LABELS: Record<string, string> = {
  primary_color: 'Primary',
  secondary_color: 'Secondary',
  accent_color: 'Accent',
  background_color: 'Background',
  text_color: 'Text',
}

const COLOR_ROLES: Record<string, string> = {
  primary_color: 'Headers · CTAs',
  secondary_color: 'Highlights',
  accent_color: 'Tags · Badges',
  background_color: 'Canvas',
  text_color: 'Body copy',
}

const SLIDE_LABELS = [
  'Title / Cover',
  'Data / Metrics',
  'Chart / Comparison',
  'Closing / CTA',
]

export default function EditBrandPage() {
  const params = useParams()
  const router = useRouter()
  const [brand, setBrand] = useState<Brand | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [colors, setColors] = useState({
    primary_color: '#1B365D',
    secondary_color: '#4A90D9',
    accent_color: '#FFB347',
    background_color: '#0a1628',
    text_color: '#FFFFFF',
  })

  // Profile type (Person | Company)
  const [profileType, setProfileType] = useState<'person' | 'company'>('company')
  const [personRole, setPersonRole] = useState('')
  const [introLine, setIntroLine] = useState('')
  const [showNameOnSlides, setShowNameOnSlides] = useState(true)
  const [photoPlacement, setPhotoPlacement] = useState('auto')
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [showLogo, setShowLogo] = useState(true)

  // Logo upload state
  const [logoFileUrl, setLogoFileUrl] = useState<string | null>(null)
  // Processed transparent variants for VIDEO rendering (separate from the raw
  // logo + the styled logo kit). Saved as hidden inputs with the brand form.
  const [logoLightUrl, setLogoLightUrl] = useState<string | null>(null)
  const [logoDarkUrl, setLogoDarkUrl] = useState<string | null>(null)
  const [logoChip, setLogoChip] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  // Logo kit state
  const [generatingLogoKit, setGeneratingLogoKit] = useState(false)
  const [logoKitError, setLogoKitError] = useState<string | null>(null)

  // Deck builder state
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generatingSlide, setGeneratingSlide] = useState(0)

  // Brand guide fields
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [industry, setIndustry] = useState('')
  const [tone, setTone] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [brandValues, setBrandValues] = useState<string[]>([])
  const [services, setServices] = useState<string[]>([])
  const [uniqueSellingPoints, setUniqueSellingPoints] = useState<string[]>([])
  const [contentThemes, setContentThemes] = useState<string[]>([])
  const [competitorNotes, setCompetitorNotes] = useState('')
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({})
  const [websiteUrl, setWebsiteUrl] = useState('')

  // Closing-card contact (persisted into brand_guide_data, read by generate-video)
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactWebsite, setContactWebsite] = useState('')

  async function triggerLogoKit(brandId: string) {
    setGeneratingLogoKit(true)
    setLogoKitError(null)
    try {
      const res = await fetch('/api/generate-logo-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate logo kit')
      setBrand((prev) => prev ? { ...prev, logo_kit: data.kit ?? {} } : prev)
    } catch (err) {
      setLogoKitError(err instanceof Error ? err.message : 'Logo kit generation failed')
    } finally {
      setGeneratingLogoKit(false)
    }
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('brands')
        .select('*')
        .eq('id', params.id as string)
        .single()

      if (data) {
        setBrand(data as Brand)
        setColors({
          primary_color: data.primary_color,
          secondary_color: data.secondary_color,
          accent_color: data.accent_color,
          background_color: data.background_color,
          text_color: data.text_color,
        })
        // Profile fields
        setProfileType(data.profile_type === 'person' ? 'person' : 'company')
        setPersonRole(data.person_role ?? '')
        setIntroLine(data.intro_line ?? '')
        setShowNameOnSlides(data.show_name_on_slides !== false)
        setPhotoPlacement(data.photo_placement ?? 'auto')
        setPhotoUrl(data.photo_url ?? '')
        setShowLogo(data.show_logo !== false)
        setLogoFileUrl(data.logo_file_url ?? null)
        setLogoLightUrl(data.logo_light_url ?? null)
        setLogoDarkUrl(data.logo_dark_url ?? null)
        setLogoChip(!!data.logo_chip)
        if (data.deck_style_id) {
          setSelectedStyleId(data.deck_style_id)
        }
        // Brand guide fields
        setTagline(data.tagline ?? '')
        setDescription(data.description ?? '')
        setIndustry(data.industry ?? '')
        setTone(data.tone ?? '')
        setTargetAudience(data.target_audience ?? '')
        setBrandValues(data.brand_values ?? [])
        setServices(data.services ?? [])
        setUniqueSellingPoints(data.unique_selling_points ?? [])
        setContentThemes(data.content_themes ?? [])
        setCompetitorNotes(data.competitor_notes ?? '')
        setSocialLinks(data.social_links ?? {})
        setWebsiteUrl(data.social_links?.website ?? '')
        // Closing-card contact from brand_guide_data
        const guide = (data.brand_guide_data ?? {}) as Record<string, unknown>
        setContactPhone(typeof guide.phone === 'string' ? guide.phone : '')
        setContactEmail(typeof guide.email === 'string' ? guide.email : '')
        setContactWebsite(typeof guide.website === 'string' ? guide.website : '')

        // Auto-trigger logo kit if brand has logo but no kit
        if (data.logo_file_url && (!data.logo_kit || Object.keys(data.logo_kit).length === 0)) {
          triggerLogoKit(data.id)
        }
      }
    }
    load()
  }, [params.id])

  async function handleLogoUpload(file: File) {
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload-logo', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setLogoFileUrl(data.url)
      // Process transparent light/dark variants for VIDEO rendering. Best-effort:
      // a recoverable 422 means the logo couldn't be cleanly separated — we keep
      // the raw logo for the kit but skip video variants (videos fall back to the
      // company name), and tell the user.
      try {
        const vForm = new FormData()
        vForm.append('file', file)
        const vRes = await fetch('/api/brands/logo', { method: 'POST', body: vForm })
        const vData = await vRes.json()
        if (vRes.ok) {
          setLogoLightUrl(vData.logo_light_url ?? null)
          setLogoDarkUrl(vData.logo_dark_url ?? null)
          setLogoChip(!!vData.logo_chip)
        } else if (vRes.status === 422 && vData.recoverable) {
          setLogoLightUrl(null); setLogoDarkUrl(null); setLogoChip(false)
          setUploadError(vData.error)
        }
      } catch { /* video variants are best-effort */ }
      // Auto-extract colors from logo
      try {
        const colorRes = await fetch('/api/extract-logo-colors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: data.url }),
        })
        if (colorRes.ok) {
          const extracted = await colorRes.json()
          if (extracted.primary) {
            setColors({
              primary_color: extracted.primary,
              secondary_color: extracted.secondary,
              accent_color: extracted.accent,
              background_color: extracted.background,
              text_color: extracted.text,
            })
          }
        }
      } catch { /* color extraction is best-effort */ }
      // Trigger logo kit regeneration after new logo upload
      if (brand) {
        triggerLogoKit(brand.id)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleLogoUpload(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) handleLogoUpload(file)
  }

  function handleRemoveLogo() {
    setLogoFileUrl(null)
    setLogoLightUrl(null)
    setLogoDarkUrl(null)
    setLogoChip(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true)
    setPhotoError(null)
    try {
      const upload = await downscaleImage(file, 1024, 0.85)
      const fd = new FormData()
      fd.append('file', upload, upload.name)
      const res = await fetch('/api/brands/photo', { method: 'POST', body: fd })
      if (!res.ok) {
        let msg = `Upload failed (${res.status})`
        try { const d = await res.json(); if (d?.error) msg = d.error } catch { /* non-JSON */ }
        throw new Error(msg)
      }
      const data = await res.json()
      setPhotoUrl(data.url)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setPhotoUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('id', params.id as string)
    const result = await updateBrand(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteBrand(params.id as string)
    if (result?.error) {
      setError(result.error)
      setDeleting(false)
    }
  }

  async function handleGenerateDeck() {
    if (!selectedStyleId || !brand) return
    setGenerating(true)
    setGeneratingSlide(1)

    const interval = setInterval(() => {
      setGeneratingSlide((prev) => (prev < 4 ? prev + 1 : prev))
    }, 3000)

    try {
      const res = await fetch('/api/generate-brand-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: brand.id, styleId: selectedStyleId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to generate brand deck')
      }

      const data = await res.json()
      setBrand((prev) =>
        prev
          ? {
              ...prev,
              reference_slides: data.reference_slides ?? data.referenceSlides ?? prev.reference_slides,
              deck_style_id: selectedStyleId,
            }
          : prev
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate brand deck')
    } finally {
      clearInterval(interval)
      setGenerating(false)
      setGeneratingSlide(0)
    }
  }

  const selectedStyle = SLIDE_STYLES.find((s) => s.id === selectedStyleId)
  const hasExistingDeck = brand?.reference_slides && brand.reference_slides.length > 0

  if (!brand) {
    return <div style={{ color: 'var(--ink-light)' }}>Loading...</div>
  }

  return (
    <div>
      <Link href="/brands" className="back-link">&larr; Back to profiles</Link>

      <div className="wizard-card brand-form">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <h2 style={{ marginBottom: 0 }}>Edit {brand.name}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/brands/${params.id}/guide`} className="btn btn-soft" style={{ fontSize: 13 }}>
              View Brand Guide
            </Link>
            <InlineConfirm message="Delete this profile?" confirmLabel="Delete" onConfirm={handleDelete}>
              <button className="btn btn-danger" style={{ fontSize: 13 }}>Delete</button>
            </InlineConfirm>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Profile type toggle */}
          <input type="hidden" name="profile_type" value={profileType} />
          <div className="form-group">
            <label className="input-label">Profile type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['company', 'person'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setProfileType(t)}
                  style={{
                    flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                    fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                    border: profileType === t ? '2px solid var(--mint)' : '1px solid var(--border)',
                    background: profileType === t ? 'rgba(199, 232, 168, 0.12)' : 'white',
                    color: 'var(--ink)',
                  }}
                >
                  {t === 'company' ? 'Company' : 'Person'}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="input-label">{profileType === 'person' ? 'Your name' : 'Brand Name'}</label>
            <input
              name="name"
              required
              defaultValue={brand.name}
              className="input"
            />
          </div>

          {/* ───────── Person fields ───────── */}
          {profileType === 'person' && (
            <>
              <input type="hidden" name="photo_url" value={photoUrl} />
              <input type="hidden" name="show_name_on_slides" value={showNameOnSlides ? 'true' : 'false'} />

              <div className="form-group">
                <label className="input-label">Role / title <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  name="person_role"
                  className="input"
                  placeholder="e.g., Registered Nurse"
                  value={personRole}
                  onChange={(e) => setPersonRole(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="input-label">Photo <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(optional)</span></label>
                {photoUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <img src={photoUrl} alt="Presenter" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)' }} />
                    <button
                      type="button"
                      onClick={() => { setPhotoUrl(''); if (photoInputRef.current) photoInputRef.current.value = '' }}
                      style={{ background: 'none', border: 'none', color: 'var(--ink-light)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Remove photo
                    </button>
                  </div>
                )}
                <div
                  onClick={() => photoInputRef.current?.click()}
                  style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '20px 16px', textAlign: 'center', cursor: 'pointer' }}
                >
                  {photoUploading ? (
                    <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>Uploading...</span>
                  ) : (
                    <span style={{ fontSize: 14, color: 'var(--ink-light)' }}>Click to upload a headshot</span>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }}
                    style={{ display: 'none' }}
                  />
                </div>
                {photoError && <div style={{ marginTop: 8, fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{photoError}</div>}
              </div>

              <div className="form-group">
                <label className="input-label">Intro line <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  name="intro_line"
                  className="input"
                  rows={3}
                  style={{ resize: 'vertical' }}
                  placeholder="Hi, I'm Sarah Talls, a registered nurse. I've prepared this video to walk you through your prescription plan."
                  value={introLine}
                  onChange={(e) => setIntroLine(e.target.value)}
                />
                <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 6, marginBottom: 0 }}>
                  Spoken at the start of your video — write it the way you&apos;d say it.
                </p>
              </div>

              <div className="form-group">
                <label className="input-label">Accent color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'block', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: colors.primary_color, border: '2px solid var(--border)' }} />
                    <input
                      type="color"
                      name="primary_color"
                      value={colors.primary_color}
                      onChange={(e) => setColors((prev) => ({ ...prev, primary_color: e.target.value }))}
                      style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    />
                  </label>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: 'monospace' }}>{colors.primary_color.toUpperCase()}</span>
                </div>
              </div>

              <div className="form-group">
                <label className="input-label">Photo placement</label>
                <select name="photo_placement" className="input" value={photoPlacement} onChange={(e) => setPhotoPlacement(e.target.value)}>
                  <option value="auto">Auto (style decides)</option>
                  <option value="cover">Cover</option>
                  <option value="closing">Closing</option>
                  <option value="both">Both</option>
                  <option value="none">None</option>
                </select>
                <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 6, marginBottom: 0 }}>Where your photo appears in the video.</p>
              </div>

              <div className="check-row">
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showNameOnSlides} onChange={(e) => setShowNameOnSlides(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--ink)' }} />
                  <span style={{ fontSize: 14.5, fontWeight: 500 }}>Show my name on slides</span>
                </label>
                <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: '6px 0 0 30px' }}>
                  Off = the document title leads the cover; your name still appears in the intro and closing.
                </p>
              </div>

              {/* Contact info — shown on the closing card */}
              <div className="form-group">
                <label className="input-label">Contact info <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(optional, for closing card)</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="tel"
                    className="input"
                    placeholder="Phone number"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                  <input
                    type="email"
                    className="input"
                    placeholder="Email address"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                  <input
                    type="url"
                    className="input"
                    placeholder="Website URL"
                    value={contactWebsite}
                    onChange={(e) => setContactWebsite(e.target.value)}
                  />
                </div>
              </div>

              {/* Keep secondary/accent/etc. submitting so the row stays valid */}
              <input type="hidden" name="secondary_color" value={colors.secondary_color} />
              <input type="hidden" name="accent_color" value={colors.accent_color} />
              <input type="hidden" name="background_color" value={colors.background_color} />
              <input type="hidden" name="text_color" value={colors.text_color} />
            </>
          )}

          {/* ───────── Company fields ───────── */}
          {profileType === 'company' && (
          <>
          <input type="hidden" name="show_logo" value={showLogo ? 'true' : 'false'} />
          <div className="form-group">
            <label className="input-label">Logo URL <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(optional)</span></label>
            <input
              name="logo_url"
              type="url"
              defaultValue={brand.logo_url ?? ''}
              className="input"
            />
          </div>

          {/* Logo Upload */}
          <div className="form-group">
            <label className="input-label">Upload Logo <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(optional)</span></label>
            <input type="hidden" name="logo_file_url" value={logoFileUrl ?? ''} />
            {/* Processed transparent variants used when rendering videos. */}
            <input type="hidden" name="logo_light_url" value={logoLightUrl ?? ''} />
            <input type="hidden" name="logo_dark_url" value={logoDarkUrl ?? ''} />
            <input type="hidden" name="logo_chip" value={logoChip ? 'true' : 'false'} />
            {logoFileUrl && logoLightUrl && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--accent, #16A34A)', fontWeight: 600 }}>
                ✓ Ready for video {logoChip ? '(shown on a subtle panel)' : ''}
              </div>
            )}

            {/* Preview */}
            {(logoFileUrl) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <img
                  src={logoFileUrl}
                  alt="Brand logo"
                  style={{ maxHeight: 120, width: 'auto', borderRadius: 8, border: '1px solid var(--border)', objectFit: 'contain', padding: 6, background: 'white' }}
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  style={{ background: 'none', border: 'none', color: 'var(--ink-light)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Remove logo
                </button>
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent, #4A90D9)' : 'var(--border)'}`,
                borderRadius: 10,
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
                background: dragOver ? 'rgba(74,144,217,0.05)' : 'transparent',
              }}
            >
              {uploading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span className="spinner" />
                  <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>Uploading...</span>
                </div>
              ) : (
                <span style={{ fontSize: 14, color: 'var(--ink-light)' }}>
                  Drop your logo here or click to upload
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
            {uploadError && (
              <div style={{ marginTop: 8, fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{uploadError}</div>
            )}
            {generatingLogoKit && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="spinner" />
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Generating styled logos...</span>
              </div>
            )}
            {logoKitError && (
              <div style={{ marginTop: 8, fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{logoKitError}</div>
            )}
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--ink)' }} />
                <span style={{ fontSize: 14.5, fontWeight: 500 }}>Show logo in videos</span>
              </label>
              <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: '6px 0 0 30px' }}>Turn off to render videos without your logo.</p>
            </div>
          </div>

          <div className="section-title" style={{ marginTop: 18 }}>Brand Colors</div>
          <div className="color-pickers">
            {Object.entries(colors).map(([key, value]) => (
              <div key={key} className="color-picker">
                <div className="lbl">{COLOR_LABELS[key]}</div>
                <label style={{ display: 'block', position: 'relative', cursor: 'pointer' }}>
                  <div
                    className="color-input"
                    style={{
                      background: value,
                      ...(value.toLowerCase() === '#ffffff' ? { boxShadow: 'inset 0 0 0 3px white, 0 0 0 1px var(--border)' } : {}),
                    }}
                  />
                  <input
                    type="color"
                    name={key}
                    value={value}
                    onChange={(e) => setColors((prev) => ({ ...prev, [key]: e.target.value }))}
                    style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                  />
                </label>
                <div className="color-hex">{value.toUpperCase()}</div>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="brand-preview">
            <div className="brand-preview-label">Live Preview</div>
            <div className="preview-card-mini">
              {Object.entries(colors).filter(([k]) => k !== 'text_color').map(([key, value]) => (
                <div key={key} className="pcm-row" style={{ background: value }}>
                  <span>{COLOR_LABELS[key]}</span>
                  <span style={{ opacity: 0.85, fontSize: 12, fontWeight: 500 }}>{COLOR_ROLES[key]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ───────── Identity Section ───────── */}
          <div className="section-eyebrow" style={{ marginTop: 28 }}>Identity</div>

          <div className="form-group">
            <label className="input-label">Tagline</label>
            <input
              name="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="input"
              placeholder="Your brand's tagline"
            />
          </div>

          <div className="form-group">
            <label className="input-label">Description</label>
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              rows={3}
              placeholder="Brief description of the brand"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="input-label">Industry</label>
              <input
                name="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="input"
                placeholder="e.g. SaaS, Healthcare"
              />
            </div>
            <div className="form-group">
              <label className="input-label">Tone</label>
              <input
                name="tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="input"
                placeholder="e.g. Professional, Friendly"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="input-label">Target Audience</label>
            <input
              name="target_audience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="input"
              placeholder="Who is this brand for?"
            />
          </div>

          {/* ───────── Content & Voice Section ───────── */}
          <div className="section-eyebrow" style={{ marginTop: 28 }}>Content &amp; Voice</div>

          <div className="form-group">
            <label className="input-label">Brand Values <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(comma-separated)</span></label>
            <input
              value={brandValues.join(', ')}
              onChange={(e) => setBrandValues(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="input"
              placeholder="Innovation, Trust, Quality"
            />
            <input type="hidden" name="brand_values" value={JSON.stringify(brandValues)} />
          </div>

          <div className="form-group">
            <label className="input-label">Services <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(comma-separated)</span></label>
            <input
              value={services.join(', ')}
              onChange={(e) => setServices(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="input"
              placeholder="Consulting, Development, Design"
            />
            <input type="hidden" name="services" value={JSON.stringify(services)} />
          </div>

          <div className="form-group">
            <label className="input-label">Unique Selling Points <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(comma-separated)</span></label>
            <input
              value={uniqueSellingPoints.join(', ')}
              onChange={(e) => setUniqueSellingPoints(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="input"
              placeholder="24/7 support, AI-powered, Industry-leading"
            />
            <input type="hidden" name="unique_selling_points" value={JSON.stringify(uniqueSellingPoints)} />
          </div>

          <div className="form-group">
            <label className="input-label">Content Themes <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(comma-separated)</span></label>
            <input
              value={contentThemes.join(', ')}
              onChange={(e) => setContentThemes(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="input"
              placeholder="Leadership, Data insights, Case studies"
            />
            <input type="hidden" name="content_themes" value={JSON.stringify(contentThemes)} />
          </div>

          <div className="form-group">
            <label className="input-label">Competitor Notes</label>
            <textarea
              name="competitor_notes"
              value={competitorNotes}
              onChange={(e) => setCompetitorNotes(e.target.value)}
              className="input"
              rows={3}
              placeholder="Notes on competitors, positioning, market gaps"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* ───────── Social & Web Section ───────── */}
          <div className="section-eyebrow" style={{ marginTop: 28 }}>Social &amp; Web</div>

          <div className="form-group">
            <label className="input-label">Website URL</label>
            <input
              value={websiteUrl}
              onChange={(e) => {
                setWebsiteUrl(e.target.value)
                setSocialLinks((prev) => ({ ...prev, website: e.target.value }))
              }}
              className="input"
              type="url"
              placeholder="https://example.com"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="input-label">LinkedIn</label>
              <input
                value={socialLinks.linkedin ?? ''}
                onChange={(e) => setSocialLinks((prev) => ({ ...prev, linkedin: e.target.value }))}
                className="input"
                placeholder="https://linkedin.com/company/..."
              />
            </div>
            <div className="form-group">
              <label className="input-label">Twitter / X</label>
              <input
                value={socialLinks.twitter ?? ''}
                onChange={(e) => setSocialLinks((prev) => ({ ...prev, twitter: e.target.value }))}
                className="input"
                placeholder="https://x.com/..."
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="input-label">Instagram</label>
              <input
                value={socialLinks.instagram ?? ''}
                onChange={(e) => setSocialLinks((prev) => ({ ...prev, instagram: e.target.value }))}
                className="input"
                placeholder="https://instagram.com/..."
              />
            </div>
            <div className="form-group">
              <label className="input-label">Facebook</label>
              <input
                value={socialLinks.facebook ?? ''}
                onChange={(e) => setSocialLinks((prev) => ({ ...prev, facebook: e.target.value }))}
                className="input"
                placeholder="https://facebook.com/..."
              />
            </div>
          </div>

          <input type="hidden" name="social_links" value={JSON.stringify(socialLinks)} />

          {/* ───────── End of brand guide fields ───────── */}
          </>
          )}

          {/* brand_guide_data — closing-card contact lands here for BOTH modes.
              Merge entered contact over the brand's existing guide data so we
              preserve any scraped/company guide fields while updating contact. */}
          <input
            type="hidden"
            name="brand_guide_data"
            value={JSON.stringify({
              ...(brand.brand_guide_data ?? {}),
              ...(contactPhone.trim() ? { phone: contactPhone.trim() } : { phone: '' }),
              ...(contactEmail.trim() ? { email: contactEmail.trim() } : { email: '' }),
              ...(contactWebsite.trim() ? { website: contactWebsite.trim() } : { website: '' }),
            })}
          />

          <div className="check-row" style={{ marginTop: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <input type="checkbox" name="is_default" value="true" defaultChecked={brand.is_default} style={{ width: 18, height: 18, accentColor: 'var(--ink)' }} />
              <span style={{ fontSize: 14.5, fontWeight: 500 }}>Set as default profile</span>
            </label>
          </div>

          {error && (
            <div style={{ borderRadius: 10, background: 'var(--rose-light, #fde8e8)', padding: '10px 16px', fontSize: 13, marginBottom: 16, color: 'var(--ink)', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/brands" className="btn btn-soft">Cancel</Link>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Saving...' : 'Save changes \u2192'}
            </button>
          </div>
        </form>
      </div>

      {/* ───────── Brand Deck Builder ───────── */}
      <div className="wizard-card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Brand Deck</h2>
            <p style={{ color: 'var(--ink-light)', fontSize: 14, margin: 0 }}>
              Generate a custom branded slide template. Your logo's colors will be matched across all slides.
            </p>
          </div>
          {hasExistingDeck && selectedStyle && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(52, 211, 153, 0.15)',
                color: '#34d399',
                fontSize: 12,
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: 10,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
              Brand deck active &mdash; {selectedStyle.name}
            </span>
          )}
        </div>

        {/* Style Picker */}
        <div className="section-title" style={{ marginTop: 18, marginBottom: 10 }}>Choose a style</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          {SLIDE_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => setSelectedStyleId(style.id)}
              style={{
                background: 'var(--surface, #111)',
                border: selectedStyleId === style.id ? '2px solid var(--accent, #4A90D9)' : '1px solid var(--border)',
                borderRadius: 10,
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
                overflow: 'hidden',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: selectedStyleId === style.id ? '0 0 0 2px rgba(74,144,217,0.25)' : 'none',
              }}
            >
              <img
                src={`/style-previews/${style.id}.png`}
                alt={style.name}
                style={{
                  width: '100%',
                  height: 100,
                  objectFit: 'cover',
                  display: 'block',
                  borderBottom: '1px solid var(--border)',
                }}
              />
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{style.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-light)', lineHeight: 1.3 }}>{style.description}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Generate / Regenerate Button */}
        {generating && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ height: 5, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%', borderRadius: 10, background: 'var(--mint)',
                transition: 'width 0.5s ease',
                width: `${Math.max(10, (generatingSlide / 4) * 100)}%`,
              }} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-light)', margin: 0, textAlign: 'center' }}>
              Slide {generatingSlide} of 4 &mdash; {generatingSlide <= 1 ? 'Designing title slide...' : generatingSlide === 2 ? 'Creating data layout...' : generatingSlide === 3 ? 'Building comparison chart...' : 'Finishing CTA slide...'}
            </p>
          </div>
        )}
        <button
          type="button"
          className="btn btn-mint"
          disabled={!selectedStyleId || generating}
          onClick={handleGenerateDeck}
          style={{ width: '100%', marginBottom: 20 }}
        >
          {generating
            ? `Generating slide ${generatingSlide} of 4...`
            : hasExistingDeck
              ? 'Regenerate Brand Deck'
              : 'Generate Brand Deck'}
        </button>

        {/* Reference Slides Preview */}
        {brand.reference_slides && brand.reference_slides.length > 0 && (
          <div>
            <div className="section-title" style={{ marginBottom: 10 }}>Reference Slides</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
              }}
            >
              {brand.reference_slides.map((slideUrl, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: 'var(--surface, #111)',
                  }}
                >
                  <img
                    src={slideUrl}
                    alt={SLIDE_LABELS[i] ?? `Slide ${i + 1}`}
                    style={{
                      width: '100%',
                      aspectRatio: '16/9',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  <div
                    style={{
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--ink-light)',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    {SLIDE_LABELS[i] ?? `Slide ${i + 1}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
