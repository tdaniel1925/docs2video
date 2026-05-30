'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SLIDE_STYLES } from '../../../_lib/types'
import { createClient } from '../../../_lib/supabase/client'

const COLOR_PRESETS = [
  { id: 'navy-gold', name: 'Navy & Gold', primary: '#1B365D', secondary: '#C9A84C', bg: '#0A1628' },
  { id: 'black-red', name: 'Black & Red', primary: '#1A1A1A', secondary: '#CC0000', bg: '#0A0A0A' },
  { id: 'forest-cream', name: 'Forest & Cream', primary: '#2D5016', secondary: '#F5E6C8', bg: '#1A3009' },
  { id: 'purple-cyan', name: 'Purple & Cyan', primary: '#6B21A8', secondary: '#00D4FF', bg: '#1E0A3E' },
  { id: 'charcoal-teal', name: 'Charcoal & Teal', primary: '#374151', secondary: '#14B8A6', bg: '#1F2937' },
  { id: 'burgundy-gold', name: 'Burgundy & Gold', primary: '#7B1E3A', secondary: '#D4A853', bg: '#4A0E22' },
  { id: 'ocean-white', name: 'Ocean & White', primary: '#0369A1', secondary: '#FFFFFF', bg: '#023E73' },
  { id: 'slate-orange', name: 'Slate & Orange', primary: '#334155', secondary: '#F97316', bg: '#1E293B' },
]

interface SavedTemplate {
  id: string
  name: string
  styleId: string
  colors: { primary: string; secondary: string }
  customPrompt?: string
}

export default function StylingPage() {
  const router = useRouter()
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [selectedColors, setSelectedColors] = useState<string | null>(null)
  const [customPrimary, setCustomPrimary] = useState('#1B365D')
  const [customSecondary, setCustomSecondary] = useState('#C9A84C')
  const [useCustomColors, setUseCustomColors] = useState(false)
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([])
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [saving, setSaving] = useState(false)
  const [customStylePrompt, setCustomStylePrompt] = useState('')
  const [showCustomPrompt, setShowCustomPrompt] = useState(false)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [referencePreview, setReferencePreview] = useState<string | null>(null)
  const [customPreviews, setCustomPreviews] = useState<string[]>([])
  const [customStyleDesc, setCustomStyleDesc] = useState('')
  const [generatingCustom, setGeneratingCustom] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)
  const [companyNameInput, setCompanyNameInput] = useState('')

  // Load saved templates from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('d2v_style_templates')
    if (saved) setSavedTemplates(JSON.parse(saved))
  }, [])

  // Load existing state
  useEffect(() => {
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    if (state.styleId) setSelectedStyle(state.styleId)
    if (state.colorPreset) setSelectedColors(state.colorPreset)
    if (state.customPrimary) { setCustomPrimary(state.customPrimary); setUseCustomColors(true) }
    if (state.customSecondary) { setCustomSecondary(state.customSecondary); setUseCustomColors(true) }
    if (state.customStylePrompt) { setCustomStylePrompt(state.customStylePrompt); setShowCustomPrompt(true) }
  }, [])

  function applyTemplate(template: SavedTemplate) {
    setSelectedStyle(template.styleId)
    setCustomPrimary(template.colors.primary)
    setCustomSecondary(template.colors.secondary)
    setUseCustomColors(true)
    setSelectedColors(null)
    if (template.customPrompt) {
      setCustomStylePrompt(template.customPrompt)
      setShowCustomPrompt(true)
    }
  }

  function saveAsTemplate() {
    if (!templateName.trim() || !selectedStyle) return
    setSaving(true)
    const colors = getActiveColors()
    const template: SavedTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      styleId: selectedStyle,
      colors,
      customPrompt: customStylePrompt || undefined,
    }
    const updated = [...savedTemplates, template]
    setSavedTemplates(updated)
    localStorage.setItem('d2v_style_templates', JSON.stringify(updated))
    setSaving(false)
    setSaveModalOpen(false)
    setTemplateName('')
  }

  function deleteTemplate(id: string) {
    const updated = savedTemplates.filter(t => t.id !== id)
    setSavedTemplates(updated)
    localStorage.setItem('d2v_style_templates', JSON.stringify(updated))
  }

  function getActiveColors() {
    if (useCustomColors) return { primary: customPrimary, secondary: customSecondary }
    const preset = COLOR_PRESETS.find(p => p.id === selectedColors)
    return preset ? { primary: preset.primary, secondary: preset.secondary } : { primary: '#1B365D', secondary: '#C9A84C' }
  }

  function handleNext() {
    if (!selectedStyle) return
    const colors = getActiveColors()
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    state.styleId = selectedStyle
    state.colorPreset = selectedColors
    state.customPrimary = colors.primary
    state.customSecondary = colors.secondary
    state.customStylePrompt = customStylePrompt || undefined
    localStorage.setItem('d2v_create', JSON.stringify(state))
    router.push('/create/review')
  }

  function handleReferenceUpload(file: File) {
    setReferenceFile(file)
    const reader = new FileReader()
    reader.onload = () => setReferencePreview(reader.result as string)
    reader.readAsDataURL(file)
    setShowCustomPrompt(true)
  }

  const activeStyle = SLIDE_STYLES.find(s => s.id === selectedStyle)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>
        Choose your style
      </h1>
      <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 32 }}>
        Pick a visual style and color scheme for your video. This defines how every slide looks.
      </p>

      {/* Saved Templates */}
      {savedTemplates.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
            My Saved Templates
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {savedTemplates.map(t => {
              const style = SLIDE_STYLES.find(s => s.id === t.styleId)
              return (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  style={{
                    padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                    border: selectedStyle === t.styleId && customPrimary === t.colors.primary ? '2px solid var(--mint)' : '1.5px solid var(--border-light)',
                    background: 'white', fontFamily: 'inherit', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', gap: 3 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 3, background: t.colors.primary }} />
                    <div style={{ width: 16, height: 16, borderRadius: 3, background: t.colors.secondary }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>{style?.name || t.styleId}</div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteTemplate(t.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink-light)', padding: '0 4px' }}
                    title="Delete template"
                  >
                    &times;
                  </button>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Style Templates */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
          Illustration Style
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {SLIDE_STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedStyle(s.id)}
              style={{
                padding: 0, borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                border: selectedStyle === s.id ? '2.5px solid var(--mint)' : '1.5px solid var(--border-light)',
                background: 'white', fontFamily: 'inherit', textAlign: 'left',
                transition: 'all 0.15s', transform: selectedStyle === s.id ? 'scale(1.02)' : 'none',
              }}
            >
              <div style={{ width: '100%', height: 100, background: 'var(--bg-soft)', overflow: 'hidden' }}>
                <img
                  src={`/style-previews/${s.id}.png`}
                  alt={s.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)', lineHeight: 1.3 }}>
                  {s.description}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Create Your Own Style */}
        <div style={{
          marginTop: 20, padding: '20px', borderRadius: 10,
          border: '1.5px solid var(--border-light)', background: 'var(--bg-soft)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
            Create Your Own Style
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 16, lineHeight: 1.4 }}>
            Upload any image as a reference &mdash; a design you love, a brand asset, a screenshot &mdash; and AI will generate preview slides matching that visual style. Costs 50 credits.
          </p>

          {/* Company name for preview */}
          <input
            type="text"
            value={companyNameInput}
            onChange={e => setCompanyNameInput(e.target.value)}
            placeholder="Company name (for preview slides)"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              border: '1.5px solid var(--border-light)', fontSize: 13, fontFamily: 'inherit',
              outline: 'none', marginBottom: 10,
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
          />

          {/* Upload + Generate */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <button
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/*'
                input.onchange = e => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (file) handleReferenceUpload(file)
                }
                input.click()
              }}
              style={{
                flex: 1, padding: '12px', borderRadius: 8,
                border: '1.5px dashed var(--border)', background: 'white',
                fontSize: 13, fontWeight: 600, color: 'var(--ink-light)',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
              }}
            >
              {referencePreview ? 'Change image' : 'Upload reference image'}
            </button>
            <button
              onClick={async () => {
                if (!referencePreview) return
                setGeneratingCustom(true)
                setCustomError(null)
                setCustomPreviews([])
                try {
                  const base64 = referencePreview.split(',')[1]
                  const res = await fetch('/api/style-preview-custom', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      referenceImageBase64: base64,
                      companyName: companyNameInput.trim() || undefined,
                    }),
                  })
                  const data = await res.json()
                  if (!res.ok) { setCustomError(data.error || 'Failed'); return }
                  setCustomPreviews(data.previews || [])
                  setCustomStyleDesc(data.styleDescription || '')
                  setCustomStylePrompt(data.styleDescription || '')
                  setSelectedStyle('custom')
                } catch (err) {
                  setCustomError(err instanceof Error ? err.message : 'Failed')
                } finally {
                  setGeneratingCustom(false)
                }
              }}
              disabled={!referencePreview || generatingCustom}
              style={{
                padding: '12px 20px', borderRadius: 8, border: 'none',
                background: referencePreview && !generatingCustom ? 'var(--ink)' : 'var(--border)',
                color: 'white', fontSize: 13, fontWeight: 700,
                cursor: referencePreview && !generatingCustom ? 'pointer' : 'default',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              {generatingCustom ? 'Generating...' : 'Generate Preview (50 credits)'}
            </button>
          </div>

          {/* Reference thumbnail */}
          {referencePreview && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <img src={referencePreview} alt="Reference" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Style will be matched to this image</span>
            </div>
          )}

          {/* Error */}
          {customError && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 13 }}>
              {customError}
            </div>
          )}

          {/* Generated previews */}
          {customPreviews.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Preview &mdash; your custom style:</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {customPreviews.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={i === 0 ? 'Cover preview' : 'Content preview'}
                    style={{ flex: 1, maxWidth: '48%', borderRadius: 8, border: '2px solid var(--mint)' }}
                  />
                ))}
              </div>
              {customStyleDesc && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-light)', lineHeight: 1.4, fontStyle: 'italic' }}>
                  Detected style: {customStyleDesc.slice(0, 200)}
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {generatingCustom && (
            <div style={{ marginTop: 16, textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Generating preview slides...</div>
              <div style={{ fontSize: 13, color: 'var(--ink-light)' }}>This takes 15-30 seconds</div>
              <div style={{ marginTop: 12, width: '100%', height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: '60%', height: '100%', background: 'var(--mint)', borderRadius: 3, animation: 'shimmer 2s infinite' }} />
              </div>
            </div>
          )}
        </div>

        {/* Advanced: custom style prompt */}
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowCustomPrompt(!showCustomPrompt)}
            style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
          >
            {showCustomPrompt ? '▾ Hide style description' : '▸ Advanced: edit style description'}
          </button>
          {showCustomPrompt && (
            <textarea
              value={customStylePrompt}
              onChange={e => setCustomStylePrompt(e.target.value)}
              placeholder="Describe the exact visual style you want... e.g. 'Steampunk with brass gears and copper pipes on dark brown backgrounds'"
              rows={3}
              style={{
                width: '100%', marginTop: 8, padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid var(--border-light)', fontSize: 13, fontFamily: 'inherit',
                outline: 'none', resize: 'vertical',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
            />
          )}
        </div>
      </div>

      {/* Color Scheme */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
          Color Scheme
        </div>

        {/* Preset colors */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {COLOR_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => { setSelectedColors(preset.id); setUseCustomColors(false) }}
              style={{
                padding: '10px', borderRadius: 10, cursor: 'pointer',
                border: selectedColors === preset.id && !useCustomColors ? '2.5px solid var(--mint)' : '1.5px solid var(--border-light)',
                background: 'white', fontFamily: 'inherit', textAlign: 'center',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: preset.primary, border: '1px solid rgba(0,0,0,0.1)' }} />
                <div style={{ width: 24, height: 24, borderRadius: 6, background: preset.secondary, border: '1px solid rgba(0,0,0,0.1)' }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{preset.name}</div>
            </button>
          ))}
        </div>

        {/* Custom color picker */}
        <div style={{
          padding: '14px 16px', borderRadius: 10,
          border: useCustomColors ? '2.5px solid var(--mint)' : '1.5px solid var(--border-light)',
          background: 'white', cursor: 'pointer',
        }}
          onClick={() => setUseCustomColors(true)}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            Custom Colors
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-soft)' }}>
              Primary
              <input
                type="color"
                value={customPrimary}
                onChange={e => { setCustomPrimary(e.target.value); setUseCustomColors(true); setSelectedColors(null) }}
                style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-soft)' }}>
              Secondary
              <input
                type="color"
                value={customSecondary}
                onChange={e => { setCustomSecondary(e.target.value); setUseCustomColors(true); setSelectedColors(null) }}
                style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer' }}
              />
            </label>
            <div style={{
              flex: 1, height: 28, borderRadius: 6,
              background: `linear-gradient(135deg, ${customPrimary} 0%, ${customSecondary} 100%)`,
              border: '1px solid rgba(0,0,0,0.1)',
            }} />
          </div>
        </div>
      </div>

      {/* Preview */}
      {activeStyle && (
        <div style={{ marginBottom: 32, padding: '16px', borderRadius: 10, background: 'var(--bg-soft)', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Preview</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 160, height: 90, borderRadius: 8, overflow: 'hidden', background: 'var(--border-light)', flexShrink: 0 }}>
              <img
                src={`/style-previews/${activeStyle.id}.png`}
                alt={activeStyle.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                {activeStyle.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
                {activeStyle.description}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, background: getActiveColors().primary, border: '1px solid rgba(0,0,0,0.1)' }} />
                <div style={{ width: 20, height: 20, borderRadius: 4, background: getActiveColors().secondary, border: '1px solid rgba(0,0,0,0.1)' }} />
                <span style={{ fontSize: 11, color: 'var(--ink-light)', lineHeight: '20px', marginLeft: 4 }}>
                  {useCustomColors ? 'Custom colors' : COLOR_PRESETS.find(p => p.id === selectedColors)?.name || 'Default'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: '14px 24px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            color: 'var(--ink-soft)', fontFamily: 'inherit',
          }}
        >
          &larr; Back
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          {selectedStyle && (
            <button
              onClick={() => setSaveModalOpen(true)}
              style={{
                padding: '14px 20px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                color: 'var(--ink-soft)', fontFamily: 'inherit',
              }}
            >
              Save as template
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!selectedStyle}
            style={{
              padding: '14px 32px', borderRadius: 10, border: 'none',
              background: selectedStyle ? 'var(--ink)' : 'var(--border)',
              color: 'white', fontSize: 15, fontWeight: 700,
              cursor: selectedStyle ? 'pointer' : 'default', fontFamily: 'inherit',
            }}
          >
            Next &rarr;
          </button>
        </div>
      </div>

      {/* Save Template Modal */}
      {saveModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSaveModalOpen(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', background: 'white', borderRadius: 16, padding: 28,
            maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Save Style Template</h3>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>
              Save this style + color combination for future videos.
            </p>
            <input
              type="text"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveAsTemplate() }}
              placeholder="e.g. My Corporate Style"
              autoFocus
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 10, border: '2px solid var(--border)',
                fontSize: 15, fontFamily: 'inherit', outline: 'none', marginBottom: 16,
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSaveModalOpen(false)} style={{
                padding: '12px 20px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-soft)', fontFamily: 'inherit',
              }}>Cancel</button>
              <button onClick={saveAsTemplate} disabled={!templateName.trim() || saving} style={{
                flex: 1, padding: '12px 20px', borderRadius: 10, border: 'none',
                background: templateName.trim() ? 'var(--ink)' : 'var(--border)', color: 'white',
                fontSize: 14, fontWeight: 700, cursor: templateName.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
              }}>{saving ? 'Saving...' : 'Save Template'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
