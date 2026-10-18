'use client'

/*
 * STEPS 3 AND 7 — "Your brand" (/create/brand) and "Opener & close"
 * (/create/opening). One screen's code, one job at a time (the approved
 * redesign, 2026-10-18):
 *
 *   brand   who this comes from: a saved brand, or a new one set up here — a
 *           person (name, photo, intro) or a company (logo, colors) — with
 *           nothing that needs a website; or no brand at all
 *   covers  the first and last thing the client sees: how you are
 *           introduced, where your photo appears, your contact on the closing,
 *           and the booking link their watch page offers
 *
 * The brand step saves the brand (a new one is created here) and the
 * per-video presenter choices; the opener step saves only those choices.
 */
import { StepExplain } from './StepExplain'
import Link from 'next/link'
import { tidyUrlInput } from '../../../../_lib/normalize-url'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../../../_lib/supabase/client'
import type { Brand } from '../../../../_lib/types'
import { downscaleImage } from '../../../../_lib/image-resize'
import { formatPhoneDisplay } from '../../../../_lib/phone-utils'
import { toTitleCase } from '../../../../_lib/text-format'
import { nextStepAfterBrand } from '../make/nextStep'
import { voiceNote, type SpeakAs, type PresenterVoice } from '../../../../_lib/narration-pov'
import BottomBar from '../workspace/BottomBar'
import { type Missing } from '../workspace/MainAction'
import { neighbours, stepPath } from '../workspace/steps'

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

/** Where an uploaded logo is stored: one new file per upload. */
const logoPathFor = (userId: string, ext: string) => `${userId}/brand-logos/${Date.now()}.${ext}`

export default function BrandCovers({ part }: { part: 'brand' | 'covers' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const videoId = searchParams.get('id')
  const { prev, next } = neighbours(part === 'brand' ? 'brand' : 'opening')
  // The booking link on the account (Settings) — shown on the opener step; the watch page offers it.
  const [bookingUrl, setBookingUrl] = useState<string | null>(null)

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
  // WHO IS SPEAKING (app/_lib/narration-pov.ts): the AI voice speaks on the
  // presenter's behalf unless they choose "as me" AND say which voice fits them.
  const [speakAs, setSpeakAs] = useState<SpeakAs>('for')
  const [presenterVoice, setPresenterVoice] = useState<PresenterVoice | ''>('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Load draft + brands on mount
  useEffect(() => {
    if (!videoId) { setLoading(false); return }

    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) { setLoading(false); return }
      if (part === 'covers') {
        void supabase.from('profiles').select('calendly_url').eq('id', authUser.id).maybeSingle()
          .then(({ data }) => setBookingUrl((data as { calendly_url?: string | null } | null)?.calendly_url || null))
      }
      Promise.all([
        fetch(`/api/videos/draft?videoId=${videoId}`).then(r => r.json()),
        supabase.from('brands').select('*').eq('user_id', authUser.id).order('is_default', { ascending: false }).order('created_at', { ascending: true }),
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

      // Restore what the user already entered on this step (so hitting Back from a
      // later step doesn't wipe their work). These were PATCHed to the draft on the
      // way forward; the auto-detected block above only covers the scraped values.
      if (draft.contactPhone) setPhone(draft.contactPhone)
      if (draft.contactEmail) setEmail(draft.contactEmail)
      if (draft.contactWebsite) setWebsite(draft.contactWebsite)
      if (draft.presenterIntro) setPresenterIntro(draft.presenterIntro)
      if (draft.photoPlacement) { setPhotoPlacement(draft.photoPlacement); setPerVideoPlacement(draft.photoPlacement) }
      if (typeof draft.introduceInOpening === 'boolean') setIntroduceInOpening(draft.introduceInOpening)
      if (typeof draft.showContactClosing === 'boolean') setShowContactClosing(draft.showContactClosing)
      if (draft.speakAs === 'as' || draft.speakAs === 'for') setSpeakAs(draft.speakAs)
      if (draft.presenterVoice === 'female' || draft.presenterVoice === 'male') setPresenterVoice(draft.presenterVoice)

      // Brands
      if (brandsResult.data) {
        const loaded = brandsResult.data as Brand[]
        setBrands(loaded)
        // Auto-select the auto-detected brand if present. We DON'T collapse the
        // picker anymore — "who's presenting?" must stay visible so the presenter
        // options aren't hidden behind a one-brand auto-select.
        // Coming BACK to this step: re-select the brand already chosen (or
        // created here) for this draft. Without this the inline form showed
        // again and pressing Next created a second copy of the same brand
        // every time the user went Back and forward.
        const chosen = typeof draft.brandId === 'string' ? loaded.find((b: Brand) => b.id === draft.brandId) : undefined
        if (chosen) setSelectedBrandId(chosen.id)
        else if (draft._autoBrandId) {
          const match = loaded.find((b: Brand) => b.id === draft._autoBrandId)
          if (match) setSelectedBrandId(match.id)
        } else if (draft.brandId === undefined && loaded.length > 0) {
          // Nothing chosen yet: start on the profile's default brand — the one
          // step 3 ("Make it yours") shows and uses.
          setSelectedBrandId(loaded[0].id)
        }
      }

      setLoading(false)
    }).catch(() => {
      setError('Failed to load draft data')
      setLoading(false)
    })
    })
  }, [videoId])

  function handleLogoChange(file: File) {
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleLogoDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleLogoChange(file)
    }
  }

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true)
    setError(null)
    try {
      // Downscale in the browser BEFORE upload — phone photos are 10-15MB and
      // hit the platform's request-body limit (413). A headshot only needs
      // ~1024px, which keeps the upload to a few hundred KB.
      const upload = await downscaleImage(file, 1024, 0.85)
      const fd = new FormData()
      fd.append('file', upload, upload.name)
      const res = await fetch('/api/brands/photo', { method: 'POST', body: fd })
      if (!res.ok) {
        let msg = `Photo upload failed (${res.status})`
        try { const d = await res.json(); if (d?.error) msg = d.error } catch { /* non-JSON (e.g. platform 413) */ }
        setError(msg)
        return
      }
      const data = await res.json()
      setPhotoUrl(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo upload failed')
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
          const path = logoPathFor(user.id, ext)
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
          // Logo applies to BOTH person and company — a person presenting still
          // wants their brand/company logo on the video (real uploaded logo only).
          logo_url: logoUrl,
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
        step: 4, // the look (derive.ts resumeUrl)
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
        updates.speakAs = speakAs
        updates.presenterVoice = presenterVoice || undefined
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

      // Back to step 3 ("Make it yours"), or to the story first if it isn't
      // written yet. (The separate voice step is gone — it's on step 3 now.)
      router.push(nextStepAfterBrand(videoId, draftData))
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
        body: JSON.stringify({ videoId, updates: { brandId: null, step: 4 } }),
      })

      router.push(nextStepAfterBrand(videoId, draftData))
    } catch {
      setError('Failed to skip')
      setSubmitting(false)
    }
  }

  /** Next on the opener step: save how you are introduced, then the review. */
  async function saveCovers() {
    if (!videoId) return
    setSubmitting(true)
    setError(null)
    try {
      const updates: Record<string, unknown> = { step: 8 } // the review (derive.ts resumeUrl)
      // Per-video presenter prefs — carried to generate-video via the draft,
      // exactly as the brand step saves them.
      if (selectedIsPerson) {
        updates.presenterIntro = presenterIntro.trim() || undefined
        updates.photoPlacement = perVideoPlacement
        updates.introduceInOpening = introduceInOpening
        updates.showContactClosing = showContactClosing
        updates.speakAs = speakAs
        updates.presenterVoice = presenterVoice || undefined
      }
      {
        const res = await fetch('/api/videos/draft', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, updates }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          setError(d.error || 'We couldn’t save that. Please try again.')
          setSubmitting(false)
          return
        }
      }
      router.push(stepPath('review', videoId))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg === 'Failed to fetch' ? 'Connection lost. Please check your internet and try again.' : msg)
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="cf-page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner" /></div>
      </div>
    )
  }

  if (!videoId) {
    return (
      <div className="cf-page">
        <h1 className="cf-h1">We couldn’t find this project.</h1>
        <p className="cf-hint">Start a new one and it will be saved as you go.</p>
        <div className="cf-buttons">
          <button type="button" className="kit-btn kit-btn--secondary" onClick={() => router.push('/create')}>Start a project</button>
        </div>
      </div>
    )
  }

  const hasInlineInput = companyName.trim().length > 0
  const canProceed = selectedBrandId || hasInlineInput
  const back = prev ? { href: stepPath(prev.key, videoId), label: prev.label } : null
  const errorNote = error ? (
    <div role="alert" className="kit-note kit-note--stop"><div className="kit-note-body"><p>{error}</p></div></div>
  ) : null

  /* ── STEP 7 — OPENER & CLOSE ───────────────────────────────────────── */
  if (part === 'covers') {
    const contact = (selectedBrand?.brand_guide_data ?? {}) as { phone?: string; email?: string; website?: string }
    const contactLines = [contact.phone, contact.email, contact.website].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    return (
      <div className="cf-page cf-step" data-step="covers">
        <StepExplain step="opening" />
        <h1 className="cf-h1">Opener <em>&amp; close.</em></h1>

        <div className="cf-split">
          <div className="cf-main-col">
            {!selectedBrand ? (
              <div className="cf-card cf-quick">
                <span>No brand on this one — the opening shows the title and the closing a plain ask.</span>
                <Link className="cf-link" href={stepPath('brand', videoId)}>Add a brand</Link>
              </div>
            ) : selectedIsPerson ? (
              <>
                <div className="cf-card cf-covers">
                  <span className="cf-label">The opener</span>
                  <div className="cf-covers-who">
                    {selectedBrand.photo_url ? <img className="cf-covers-photo" src={selectedBrand.photo_url} alt={selectedBrand.name} /> : null}
                    <span><strong>{selectedBrand.name}</strong>{selectedBrand.person_role ? <><br /><span className="cf-hint">{selectedBrand.person_role}</span></> : null}</span>
                  </div>
                  <label className="cf-field">
                    <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>How you’re introduced in this video</span>
                    <textarea
                      className="cf-input"
                      value={presenterIntro}
                      onChange={(e) => setPresenterIntro(e.target.value)}
                      rows={3}
                      placeholder={selectedBrand.intro_line || `${selectedBrand.name.split(/\s+/)[0]} is ${selectedBrand.person_role ? `a ${selectedBrand.person_role}` : 'here to help'} and prepared this video to walk you through your plan.`}
                    />
                    <span className="cf-hint">Spoken at the start by the narrator, on your behalf. A line written as “I’m…” is said in the third person unless the voice speaks as you (below).</span>
                  </label>
                  <label className="cf-toggle">
                    <input type="checkbox" checked={introduceInOpening} onChange={(e) => setIntroduceInOpening(e.target.checked)} />
                    <span>Introduce me in the opening</span>
                  </label>
                  <fieldset className="cf-field" data-testid="speak-as">
                    <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>Who is speaking?</span>
                    <label className="cf-toggle">
                      <input type="radio" name="speak-as" checked={speakAs === 'for'} onChange={() => setSpeakAs('for')} />
                      <span>The narrator, on my behalf (recommended)</span>
                    </label>
                    <label className="cf-toggle">
                      <input type="radio" name="speak-as" checked={speakAs === 'as'} onChange={() => setSpeakAs('as')} />
                      <span>The voice speaks as me</span>
                    </label>
                    {speakAs === 'as' ? (
                      <label className="cf-field">
                        <span className="cf-hint">The voice that fits me</span>
                        <select className="cf-input" value={presenterVoice} onChange={(e) => setPresenterVoice(e.target.value as PresenterVoice | '')}>
                          <option value="">Choose…</option>
                          <option value="female">A female voice</option>
                          <option value="male">A male voice</option>
                        </select>
                      </label>
                    ) : null}
                    {(() => {
                      const note = voiceNote({ presenterName: selectedBrand.name, speakAs, presenterVoice: presenterVoice || null, voiceId: draftData?.voiceId, intro: presenterIntro || selectedBrand.intro_line })
                      return note ? <span className="cf-hint" role="status" data-testid="voice-note">{note}</span> : null
                    })()}
                  </fieldset>
                  <label className="cf-field">
                    <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>Where my photo appears</span>
                    <select className="cf-input" value={perVideoPlacement} onChange={(e) => setPerVideoPlacement(e.target.value)}>
                      <option value="auto">Auto (the video style decides)</option>
                      <option value="cover">Cover only</option>
                      <option value="closing">Closing only</option>
                      <option value="both">Cover and closing</option>
                      <option value="none">Don’t show my photo</option>
                    </select>
                  </label>
                </div>
                <div className="cf-card cf-covers">
                  <span className="cf-label">The closing</span>
                  <label className="cf-toggle">
                    <input type="checkbox" checked={showContactClosing} onChange={(e) => setShowContactClosing(e.target.checked)} />
                    <span>Show my contact on the closing</span>
                  </label>
                  {contactLines.length ? <span className="cf-hint">{contactLines.join(' · ')}</span> : <span className="cf-hint">No contact details on this brand yet.</span>}
                  <Link className="cf-link" href={`/brands/${encodeURIComponent(selectedBrand.id)}`}>Change your photo or contact details on the brand</Link>
                </div>
              </>
            ) : (
              <div className="cf-card cf-covers">
                <span className="cf-label">The opener and the closing</span>
                <span>The opening wears <strong>{selectedBrand.name}</strong>’s logo; the closing shows how to reach you.</span>
                {contactLines.length ? <span className="cf-hint">{contactLines.join(' · ')}</span> : <span className="cf-hint">No contact details on this brand yet.</span>}
                <Link className="cf-link" href={`/brands/${encodeURIComponent(selectedBrand.id)}`}>Change the logo or contact details on the brand</Link>
              </div>
            )}

            <div className="cf-card cf-covers">
              <span className="cf-label">Booking link</span>
              {bookingUrl
                ? <span>Their watch page has a <strong>Book a call</strong> button: <span className="cf-hint">{bookingUrl}</span></span>
                : <span className="cf-hint">No booking link yet. Add your Calendly, Cal.com or Google Calendar link and their watch page gets a Book a call button.</span>}
              <Link className="cf-link" href="/settings">{bookingUrl ? 'Change it in Settings' : 'Add it in Settings'}</Link>
            </div>

            {errorNote}
          </div>
          <aside className="cf-side" aria-label="Who it comes from">
            <div className="cf-card cf-side-card">
              <span className="cf-label">From</span>
              <strong>{selectedBrand?.name ?? 'No brand'}</strong>
              <Link className="cf-link" href={stepPath('brand', videoId)}>Change the brand</Link>
            </div>
          </aside>
        </div>

        <BottomBar
          label="Next step"
          info="Free"
          sub="Nothing charged yet"
          back={back}
          onMain={() => void saveCovers()}
          mainLabel={submitting ? 'Saving…' : `Next: ${next?.label ?? ''} →`}
          disabled={submitting}
          busy={submitting}
        />
      </div>
    )
  }

  /* ── STEP 3 — YOUR BRAND ──────────────────────────────────────────── */
  const shownName = selectedBrand?.name || companyName.trim()
  const shownLogo = selectedBrand ? (selectedBrand.profile_type === 'person' && selectedBrand.photo_url ? selectedBrand.photo_url : selectedBrand.logo_url) : logoPreview
  const shownColors = selectedBrand ? [selectedBrand.primary_color, selectedBrand.secondary_color, selectedBrand.accent_color] : [primaryColor, profileType === 'company' ? secondaryColor : null]
  const missing: Missing | null = submitting || canProceed ? null : { reason: 'Pick a saved brand, set one up here, or skip it below.' }

  return (
    <div className="cf-page cf-step" data-step="brand">
      <StepExplain step="brand" />
      <h1 className="cf-h1">Your <em>brand.</em></h1>

      <div className="cf-split">
        <div className="cf-main-col">
          {/* Compact confirm — single brand, auto-selected */}
          {!showPicker && selectedBrandId && (() => {
            const b = brands.find(x => x.id === selectedBrandId)
            if (!b) return null
            return (
              <div className="cf-card cf-brand">
                {b.logo_url ? <img className="cf-brand-logo" src={b.logo_url} alt="" /> : null}
                <span className="cf-brand-text">Using your brand <strong>{b.name}</strong></span>
                <button type="button" className="cf-link" onClick={() => setShowPicker(true)}>Change</button>
              </div>
            )
          })()}

          {/* Saved brands — a dropdown (people + companies, badged in the label). */}
          {showPicker && brands.length > 0 && (
            <div className="cf-card cf-covers">
              <label htmlFor="profile-select" className="cf-label">Use a saved brand</label>
              <select
                id="profile-select"
                className="cf-input"
                value={selectedBrandId ?? ''}
                onChange={(e) => {
                  const id = e.target.value
                  if (id) handleSelectBrand(id)
                  else setSelectedBrandId(null)   // "Create new" → show the inline form
                }}
              >
                <option value="">+ Set up a new brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.profile_type === 'person' ? 'Person' : 'Company'}{b.is_default ? ' (default)' : ''}
                  </option>
                ))}
              </select>

              {/* Small confirmation card for the chosen profile. */}
              {selectedBrand && (
                <div className="cf-covers-who">
                  {selectedBrand.profile_type === 'person' && selectedBrand.photo_url ? (
                    <img className="cf-covers-photo" src={selectedBrand.photo_url} alt={selectedBrand.name} />
                  ) : selectedBrand.logo_url ? (
                    <img className="cf-brand-logo" src={selectedBrand.logo_url} alt="" />
                  ) : null}
                  <span>
                    <strong>{selectedBrand.name}</strong><br />
                    <span className="cf-hint">{selectedBrand.profile_type === 'person' ? (selectedBrand.person_role || 'Person') : 'Company'}</span>
                  </span>
                </div>
              )}
              {selectedBrand ? <span className="cf-hint">How you’re introduced and your contact on the closing are set on the Opener &amp; close step.</span> : null}
            </div>
          )}

          {/* Inline create form — hidden when a saved profile is selected */}
          {!selectedBrandId && (
            <div className="cf-card cf-covers">
              <span className="cf-label">{brands.length > 0 ? 'Or set up a new one' : 'Set up your brand'}</span>

              <div className="cf-field">
                <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>Is this a person or a company?</span>
                <div className="cf-chips" role="radiogroup" aria-label="Person or company">
                  {(['person', 'company'] as const).map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={profileType === t} className="cf-chip" onClick={() => setProfileType(t)}>
                      {t === 'company' ? 'Company' : 'Person'}
                    </button>
                  ))}
                </div>
              </div>

              <label className="cf-field">
                <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>{profileType === 'person' ? 'Your name' : 'Company name'} <span aria-hidden="true">*</span></span>
                <input
                  type="text"
                  className="cf-input"
                  value={companyName}
                  onChange={e => { setCompanyName(e.target.value); setSelectedBrandId(null) }}
                  placeholder={profileType === 'person' ? 'e.g. Sarah Talls' : 'e.g. Acme Insurance'}
                  onBlur={() => setCompanyName(toTitleCase(companyName))}
                />
              </label>

              {profileType === 'person' && (
                <>
                  <label className="cf-field">
                    <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>Role / title <small>(optional)</small></span>
                    <input type="text" className="cf-input" value={personRole} onChange={e => setPersonRole(e.target.value)} placeholder="e.g. Registered Nurse" />
                  </label>

                  <div className="cf-field">
                    <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>Photo <small>(optional)</small></span>
                    {photoUrl && (
                      <div className="cf-covers-who">
                        <img className="cf-covers-photo" src={photoUrl} alt="Your photo" />
                        <button type="button" className="cf-link" onClick={() => { setPhotoUrl(''); if (photoInputRef.current) photoInputRef.current.value = '' }}>Remove photo</button>
                      </div>
                    )}
                    <button type="button" className="cf-drop cf-drop--small" onClick={() => photoInputRef.current?.click()}>
                      {photoUploading ? 'Uploading…' : 'Click to upload a headshot'}
                    </button>
                    <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} style={{ display: 'none' }} />
                  </div>

                  <label className="cf-field">
                    <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>Intro line <small>(optional)</small></span>
                    <textarea
                      className="cf-input"
                      value={introLine}
                      onChange={e => setIntroLine(e.target.value)}
                      rows={3}
                      placeholder="Sarah Talls is a registered nurse and prepared this video to walk you through your prescription plan."
                    />
                    <span className="cf-hint">Spoken at the start by the narrator, on your behalf — so write it about you (“Sarah is…”). A line written as “I’m…” is said in the third person.</span>
                  </label>

                  <div className="cf-two">
                    <label className="cf-field">
                      <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>Accent color</span>
                      <span className="cf-color"><input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} /><code>{primaryColor}</code></span>
                    </label>
                    <label className="cf-field">
                      <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>Photo placement</span>
                      <select className="cf-input" value={photoPlacement} onChange={e => setPhotoPlacement(e.target.value)}>
                        <option value="auto">Auto (style decides)</option>
                        <option value="cover">Cover</option>
                        <option value="closing">Closing</option>
                        <option value="both">Both</option>
                        <option value="none">None</option>
                      </select>
                    </label>
                  </div>

                  <label className="cf-toggle">
                    <input type="checkbox" checked={showNameOnSlides} onChange={e => setShowNameOnSlides(e.target.checked)} />
                    <span>Show my name on slides<small>Off = the document title leads the cover; your name still appears in the intro and closing.</small></span>
                  </label>
                </>
              )}

              {profileType === 'company' && (
                <div className="cf-two">
                  <label className="cf-field">
                    <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>Primary color</span>
                    <span className="cf-color"><input type="color" value={primaryColor} onChange={e => { setPrimaryColor(e.target.value); setSelectedBrandId(null) }} /><code>{primaryColor}</code></span>
                  </label>
                  <label className="cf-field">
                    <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>Secondary color <small>(optional)</small></span>
                    <span className="cf-color"><input type="color" value={secondaryColor} onChange={e => { setSecondaryColor(e.target.value); setSelectedBrandId(null) }} /><code>{secondaryColor}</code></span>
                  </label>
                </div>
              )}

              {/* Contact info — shown on the closing card (both kinds). */}
              <div className="cf-field">
                <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>Contact info <small>(optional, for the closing)</small></span>
                <input
                  type="tel"
                  className="cf-input"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setSelectedBrandId(null) }}
                  onBlur={e => setPhone(formatPhoneDisplay(e.target.value))}
                  placeholder="Phone number"
                />
                <input
                  type="email"
                  className="cf-input"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setSelectedBrandId(null) }}
                  placeholder="Email address"
                />
                <input
                  type="text" inputMode="url" autoComplete="url"
                  className="cf-input"
                  value={website}
                  onChange={e => { setWebsite(e.target.value); setSelectedBrandId(null) }}
                  onBlur={() => setWebsite((v) => tidyUrlInput(v))}
                  placeholder="Website (optional — yourcompany.com)"
                />
              </div>

              {/* Logo upload — shown for BOTH person and company. Real uploaded logo
                  only (no AI-drawn logos). Placed in the video's intro/corner/outro. */}
              <div className="cf-field">
                <span className="cf-hint" style={{ color: 'var(--ink)', fontWeight: 700 }}>Logo <small>(optional — shown in the video)</small></span>
                {logoPreview ? (
                  <div className="cf-covers-who">
                    <img className="cf-brand-logo cf-brand-logo--big" src={logoPreview} alt="Logo" />
                    <button
                      type="button"
                      className="cf-link"
                      onClick={() => { setLogoFile(null); setLogoPreview(null); if (logoInputRef.current) logoInputRef.current.value = '' }}
                    >Remove logo</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="cf-drop cf-drop--small"
                    onClick={() => logoInputRef.current?.click()}
                    onDrop={handleLogoDrop}
                    onDragOver={e => e.preventDefault()}
                  >
                    Click or drop to upload your logo (PNG with transparency works best)
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoChange(f) }} style={{ display: 'none' }} />
                <label className="cf-toggle">
                  <input type="checkbox" checked={showLogo} onChange={e => setShowLogo(e.target.checked)} />
                  <span>Show logo in videos</span>
                </label>
              </div>

              <label className="cf-toggle">
                <input type="checkbox" checked={saveAsDefault} onChange={e => setSaveAsDefault(e.target.checked)} />
                <span>Save as my default brand</span>
              </label>
            </div>
          )}

          {errorNote}

          <p className="cf-hint">
            <button type="button" className="cf-link" onClick={handleSkip} disabled={submitting}>Skip — no brand on this one</button>
          </p>
        </div>

        <aside className="cf-side" aria-label="How it will wear it">
          <div className="cf-card cf-side-card">
            <span className="cf-label">How it will wear it</span>
            <div className="cf-brand-peek">
              {shownLogo ? <img className="cf-brand-logo cf-brand-logo--big" src={shownLogo} alt="" /> : null}
              <strong>{shownName || 'Your name or company'}</strong>
              <span className="cf-brand-dots" aria-hidden>
                {shownColors.filter(Boolean).map((c, i) => <span key={i} className="cf-brand-dot" style={{ background: c as string }} />)}
              </span>
            </div>
            <span className="cf-hint">A first look — the scenes themselves are designed on the Look step.</span>
          </div>
        </aside>
      </div>

      <BottomBar
        label="Next step"
        info="Free"
        sub="Nothing charged yet · saved as you go"
        back={back}
        onMain={() => void handleSubmit()}
        mainLabel={submitting ? 'Saving…' : `Next: ${next?.label ?? ''} →`}
        disabled={submitting}
        busy={submitting}
        missing={missing}
      />
    </div>
  )
}
