'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../_lib/supabase/client'
import { SLIDE_STYLES } from '../_lib/types'
import type { Brand } from '../_lib/types'

interface BrandStylePickerProps {
  onSelect: (selection: { brandId: string | null; styleId: string; customStylePrompt?: string }) => void
  initialBrandId?: string | null
  initialStyleId?: string
  showBrand?: boolean
  showStyle?: boolean
  compact?: boolean
}

export default function BrandStylePicker({
  onSelect,
  initialBrandId = null,
  initialStyleId = 'corporate-clean',
  showBrand = true,
  showStyle = true,
  compact = false,
}: BrandStylePickerProps) {
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string | null>(initialBrandId)
  const [selectedStyle, setSelectedStyle] = useState(initialStyleId)
  const [customTemplates, setCustomTemplates] = useState<any[]>([])
  const [customStylePrompt, setCustomStylePrompt] = useState('')

  // Reference upload for on-the-fly template
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [templateDesc, setTemplateDesc] = useState('')
  const [creatingTemplate, setCreatingTemplate] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    // Load brands
    if (showBrand) {
      supabase.from('brands').select('*').order('is_default', { ascending: false })
        .then(({ data }) => {
          if (data) {
            setBrands(data as Brand[])
            if (!initialBrandId) {
              const def = data.find((b: any) => b.is_default)
              if (def) setSelectedBrand(def.id)
            }
          }
        })
    }
    // Load custom templates
    if (showStyle) {
      fetch('/api/templates').then(r => r.json()).then(data => {
        if (Array.isArray(data)) setCustomTemplates(data)
      }).catch(() => {})
    }
  }, [showBrand, showStyle, initialBrandId])

  // Emit changes
  useEffect(() => {
    onSelect({ brandId: selectedBrand, styleId: selectedStyle, customStylePrompt: customStylePrompt || undefined })
  }, [selectedBrand, selectedStyle, customStylePrompt])

  const handleReferenceUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setReferenceImage(reader.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (blob) handleReferenceUpload(blob)
        return
      }
    }
  }, [handleReferenceUpload])

  async function handleCreateFromReference() {
    if (!referenceImage) return
    setCreatingTemplate(true)
    try {
      const res = await fetch('/api/templates/from-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImage,
          description: templateDesc || 'Create an infographic-style template matching this reference',
        }),
      })
      const data = await res.json()
      if (data.stylePrompt) {
        setCustomStylePrompt(data.stylePrompt)
        setSelectedStyle(`ref:${Date.now()}`)
        setShowCreateTemplate(false)
        setReferenceImage(null)
        setTemplateDesc('')
      }
    } catch { /* ignore */ }
    setCreatingTemplate(false)
  }

  const gridCols = compact ? 'repeat(auto-fill, minmax(100px, 1fr))' : 'repeat(auto-fill, minmax(140px, 1fr))'

  return (
    <div>
      {/* Brand Selection */}
      {showBrand && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8, color: 'var(--ink)' }}>Brand</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedBrand(null)}
              style={{
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                border: selectedBrand === null ? '2px solid var(--mint)' : '1px solid var(--border)',
                background: selectedBrand === null ? 'rgba(168,240,212,0.1)' : 'white',
                fontSize: 13, fontWeight: 600, color: 'var(--ink)',
              }}
            >
              No Brand
            </button>
            {brands.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBrand(b.id)}
                style={{
                  padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                  border: selectedBrand === b.id ? '2px solid var(--mint)' : '1px solid var(--border)',
                  background: selectedBrand === b.id ? 'rgba(168,240,212,0.1)' : 'white',
                  fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <div style={{ display: 'flex', gap: 3 }}>
                  {[b.primary_color, b.secondary_color, b.accent_color].map((c, i) => (
                    <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.1)' }} />
                  ))}
                </div>
                {b.name}
                {b.is_default && <span style={{ fontSize: 10, color: 'var(--ink-light)' }}>(default)</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Style Selection */}
      {showStyle && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8, color: 'var(--ink)' }}>Style</label>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8 }}>
            {/* Custom templates first */}
            {customTemplates.map(t => (
              <div
                key={`ct-${t.id}`}
                onClick={() => { setSelectedStyle(`custom:${t.id}`); setCustomStylePrompt(t.prompt ?? '') }}
                style={{
                  borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                  border: selectedStyle === `custom:${t.id}` ? '2px solid var(--mint)' : '1px solid var(--border-light)',
                  transition: 'all 0.15s',
                }}
              >
                {t.preview_url ? (
                  <img src={t.preview_url} alt={t.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} loading="lazy" />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{t.name?.[0]}</div>
                )}
                <div style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{t.name}</div>
                </div>
              </div>
            ))}

            {/* Built-in styles */}
            {SLIDE_STYLES.map(s => (
              <div
                key={s.id}
                onClick={() => { setSelectedStyle(s.id); setCustomStylePrompt('') }}
                style={{
                  borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                  border: selectedStyle === s.id ? '2px solid var(--mint)' : '1px solid var(--border-light)',
                  transition: 'all 0.15s',
                }}
              >
                <img src={`/style-previews/${s.id}.png`} alt={s.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} loading="lazy" />
                <div style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{s.name}</div>
                </div>
              </div>
            ))}

            {/* Create from reference */}
            <div
              onClick={() => setShowCreateTemplate(true)}
              style={{
                borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                border: '2px dashed var(--border)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: compact ? 80 : 100, background: 'var(--bg-soft)',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 10, fontWeight: 600, marginTop: 4, color: 'var(--ink-soft)' }}>From Reference</span>
            </div>
          </div>
        </div>
      )}

      {/* Create template from reference modal */}
      {showCreateTemplate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowCreateTemplate(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 10, padding: '28px 32px',
            width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Create Style from Reference</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 16px' }}>
              Upload any image as a reference. AI will create an infographic-style template matching its aesthetic.
            </p>

            {/* Upload area */}
            {!referenceImage ? (
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleReferenceUpload(f) }}
                onPaste={handlePaste}
                style={{
                  border: '2px dashed var(--border)', borderRadius: 10, padding: '32px 24px',
                  textAlign: 'center', background: 'var(--bg-soft)', marginBottom: 16, cursor: 'pointer',
                }}
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleReferenceUpload(f) }
                  input.click()
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>&#128247;</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Drop, paste, or click to upload</div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>Any image — flyer, poster, screenshot, design</div>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <img src={referenceImage} alt="Reference" style={{ width: '100%', borderRadius: 10, maxHeight: 200, objectFit: 'cover' }} />
                <button onClick={() => setReferenceImage(null)} className="btn btn-soft btn-sm" style={{ marginTop: 8 }}>Change Image</button>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Style Description (optional)</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., Bold corporate with data callouts"
                value={templateDesc}
                onChange={e => setTemplateDesc(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowCreateTemplate(false)} className="btn btn-soft" style={{ flex: 1 }}>Cancel</button>
              <button
                onClick={handleCreateFromReference}
                disabled={!referenceImage || creatingTemplate}
                className="btn btn-primary"
                style={{ flex: 2 }}
              >
                {creatingTemplate ? 'Creating...' : 'Create Style'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
