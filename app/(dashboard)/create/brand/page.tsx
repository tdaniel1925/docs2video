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
  // When the user has exactly one brand we auto-use it and hide the full
  // picker behind a "change?" toggle, so the common case is one click.
  const [showPicker, setShowPicker] = useState(true)
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

  // Profile type (Person | Company) — presenter-first: default to Person.
  const [profileType, setProfileType] = useState<'person' | 'company'>('person')
  const [personRole, setPersonRole] = useState('')
  const [introLine, setIntroLine] = useState('')
  const [showNameOnSlides, setShowNameOnSlides] = useState(true)
  const [photoPlacement, setPhotoPlacement] = useState('auto')
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showLogo, setShowLogo] = useState(true)
  // Per-video presenter controls (shown when a Person profile is selected).
  const [presenterIntro, setPresenterIntro] = useState('')
  const [introduceInOpening, setIntroduceInOpening] = useState(true)
  const [showContactClosing, setShowContactClosing] = useState(true)
  const [perVideoPlacement, setPerVideoPlacement] = useState('auto')
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Load draft + brands on mount
  useEffect(() => {
    if (!videoId) { setLoading(false); return }

    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) { setLoading(false); return }
      Promise.all([
        fetch(`/api/videos/draft?videoId=${videoId}`).then(r => r.json()),
        supabase.from('brands').select('*').eq('user_id', authUser.id).order('is_default', { ascending: false }),
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
        const loaded = brandsResult.data as Brand[]
        setBrands(loaded)
        // Auto-select the auto-detected brand if present. We DON'T collapse the
        // picker anymore — "who's presenting?" must stay visible so the presenter
        // options aren't hidden behind a one-brand auto-select.
        if (draft._autoBrandId) {
          const match = loaded.find((b: Brand) => b.id === draft._autoBrandId)
          if (match) setSelectedBrandId(match.id)
        }
      }

      setLoading(false)
    }).catch(() => {
      setError('Failed to load draft data')
      setLoading(false)
    })
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

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/brands/photo', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) setPhotoUrl(data.url)
      else setError(data.error || 'Photo upload failed')
    } catch {
      setError('Photo upload failed')
    } finally {
      setPhotoUploading(false)
    }
  }

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
    // Prefill the per-video presenter controls from the chosen profile.
    const b = brands.find((x) => x.id === brandId)
    setPresenterIntro(b?.intro_line || '')
    setPerVideoPlacement(b?.photo_placement || 'auto')
    setIntroduceInOpening(true)
    setShowContactClosing(true)
  }

  // The currently-selected saved profile (for showing presenter controls).
  const selectedBrand = brands.find((b) => b.id === selectedBrandId) || null
  const selectedIsPerson = selectedBrand?.profile_type === 'person'

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
          logo_url: profileType === 'person' ? null : logoUrl,
          is_default: saveAsDefault,
          profile_type: profileType,
          person_role: profileType === 'person' ? (personRole.trim() || null) : null,
          photo_url: profileType === 'person' ? (photoUrl || null) : null,
          intro_line: profileType === 'person' ? (introLine.trim() || null) : null,
          show_name_on_slides: showNameOnSlides,
          show_logo: showLogo,
          photo_placement: profileType === 'person' ? photoPlacement : 'auto',
        }

        // Closing-card contact lives in brand_guide_data (read by generate-video).
        // Include only the non-empty fields, for both person and company.
        const contactGuide: Record<string, string> = {}
        if (phone.trim()) contactGuide.phone = phone.trim()
        if (email.trim()) contactGuide.email = email.trim()
        if (website.trim()) contactGuide.website = website.trim()
        if (Object.keys(contactGuide).length > 0) {
          brandRecord.brand_guide_data = contactGuide
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

      // Per-video presenter prefs — carried to generate-video via the draft.
      // Covers BOTH a selected Person profile AND a Person being created inline
      // (in which case the inline intro/placement seed the per-video values).
      const isInlinePerson = !selectedBrandId && profileType === 'person'
      if (selectedIsPerson || isInlinePerson) {
        const introVal = selectedIsPerson ? presenterIntro : (presenterIntro || introLine)
        const placementVal = selectedIsPerson ? perVideoPlacement : photoPlacement
        updates.presenterIntro = introVal.trim() || undefined
        updates.photoPlacement = placementVal
        updates.introduceInOpening = introduceInOpening
        updates.showContactClosing = showContactClosing
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
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg === 'Failed to fetch' ? 'Connection lost. Please check your internet and try again.' : msg)
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
        Who&rsquo;s presenting this video?
      </h1>
      <p style={{
        fontSize: 17, color: 'var(--ink-soft)', textAlign: 'center',
        marginBottom: 32, lineHeight: 1.6, animation: 'fadeInUp 0.4s ease 0.05s both',
      }}>
        Introduce yourself with your name, photo, and a friendly intro &mdash; or pick a saved profile. Company branding is optional.
      </p>

      {/* Compact confirm — single brand, auto-selected */}
      {!showPicker && selectedBrandId && (() => {
        const b = brands.find(x => x.id === selectedBrandId)
        if (!b) return null
        return (
          <div style={{
            width: '100%', marginBottom: 24, padding: '16px 20px', borderRadius: 10,
            border: '1.5px solid var(--mint)', background: 'rgba(199, 232, 168, 0.08)',
            display: 'flex', alignItems: 'center', gap: 12,
            animation: 'fadeInUp 0.4s ease 0.1s both',
          }}>
            {b.logo_url ? (
              <img src={b.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'contain', background: 'var(--bg-soft)' }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: 6, background: b.primary_color || 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: 'white' }}>
                {b.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-light)', fontWeight: 600 }}>Using your brand</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{b.name}</div>
            </div>
            <button onClick={() => setShowPicker(true)} style={{ background: 'none', border: 'none', color: 'var(--ink-soft)', fontSize: 14, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
              Change
            </button>
          </div>
        )
      })()}

      {/* Saved profiles — a dropdown (people + companies, badged in the label). */}
      {showPicker && brands.length > 0 && (
        <div style={{ width: '100%', marginBottom: 20, animation: 'fadeInUp 0.4s ease 0.1s both' }}>
          <label htmlFor="profile-select" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>
            Use a saved profile
          </label>
          <select
            id="profile-select"
            value={selectedBrandId ?? ''}
            onChange={(e) => {
              const id = e.target.value
              if (id) handleSelectBrand(id)
              else setSelectedBrandId(null)   // "Create new" → show the inline form
            }}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 15,
              fontFamily: 'inherit', fontWeight: 600, color: 'var(--ink)',
              border: '1.5px solid var(--border-light)', background: 'white',
              boxSizing: 'border-box', cursor: 'pointer',
            }}
          >
            <option value="">+ Create a new profile</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.profile_type === 'person' ? 'Person' : 'Company'}{b.is_default ? ' (default)' : ''}
              </option>
            ))}
          </select>

          {/* Small confirmation card for the chosen profile. */}
          {selectedBrand && (
            <div style={{
              marginTop: 12, display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 10,
              border: '1.5px solid var(--mint)', background: 'rgba(199, 232, 168, 0.08)',
            }}>
              {selectedBrand.profile_type === 'person' && selectedBrand.photo_url ? (
                <img src={selectedBrand.photo_url} alt={selectedBrand.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: 'var(--bg-soft)' }} />
              ) : selectedBrand.logo_url ? (
                <img src={selectedBrand.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'contain', background: 'var(--bg-soft)' }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 6, background: selectedBrand.primary_color || 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: 'white' }}>
                  {selectedBrand.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{selectedBrand.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>
                  {selectedBrand.profile_type === 'person'
                    ? (selectedBrand.person_role || 'Presenter')
                    : 'Company branding'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Divider / toggle link */}
      {showPicker && brands.length > 0 && !selectedBrandId && (
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

      {/* Per-video presenter controls — shown when the selected profile is a
          Person. Lets the creator tweak how they're introduced for THIS video. */}
      {showPicker && selectedIsPerson && (
        <div style={{
          width: '100%', padding: '24px', borderRadius: 10, background: 'white',
          border: '1.5px solid var(--border-light)', marginBottom: 20,
          animation: 'fadeInUp 0.4s ease both',
        }}>
          <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
            How you&apos;re introduced in this video
          </label>
          <textarea
            value={presenterIntro}
            onChange={(e) => setPresenterIntro(e.target.value)}
            rows={3}
            placeholder="Hi, I'm Sarah Talls, a registered nurse. I've prepared this video to walk you through your prescription plan."
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
              fontFamily: 'inherit', border: '1.5px solid var(--border-light)',
              color: 'var(--ink)', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: '6px 0 16px' }}>
            Spoken at the start — write it the way you&apos;d say it.
          </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink)', marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={introduceInOpening} onChange={(e) => setIntroduceInOpening(e.target.checked)} />
            Introduce me in the opening
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink)', marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={showContactClosing} onChange={(e) => setShowContactClosing(e.target.checked)} />
            Show my contact on the closing
          </label>

          <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
            Where my photo appears
          </label>
          <select
            value={perVideoPlacement}
            onChange={(e) => setPerVideoPlacement(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
              fontFamily: 'inherit', border: '1.5px solid var(--border-light)',
              color: 'var(--ink)', background: 'white', boxSizing: 'border-box',
            }}
          >
            <option value="auto">Auto (the video style decides)</option>
            <option value="cover">Cover only</option>
            <option value="closing">Closing only</option>
            <option value="both">Cover and closing</option>
            <option value="none">Don&apos;t show my photo</option>
          </select>
        </div>
      )}

      {/* Inline create form — hidden when a saved profile is selected */}
      {!selectedBrandId && (
      <div style={{
        width: '100%', padding: '24px', borderRadius: 10,
        background: 'white',
        border: '1.5px solid var(--border-light)',
        marginBottom: 20,
        animation: 'fadeInUp 0.4s ease 0.2s both',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
          {brands.length > 0 ? 'Or set up a new one' : "Set up who's presenting"}
        </div>
        {/* Profile type toggle */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
            Is this a person or a company?
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['person', 'company'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setProfileType(t)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                  border: profileType === t ? '2px solid var(--mint)' : '1.5px solid var(--border-light)',
                  background: profileType === t ? 'rgba(199, 232, 168, 0.12)' : 'white',
                  color: 'var(--ink)',
                }}
              >
                {t === 'company' ? 'Company' : 'Person'}
              </button>
            ))}
          </div>
        </div>

        {/* Company / person name */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
            {profileType === 'person' ? 'Your name' : 'Company name'} <span style={{ color: '#b91c1c' }}>*</span>
          </label>
          <input
            type="text"
            value={companyName}
            onChange={e => { setCompanyName(e.target.value); setSelectedBrandId(null) }}
            placeholder={profileType === 'person' ? 'e.g. Sarah Talls' : 'e.g. Acme Insurance'}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 8,
              border: '2px solid var(--border)', fontSize: 15, fontFamily: 'inherit',
              outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Person fields */}
        {profileType === 'person' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
                Role / title <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-light)' }}>(optional)</span>
              </label>
              <input
                type="text"
                value={personRole}
                onChange={e => setPersonRole(e.target.value)}
                placeholder="e.g. Registered Nurse"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1.5px solid var(--border-light)', fontSize: 15, fontFamily: 'inherit', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
                Photo <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-light)' }}>(optional)</span>
              </label>
              {photoUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <img src={photoUrl} alt="Presenter" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border-light)' }} />
                  <button type="button" onClick={() => { setPhotoUrl(''); if (photoInputRef.current) photoInputRef.current.value = '' }} style={{ background: 'none', border: 'none', color: 'var(--ink-light)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Remove photo</button>
                </div>
              )}
              <div
                onClick={() => photoInputRef.current?.click()}
                style={{ border: '2px dashed var(--border-light)', borderRadius: 8, padding: '18px 14px', textAlign: 'center', cursor: 'pointer' }}
              >
                <span style={{ fontSize: 14, color: 'var(--ink-light)' }}>{photoUploading ? 'Uploading...' : 'Click to upload a headshot'}</span>
                <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} style={{ display: 'none' }} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
                Intro line <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-light)' }}>(optional)</span>
              </label>
              <textarea
                value={introLine}
                onChange={e => setIntroLine(e.target.value)}
                rows={3}
                placeholder="Hi, I'm Sarah Talls, a registered nurse. I've prepared this video to walk you through your prescription plan."
                style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1.5px solid var(--border-light)', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
              />
              <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: '6px 0 0' }}>Spoken at the start of your video — write it the way you&apos;d say it.</p>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>Accent color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: 40, height: 40, borderRadius: 8, border: '2px solid var(--border)', cursor: 'pointer', padding: 2 }} />
                  <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontFamily: 'monospace' }}>{primaryColor}</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>Photo placement</label>
                <select
                  value={photoPlacement}
                  onChange={e => setPhotoPlacement(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-light)', fontSize: 14, fontFamily: 'inherit', background: 'white' }}
                >
                  <option value="auto">Auto (style decides)</option>
                  <option value="cover">Cover</option>
                  <option value="closing">Closing</option>
                  <option value="both">Both</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--ink-soft)' }}>
                <input type="checkbox" checked={showNameOnSlides} onChange={e => setShowNameOnSlides(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--mint)' }} />
                Show my name on slides
              </label>
              <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: '6px 0 0 24px' }}>Off = the document title leads the cover; your name still appears in the intro and closing.</p>
            </div>

            {/* Contact info — shown on the closing card */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 10 }}>
                Contact info <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-light)' }}>(optional, for closing card)</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setSelectedBrandId(null) }}
                  placeholder="Phone number"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border-light)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setSelectedBrandId(null) }}
                  placeholder="Email address"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border-light)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                />
                <input
                  type="url"
                  value={website}
                  onChange={e => { setWebsite(e.target.value); setSelectedBrandId(null) }}
                  placeholder="Website URL"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border-light)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>
            </div>
          </>
        )}

        {/* Color pickers — Company only */}
        {profileType === 'company' && (
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
        )}

        {/* Show logo toggle — Company only */}
        {profileType === 'company' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--ink-soft)' }}>
              <input type="checkbox" checked={showLogo} onChange={e => setShowLogo(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--mint)' }} />
              Show logo in videos
            </label>
            <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: '6px 0 0 24px' }}>Turn off to render videos without your logo.</p>
          </div>
        )}

        {/* Contact info — Company only */}
        {profileType === 'company' && (
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
        )}

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
            Save as my default profile
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
        Skip &mdash; no presenter or branding
      </button>
    </div>
  )
}
