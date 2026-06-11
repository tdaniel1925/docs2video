'use client'

import { useState, useRef, useCallback } from 'react'

type HeadshotImage = {
  url: string
  style: string
  description: string
}

const CATEGORY_ORDER = ['Corporate', 'Creative', 'Outdoor', 'Premium']
const BATCH_LABELS = [
  'Generating corporate styles...',
  'Generating creative styles...',
  'Generating outdoor styles...',
  'Generating premium styles...',
]

export default function HeadshotPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [photo, setPhoto] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [images, setImages] = useState<HeadshotImage[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [batchProgress, setBatchProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File | Blob) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      setPhoto(reader.result as string)
      setError(null)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.')
      return
    }
    processFile(file)
    e.target.value = ''
  }, [processFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) processFile(file)
  }, [processFile])

  async function handleGenerate() {
    if (!photo) return
    setStep(2)
    setError(null)
    setBatchProgress(0)

    // Simulate batch progress while waiting
    const progressInterval = setInterval(() => {
      setBatchProgress(prev => {
        if (prev >= 3) {
          clearInterval(progressInterval)
          return 3
        }
        return prev + 1
      })
    }, 8000)

    try {
      const res = await fetch('/api/generate-headshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo, name: name.trim() || undefined }),
      })
      const data = await res.json()
      clearInterval(progressInterval)

      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setImages(data.images)
      setSelected(new Set())
      setBatchProgress(4)
      setStep(3)
    } catch (err) {
      clearInterval(progressInterval)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep(1)
    }
  }

  function toggleSelect(idx: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(images.map((_, i) => i)))
  }

  async function downloadImages(indices: number[]) {
    for (const i of indices) {
      const img = images[i]
      if (!img) continue
      const link = document.createElement('a')
      link.href = img.url
      link.download = `headshot_${img.style.toLowerCase()}_${i + 1}.png`
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      // Small delay between downloads so browser handles each
      await new Promise(r => setTimeout(r, 200))
    }
  }

  function handleReset() {
    setStep(1)
    setPhoto(null)
    setName('')
    setImages([])
    setSelected(new Set())
    setError(null)
  }

  // Group images by category
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    items: images
      .map((img, idx) => ({ ...img, idx }))
      .filter(img => img.style === cat),
  }))

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>AI Headshot Generator</h1>
        <p style={{ fontSize: 15, color: 'var(--ink-soft, #94a3b8)', margin: 0 }}>
          Upload a photo and get 20 professional headshot variations instantly
        </p>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="wizard-card" style={{ maxWidth: 600, margin: '0 auto', padding: 32, borderRadius: 10 }}>
          {!photo ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: dragOver ? '2px dashed var(--mint, #A8F0D4)' : '2px dashed var(--border, #e2e8f0)',
                background: dragOver ? 'rgba(168,240,212,0.08)' : 'transparent',
                borderRadius: 10,
                padding: '48px 24px',
                transition: 'all 0.2s',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft, #94a3b8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink, #1e293b)', margin: '0 0 6px' }}>
                Upload your photo
              </p>
              <p style={{ fontSize: 13, color: 'var(--ink-soft, #94a3b8)', margin: 0, textAlign: 'center', maxWidth: 340 }}>
                Drag and drop or click to browse. Use a clear, front-facing photo for best results.
              </p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <div style={{ position: 'relative', width: 200, height: 200, borderRadius: 10, overflow: 'hidden' }}>
                  <img src={photo} alt="Your photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={() => setPhoto(null)}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', color: '#fff',
                      border: 'none', cursor: 'pointer', fontSize: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    x
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft, #94a3b8)', display: 'block', marginBottom: 6 }}>
                  Name (optional)
                </label>
                <input
                  className="input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. John Smith"
                  style={{ width: '100%' }}
                />
              </div>

              <p style={{ fontSize: 12, color: 'var(--ink-soft, #94a3b8)', textAlign: 'center', margin: '0 0 20px' }}>
                Your photo stays private — only used for headshot generation
              </p>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px 0', fontSize: 16, fontWeight: 600 }}
              >
                Generate 20 Headshots — $19
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Generating */}
      {step === 2 && (
        <div className="wizard-card" style={{ maxWidth: 600, margin: '0 auto', padding: 40, borderRadius: 10, textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}>
            <span className="spinner" style={{ width: 40, height: 40, display: 'inline-block' }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Generating Your Headshots</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-soft, #94a3b8)', margin: '0 0 24px' }}>
            Creating 20 professional variations. This may take a minute...
          </p>

          {/* Progress bar */}
          <div style={{ background: 'var(--surface-raised, #f1f5f9)', borderRadius: 10, height: 8, overflow: 'hidden', marginBottom: 16 }}>
            <div
              style={{
                width: `${(batchProgress / 4) * 100}%`,
                height: '100%',
                background: 'var(--primary, #6366f1)',
                borderRadius: 10,
                transition: 'width 0.5s ease',
              }}
            />
          </div>

          <p style={{ fontSize: 13, color: 'var(--ink-soft, #94a3b8)', margin: 0 }}>
            {batchProgress < 4 ? BATCH_LABELS[batchProgress] : 'Almost done...'}
          </p>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && (
        <div>
          {/* Actions bar */}
          <div className="wizard-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderRadius: 10, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={handleReset} className="btn btn-soft" style={{ fontSize: 13 }}>
                Start Over
              </button>
              <span style={{ fontSize: 13, color: 'var(--ink-soft, #94a3b8)' }}>
                {selected.size > 0 ? `${selected.size} selected` : `${images.length} headshots generated`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={selectAll} className="btn btn-soft" style={{ fontSize: 13 }}>
                Select All
              </button>
              {selected.size > 0 && (
                <button
                  onClick={() => downloadImages(Array.from(selected))}
                  className="btn btn-primary"
                  style={{ fontSize: 13 }}
                >
                  Download Selected ({selected.size})
                </button>
              )}
              <button
                onClick={() => downloadImages(images.map((_, i) => i))}
                className="btn btn-primary"
                style={{ fontSize: 13 }}
              >
                Download All
              </button>
            </div>
          </div>

          {/* Category grids */}
          {grouped.map(group => {
            if (group.items.length === 0) return null
            return (
              <div key={group.category} style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink, #1e293b)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {group.category}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                  {group.items.map(img => {
                    const isSelected = selected.has(img.idx)
                    return (
                      <div
                        key={img.idx}
                        onClick={() => toggleSelect(img.idx)}
                        style={{
                          position: 'relative',
                          borderRadius: 10,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: isSelected ? '3px solid #22c55e' : '3px solid transparent',
                          transition: 'border-color 0.15s',
                          aspectRatio: '1 / 1',
                        }}
                      >
                        <img
                          src={img.url}
                          alt={img.description}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        {isSelected && (
                          <div style={{
                            position: 'absolute', top: 8, right: 8,
                            width: 24, height: 24, borderRadius: '50%',
                            background: '#22c55e', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 700,
                          }}>
                            &#10003;
                          </div>
                        )}
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                          padding: '20px 8px 8px',
                        }}>
                          <p style={{ fontSize: 11, color: '#fff', margin: 0, lineHeight: 1.3 }}>
                            {img.description.length > 50 ? img.description.slice(0, 50) + '...' : img.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-soft, #94a3b8)', margin: '16px 0 0' }}>
            $19 for 20 variations
          </p>
        </div>
      )}
    </div>
  )
}
