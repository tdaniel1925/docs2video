'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../_lib/supabase/client'
import type { Brand, ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'
import { VOICE_OPTIONS, SLIDE_STYLES } from '../../_lib/types'
import Link from 'next/link'

type InputMode = 'upload' | 'url' | 'text'

interface AutoSelections {
  templateId: string
  voiceId: string
  slideCount: number
  mood: string
}

export default function QuickModePage() {
  const router = useRouter()
  const [inputMode, setInputMode] = useState<InputMode>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [autoSelections, setAutoSelections] = useState<AutoSelections | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const assetInputRef = useRef<HTMLInputElement>(null)
  const [assetsExpanded, setAssetsExpanded] = useState(false)
  const [assets, setAssets] = useState<{url: string, tag: string, name: string, uploading?: boolean}[]>([])
  const [assetUploading, setAssetUploading] = useState(false)

  // Load brands on mount
  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const { data } = await supabase
        .from('brands')
        .select('*')
        .order('is_default', { ascending: false })
      if (data) setBrands(data as Brand[])
    }
    loadData()
  }, [])

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile)
      setInputMode('upload')
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setInputMode('upload')
    }
  }, [])

  async function handleAssetUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    const remaining = 5 - assets.length
    const toUpload = Array.from(files).slice(0, remaining)
    if (toUpload.length === 0) return

    setAssetUploading(true)
    for (const f of toUpload) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) continue
      if (f.size > 10 * 1024 * 1024) continue

      const formData = new FormData()
      formData.append('file', f)
      formData.append('tag', 'product')
      try {
        const res = await fetch('/api/upload-asset', { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          setAssets(prev => [...prev, { url: data.url, tag: 'product', name: f.name }])
        }
      } catch { /* skip failed uploads */ }
    }
    setAssetUploading(false)
    if (!assetsExpanded) setAssetsExpanded(true)
  }

  function removeAsset(index: number) {
    setAssets(prev => prev.filter((_, i) => i !== index))
  }

  function updateAssetTag(index: number, tag: string) {
    setAssets(prev => prev.map((a, i) => i === index ? { ...a, tag } : a))
  }

  async function handleCreate() {
    setError(null)
    setLoading(true)

    try {
      let policyData: ExtractedPolicyData | ExtractedData | null = null

      // Step 1: Extract data based on input mode
      if (inputMode === 'upload' && file) {
        setStatusMsg('Extracting data from your document...')
        const formData = new FormData()
        formData.append('file', file)
        const extractRes = await fetch('/api/extract', { method: 'POST', body: formData })
        if (!extractRes.ok) {
          const errData = await extractRes.json()
          throw new Error(errData.error || 'Failed to extract data')
        }
        const extractData = await extractRes.json()
        // Use insurance data if available, otherwise general
        policyData = extractData.insurance ?? extractData.general
      } else if (inputMode === 'url' && urlInput.trim()) {
        setStatusMsg('Analyzing URL content...')
        const res = await fetch('/api/extract-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlInput.trim() }),
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to extract URL')
        }
        const data = await res.json()
        policyData = data.general ?? data
      } else if (inputMode === 'text' && textInput.trim()) {
        setStatusMsg('Processing your text...')
        const res = await fetch('/api/extract-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textInput.trim() }),
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to process text')
        }
        const data = await res.json()
        policyData = data.general ?? data
      } else {
        throw new Error('Please provide content to create a presentation from.')
      }

      if (!policyData) throw new Error('Could not extract data from your input.')

      // Step 2: Auto-select template, voice, slide count
      setStatusMsg('Choosing the best style for your content...')
      const autoRes = await fetch('/api/auto-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyData }),
      })
      const selections: AutoSelections = await autoRes.json()
      setAutoSelections(selections)

      // Step 3: Create video record
      setStatusMsg('Setting up your video...')
      const assetPayload = assets.length > 0 ? assets.map(a => ({ url: a.url, tag: a.tag })) : undefined
      const createRes = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyData,
          brandId: brands.find(b => b.is_default)?.id ?? null,
          voiceId: selections.voiceId,
          assets: assetPayload,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create video')

      // Step 4: Save pipeline input to the video record
      const supabase = createClient()
      await supabase.from('videos').update({
        script: {
          _pipeline_input: {
            policyData,
            brandId: brands.find(b => b.is_default)?.id ?? null,
            voiceId: selections.voiceId,
            styleId: selections.templateId,
            aiMusic: true,
            clientName: clientName || undefined,
            clientEmail: clientEmail || undefined,
            assets: assetPayload,
          },
        },
      }).eq('id', createData.id)

      // Step 5: Redirect to video page
      setStatusMsg('Redirecting...')
      router.push(`/videos/${createData.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
      setStatusMsg('')
    }
  }

  const hasInput = (inputMode === 'upload' && file) ||
    (inputMode === 'url' && urlInput.trim()) ||
    (inputMode === 'text' && textInput.trim())

  const voiceName = autoSelections
    ? VOICE_OPTIONS.find(v => v.id === autoSelections.voiceId)?.name ?? autoSelections.voiceId
    : null
  const templateName = autoSelections
    ? SLIDE_STYLES.find(s => s.id === autoSelections.templateId)?.name ?? autoSelections.templateId
    : null

  return (
    <div className="wizard-container">
      {/* Mode Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        <div style={{
          display: 'inline-flex',
          background: 'var(--surface-raised, #f1f5f9)',
          borderRadius: 10,
          padding: 4,
        }}>
          <div style={{
            padding: '8px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            background: 'var(--bg-card)',
            color: 'var(--ink)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            Quick Mode
          </div>
          <Link
            href="/create"
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--muted)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Pro Mode
          </Link>
        </div>
      </div>

      <div className="wizard-card" style={{ maxWidth: 640, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 4 }}>What would you like to explain?</h2>
        <p className="wizard-sub" style={{ marginBottom: 24 }}>
          Drop your content and we will handle everything automatically.
        </p>

        {/* Input mode tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--surface-raised, #f1f5f9)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {([
            { key: 'upload' as InputMode, label: 'Upload PDF' },
            { key: 'url' as InputMode, label: 'Paste URL' },
            { key: 'text' as InputMode, label: 'Type' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setInputMode(tab.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: inputMode === tab.key ? 600 : 400,
                background: inputMode === tab.key ? 'var(--bg-card)' : 'transparent',
                color: inputMode === tab.key ? 'var(--ink)' : 'var(--muted)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: inputMode === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Upload PDF drop zone */}
        {inputMode === 'upload' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent, #4A90D9)' : file ? 'var(--success, #22c55e)' : 'var(--border)'}`,
              borderRadius: 16,
              padding: file ? '24px 32px' : '48px 32px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'var(--bg-soft)' : 'transparent',
              transition: 'all 0.2s ease',
              marginBottom: 20,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {file ? (
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{file.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  {(file.size / 1024 / 1024).toFixed(1)} MB -- Click to replace
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 36, marginBottom: 8 }}>+</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
                  Drop your PDF here or click to browse
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  Insurance illustrations, financial reports, proposals, any document
                </div>
              </div>
            )}
          </div>
        )}

        {/* URL input */}
        {inputMode === 'url' && (
          <div style={{ marginBottom: 20 }}>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/article-or-page"
              className="input-text"
              style={{ width: '100%', padding: '14px 16px', fontSize: 15 }}
            />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              We will extract the content from this page and create a presentation from it.
            </div>
          </div>
        )}

        {/* Text input */}
        {inputMode === 'text' && (
          <div style={{ marginBottom: 20 }}>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste your content here, or describe what you want to present..."
              className="input-text"
              rows={8}
              style={{ width: '100%', padding: '14px 16px', fontSize: 14, resize: 'vertical', minHeight: 160 }}
            />
          </div>
        )}

        {/* Product images (optional) */}
        <div style={{ marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => {
              if (!assetsExpanded && assets.length === 0) {
                assetInputRef.current?.click()
              }
              setAssetsExpanded(!assetsExpanded)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '10px 14px', border: '1px dashed var(--border)', borderRadius: 10,
              background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              color: 'var(--muted)', transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            Product images (optional) {assets.length > 0 && <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{assets.length}/5</span>}
          </button>
          <input
            ref={assetInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => handleAssetUpload(e.target.files)}
            style={{ display: 'none' }}
          />

          {assetsExpanded && (
            <div style={{ marginTop: 12, padding: '12px', background: 'var(--bg-soft)', borderRadius: 10 }}>
              {assets.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  {assets.map((asset, i) => (
                    <div key={i} style={{ position: 'relative', width: 80, textAlign: 'center' }}>
                      <div style={{ position: 'relative', width: 80, height: 60, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <img src={asset.url} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          onClick={() => removeAsset(i)}
                          style={{
                            position: 'absolute', top: 2, right: 2, width: 18, height: 18,
                            borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)',
                            color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                          }}
                        >x</button>
                      </div>
                      <select
                        value={asset.tag}
                        onChange={(e) => updateAssetTag(i, e.target.value)}
                        style={{
                          marginTop: 4, width: '100%', fontSize: 10, padding: '2px 4px',
                          borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)',
                          color: 'var(--ink)', cursor: 'pointer',
                        }}
                      >
                        <option value="product">product</option>
                        <option value="logo">logo</option>
                        <option value="lifestyle">lifestyle</option>
                        <option value="background">background</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {assets.length < 5 && (
                <button
                  type="button"
                  onClick={() => assetInputRef.current?.click()}
                  disabled={assetUploading}
                  style={{
                    padding: '8px 14px', fontSize: 12, fontWeight: 500, border: '1px dashed var(--border)',
                    borderRadius: 8, background: 'transparent', cursor: 'pointer', color: 'var(--muted)',
                    opacity: assetUploading ? 0.5 : 1, width: '100%',
                  }}
                >
                  {assetUploading ? 'Uploading...' : `+ Add photos, logos, or product shots (${5 - assets.length} slots left)`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Client info (optional) */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>
            Who is this for? (optional)
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name"
              className="input-text"
              style={{ flex: 1, padding: '10px 14px', fontSize: 14 }}
            />
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="Client email"
              className="input-text"
              style={{ flex: 1, padding: '10px 14px', fontSize: 14 }}
            />
          </div>
        </div>

        {/* Auto-selections preview */}
        {autoSelections && (
          <div style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 16,
            padding: '10px 14px',
            background: 'var(--bg-soft)',
            borderRadius: 10,
            fontSize: 13,
          }}>
            <span style={{ color: 'var(--muted)' }}>AI picked:</span>
            <span style={{ fontWeight: 500 }}>{templateName} template</span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span style={{ fontWeight: 500 }}>{voiceName} voice</span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span style={{ fontWeight: 500 }}>{autoSelections.slideCount} slides</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 10,
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {/* Loading status */}
        {loading && statusMsg && (
          <div style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
            border: '1px solid #93c5fd',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 16, height: 16, border: '2px solid #3b82f6',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            {statusMsg}
          </div>
        )}

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={!hasInput || loading}
          className="btn btn-primary btn-lg"
          style={{
            width: '100%',
            padding: '16px 24px',
            fontSize: 16,
            fontWeight: 600,
            opacity: (!hasInput || loading) ? 0.5 : 1,
          }}
        >
          {loading ? 'Creating...' : 'Create Presentation'}
        </button>

        {/* Pro mode link */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link
            href="/create"
            style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}
          >
            Want more control? Switch to Pro Mode
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
