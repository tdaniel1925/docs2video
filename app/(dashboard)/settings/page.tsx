'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../_lib/supabase/client'
import SmtpSetupModal from '../../_components/SmtpSetupModal'
import InlineConfirm from '../../_components/InlineConfirm'
import BuyCreditsModal from '../../_components/BuyCreditsModal'
import { SLIDE_STYLES } from '../../_lib/types'
import type { Profile, Brand } from '../../_lib/types'
import { updatePassword, updateEmail } from '../../_actions/auth'

type SettingsTab = 'profile' | 'brand' | 'integrations' | 'subscription'

function ReferralSection() {
  const [code, setCode] = useState<string | null>(null)
  const [stats, setStats] = useState({ total: 0, converted: 0, pending: 0, rewarded: 0 })
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/referrals')
      .then(r => r.json())
      .then(d => {
        setCode(d.referral_code)
        if (d.stats) setStats(d.stats)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function generateCode() {
    const res = await fetch('/api/referrals', { method: 'POST' })
    const d = await res.json()
    if (d.referral_code) setCode(d.referral_code)
  }

  function copyLink() {
    if (!code) return
    navigator.clipboard.writeText(`https://docs2video.com/signup?ref=${code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="settings-card"><p className="ssub">Loading referral info...</p></div>

  return (
    <div className="settings-card">
      <h3 style={{ marginBottom: 4 }}>Affiliate Program</h3>
      <p className="ssub" style={{ margin: '0 0 16px' }}>Earn 20% commission by referring others.</p>

      {!code ? (
        <button className="btn btn-primary" onClick={generateCode}>Generate Referral Link</button>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <code style={{ background: 'var(--surface)', padding: '8px 12px', borderRadius: 8, fontSize: 14, flex: 1 }}>
              https://docs2video.com/signup?ref={code}
            </code>
            <button className="btn btn-primary" onClick={copyLink} style={{ whiteSpace: 'nowrap' }}>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.total}</div>
              <div className="ssub">Referrals</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.converted}</div>
              <div className="ssub">Converted</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>${(stats.rewarded / 100).toFixed(0)}</div>
              <div className="ssub">Earned</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('profile')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [photoUploading, setPhotoUploading] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [emailConnections, setEmailConnections] = useState<any[]>([])
  const [showSmtpModal, setShowSmtpModal] = useState(false)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
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
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [showBuyCredits, setShowBuyCredits] = useState(false)
  const [calendlyUrl, setCalendlyUrl] = useState('')
  const [calendarProvider, setCalendarProvider] = useState<'calendly' | 'calcom' | 'google'>('calendly')
  const [calendarySaving, setCalendarySaving] = useState(false)
  const [calendarySaved, setCalendarySaved] = useState(false)
  const [defaultStyle, setDefaultStyle] = useState('corporate-clean')
  const [styleSaving, setStyleSaving] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    fetch('/api/credits/balance')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.balance === 'number') setCreditBalance(d.balance) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (p) {
        setProfile(p as Profile)
        setCalendlyUrl(p.calendly_url ?? '')
        setDefaultStyle(p.default_style ?? 'luxury')
      }
      const { data: brands } = await supabase.from('brands').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).limit(1)
      if (brands && brands.length > 0) setBrand(brands[0] as Brand)
      loadEmailConnections()
      loadSocialAccounts()

      // Load social settings from profile
      if (p) {
        setSocialVoice((p as any).social_voice ?? 'professional')
        setSocialTopics(((p as any).social_topics ?? []).join(', '))
      }
    }
    load()

    if (searchParams.get('email_connected')) {
      setEmailMessage(`Successfully connected ${searchParams.get('email_connected')}!`)
      setTab('integrations')
      setTimeout(() => setEmailMessage(null), 5000)
    }
    if (searchParams.get('email_error')) {
      setEmailMessage(`Connection failed: ${searchParams.get('email_error')}`)
      setTab('integrations')
    }
    if (searchParams.get('stripe_connected')) {
      setStripeMessage('Stripe connected successfully!')
      setTab('integrations')
      setTimeout(() => setStripeMessage(null), 5000)
    }
  }, [searchParams])

  async function loadEmailConnections() {
    const res = await fetch('/api/email-connections')
    const data = await res.json()
    if (Array.isArray(data)) setEmailConnections(data)
  }

  async function loadSocialAccounts() {
    try {
      const res = await fetch('/api/social-accounts')
      const data = await res.json()
      setSocialConnected(data.connected ?? false)
      setSocialPlatforms(data.platforms ?? [])
    } catch { /* ignore */ }
  }

  async function connectSocial() {
    setSocialLoading(true)
    setSocialError(null)
    try {
      // Step 1: Create profile if needed
      const createRes = await fetch('/api/social-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-profile' }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) { setSocialError(createData.error || 'Failed to create social profile'); setSocialLoading(false); return }

      // Step 2: Open Ayrshare connect page with profile key
      const profileKey = createData.profileKey
      if (profileKey) {
        window.open(`https://app.ayrshare.com/social-accounts?profileKey=${profileKey}`, '_blank', 'width=600,height=700')
        setSocialConnected(true)
        // Poll for updates after user connects
        setTimeout(() => loadSocialAccounts(), 10000)
        setTimeout(() => loadSocialAccounts(), 20000)
      } else {
        setSocialError('No profile key returned. Please try again.')
      }
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
    await supabase.from('profiles').update({
      social_voice: socialVoice,
      social_topics: topics,
    }).eq('id', profile.id)
    setSocialSaving(false)
    setSocialSaved(true)
    setTimeout(() => setSocialSaved(false), 3000)
  }

  async function disconnectEmail(id: string) {
    const supabase = createClient()
    await supabase.from('email_connections').delete().eq('id', id)
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
        setTestResults(prev => ({ ...prev, [connectionId]: { success: true, message: 'Test email sent successfully!' } }))
      } else {
        setTestResults(prev => ({ ...prev, [connectionId]: { success: false, message: data.error ?? 'Test failed' } }))
      }
    } catch {
      setTestResults(prev => ({ ...prev, [connectionId]: { success: false, message: 'Network error' } }))
    }
    setTestingConnection(null)
  }

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!profile) return
    setLoading(true); setSuccess(false)
    const formData = new FormData(e.currentTarget)
    const supabase = createClient()
    await supabase.from('profiles').update({
      full_name: formData.get('full_name') as string,
      company_name: formData.get('company_name') as string,
      phone: formData.get('phone') as string || null,
      role: formData.get('role') as string || null,
    }).eq('id', profile.id)
    setLoading(false); setSuccess(true)
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
          await supabase.from('brands').update({ logo_file_url: data.url, logo_url: data.url }).eq('id', brand.id)
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
    setCalendarySaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ calendly_url: calendlyUrl || null }).eq('id', profile.id)
    setCalendarySaving(false); setCalendarySaved(true)
    setTimeout(() => setCalendarySaved(false), 3000)
  }

  async function saveDefaultStyle(styleId: string) {
    if (!profile) return
    setDefaultStyle(styleId)
    setStyleSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ default_style: styleId }).eq('id', profile.id)
    setStyleSaving(false)
  }

  if (!profile) return <div style={{ color: 'var(--ink-light)', padding: 64, textAlign: 'center' }}>Loading...</div>

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'brand', label: 'Style & Branding' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'subscription', label: 'Subscription' },
  ]

  const photoSlots = [
    { type: 'headshot', label: 'Headshot', url: profile.photo_url, required: true, shape: 'circle' as const },
    { type: 'midlevel', label: 'Mid-level', url: (profile as any).photo_midlevel_url, required: false, shape: 'rect' as const },
    { type: 'standing', label: 'Standing', url: (profile as any).photo_standing_url, required: false, shape: 'rect' as const },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Manage your account, brand, and integrations.</p>
        </div>
        <Link href="/setup" className="btn btn-soft">Re-run Setup Wizard</Link>
      </div>

      {/* Tabs */}
      <div className="settings-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`settings-tab${tab === t.id ? ' active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== PROFILE TAB ===== */}
      {tab === 'profile' && (
        <div>
          {/* Profile form */}
          <form onSubmit={handleProfileSubmit}>
            <div className="settings-card">
              <h3>Personal Info</h3>
              <div className="form-group">
                <label className="input-label">Email</label>
                <input type="email" className="input" value={profile.email} readOnly style={{ opacity: 0.5 }} />
              </div>
              <div className="form-group">
                <label className="input-label">Full Name</label>
                <input name="full_name" type="text" className="input" defaultValue={profile.full_name ?? ''} />
              </div>
              <div className="form-group">
                <label className="input-label">Company Name</label>
                <input name="company_name" type="text" className="input" defaultValue={profile.company_name ?? ''} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="input-label">Phone</label>
                  <input name="phone" type="tel" className="input" defaultValue={profile.phone ?? ''} />
                </div>
                <div className="form-group">
                  <label className="input-label">Role</label>
                  <select name="role" className="input-select" defaultValue={profile.role ?? ''}>
                    <option value="">Select</option>
                    <option value="agent">Insurance Agent</option>
                    <option value="agency_owner">Agency Owner</option>
                    <option value="broker">Broker</option>
                    <option value="financial_advisor">Financial Advisor</option>
                    <option value="consultant">Consultant</option>
                    <option value="real_estate">Real Estate</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="legal">Legal</option>
                    <option value="educator">Educator</option>
                    <option value="marketer">Marketer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save changes'}
                </button>
                {success && <span style={{ fontSize: 13, color: 'var(--mint-darker)', fontWeight: 600 }}>Saved!</span>}
              </div>
            </div>
          </form>

          {/* Security: change email + password */}
          <div className="settings-card">
            <h3>Security</h3>
            {securityMsg && (
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: securityMsg.kind === 'ok' ? 'var(--mint-darker)' : '#c03a1f' }}>
                {securityMsg.text}
              </div>
            )}
            <form onSubmit={handleEmailChange} style={{ marginBottom: 20 }}>
              <div className="form-group">
                <label className="input-label">Change email</label>
                <input name="email" type="email" className="input" placeholder="new@email.com" defaultValue={profile.email} />
              </div>
              <button type="submit" className="btn btn-soft" disabled={securityBusy}>Update email</button>
            </form>
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label className="input-label">Change password</label>
                <input name="password" type="password" className="input" placeholder="New password (min 8 characters)" autoComplete="new-password" />
              </div>
              <button type="submit" className="btn btn-soft" disabled={securityBusy}>Update password</button>
            </form>
          </div>

          {/* Photos */}
          <div className="settings-card">
            <h3>Profile Photos</h3>
            <p className="ssub">These photos appear on your presentation slides and share pages.</p>
            {uploadError && (
              <div style={{ borderRadius: 10, background: '#fde8e8', padding: '10px 16px', fontSize: 13, marginBottom: 12, color: '#b91c1c', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {uploadError}
                <button onClick={() => setUploadError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#b91c1c', lineHeight: 1 }}>&times;</button>
              </div>
            )}
            <Link href="/fix" style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: 'var(--mint-darker, #2d7a4f)', marginBottom: 8 }}>
              Need to fix a photo? Try AI Photo Fixer &rarr;
            </Link>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
              {photoSlots.map(slot => (
                <div key={slot.type} style={{ textAlign: 'center' }}>
                  {slot.url ? (
                    <img src={slot.url} alt={slot.label} style={{
                      width: 100, height: 100,
                      borderRadius: slot.shape === 'circle' ? '50%' : 10,
                      objectFit: 'cover', border: '2px solid var(--border-light)',
                      display: 'block', margin: '0 auto 8px',
                    }} />
                  ) : (
                    <div style={{
                      width: 100, height: 100,
                      borderRadius: slot.shape === 'circle' ? '50%' : 10,
                      border: '2px dashed var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 8px', color: 'var(--ink-light)', fontSize: 12,
                      background: 'var(--bg-soft)',
                    }}>
                      No photo
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{slot.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-light)', marginBottom: 8 }}>{slot.required ? 'Required' : 'Optional'}</div>
                  <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                    {photoUploading === slot.type ? 'Uploading...' : slot.url ? 'Change' : 'Upload'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f, slot.type) }} />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== BRAND & STYLE TAB ===== */}
      {tab === 'brand' && (
        <div>
          {/* Brand/Logo */}
          {brand && (
            <div className="settings-card">
              <h3>Your default brand</h3>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 16px' }}>
                This is applied automatically to every video. Manage additional brands on the <Link href="/brands" style={{ color: 'var(--mint-darker)', fontWeight: 600 }}>Brands</Link> page.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                {brand.logo_file_url || brand.logo_url ? (
                  <img src={brand.logo_file_url ?? brand.logo_url!} alt="Logo"
                    style={{ height: 56, width: 'auto', maxWidth: 160, borderRadius: 10, border: '1px solid var(--border)', objectFit: 'contain', padding: 6, background: 'white' }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 10, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)', fontSize: 11 }}>No logo</div>
                )}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{brand.name}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
                      {logoUploading ? 'Uploading...' : 'Change Logo'}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }} />
                    </label>
                    <Link href={`/brands/${brand.id}`} className="btn btn-soft btn-sm">Edit Colors</Link>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 6 }}>Logo appears on slide decks and client emails. Videos use text branding only.</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[brand.primary_color, brand.secondary_color, brand.accent_color, brand.background_color, brand.text_color].map((c, i) => (
                  <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: c?.toLowerCase() === '#ffffff' ? '1.5px solid var(--border)' : 'none' }} />
                ))}
              </div>
            </div>
          )}

          {/* Default Template */}
          <div className="settings-card">
            <h3>Default Template</h3>
            <p className="ssub">This style is pre-selected when you create new presentations. You can always change it per project.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 16 }}>
              {SLIDE_STYLES.map(style => (
                <div
                  key={style.id}
                  onClick={() => saveDefaultStyle(style.id)}
                  style={{
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: defaultStyle === style.id ? '2px solid var(--ink)' : '1px solid var(--border-light)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    opacity: styleSaving ? 0.7 : 1,
                  }}
                >
                  <img src={`/style-previews/${style.id}.png`} alt={style.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  <div style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: defaultStyle === style.id ? 700 : 500, color: defaultStyle === style.id ? 'var(--ink)' : 'var(--ink-soft)' }}>
                      {style.name} {defaultStyle === style.id && '✓'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== INTEGRATIONS TAB ===== */}
      {tab === 'integrations' && (
        <div>
          {/* Social Accounts */}
          <div className="settings-card">
            <h3>Social Accounts</h3>
            <p className="ssub">Connect your social media accounts to post directly from Docs2Video.</p>

            {socialError && (
              <div style={{ borderRadius: 10, background: '#fde8e8', padding: '10px 16px', fontSize: 13, marginBottom: 12, color: '#b91c1c', fontWeight: 600 }}>
                {socialError}
              </div>
            )}

            {!socialConnected ? (
              <button className="btn btn-primary" onClick={connectSocial} disabled={socialLoading}>
                {socialLoading ? 'Connecting...' : 'Connect Social Media'}
              </button>
            ) : (
              <>
                {socialPlatforms.length > 0 ? (
                  <div style={{ marginBottom: 16 }}>
                    {socialPlatforms.map((p) => {
                      const icons: Record<string, string> = { twitter: 'X', linkedin: 'in', facebook: 'f', instagram: 'IG', youtube: 'YT', tiktok: 'TT' }
                      const colors: Record<string, string> = { twitter: '#000', linkedin: '#0077B5', facebook: '#1877F2', instagram: '#E4405F', youtube: '#FF0000', tiktok: '#000' }
                      return (
                        <div key={p.platform} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-light)', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${colors[p.platform] || '#666'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: colors[p.platform] || '#666' }}>
                              {icons[p.platform] || p.platform[0].toUpperCase()}
                            </div>
                            <div>
                              <span style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{p.platform}</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#2d8a4e', marginLeft: 8 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2d8a4e', display: 'inline-block' }} />
                                Connected
                              </span>
                            </div>
                          </div>
                          <InlineConfirm message="Disconnect?" confirmLabel="Yes" onConfirm={() => disconnectSocialPlatform(p.platform)}>
                            <button className="btn btn-danger btn-sm">Disconnect</button>
                          </InlineConfirm>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 12 }}>Profile created. Click below to connect your social accounts.</p>
                )}
                <button className="btn btn-soft" onClick={connectSocial} disabled={socialLoading}>
                  {socialLoading ? 'Opening...' : 'Add / Manage Accounts'}
                </button>
              </>
            )}

            {/* Social Voice & Topics */}
            {socialConnected && (
              <div style={{ marginTop: 20, borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                <div className="form-group">
                  <label className="input-label">Social Voice</label>
                  <select className="input-select" value={socialVoice} onChange={e => setSocialVoice(e.target.value)}>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="witty">Witty</option>
                    <option value="authoritative">Authoritative</option>
                    <option value="educational">Educational</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="input-label">Content Topics</label>
                  <input
                    className="input"
                    value={socialTopics}
                    onChange={e => setSocialTopics(e.target.value)}
                    placeholder="e.g. insurance tips, market trends, client success stories"
                  />
                  <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 4 }}>Comma-separated topics for AI content generation</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveSocialSettings} disabled={socialSaving}>
                    {socialSaving ? 'Saving...' : 'Save Social Settings'}
                  </button>
                  {socialSaved && <span style={{ fontSize: 12, color: 'var(--mint-darker)', fontWeight: 600 }}>Saved!</span>}
                </div>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="settings-card">
            <h3>Email Connections</h3>
            <p className="ssub">Connect your email to send presentations directly to clients.</p>

            {emailMessage && (
              <div style={{ borderRadius: 10, padding: '10px 16px', fontSize: 13, marginBottom: 14, fontWeight: 600, background: emailMessage.includes('failed') ? '#fde8e8' : 'rgba(199,232,168,0.2)', color: emailMessage.includes('failed') ? '#c03a1f' : 'var(--mint-darker)' }}>
                {emailMessage}
              </div>
            )}

            {emailConnections.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {emailConnections.map((conn: any) => {
                  const testResult = testResults[conn.id]
                  const isTesting = testingConnection === conn.id
                  const hasLastTest = conn.last_tested_at != null
                  const lastTestOk = conn.last_test_success === true
                  // Determine status: use live test result if available, else use last stored result
                  const statusOk = testResult ? testResult.success : (hasLastTest ? lastTestOk : null)

                  return (
                    <div key={conn.id} style={{ borderRadius: 10, border: '1px solid var(--border-light)', padding: '12px 16px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: conn.provider === 'microsoft' ? 'rgba(74,144,217,0.15)' : conn.provider === 'google' ? 'rgba(234,67,53,0.12)' : 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: conn.provider === 'microsoft' ? '#4A90D9' : conn.provider === 'google' ? '#EA4335' : 'var(--ink-soft)' }}>
                            {conn.provider === 'microsoft' ? 'MS' : conn.provider === 'google' ? 'G' : 'SM'}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{conn.email_address}</span>
                              {statusOk !== null && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: statusOk ? 'var(--mint-darker, #2d8a4e)' : '#c03a1f' }}>
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusOk ? '#2d8a4e' : '#c03a1f', display: 'inline-block' }} />
                                  {statusOk ? 'Connected' : 'Error'}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>{conn.provider === 'smtp' ? 'SMTP/IMAP' : conn.provider === 'google' ? 'Gmail' : 'Microsoft 365'}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => testEmailConnection(conn.id)}
                            disabled={isTesting}
                            className="btn btn-soft btn-sm"
                          >
                            {isTesting ? 'Sending...' : 'Send Test Email'}
                          </button>
                          <InlineConfirm message="Disconnect?" confirmLabel="Yes" onConfirm={() => disconnectEmail(conn.id)}><button className="btn btn-danger btn-sm">Disconnect</button></InlineConfirm>
                        </div>
                      </div>
                      {testResult && (
                        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: testResult.success ? 'var(--mint-darker, #2d8a4e)' : '#c03a1f' }}>
                          {testResult.message}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href="/api/auth/microsoft" style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 10, border: '1px solid var(--border-light)', padding: '14px 16px', textDecoration: 'none', color: 'var(--ink)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(74,144,217,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#4A90D9' }}>M</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Microsoft 365 / Outlook</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>One-click OAuth setup</div>
                </div>
              </a>
              <a href="/api/auth/google" style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 10, border: '1px solid var(--border-light)', padding: '14px 16px', textDecoration: 'none', color: 'var(--ink)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(234,67,53,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#EA4335' }}>G</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Gmail / Google Workspace</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>Connect with OAuth — send from your Gmail</div>
                </div>
              </a>
              <button onClick={() => setShowSmtpModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 10, border: '1px solid var(--border-light)', padding: '14px 16px', background: 'none', cursor: 'pointer', color: 'var(--ink)', textAlign: 'left', width: '100%' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>SM</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>SMTP / IMAP</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>Manual setup — any provider</div>
                </div>
              </button>
            </div>
          </div>

          {/* Payments */}
          <div className="settings-card">
            <h3>Payments (Stripe)</h3>
            <p className="ssub">Connect your Stripe account to collect payments from clients on your share pages.</p>

            {stripeMessage && (
              <div style={{ borderRadius: 10, padding: '10px 16px', fontSize: 13, marginBottom: 14, fontWeight: 600, background: 'rgba(199,232,168,0.2)', color: 'var(--mint-darker)' }}>
                {stripeMessage}
              </div>
            )}

            {(profile as any).stripe_user_id ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border-light)', background: 'rgba(199,232,168,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--mint-darker)', fontWeight: 700 }}>&#10003;</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Stripe connected</span>
                </div>
                <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="btn btn-soft btn-sm">Manage in Stripe</a>
              </div>
            ) : (
              <a href="/api/stripe/oauth" className="btn btn-primary">Connect Stripe &rarr;</a>
            )}
          </div>

          {/* Calendar */}
          <div className="settings-card">
            <h3>Calendar Booking</h3>
            <p className="ssub">Connect your scheduling tool so clients can book meetings from your share pages.</p>

            <div style={{ marginBottom: 12 }}>
              <label className="input-label" style={{ marginBottom: 6, display: 'block' }}>Provider</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {([
                  { id: 'calendly' as const, label: 'Calendly' },
                  { id: 'calcom' as const, label: 'Cal.com' },
                  { id: 'google' as const, label: 'Google Calendar' },
                ]).map(p => (
                  <button
                    key={p.id}
                    onClick={() => setCalendarProvider(p.id)}
                    className={`btn btn-sm ${calendarProvider === p.id ? 'btn-primary' : 'btn-soft'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {calendarProvider === 'google' ? (
              <div>
                <a href="/api/auth/google/calendar" className="btn btn-primary">
                  Connect Google Calendar &rarr;
                </a>
                <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 8 }}>
                  OAuth connection lets clients book directly on your Google Calendar.
                </p>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    value={calendlyUrl}
                    onChange={e => setCalendlyUrl(e.target.value)}
                    className="input"
                    placeholder={calendarProvider === 'calendly' ? 'https://calendly.com/your-name/30min' : 'https://cal.com/your-name'}
                    style={{ flex: 1 }}
                  />
                  <button onClick={saveCalendly} disabled={calendarySaving} className="btn btn-primary btn-sm">
                    {calendarySaving ? 'Saving...' : 'Save'}
                  </button>
                  {calendarySaved && <span style={{ fontSize: 12, color: 'var(--mint-darker)', fontWeight: 600 }}>Saved!</span>}
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 8 }}>
                  Tip: Paste your booking link from Calendly, Cal.com, or any scheduling tool.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== SUBSCRIPTION TAB ===== */}
      {tab === 'subscription' && (
        <div>
          {/* Credits & top-ups */}
          <div className="settings-card">
            <h3>Credits &amp; Top-Ups</h3>
            <p className="ssub">Buy credit packs anytime. Credits never expire and are used after your monthly allotment.</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Current balance</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {creditBalance === null ? '—' : creditBalance.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-light)' }}> credits</span>
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => setShowBuyCredits(true)}>Buy credits</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
              {[
                { name: 'Starter', credits: '2,500', price: '$10' },
                { name: 'Power', credits: '7,500', price: '$25' },
                { name: 'Studio', credits: '18,000', price: '$50' },
              ].map(p => (
                <button key={p.name} onClick={() => setShowBuyCredits(true)}
                  style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--border-light)', background: 'var(--bg-soft)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-light)' }}>{p.credits} credits</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{p.price}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Current plan summary */}
          <div className="settings-card">
            <h3>Your Plan</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, textTransform: 'capitalize' }}>
                  {(() => {
                    const s = profile.subscription_status?.toLowerCase() ?? ''
                    if (['enterprise', 'enterprise-plus', 'enterprise_plus'].includes(s)) return 'Enterprise'
                    if (['business', 'unlimited'].includes(s)) return 'Business'
                    if (['pro', 'professional'].includes(s)) return 'Pro'
                    if (['starter', 'active'].includes(s)) return 'Starter'
                    return 'Pay Per Video'
                  })()}
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 4 }}>
                  {(() => {
                    const s = profile.subscription_status?.toLowerCase() ?? ''
                    if (['enterprise', 'enterprise-plus', 'enterprise_plus'].includes(s)) return '200 videos/mo + API'
                    if (['business', 'unlimited'].includes(s)) return '75 videos/mo included'
                    if (['pro', 'professional'].includes(s)) return '20 videos/mo included'
                    if (['starter', 'active'].includes(s)) return '5 videos/mo included'
                    return '$10 per video'
                  })()}
                </div>
              </div>
              {(profile as any).stripe_customer_id && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={async () => {
                    const res = await fetch('/api/stripe/portal', { method: 'POST' })
                    const data = await res.json()
                    if (data.url) window.location.href = data.url
                  }} className="btn btn-soft">Manage billing &amp; invoices</button>
                  {(() => {
                    const s = profile.subscription_status?.toLowerCase() ?? ''
                    const paidStatuses = ['active', 'starter', 'pro', 'professional', 'business', 'agency', 'enterprise', 'enterprise-plus', 'enterprise_plus', 'past_due']
                    return paidStatuses.includes(s) ? (
                      <button onClick={async () => {
                        const res = await fetch('/api/stripe/portal', { method: 'POST' })
                        const data = await res.json()
                        if (data.url) window.location.href = data.url
                      }} className="btn btn-soft" style={{ color: '#c03a1f' }}>Cancel subscription</button>
                    ) : null
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Pricing tiers */}
          <div className="settings-card">
            <h3>Plans</h3>
            <p className="ssub">Choose the plan that fits your needs. Upgrade or downgrade anytime.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginTop: 16 }}>
              {([
                {
                  tier: 'free',
                  label: 'Pay Per Video',
                  price: '$0',
                  period: '',
                  highlight: '1 free video, then $10 each',
                  features: ['No monthly fee', 'Full quality output', 'Share pages with AI chat'],
                },
                {
                  tier: 'starter',
                  label: 'Starter',
                  price: '$29',
                  period: '/mo',
                  highlight: '5 videos/mo included',
                  features: ['$5 per additional video', 'Multi-voice narration', '2 brand profiles'],
                },
                {
                  tier: 'pro',
                  label: 'Pro',
                  price: '$79',
                  period: '/mo',
                  highlight: '20 videos/mo included',
                  features: ['$5 per additional video', 'Priority generation', 'Unlimited brands'],
                },
                {
                  tier: 'business',
                  label: 'Business',
                  price: '$199',
                  period: '/mo',
                  highlight: '75 videos/mo included',
                  features: ['$5 per additional video', 'White-label share pages', 'Priority support'],
                },
                {
                  tier: 'enterprise',
                  label: 'Enterprise',
                  price: '$499',
                  period: '/mo',
                  highlight: '200 videos/mo + API',
                  features: ['$5 per additional video', 'Unlimited slide edits', 'Dedicated support'],
                },
              ] as const).map(plan => {
                const s = profile.subscription_status?.toLowerCase() ?? ''
                const currentTier = (() => {
                  if (['enterprise', 'enterprise-plus', 'enterprise_plus'].includes(s)) return 'enterprise'
                  if (['business', 'unlimited'].includes(s)) return 'business'
                  if (['pro', 'professional'].includes(s)) return 'pro'
                  if (['starter', 'active'].includes(s)) return 'starter'
                  return 'free'
                })()
                const isCurrent = currentTier === plan.tier

                return (
                  <div key={plan.tier} style={{
                    padding: '20px 16px', borderRadius: 10, textAlign: 'center', position: 'relative',
                    background: isCurrent ? 'rgba(168,240,212,0.1)' : 'white',
                    border: isCurrent ? '2px solid var(--mint)' : '1px solid var(--border-light)',
                  }}>
                    {isCurrent && (
                      <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--mint)', color: 'var(--ink)', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10 }}>
                        CURRENT PLAN
                      </div>
                    )}
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, marginTop: 4 }}>{plan.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2, marginBottom: 4 }}>
                      <span style={{ fontSize: 28, fontWeight: 800 }}>{plan.price}</span>
                      {plan.period && <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{plan.period}</span>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mint-darker, #2d7a4f)', marginBottom: 12 }}>
                      {plan.highlight}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 16, textAlign: 'left' }}>
                      {plan.features.map(f => (
                        <div key={f} style={{ padding: '3px 0' }}>&#10003; {f}</div>
                      ))}
                    </div>
                    {isCurrent ? (
                      <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-soft)', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>
                        Current Plan
                      </div>
                    ) : plan.tier === 'free' ? (
                      (profile as any).stripe_customer_id ? (
                        <button onClick={async () => {
                          const res = await fetch('/api/stripe/portal', { method: 'POST' })
                          const data = await res.json()
                          if (data.url) window.location.href = data.url
                        }} className="btn btn-soft" style={{ width: '100%', fontSize: 13 }}>
                          Downgrade
                        </button>
                      ) : (
                        <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-soft)', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>
                          Default
                        </div>
                      )
                    ) : (
                      <button onClick={async () => {
                        const res = await fetch('/api/subscribe', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ tier: plan.tier }),
                        })
                        const data = await res.json()
                        if (data.url) window.location.href = data.url
                      }} className="btn btn-primary" style={{ width: '100%', fontSize: 13 }}>
                        {currentTier !== 'free' ? `Switch to ${plan.label}` : `Subscribe to ${plan.label}`}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Affiliate program — functional referral section */}
          <ReferralSection />
        </div>
      )}

      {/* ===== DANGER ZONE ===== */}
      <div className="settings-card" style={{ marginTop: 40, border: '1px solid #e8c4c4' }}>
        <h3 style={{ color: '#c03a1f' }}>Danger Zone</h3>
        <p className="ssub">Permanently delete your account and all associated data. This action cannot be undone.</p>
        <button
          className="btn"
          style={{ background: '#c03a1f', color: '#fff', border: 'none', marginTop: 8 }}
          onClick={async () => {
            if (!window.confirm('Are you sure you want to delete your account? All your videos, brands, and data will be permanently removed. This cannot be undone.')) return
            if (!window.confirm('This is your final confirmation. Type OK in the next prompt to proceed.')) return
            const res = await fetch('/api/account/delete', { method: 'POST' })
            if (res.ok) {
              window.location.href = '/login?deleted=1'
            } else {
              const data = await res.json()
              alert(data.error || 'Failed to delete account')
            }
          }}
        >
          Delete Account
        </button>
      </div>

      {/* SMTP Modal */}
      {showSmtpModal && (
        <SmtpSetupModal
          onClose={() => setShowSmtpModal(false)}
          onConnected={() => { setShowSmtpModal(false); loadEmailConnections(); setEmailMessage('SMTP connected!'); setTimeout(() => setEmailMessage(null), 5000) }}
        />
      )}

      <BuyCreditsModal open={showBuyCredits} onClose={() => setShowBuyCredits(false)} />
    </div>
  )
}
