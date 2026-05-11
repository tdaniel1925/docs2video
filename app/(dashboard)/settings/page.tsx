'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../_lib/supabase/client'
import SmtpSetupModal from '../../_components/SmtpSetupModal'
import { SLIDE_STYLES } from '../../_lib/types'
import type { Profile, Brand } from '../../_lib/types'

type SettingsTab = 'profile' | 'brand' | 'integrations' | 'subscription'

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('profile')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [photoUploading, setPhotoUploading] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [emailConnections, setEmailConnections] = useState<any[]>([])
  const [showSmtpModal, setShowSmtpModal] = useState(false)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [testingConnection, setTestingConnection] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})

  const [stripeMessage, setStripeMessage] = useState<string | null>(null)
  const [calendlyUrl, setCalendlyUrl] = useState('')
  const [calendarySaving, setCalendarySaving] = useState(false)
  const [calendarySaved, setCalendarySaved] = useState(false)
  const [defaultStyle, setDefaultStyle] = useState('luxury')
  const [styleSaving, setStyleSaving] = useState(false)
  const searchParams = useSearchParams()

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
      const { data: b } = await supabase.from('brands').select('*').eq('user_id', user.id).eq('is_default', true).single()
      if (b) setBrand(b as Brand)
      loadEmailConnections()
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

  async function disconnectEmail(id: string) {
    if (!confirm('Disconnect this email account?')) return
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

  async function handlePhotoUpload(file: File, type: string) {
    setPhotoUploading(type)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    try {
      const res = await fetch('/api/upload-photo', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok && profile) {
        const key = type === 'headshot' ? 'photo_url' : type === 'midlevel' ? 'photo_midlevel_url' : 'photo_standing_url'
        setProfile({ ...profile, [key]: data.url } as Profile)
      }
    } catch { /* ignore */ }
    setPhotoUploading(null)
  }

  async function handleLogoUpload(file: File) {
    setLogoUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload-logo', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok && brand) {
        const supabase = createClient()
        await supabase.from('brands').update({ logo_file_url: data.url, logo_url: data.url }).eq('id', brand.id)
        setBrand({ ...brand, logo_file_url: data.url, logo_url: data.url })
      }
    } catch { /* ignore */ }
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

          {/* Photos */}
          <div className="settings-card">
            <h3>Profile Photos</h3>
            <p className="ssub">These photos appear on your presentation slides and share pages.</p>
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
              <h3>Brand &amp; Logo</h3>
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
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: conn.provider === 'microsoft' ? 'rgba(74,144,217,0.15)' : 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: conn.provider === 'microsoft' ? '#4A90D9' : 'var(--ink-soft)' }}>
                            {conn.provider === 'microsoft' ? 'MS' : 'SM'}
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
                            <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>{conn.provider === 'smtp' ? 'SMTP/IMAP' : 'Microsoft 365'}</div>
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
                          <button onClick={() => disconnectEmail(conn.id)} className="btn btn-danger btn-sm">Disconnect</button>
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
            <p className="ssub">Enter your Calendly or Cal.com URL to show a booking widget on your share pages.</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input value={calendlyUrl} onChange={e => setCalendlyUrl(e.target.value)} className="input" placeholder="https://calendly.com/your-name" style={{ flex: 1 }} />
              <button onClick={saveCalendly} disabled={calendarySaving} className="btn btn-primary btn-sm">
                {calendarySaving ? 'Saving...' : 'Save'}
              </button>
              {calendarySaved && <span style={{ fontSize: 12, color: 'var(--mint-darker)', fontWeight: 600 }}>Saved!</span>}
            </div>
          </div>
        </div>
      )}

      {/* ===== SUBSCRIPTION TAB ===== */}
      {tab === 'subscription' && (
        <div>
          <div className="settings-card">
            <h3>Your Plan</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, textTransform: 'capitalize' }}>{profile.subscription_status}</div>
                <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 4 }}>{profile.credits_remaining} credits remaining</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={async () => {
                  const res = await fetch('/api/stripe/portal', { method: 'POST' })
                  const data = await res.json()
                  if (data.url) window.location.href = data.url
                }} className="btn btn-soft">Manage Subscription</button>
                <button onClick={async () => {
                  const res = await fetch('/api/stripe/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ priceId: 'pro' }),
                  })
                  const data = await res.json()
                  if (data.url) window.location.href = data.url
                }} className="btn btn-primary">Upgrade</button>
              </div>
            </div>

            <div style={{ background: 'var(--bg-soft)', borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 12 }}>Plan Comparison</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, fontSize: 13 }}>
                {[
                  { name: 'Demo', price: 'Free', credits: '3/mo' },
                  { name: 'Starter', price: '$49', credits: '30/mo' },
                  { name: 'Professional', price: '$99', credits: '75/mo' },
                  { name: 'Agency', price: '$249', credits: '200/mo' },
                ].map(plan => (
                  <div key={plan.name} style={{
                    padding: '14px 12px',
                    borderRadius: 10,
                    background: profile.subscription_status === plan.name.toLowerCase() ? 'white' : 'transparent',
                    border: profile.subscription_status === plan.name.toLowerCase() ? '1px solid var(--ink)' : '1px solid transparent',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{plan.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>{plan.price}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>{plan.credits} credits/mo</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SMTP Modal */}
      {showSmtpModal && (
        <SmtpSetupModal
          onClose={() => setShowSmtpModal(false)}
          onConnected={() => { setShowSmtpModal(false); loadEmailConnections(); setEmailMessage('SMTP connected!'); setTimeout(() => setEmailMessage(null), 5000) }}
        />
      )}
    </div>
  )
}
