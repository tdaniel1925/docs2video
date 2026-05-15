'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

type FixType = 'remove-background' | 'swap-background-studio' | 'swap-background-office' | 'enhance' | 'headshot-pro' | 'remove-objects' | 'upscale' | 'brand-filter' | 'logo-cleanup'

const FIX_OPTIONS: { id: FixType; icon: string; title: string; desc: string }[] = [
  { id: 'remove-background', icon: '\u{1F5BC}\uFE0F', title: 'Remove BG', desc: 'Transparent or white background' },
  { id: 'swap-background-studio', icon: '\uD83D\uDCF8', title: 'Studio Backdrop', desc: 'Clean studio gradient' },
  { id: 'swap-background-office', icon: '\uD83C\uDFE2', title: 'Office Backdrop', desc: 'Professional office setting' },
  { id: 'enhance', icon: '\u2728', title: 'Enhance Photo', desc: 'Sharpen, color, lighting' },
  { id: 'headshot-pro', icon: '\uD83D\uDC64', title: 'Pro Headshot', desc: 'Studio-quality headshot' },
  { id: 'remove-objects', icon: '\uD83E\uDDF9', title: 'Remove Objects', desc: 'Clean up clutter' },
  { id: 'upscale', icon: '\uD83D\uDD0D', title: 'Upscale 2x', desc: 'Double resolution (Sharp)' },
  { id: 'brand-filter', icon: '\uD83C\uDFA8', title: 'Brand Filter', desc: 'Color grade with brand colors' },
  { id: 'logo-cleanup', icon: '\u2B50', title: 'Logo Cleanup', desc: 'Crisp lines, remove noise' },
]

export default function PhotoFixerPage() {
  const [step, setStep] = useState<'upload' | 'choose' | 'processing' | 'result'>('upload')
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [selectedFix, setSelectedFix] = useState<FixType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [brandColors, setBrandColors] = useState({ primary: '#1B365D', secondary: '#4A90D9' })

  const handleFile = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError('File must be under 10MB'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Only JPG, PNG, WebP accepted'); return }
    setError(null)
    const reader = new FileReader()
    reader.onload = () => { setOriginalImage(reader.result as string); setStep('choose') }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  async function applyFix() {
    if (!originalImage || !selectedFix) return
    setStep('processing'); setError(null)
    try {
      const res = await fetch('/api/fix-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: originalImage,
          fixType: selectedFix,
          options: selectedFix === 'brand-filter' ? { brandColors } : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fix failed')
      setResultImage(data.image); setStep('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('choose')
    }
  }

  async function useAsProfilePhoto() {
    if (!resultImage) return
    const blob = await fetch(resultImage).then(r => r.blob())
    const formData = new FormData()
    formData.append('file', blob, 'fixed-photo.png')
    formData.append('type', 'headshot')
    const res = await fetch('/api/upload-photo', { method: 'POST', body: formData })
    if (res.ok) alert('Profile photo updated!')
    else alert('Failed to update profile photo')
  }

  async function useAsBrandLogo() {
    if (!resultImage) return
    const blob = await fetch(resultImage).then(r => r.blob())
    const formData = new FormData()
    formData.append('file', blob, 'fixed-logo.png')
    const res = await fetch('/api/upload-logo', { method: 'POST', body: formData })
    if (res.ok) alert('Brand logo updated!')
    else alert('Failed to update brand logo')
  }

  function downloadResult() {
    if (!resultImage) return
    const a = document.createElement('a')
    a.href = resultImage; a.download = 'fixed-photo.png'; a.click()
  }

  function reset() {
    setStep('upload'); setOriginalImage(null); setResultImage(null); setSelectedFix(null); setError(null)
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>AI Photo Fixer</h1>
          <p>Upload any photo and apply AI-powered fixes and enhancements.</p>
        </div>
        <Link href="/settings" className="btn btn-soft">Back to Settings</Link>
      </div>

      {error && (
        <div style={{ borderRadius: 10, background: 'var(--rose-light, #fde8e8)', padding: '10px 16px', fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="settings-card" style={{ textAlign: 'center' }}>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            style={{
              border: `2px dashed ${dragOver ? 'var(--mint)' : 'var(--border)'}`,
              borderRadius: 10, padding: '48px 24px', cursor: 'pointer',
              background: dragOver ? 'rgba(168,240,212,0.08)' : 'var(--bg-soft)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>{'\uD83D\uDCF7'}</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Drop your photo here</p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>JPG, PNG, or WebP up to 10MB</p>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              Choose File
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </label>
          </div>
        </div>
      )}

      {/* Step 2: Choose Fix */}
      {step === 'choose' && originalImage && (
        <div>
          <div className="settings-card" style={{ textAlign: 'center', marginBottom: 16 }}>
            <img src={originalImage} alt="Original" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 10, objectFit: 'contain' }} />
            <div style={{ marginTop: 8 }}>
              <button onClick={reset} className="btn btn-soft btn-sm">Change Photo</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {FIX_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setSelectedFix(opt.id)}
                style={{
                  padding: '16px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                  background: 'white', border: selectedFix === opt.id ? '2px solid var(--mint)' : '1px solid var(--border-light)',
                  transition: 'all 0.15s',
                }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{opt.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{opt.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{opt.desc}</div>
              </button>
            ))}
          </div>

          {selectedFix === 'brand-filter' && (
            <div className="settings-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Brand Colors</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  Primary <input type="color" value={brandColors.primary} onChange={(e) => setBrandColors(p => ({ ...p, primary: e.target.value }))} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  Secondary <input type="color" value={brandColors.secondary} onChange={(e) => setBrandColors(p => ({ ...p, secondary: e.target.value }))} />
                </label>
              </div>
            </div>
          )}

          <button onClick={applyFix} disabled={!selectedFix} className="btn btn-primary" style={{ width: '100%' }}>
            Apply Fix
          </button>
        </div>
      )}

      {/* Step 3: Processing */}
      {step === 'processing' && (
        <div className="settings-card" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--mint)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 16, fontWeight: 700 }}>Fixing your photo...</p>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>This usually takes 10-20 seconds</p>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 'result' && originalImage && resultImage && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="settings-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--ink-soft)' }}>Before</div>
              <img src={originalImage} alt="Before" style={{ maxHeight: 280, maxWidth: '100%', borderRadius: 10, objectFit: 'contain' }} />
            </div>
            <div className="settings-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--mint-darker, #2d7a4f)' }}>After</div>
              <img src={resultImage} alt="After" style={{ maxHeight: 280, maxWidth: '100%', borderRadius: 10, objectFit: 'contain' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={downloadResult} className="btn btn-primary">Download</button>
            <button onClick={useAsProfilePhoto} className="btn btn-soft">Use as Profile Photo</button>
            <button onClick={useAsBrandLogo} className="btn btn-soft">Use as Brand Logo</button>
            <button onClick={() => { setResultImage(null); setSelectedFix(null); setStep('choose') }} className="btn btn-soft">Try Another Fix</button>
            <button onClick={reset} className="btn btn-soft">Start Over</button>
          </div>
        </div>
      )}
    </div>
  )
}
