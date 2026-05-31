'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../_lib/supabase/client'
import type { Brand } from '../../../_lib/types'

export default function ReviewPage() {
  const router = useRouter()
  const [createState, setCreateState] = useState<any>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [themeAccepted, setThemeAccepted] = useState(false)
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactWebsite, setContactWebsite] = useState('')

  useEffect(() => {
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    setCreateState(state)
    if (state.autoLogoUrl) setLogoPreview(state.autoLogoUrl)
    if (state.autoBrandId) setSelectedBrand(state.autoBrandId)

    // Auto-populate contact info from extraction if found
    const ci = state.extractedData?.contactInfo
    if (ci) {
      if (ci.phone && !state.contactPhone) { state.contactPhone = ci.phone; setContactPhone(ci.phone) }
      if (ci.email && !state.contactEmail) { state.contactEmail = ci.email; setContactEmail(ci.email) }
      if (ci.website && !state.contactWebsite) { state.contactWebsite = ci.website; setContactWebsite(ci.website) }
      localStorage.setItem('d2v_create', JSON.stringify(state))
    }

    // Load brands
    const supabase = createClient()
    supabase.from('brands').select('*').order('is_default', { ascending: false }).then(({ data }) => {
      if (data) setBrands(data as Brand[])
    })
  }, [])

  async function handleLogoUpload(file: File) {
    setLogoFile(file)
    setUploading(true)

    // Preview immediately
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Upload to storage
      const logoPath = `${user.id}/brand_logo_${Date.now()}.png`
      const buf = await file.arrayBuffer()
      const { error } = await supabase.storage.from('videos').upload(logoPath, buf, { contentType: 'image/png', upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from('videos').getPublicUrl(logoPath)
        const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
        state.logoUrl = urlData.publicUrl
        localStorage.setItem('d2v_create', JSON.stringify(state))
        setLogoPreview(urlData.publicUrl)

        // Update brand if one is selected
        if (selectedBrand) {
          await supabase.from('brands').update({ logo_file_url: urlData.publicUrl }).eq('id', selectedBrand)
        }
      }
    } catch { /* skip */ }
    setUploading(false)
  }

  function handleAcceptTheme() {
    if (!createState?.suggestedTheme?.prompt) return
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    state.customStylePrompt = createState.suggestedTheme.prompt
    state.themeAccepted = true
    localStorage.setItem('d2v_create', JSON.stringify(state))
    setThemeAccepted(true)
  }

  function handleContinue() {
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    state.selectedBrand = selectedBrand
    localStorage.setItem('d2v_create', JSON.stringify(state))
    router.push('/create/script')
  }

  if (!createState) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
  }

  const data = createState.extractedData

  return (
    <div style={{
      flex: 1, padding: '40px 24px', maxWidth: 800, margin: '0 auto', width: '100%',
    }}>

      <div style={{ animation: 'fadeInUp 0.4s ease' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Here&apos;s what we found
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 32, lineHeight: 1.6 }}>
          Review the extracted content, then we&apos;ll generate your script.
        </p>

        {/* Analysis summary */}
        {(() => {
          const sectionCount = data?.sections?.length || 0
          const metricCount = data?.keyMetrics?.length || 0
          const hasContact = !!(data?.contactInfo?.phone || data?.contactInfo?.email)
          const allText = JSON.stringify(data || {})
          const wordCount = allText.split(/\s+/).length
          const hasPricing = /\$\d|pricing|price|plan|tier/i.test(allText)

          // Estimate video length
          let recMinutes = '1-2'
          let recLabel = 'Highlights'
          if (wordCount > 3000) { recMinutes = '5-10'; recLabel = 'Detailed' }
          else if (wordCount > 1200) { recMinutes = '3-5'; recLabel = 'Standard' }
          else if (wordCount > 500) { recMinutes = '2-3'; recLabel = 'Standard' }

          const stats = [
            { value: sectionCount, label: 'Sections' },
            { value: metricCount, label: 'Key stats' },
            { value: `~${recMinutes} min`, label: 'Recommended' },
          ]

          const capabilities: string[] = []
          if (sectionCount > 0) capabilities.push('Structured content for narration')
          if (metricCount > 0) capabilities.push('Stats and data for visual slides')
          if (hasPricing) capabilities.push('Pricing details found')
          if (hasContact) capabilities.push('Contact info for closing slide')
          if (data?.testimonials?.length > 0) capabilities.push('Testimonials for social proof')

          return (
            <div style={{
              padding: '24px 28px', borderRadius: 10, marginBottom: 24,
              background: 'rgba(168,240,212,0.08)', border: '2px solid var(--mint)',
            }}>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                {stats.map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)' }}>{s.value}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {capabilities.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {capabilities.map((c, i) => (
                    <span key={i} style={{
                      padding: '4px 12px', borderRadius: 6, background: 'rgba(168,240,212,0.2)',
                      fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500,
                    }}>
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Extracted content card */}
        <div style={{
          padding: '28px', borderRadius: 16, background: 'white',
          border: '1px solid var(--border-light)', marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{data?.title || 'Untitled'}</h2>
          {data?.subtitle && <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 12 }}>{data.subtitle}</p>}

          {data?.keyMetrics?.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              {data.keyMetrics.slice(0, 6).map((m: any, i: number) => (
                <div key={i} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-soft)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{m.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {data?.sections?.length > 0 && (
            <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              {data.sections.slice(0, 4).map((s: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <strong>{s.title}:</strong> {s.content?.slice(0, 150)}{s.content?.length > 150 ? '...' : ''}
                </div>
              ))}
              {data.sections.length > 4 && <div style={{ color: 'var(--ink-light)' }}>+ {data.sections.length - 4} more sections</div>}
            </div>
          )}
        </div>

        {/* Missing info — intent-aware dynamic fields */}
        {(() => {
          const allText = JSON.stringify(data).toLowerCase()
          const intentType = createState.intentType || ''
          // Check both structured contactInfo AND raw text patterns
          const ci = data?.contactInfo || {}
          const hasPhone = !!ci.phone || !!allText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d[\d\s-]{7,}/)
          const hasEmail = !!ci.email || !!allText.match(/\S+@\S+\.\S+/)
          const hasWebsite = !!ci.website || !!allText.match(/(?:www\.|https?:\/\/)\S+/)
          const hasPricing = !!allText.match(/\$\d|pricing|price|cost|plan|tier|subscription|free trial/)
          const hasCompanyName = !!data?.title || !!data?.companyName

          // Build dynamic fields based on intent
          type FieldDef = { key: string; label: string; placeholder: string; type: string }
          const fields: FieldDef[] = []

          // Common contact fields if missing
          if (!hasPhone) fields.push({ key: 'contactPhone', label: 'Phone number', placeholder: '(555) 123-4567', type: 'tel' })
          if (!hasEmail) fields.push({ key: 'contactEmail', label: 'Email address', placeholder: 'hello@company.com', type: 'email' })
          if (!hasWebsite) fields.push({ key: 'contactWebsite', label: 'Website URL', placeholder: 'https://yoursite.com', type: 'url' })

          // Intent-specific fields
          if (intentType === 'sales' && !hasPricing) {
            fields.push({ key: 'pricingInfo', label: 'Pricing details', placeholder: 'e.g. Free trial, $29/mo starter, $79/mo pro', type: 'text' })
            fields.push({ key: 'ctaUrl', label: 'Sign up / demo URL', placeholder: 'https://yoursite.com/demo', type: 'url' })
          }
          if (intentType === 'proposal') {
            fields.push({ key: 'clientName', label: 'Client name', placeholder: 'Who is this proposal for?', type: 'text' })
            fields.push({ key: 'timeline', label: 'Timeline', placeholder: 'e.g. 6 weeks, Q3 2026', type: 'text' })
          }
          if (intentType === 'report') {
            fields.push({ key: 'reportPeriod', label: 'Report period', placeholder: 'e.g. Q2 2026, January-March', type: 'text' })
            fields.push({ key: 'preparedBy', label: 'Prepared by', placeholder: 'Team or person name', type: 'text' })
          }

          if (fields.length === 0) return null
          return (
            <div style={{
              padding: '24px 28px', borderRadius: 16, marginBottom: 24,
              background: 'white', border: '2px solid #fbbf24',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                Add contact info <span style={{ fontSize: 13, fontWeight: 500, color: '#a16207' }}>(optional)</span>
              </div>
              <p style={{ fontSize: 14, color: '#a16207', marginBottom: 16, lineHeight: 1.5 }}>
                We didn&apos;t find contact details in the source. Add them here — they&apos;ll appear on the closing slide and the narrator will mention them at the end of the video.
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                {fields.map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4, display: 'block' }}>{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      defaultValue={(createState as any)?.[f.key] || ''}
                      onChange={e => {
                        const s = JSON.parse(localStorage.getItem('d2v_create') || '{}')
                        s[f.key] = e.target.value
                        localStorage.setItem('d2v_create', JSON.stringify(s))
                      }}
                      style={{
                        padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)',
                        fontSize: 15, fontFamily: 'inherit', outline: 'none', width: '100%',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Logo upload removed — video branding is text-only */}

        {/* Theme preview card */}
        {createState.suggestedTheme && !themeAccepted && (
          <div style={{
            padding: '28px', borderRadius: 16, background: 'white',
            border: '2px solid var(--mint)', marginBottom: 24,
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Suggested theme</h3>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>
              Based on the website&apos;s design, we created a custom slide theme.
            </p>

            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{createState.suggestedTheme.name}</div>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>{createState.suggestedTheme.description}</p>

            {createState.suggestedTheme.colors && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {Object.entries(createState.suggestedTheme.colors).map(([key, hex]) => (
                  <div key={key} style={{ width: 28, height: 28, borderRadius: 6, background: hex as string, border: '1px solid var(--border-light)' }} title={`${key}: ${hex}`} />
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAcceptTheme} style={{
                padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--ink)',
                color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Use this theme
              </button>
              <button onClick={() => {
                const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
                state.suggestedTheme = null
                localStorage.setItem('d2v_create', JSON.stringify(state))
                setCreateState({ ...createState, suggestedTheme: null })
              }} style={{
                padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-soft)', fontFamily: 'inherit',
              }}>
                No thanks
              </button>
            </div>
          </div>
        )}

        {themeAccepted && (
          <div style={{
            padding: '14px 20px', borderRadius: 10, background: 'rgba(168,240,212,0.1)',
            border: '1px solid var(--mint)', fontSize: 14, marginBottom: 24,
          }}>
            Theme &ldquo;{createState.suggestedTheme?.name}&rdquo; applied.
          </div>
        )}

        {/* Continue button */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button onClick={() => router.push('/create/source')} style={{
            padding: '16px 28px', borderRadius: 12, border: '2px solid var(--border)',
            background: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-soft)', fontFamily: 'inherit',
          }}>
            &larr; Back
          </button>
          <button onClick={handleContinue} style={{
            flex: 1, padding: '16px 28px', borderRadius: 12, border: 'none',
            background: 'var(--ink)', color: 'white', fontSize: 17, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Continue to script &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}
