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

  useEffect(() => {
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    setCreateState(state)
    if (state.autoLogoUrl) setLogoPreview(state.autoLogoUrl)
    if (state.autoBrandId) setSelectedBrand(state.autoBrandId)

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
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ animation: 'fadeInUp 0.4s ease' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Review your content
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 40, lineHeight: 1.6 }}>
          Make sure everything looks right. You can edit the script in the next step.
        </p>

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

        {/* Missing info detection */}
        {(() => {
          const allText = JSON.stringify(data).toLowerCase()
          const missing: string[] = []
          if (!allText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d[\d\s-]{7,}/)) missing.push('phone number')
          if (!allText.match(/\S+@\S+\.\S+/)) missing.push('email address')
          if (!allText.match(/(?:www\.|https?:\/\/)\S+/)) missing.push('website URL')
          if (missing.length === 0) return null
          return (
            <div style={{
              padding: '20px 24px', borderRadius: 14, marginBottom: 24,
              background: '#fffbeb', border: '1px solid #fbbf24',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
                Missing information detected
              </div>
              <div style={{ fontSize: 14, color: '#a16207', lineHeight: 1.6 }}>
                We didn&apos;t find a <strong>{missing.join(', ')}</strong> in the source content.
                If you want contact info in your video, add it to your brand profile or include it in the source material.
              </div>
            </div>
          )
        })()}

        {/* Logo upload card */}
        <div style={{
          padding: '28px', borderRadius: 16, background: 'white',
          border: '2px solid var(--mint)', marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Your logo</h3>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>
            Upload your logo — it will appear on every slide and colors will be extracted automatically.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {logoPreview ? (
              <div style={{
                width: 100, height: 100, borderRadius: 12, border: '1px solid var(--border-light)',
                background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8,
              }}>
                <img src={logoPreview} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            ) : (
              <div
                onClick={() => document.getElementById('logo-upload')?.click()}
                style={{
                  width: 100, height: 100, borderRadius: 12, border: '2px dashed var(--border)',
                  background: 'var(--bg-soft)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>+</div>
                <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>Upload</div>
              </div>
            )}

            <div>
              <label style={{ cursor: 'pointer' }}>
                <span style={{
                  display: 'inline-block', padding: '10px 20px', borderRadius: 10,
                  background: logoPreview ? 'var(--bg-soft)' : 'var(--ink)', color: logoPreview ? 'var(--ink)' : 'white',
                  fontSize: 14, fontWeight: 600, border: logoPreview ? '1px solid var(--border)' : 'none',
                }}>
                  {uploading ? 'Uploading...' : logoPreview ? 'Change logo' : 'Upload logo'}
                </span>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }}
                />
              </label>
              {!logoPreview && (
                <button
                  onClick={() => router.push('/create/script')}
                  style={{ marginLeft: 12, background: 'none', border: 'none', fontSize: 14, color: 'var(--ink-light)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Skip for now
                </button>
              )}
            </div>
          </div>
        </div>

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
