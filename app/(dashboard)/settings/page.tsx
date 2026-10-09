'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../_lib/supabase/client'
import SmtpSetupModal from '../../_components/SmtpSetupModal'
import InlineConfirm from '../../_components/InlineConfirm'
import { useBrand } from '../../_components/BrandProvider'
import type { Profile, Brand } from '../../_lib/types'
import { NAMES } from '../../_lib/names'
import { updatePassword, updateEmail } from '../../_actions/auth'
import { useToast } from '../../_components/Toast'
import { cleanWebLink } from '../../_lib/url-validate'
import { Button, EmptyState, Note } from '../../_components/kit'
import ViewAlertsSetting from '../activity/ViewAlertsSetting'
import ApiKeysSection from './ApiKeysSection'
import BillingSection from './BillingSection'
import { sectionFromParams, type SectionId } from './account-sections'
import s from './settings.module.css'

// Plain-language text for the ?email_error= codes the connect flows return.
function emailErrorText(code: string): string {
  switch (code) {
    case 'outlook_not_configured': return 'Outlook connect is not available right now. Use Gmail or SMTP instead.'
    case 'google_not_configured': return 'Gmail connect is not available right now. Use SMTP instead.'
    case 'calendar_link_only': return 'Google Calendar can’t be connected directly yet. Paste your Google booking page link instead.'
    case 'invalid_state': return 'That sign-in link wasn’t started from this account. Please click Connect again.'
    case 'link_expired': return 'That sign-in took too long. Please click Connect again.'
    case 'access_denied': return 'You cancelled the sign-in.'
    default: return code.replace(/_/g, ' ')
  }
}

/** Each section's heading and the line under it. */
const SECTION_HEAD: Record<SectionId, { title: string; sub: string }> = {
  profile: { title: 'Profile', sub: 'Your details, sign-in and photos.' },
  billing: { title: 'Billing & credits', sub: 'Your plan, your credits and your invoices.' },
  brand: { title: 'Brand kit', sub: 'The logo and colours put on everything you make.' },
  email: { title: 'Email & sending', sub: 'How your projects reach clients, and what they can click.' },
  social: { title: 'AI Social', sub: 'The social accounts AI Social posts to.' },
}

/*
 * SETTINGS = THE ACCOUNT AREA (round B, 2026-10). The menu down the left is
 * AccountShell (settings/layout.tsx); this page draws the section the address
 * names (?tab=…, see account-sections.ts — the old ?tab=subscription and
 * ?tab=integrations links still land in the right place).
 */
export default function SettingsPage() {
  // Which storefront this is (Docs2Video / Text2Art). NOT the customer's
  // brand kit, which is also called `brand` throughout this file.
  const storefront = useBrand()
  const searchParams = useSearchParams()
  const section = sectionFromParams((k) => searchParams.get(k), { showVideoFeatures: storefront.showVideoFeatures })

  const [profile, setProfile] = useState<Profile | null>(null)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [brandsLoaded, setBrandsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [photoUploading, setPhotoUploading] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [emailConnections, setEmailConnections] = useState<any[]>([])
  const [showSmtpModal, setShowSmtpModal] = useState(false)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [oauthProviders, setOauthProviders] = useState<{ google: boolean; microsoft: boolean }>({ google: true, microsoft: true })
  const [saveError, setSaveError] = useState<string | null>(null)
  const [securityMsg, setSecurityMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [securityBusy, setSecurityBusy] = useState(false)

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSecurityBusy(true); setSecurityMsg(null)
    const res = await updatePassword(new FormData(e.currentTarget))
    setSecurityMsg(res.error ? { kind: 'err', text: res.error } : { kind: 'ok', text: res.success || 'Password updated.' })
    if (!res.error) e.currentTarget.reset()
    setSecurityBusy(false)
  }

  async function handleEmailChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSecurityBusy(true); setSecurityMsg(null)
    const res = await updateEmail(new FormData(e.currentTarget))
    setSecurityMsg(res.error ? { kind: 'err', text: res.error } : { kind: 'ok', text: res.success || 'Check your inbox to confirm.' })
    setSecurityBusy(false)
  }
  const [testingConnection, setTestingConnection] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})

  // Social accounts state
  const [socialLoading, setSocialLoading] = useState(false)
  const [socialPlatforms, setSocialPlatforms] = useState<{ platform: string; connected: boolean }[]>([])
  const [socialConnected, setSocialConnected] = useState(false)
  const [socialError, setSocialError] = useState<string | null>(null)
  const [socialVoice, setSocialVoice] = useState('professional')
  const [socialTopics, setSocialTopics] = useState('')
  const [socialSaving, setSocialSaving] = useState(false)
  const [socialSaved, setSocialSaved] = useState(false)

  const [stripeMessage, setStripeMessage] = useState<string | null>(null)
  const [paymentLink, setPaymentLink] = useState('')
  const [paymentLinkSaving, setPaymentLinkSaving] = useState(false)
  const [paymentLinkSaved, setPaymentLinkSaved] = useState(false)
  const [calendlyUrl, setCalendlyUrl] = useState('')
  const [calendarProvider, setCalendarProvider] = useState<'calendly' | 'calcom' | 'google'>('calendly')
  const [calendarySaving, setCalendarySaving] = useState(false)
  const [calendarySaved, setCalendarySaved] = useState(false)
  const notify = useToast()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (p) {
        setProfile(p as Profile)
        setCalendlyUrl(p.calendly_url ?? '')
        setPaymentLink((p as any).payment_link_url ?? '')
      }
      const { data: brands } = await supabase.from('brands').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).limit(1)
      if (brands && brands.length > 0) setBrand(brands[0] as Brand)
      setBrandsLoaded(true)
      loadEmailConnections()
      loadSocialAccounts()

      // Load social settings from profile
      if (p) {
        setSocialVoice((p as any).social_voice ?? 'professional')
        setSocialTopics(((p as any).social_topics ?? []).join(', '))
      }
    }
    load()
    // Loaded ONCE. Moving between sections changes the address (?tab=…);
    // re-loading then would wipe what someone has typed but not saved.
  }, [])

  useEffect(() => {
    // The section itself comes from the address (sectionFromParams); these
    // are the messages the connect flows bring back with them.
    if (searchParams.get('email_connected')) {
      setEmailMessage(`Connected ${searchParams.get('email_connected')}.`)
      setTimeout(() => setEmailMessage(null), 5000)
    }
    if (searchParams.get('email_error')) {
      setEmailMessage(`That didn’t connect: ${emailErrorText(searchParams.get('email_error') || '')}`)
    }
    if (searchParams.get('stripe_connected')) {
      setStripeMessage('Stripe is connected.')
      setTimeout(() => setStripeMessage(null), 5000)
    }
    // Back from an in-place plan change (no second subscription is created).
    // The new plan shows once Stripe confirms it, usually within seconds.
    if (searchParams.get('plan_changed')) {
      notify(`Your plan is changing to ${searchParams.get('plan_changed')}. It updates here within a few seconds.`, 'success')
    }
  }, [searchParams])

  async function loadEmailConnections() {
    try {
      const res = await fetch('/api/email-connections')
      const data = await res.json()
      if (Array.isArray(data)) setEmailConnections(data)
    } catch { /* list stays as it was */ }
    // Which one-click providers the server is actually set up for.
    fetch('/api/email-connections?providers=1')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.microsoft === 'boolean') setOauthProviders({ google: !!d.google, microsoft: !!d.microsoft }) })
      .catch(() => {})
  }

  async function loadSocialAccounts() {
    try {
      const res = await fetch('/api/social-accounts')
      const data = await res.json()
      setSocialConnected(data.connected ?? false)
      setSocialPlatforms(data.platforms ?? [])
    } catch { /* ignore */ }
  }

  // Connect ONE platform via Zernio's headless OAuth (redirects the user to the
  // provider, then back to /settings/social/callback to finalize).
  async function connectSocial(platform = 'twitter') {
    setSocialLoading(true)
    setSocialError(null)
    try {
      const res = await fetch('/api/social-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', platform }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSocialError(data.code === 'addon_required'
          ? 'Add the AI Social add-on first — open the account menu (top-right) and choose "AI Social", or see the Pricing page.'
          : (data.error || 'Failed to start connection'))
        setSocialLoading(false)
        return
      }
      if (data.authUrl) { window.location.href = data.authUrl; return }
      setSocialError('No connect URL returned. Please try again.')
    } catch { setSocialError('Connection failed. Please check your internet and try again.') }
    setSocialLoading(false)
  }

  async function disconnectSocialPlatform(platform: string) {
    try {
      await fetch('/api/social-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect', platform }),
      })
      loadSocialAccounts()
    } catch { /* ignore */ }
  }

  async function saveSocialSettings() {
    if (!profile) return
    setSocialSaving(true)
    const supabase = createClient()
    const topics = socialTopics.split(',').map(t => t.trim()).filter(Boolean)
    const { error } = await supabase.from('profiles').update({
      social_voice: socialVoice,
      social_topics: topics,
    }).eq('id', profile.id)
    setSocialSaving(false)
    if (error) { notify('Could not save your social settings. Please try again.', 'error'); return }
    setSocialSaved(true)
    setTimeout(() => setSocialSaved(false), 3000)
  }

  async function disconnectEmail(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('email_connections').delete().eq('id', id)
    if (error) notify('Could not disconnect that email account. Please try again.', 'error')
    loadEmailConnections()
  }

  async function testEmailConnection(connectionId: string) {
    setTestingConnection(connectionId)
    setTestResults(prev => { const next = { ...prev }; delete next[connectionId]; return next })
    try {
      const res = await fetch('/api/email-connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTestResults(prev => ({ ...prev, [connectionId]: { success: true, message: 'Test email sent.' } }))
      } else {
        setTestResults(prev => ({ ...prev, [connectionId]: { success: false, message: data.error ?? 'The test didn’t go through.' } }))
      }
    } catch {
      setTestResults(prev => ({ ...prev, [connectionId]: { success: false, message: 'Couldn’t reach the server. Check your connection.' } }))
    }
    setTestingConnection(null)
  }

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!profile) return
    setLoading(true); setSuccess(false); setSaveError(null)
    const formData = new FormData(e.currentTarget)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      full_name: formData.get('full_name') as string,
      company_name: formData.get('company_name') as string,
      phone: formData.get('phone') as string || null,
      role: formData.get('role') as string || null,
    }).eq('id', profile.id)
    setLoading(false)
    if (error) { setSaveError('Could not save your profile. Please try again.'); return }
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  // Compress image client-side before upload (resize to max dimension)
  async function compressImage(file: File, maxDim: number): Promise<File> {
    return new Promise((resolve) => {
      // Skip non-image or small files
      if (!file.type.startsWith('image/') || file.size < 500_000) { resolve(file); return }
      const img = new Image()
      img.onload = () => {
        // Only resize if larger than maxDim
        if (img.width <= maxDim && img.height <= maxDim) { resolve(file); return }
        const canvas = document.createElement('canvas')
        const scale = Math.min(maxDim / img.width, maxDim / img.height)
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          } else { resolve(file) }
        }, 'image/jpeg', 0.9)
      }
      img.onerror = () => resolve(file)
      img.src = URL.createObjectURL(file)
    })
  }

  async function handlePhotoUpload(file: File, type: string) {
    setPhotoUploading(type)
    try {
      const compressed = await compressImage(file, 1200)
      const formData = new FormData()
      formData.append('file', compressed)
      formData.append('type', type)
      const res = await fetch('/api/upload-photo', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }))
        setUploadError(data.error || `Upload failed (${res.status})`)
      } else {
        const data = await res.json()
        if (profile) {
          const key = type === 'headshot' ? 'photo_url' : type === 'midlevel' ? 'photo_midlevel_url' : 'photo_standing_url'
          setProfile({ ...profile, [key]: data.url } as Profile)
        }
        setUploadError(null)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload photo. Try a smaller file or different format.')
    }
    setPhotoUploading(null)
  }

  async function handleLogoUpload(file: File) {
    setLogoUploading(true)
    try {
      const compressed = await compressImage(file, 800)
      const formData = new FormData()
      formData.append('file', compressed)
      const res = await fetch('/api/upload-logo', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }))
        setUploadError(data.error || `Logo upload failed (${res.status})`)
      } else {
        const data = await res.json()
        if (brand) {
          const supabase = createClient()
          const { error } = await supabase.from('brands').update({ logo_file_url: data.url, logo_url: data.url }).eq('id', brand.id)
          if (error) { setUploadError('Logo uploaded, but it could not be saved to your brand. Please try again.'); setLogoUploading(false); return }
          setBrand({ ...brand, logo_file_url: data.url, logo_url: data.url })
        }
        setUploadError(null)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload logo. Try a smaller file or different format.')
    }
    setLogoUploading(false)
  }

  async function saveCalendly() {
    if (!profile) return
    // Shown as a button on public share pages — plain web links only.
    const clean = cleanWebLink(calendlyUrl)
    if (clean === null) { notify('Enter a booking link that starts with https://', 'error'); return }
    setCalendarySaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ calendly_url: clean || null }).eq('id', profile.id)
    setCalendarySaving(false)
    if (error) { notify('Could not save your booking link. Please try again.', 'error'); return }
    setCalendlyUrl(clean)
    setCalendarySaved(true)
    setTimeout(() => setCalendarySaved(false), 3000)
  }

  async function savePaymentLink() {
    if (!profile) return
    // Shown as a "Pay" button on public share pages — plain web links only.
    const clean = cleanWebLink(paymentLink)
    if (clean === null) { notify('Enter a payment link that starts with https://', 'error'); return }
    setPaymentLinkSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ payment_link_url: clean || null }).eq('id', profile.id)
    setPaymentLinkSaving(false)
    if (error) { notify('Could not save your payment link. Please try again.', 'error'); return }
    setPaymentLink(clean)
    setPaymentLinkSaved(true)
    setTimeout(() => setPaymentLinkSaved(false), 3000)
  }

  const head = SECTION_HEAD[section]
  const header = (
    <div className={s.head}>
      <h1 className={s.title}>{head.title}</h1>
      <p className={s.sub}>{head.sub}</p>
    </div>
  )

  if (!profile) {
    return (
      <div className={s.page}>
        {header}
        <p className={s.loading}>Loading…</p>
      </div>
    )
  }

  const photoSlots = [
    { type: 'headshot', label: 'Headshot', url: profile.photo_url, required: true, shape: 'circle' as const },
    { type: 'midlevel', label: 'Mid-level', url: (profile as any).photo_midlevel_url, required: false, shape: 'rect' as const },
    { type: 'standing', label: 'Standing', url: (profile as any).photo_standing_url, required: false, shape: 'rect' as const },
  ]

  return (
    <div className={s.page}>
      {header}

      {/* ===== PROFILE ===== */}
      {section === 'profile' && (
        <div>
          <form onSubmit={handleProfileSubmit}>
            <div className="settings-card">
              <h3>Your details</h3>
              <div className="form-group">
                <label className="input-label" htmlFor="set-email">Email</label>
                <input id="set-email" type="email" className="input" value={profile.email} readOnly style={{ opacity: 0.6 }} />
              </div>
              <div className="form-group">
                <label className="input-label" htmlFor="set-name">Full name</label>
                <input id="set-name" name="full_name" type="text" className="input" defaultValue={profile.full_name ?? ''} />
              </div>
              <div className="form-group">
                <label className="input-label" htmlFor="set-company">Company name</label>
                <input id="set-company" name="company_name" type="text" className="input" defaultValue={profile.company_name ?? ''} />
              </div>
              <div className={s.twoCol}>
                <div className="form-group">
                  <label className="input-label" htmlFor="set-phone">Phone</label>
                  <input id="set-phone" name="phone" type="tel" className="input" defaultValue={profile.phone ?? ''} />
                </div>
                <div className="form-group">
                  <label className="input-label" htmlFor="set-role">Role</label>
                  <select id="set-role" name="role" className="input-select" defaultValue={profile.role ?? ''}>
                    <option value="">Select</option>
                    <option value="agent">Insurance agent</option>
                    <option value="agency_owner">Agency owner</option>
                    <option value="broker">Broker</option>
                    <option value="financial_advisor">Financial advisor</option>
                    <option value="consultant">Consultant</option>
                    <option value="real_estate">Real estate</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="legal">Legal</option>
                    <option value="educator">Educator</option>
                    <option value="marketer">Marketer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className={s.saveRow}>
                <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save changes'}</Button>
                {success && <span className={s.ok}>Saved!</span>}
                {saveError && <span className={s.err}>{saveError}</span>}
              </div>
            </div>
          </form>

          {/* Security: change email + password */}
          <div className="settings-card">
            <h3>Security</h3>
            {securityMsg && (
              <div className={securityMsg.kind === 'ok' ? s.ok : s.err} style={{ marginBottom: 12 }}>
                {securityMsg.text}
              </div>
            )}
            <form onSubmit={handleEmailChange} style={{ marginBottom: 20 }}>
              <div className="form-group">
                <label className="input-label" htmlFor="set-new-email">Change email</label>
                <input id="set-new-email" name="email" type="email" className="input" placeholder="new@email.com" defaultValue={profile.email} />
              </div>
              <Button type="submit" variant="secondary" size="sm" disabled={securityBusy}>Update email</Button>
            </form>
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label className="input-label" htmlFor="set-password">Change password</label>
                <input id="set-password" name="password" type="password" className="input" placeholder="New password (min 8 characters)" autoComplete="new-password" />
              </div>
              <Button type="submit" variant="secondary" size="sm" disabled={securityBusy}>Update password</Button>
            </form>
          </div>

          {/* Photos — Docs2Video only; see note in brand.ts. */}
          {storefront.showVideoFeatures && (
          <div className="settings-card">
            <h3>Profile photos</h3>
            <p className="ssub">These appear on your presentation slides and share pages.</p>
            {uploadError && (
              <Note tone="stop" className={s.noteGap} action={<Button variant="quiet" size="sm" onClick={() => setUploadError(null)}>Close</Button>}>
                {uploadError}
              </Note>
            )}
            <Link href="/fix" className={s.inlineLink}>Need to fix a photo? Try AI Photo Fixer &rarr;</Link>
            <div className={s.photos}>
              {photoSlots.map(slot => (
                <div key={slot.type} className={s.photo}>
                  {slot.url ? (
                    <img src={slot.url} alt={slot.label} className={s.photoImg} data-shape={slot.shape} />
                  ) : (
                    <div className={s.photoEmpty} data-shape={slot.shape}>No photo</div>
                  )}
                  <div className={s.photoLabel}>{slot.label}</div>
                  <div className={s.photoNeed}>{slot.required ? 'Required' : 'Optional'}</div>
                  <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                    {photoUploading === slot.type ? 'Uploading…' : slot.url ? 'Change' : 'Upload'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f, slot.type) }} />
                  </label>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* API keys — both storefronts sell this. */}
          <ApiKeysSection />

          <div className="settings-card">
            <h3>Setup</h3>
            <p className="ssub">Walk through the first-time setup again: your details, voice and look.</p>
            <Button href="/setup" variant="secondary" size="sm">Run the setup again</Button>
          </div>

          {/* Delete account — plain words, at the bottom of Profile. Asks
              twice; nothing is sent unless both answers are yes. */}
          <div className={`settings-card ${s.delete}`}>
            <h3>Delete account</h3>
            <p className="ssub">This removes your account and everything in it for good. It can’t be undone.</p>
            <button
              type="button"
              className={s.deleteBtn}
              onClick={async () => {
                if (!window.confirm(`Are you sure you want to delete your account? All your ${storefront.showVideoFeatures ? 'videos' : 'designs'}, brands, and data will be permanently removed. This cannot be undone.`)) return
                if (!window.confirm('This is your final confirmation. Type OK in the next prompt to proceed.')) return
                const res = await fetch('/api/account/delete', { method: 'POST' })
                if (res.ok) {
                  window.location.href = '/login?deleted=1'
                } else {
                  const data = await res.json()
                  notify(data.error || 'Failed to delete account', 'error')
                }
              }}
            >
              Delete account
            </button>
          </div>
        </div>
      )}

      {/* ===== BILLING & CREDITS ===== */}
      {section === 'billing' && <BillingSection profile={profile} />}

      {/* ===== BRAND KIT — your default brand; every brand lives on Brands ===== */}
      {section === 'brand' && (
        <div>
          {uploadError && (
            <Note tone="stop" className={s.noteGap} action={<Button variant="quiet" size="sm" onClick={() => setUploadError(null)}>Close</Button>}>
              {uploadError}
            </Note>
          )}
          {brand ? (
            <div className="settings-card">
              <h3>Your default brand</h3>
              <p className="ssub">
                Put on everything you make unless you pick another. All your brands are on the <Link href="/brands" className={s.inlineLink}>{NAMES.brands}</Link> page.
              </p>
              <div className={s.brandRow}>
                {brand.logo_file_url || brand.logo_url ? (
                  <img src={brand.logo_file_url ?? brand.logo_url!} alt="Logo" className={s.brandLogo} />
                ) : (
                  <div className={s.brandNoLogo}>No logo</div>
                )}
                <div>
                  <div className={s.brandName}>{brand.name}</div>
                  <div className={s.brandActions}>
                    <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
                      {logoUploading ? 'Uploading…' : 'Change logo'}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }} />
                    </label>
                    <Button href={`/brands/${brand.id}`} variant="secondary" size="sm">Edit colors</Button>
                  </div>
                </div>
              </div>
              <div className={s.swatches} aria-label="Brand colors">
                {[brand.primary_color, brand.secondary_color, brand.accent_color, brand.background_color, brand.text_color].map((c, i) => (
                  <span key={i} className={s.swatch} style={{ background: c ?? undefined }} />
                ))}
              </div>
            </div>
          ) : brandsLoaded ? (
            <EmptyState
              title="No brand yet."
              actions={<Button href="/brands/new">{NAMES.newBrand}</Button>}
            >
              Save your logo and colours once and they go on everything you make.
            </EmptyState>
          ) : null}
          <div className={s.manage}>
            <Button href="/brands" variant="secondary" size="sm">See all {NAMES.brands.toLowerCase()}</Button>
          </div>
        </div>
      )}

      {/* ===== EMAIL & SENDING — Docs2Video only (they attach to a share page) ===== */}
      {section === 'email' && storefront.showVideoFeatures && (
        <div>
          <div className="settings-card">
            <h3>Connected email</h3>
            <p className="ssub">Send projects to clients from your own mailbox.</p>

            {emailMessage && (
              <Note tone={emailMessage.startsWith('That didn’t') ? 'stop' : 'ok'} className={s.noteGap}>{emailMessage}</Note>
            )}

            {emailConnections.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {emailConnections.map((conn: any) => {
                  const testResult = testResults[conn.id]
                  const isTesting = testingConnection === conn.id
                  const hasLastTest = conn.last_tested_at != null
                  const lastTestOk = conn.last_test_success === true
                  // Use the live test result if there is one, else the last stored result.
                  const statusOk = testResult ? testResult.success : (hasLastTest ? lastTestOk : null)

                  return (
                    <div key={conn.id} className={s.row}>
                      <div className={s.rowMain}>
                        <span className={s.badge}>{conn.provider === 'microsoft' ? 'MS' : conn.provider === 'google' ? 'G' : 'SM'}</span>
                        <div>
                          <div className={s.rowTitle}>
                            {conn.email_address}
                            {statusOk !== null && (
                              <span className={statusOk ? s.ok : s.err}>{statusOk ? 'Connected' : 'Not working'}</span>
                            )}
                          </div>
                          <div className={s.rowSub}>{conn.provider === 'smtp' ? 'SMTP/IMAP' : conn.provider === 'google' ? 'Gmail' : 'Microsoft 365'}</div>
                        </div>
                      </div>
                      <div className={s.rowActions}>
                        <Button variant="secondary" size="sm" onClick={() => testEmailConnection(conn.id)} disabled={isTesting}>
                          {isTesting ? 'Sending…' : 'Send a test email'}
                        </Button>
                        <InlineConfirm message="Disconnect?" confirmLabel="Yes" onConfirm={() => disconnectEmail(conn.id)}><button className="btn btn-danger btn-sm">Disconnect</button></InlineConfirm>
                      </div>
                      {testResult && (
                        <div className={testResult.success ? s.ok : s.err} style={{ flexBasis: '100%' }}>{testResult.message}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className={s.connectList}>
              {oauthProviders.microsoft ? (
                <a href="/api/auth/microsoft" className={`kit-card kit-card--link ${s.connect}`}>
                  <span className={s.badge}>M</span>
                  <span>
                    <span className={s.rowTitle}>Microsoft 365 / Outlook</span>
                    <span className={s.rowSub}>Sign in with Microsoft — one click</span>
                  </span>
                </a>
              ) : (
                // The server has no Outlook app registration, so the one-click
                // button would only reach a Microsoft error page.
                <div className={`${s.connect} ${s.connectOff}`}>
                  <span className={s.badge}>M</span>
                  <span>
                    <span className={s.rowTitle}>Microsoft 365 / Outlook</span>
                    <span className={s.rowSub}>One-click Outlook connect isn&apos;t available yet. Use SMTP below with smtp.office365.com.</span>
                  </span>
                </div>
              )}
              {oauthProviders.google && (
                <a href="/api/auth/google" className={`kit-card kit-card--link ${s.connect}`}>
                  <span className={s.badge}>G</span>
                  <span>
                    <span className={s.rowTitle}>Gmail / Google Workspace</span>
                    <span className={s.rowSub}>Sign in with Google — send from your Gmail</span>
                  </span>
                </a>
              )}
              <button type="button" onClick={() => setShowSmtpModal(true)} className={`kit-card kit-card--link ${s.connect}`}>
                <span className={s.badge}>SM</span>
                <span>
                  <span className={s.rowTitle}>SMTP / IMAP</span>
                  <span className={s.rowSub}>Set it up by hand — any provider</span>
                </span>
              </button>
            </div>
          </div>

          {/* Booking link */}
          <div className="settings-card">
            <h3>Booking link</h3>
            <p className="ssub">Clients can book a meeting from your share pages.</p>

            <div style={{ marginBottom: 12 }}>
              <span className="input-label" style={{ marginBottom: 6, display: 'block' }}>Where you take bookings</span>
              <div className={s.pills}>
                {([
                  { id: 'calendly' as const, label: 'Calendly' },
                  { id: 'calcom' as const, label: 'Cal.com' },
                  { id: 'google' as const, label: 'Google Calendar' },
                ]).map(p => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={calendarProvider === p.id ? 'primary' : 'secondary'}
                    onClick={() => setCalendarProvider(p.id)}
                    aria-pressed={calendarProvider === p.id}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Google Calendar has no direct connection yet — it takes a
                booking page link, like the others. */}
            <div className={s.inputRow}>
              <input
                value={calendlyUrl}
                onChange={e => setCalendlyUrl(e.target.value)}
                className="input"
                aria-label="Booking link"
                placeholder={calendarProvider === 'calendly' ? 'https://calendly.com/your-name/30min' : calendarProvider === 'google' ? 'https://calendar.app.google/…' : 'https://cal.com/your-name'}
              />
              <Button size="sm" onClick={saveCalendly} disabled={calendarySaving}>
                {calendarySaving ? 'Saving…' : 'Save'}
              </Button>
              {calendarySaved && <span className={s.ok}>Saved!</span>}
            </div>
            <p className={s.hint}>
              {calendarProvider === 'google'
                ? 'In Google Calendar, create a booking page (Appointment schedule), copy its link, and paste it here.'
                : 'Paste your booking link from Calendly, Cal.com, or any scheduling tool.'}
            </p>
          </div>

          {/* Payment link — a Stripe Payment Link shown as "Pay" on share pages */}
          <div className="settings-card">
            <h3>Payment link</h3>
            <p className="ssub">
              Paste a Stripe Payment Link and your share pages show a <strong>Pay</strong> button.{' '}
              <a href="https://dashboard.stripe.com/payment-links" target="_blank" rel="noopener noreferrer" className={s.inlineLink}>
                Make one in Stripe →
              </a>
            </p>
            {stripeMessage && <Note tone="ok" className={s.noteGap}>{stripeMessage}</Note>}
            <div className="form-group">
              <label className="input-label" htmlFor="set-pay">Stripe Payment Link</label>
              <div className={s.inputRow}>
                <input
                  id="set-pay"
                  className="input"
                  type="url"
                  value={paymentLink}
                  onChange={e => setPaymentLink(e.target.value)}
                  placeholder="https://buy.stripe.com/..."
                />
                <Button size="sm" onClick={savePaymentLink} disabled={paymentLinkSaving}>
                  {paymentLinkSaving ? 'Saving…' : 'Save'}
                </Button>
                {paymentLinkSaved && <span className={s.ok}>Saved!</span>}
              </div>
              <p className={s.hint}>Leave it empty to hide the Pay button.</p>
            </div>
          </div>

          {/* View alerts — the same setting as Activity → Notifications. */}
          <ViewAlertsSetting />
        </div>
      )}

      {/* ===== AI SOCIAL ===== */}
      {section === 'social' && (
        <div>
          {!(profile as Profile & { social_addon_active?: boolean }).social_addon_active && (
            <p className={s.slimNote}>
              <strong>AI Social is an add-on.</strong> If you just added it, it switches on here within a minute.{' '}
              <Link href="/social-media" className={s.inlineLink}>See what it does</Link>
            </p>
          )}
          <div className="settings-card">
            <h3>Social accounts</h3>
            <p className="ssub">Connect the accounts AI Social posts to for you.</p>

            {socialError && <Note tone="stop" className={s.noteGap}>{socialError}</Note>}

            {!socialConnected ? (
              <div>
                <p className={s.hint} style={{ marginBottom: 10 }}>Connect each account you want to post to:</p>
                <div className={s.pills}>
                  {(['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'] as const).map((pl) => (
                    <button key={pl} className="btn btn-soft btn-sm" onClick={() => connectSocial(pl)} disabled={socialLoading} style={{ textTransform: 'capitalize' }}>
                      {socialLoading ? '…' : `Connect ${pl === 'twitter' ? 'X' : pl}`}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {socialPlatforms.length > 0 ? (
                  <div style={{ marginBottom: 16 }}>
                    {socialPlatforms.map((p) => (
                      <div key={p.platform} className={s.row}>
                        <div className={s.rowMain}>
                          <span className={s.badge}>{({ twitter: 'X', linkedin: 'in', facebook: 'f', instagram: 'IG', youtube: 'YT', tiktok: 'TT' } as Record<string, string>)[p.platform] || p.platform[0].toUpperCase()}</span>
                          <div className={s.rowTitle}>
                            <span style={{ textTransform: 'capitalize' }}>{p.platform}</span>
                            <span className={s.ok}>Connected</span>
                          </div>
                        </div>
                        <InlineConfirm message="Disconnect?" confirmLabel="Yes" onConfirm={() => disconnectSocialPlatform(p.platform)}>
                          <button className="btn btn-danger btn-sm">Disconnect</button>
                        </InlineConfirm>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={s.hint} style={{ marginBottom: 12 }}>Your profile is ready. Connect your social accounts below.</p>
                )}
                <Button variant="secondary" onClick={() => connectSocial('twitter')} disabled={socialLoading}>
                  {socialLoading ? 'Opening…' : 'Connect another account'}
                </Button>
              </>
            )}

            {socialConnected && (
              <div className={s.divider}>
                <div className="form-group">
                  <label className="input-label" htmlFor="set-voice">Social voice</label>
                  <select id="set-voice" className="input-select" value={socialVoice} onChange={e => setSocialVoice(e.target.value)}>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="witty">Witty</option>
                    <option value="authoritative">Authoritative</option>
                    <option value="educational">Educational</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="input-label" htmlFor="set-topics">What to post about</label>
                  <input
                    id="set-topics"
                    className="input"
                    value={socialTopics}
                    onChange={e => setSocialTopics(e.target.value)}
                    placeholder="e.g. insurance tips, market trends, client success stories"
                  />
                  <p className={s.hint}>Separate topics with commas.</p>
                </div>
                <div className={s.saveRow}>
                  <Button size="sm" onClick={saveSocialSettings} disabled={socialSaving}>
                    {socialSaving ? 'Saving…' : 'Save'}
                  </Button>
                  {socialSaved && <span className={s.ok}>Saved!</span>}
                </div>
              </div>
            )}
          </div>
          <div className={s.manage}>
            <Button href="/social-media" variant="secondary" size="sm">Open AI Social</Button>
          </div>
        </div>
      )}

      {/* SMTP Modal */}
      {showSmtpModal && (
        <SmtpSetupModal
          onClose={() => setShowSmtpModal(false)}
          onConnected={() => { setShowSmtpModal(false); loadEmailConnections(); setEmailMessage('SMTP connected.'); setTimeout(() => setEmailMessage(null), 5000) }}
        />
      )}
    </div>
  )
}
