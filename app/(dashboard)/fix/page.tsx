'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useToast } from '../../_components/Toast'

type FixType = 'remove-background' | 'swap-background-studio' | 'swap-background-office' | 'enhance' | 'headshot-pack' | 'remove-objects' | 'upscale' | 'brand-filter' | 'logo-cleanup'

const FIX_OPTIONS: { id: FixType; icon: string; title: string; desc: string }[] = [
  { id: 'remove-background', icon: '\u{1F5BC}\uFE0F', title: 'Remove BG', desc: 'Transparent or white background' },
  { id: 'swap-background-studio', icon: '\uD83D\uDCF8', title: 'Studio Backdrop', desc: 'Clean studio gradient' },
  { id: 'swap-background-office', icon: '\uD83C\uDFE2', title: 'Office Backdrop', desc: 'Professional office setting' },
  { id: 'enhance', icon: '\u2728', title: 'Enhance Photo', desc: 'Sharpen, color, lighting' },
  { id: 'headshot-pack', icon: '\uD83D\uDC64', title: 'Headshot Pack', desc: '5 professional headshot styles from one photo' },
  { id: 'remove-objects', icon: '\uD83E\uDDF9', title: 'Remove Objects', desc: 'Clean up clutter' },
  { id: 'upscale', icon: '\uD83D\uDD0D', title: 'Upscale 2x', desc: 'Double resolution (Sharp)' },
  { id: 'brand-filter', icon: '\uD83C\uDFA8', title: 'Brand Filter', desc: 'Color grade with brand colors' },
  { id: 'logo-cleanup', icon: '\u2B50', title: 'Logo Cleanup', desc: 'Crisp lines, remove noise' },
]

const HEADSHOT_LABELS = ['Studio', 'Outdoor', 'Office', 'Executive', 'LinkedIn']

export default function PhotoFixerPage() {
  const notify = useToast()
  const [step, setStep] = useState<'upload' | 'choose' | 'processing' | 'result'>('upload')
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [headshotImages, setHeadshotImages] = useState<string[]>([])
  const [selectedHeadshots, setSelectedHeadshots] = useState<boolean[]>([])
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
      if (selectedFix === 'headshot-pack' && data.images) {
        setHeadshotImages(data.images)
        setSelectedHeadshots(new Array(data.images.length).fill(false))
      } else {
        setResultImage(data.image)
      }
      setStep('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('choose')
    }
  }

  async function useAsProfilePhoto(imgSrc?: string) {
    const src = imgSrc || resultImage
    if (!src) return
    const blob = await fetch(src).then(r => r.blob())
    const formData = new FormData()
    formData.append('file', blob, 'fixed-photo.png')
    formData.append('type', 'headshot')
    const res = await fetch('/api/upload-photo', { method: 'POST', body: formData })
    if (res.ok) notify('Profile photo updated!', 'success')
    else notify('Failed to update profile photo', 'error')
  }

  async function useAsBrandLogo() {
    if (!resultImage) return
    const blob = await fetch(resultImage).then(r => r.blob())
    const formData = new FormData()
    formData.append('file', blob, 'fixed-logo.png')
    const res = await fetch('/api/upload-logo', { method: 'POST', body: formData })
    if (res.ok) notify('Brand logo updated!', 'success')
    else notify('Failed to update brand logo', 'error')
  }

  function downloadImage(src: string, name: string) {
    const a = document.createElement('a')
    a.href = src; a.download = name; a.click()
  }

  function downloadResult() { if (resultImage) downloadImage(resultImage, 'fixed-photo.png') }

  function downloadSelected() {
    headshotImages.forEach((img, i) => {
      if (selectedHeadshots[i]) downloadImage(img, `headshot-${HEADSHOT_LABELS[i].toLowerCase()}.png`)
    })
  }

  function downloadAllHeadshots() {
    headshotImages.forEach((img, i) => downloadImage(img, `headshot-${HEADSHOT_LABELS[i].toLowerCase()}.png`))
  }

  function toggleHeadshot(idx: number) {
    setSelectedHeadshots(prev => { const n = [...prev]; n[idx] = !n[idx]; return n })
  }

  function tryAnotherFix() { setResultImage(null); setHeadshotImages([]); setSelectedFix(null); setStep('choose') }

  function reset() {
    setStep('upload'); setOriginalImage(null); setResultImage(null)
    setHeadshotImages([]); setSelectedHeadshots([]); setSelectedFix(null); setError(null)
  }

  const isHeadshotResult = selectedFix === 'headshot-pack' && headshotImages.length > 0

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
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
          <p style={{ fontSize: 16, fontWeight: 700 }}>
            {selectedFix === 'headshot-pack' ? 'Generating 5 headshot styles...' : 'Fixing your photo...'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            {selectedFix === 'headshot-pack' ? 'This takes about 30 seconds' : 'This usually takes 10-20 seconds'}
          </p>
        </div>
      )}

      {/* Step 4: Result — Before/After */}
      {step === 'result' && !isHeadshotResult && originalImage && resultImage && (
        <div>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0, alignItems: 'stretch' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Before</div>
                <div style={{ height: 300, background: 'var(--bg-soft)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={originalImage} alt="Before" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                </div>
              </div>
              <div style={{ width: 1, background: 'var(--border)', margin: '28px 16px 0' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--mint-darker, #2d7a4f)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>After</div>
                <div style={{ height: 300, background: 'var(--bg-soft)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={resultImage} alt="After" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => useAsProfilePhoto()} className="btn btn-primary">Use as Profile Photo</button>
            <button onClick={downloadResult} className="btn btn-primary" style={{ background: 'var(--ink)' }}>Download</button>
            <button onClick={useAsBrandLogo} className="btn btn-soft">Use as Brand Logo</button>
            <button onClick={tryAnotherFix} className="btn btn-soft">Try Another Fix</button>
            <button onClick={reset} className="btn btn-soft">Start Over</button>
          </div>
        </div>
      )}

      {/* Step 4: Result — Headshot Pack Grid */}
      {step === 'result' && isHeadshotResult && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }} className="headshot-grid">
            {headshotImages.map((img, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 10, textAlign: 'center', position: 'relative' }}>
                <label style={{ position: 'absolute', top: 8, left: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedHeadshots[i] || false} onChange={() => toggleHeadshot(i)} style={{ width: 16, height: 16 }} />
                </label>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>{HEADSHOT_LABELS[i]}</div>
                <div style={{ height: 180, background: 'var(--bg-soft)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <img src={img} alt={HEADSHOT_LABELS[i]} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                </div>
                <button onClick={() => useAsProfilePhoto(img)} className="btn btn-soft btn-sm" style={{ width: '100%', fontSize: 11 }}>
                  Use as Profile
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={downloadSelected} disabled={!selectedHeadshots.some(Boolean)} className="btn btn-primary">Download Selected</button>
            <button onClick={downloadAllHeadshots} className="btn btn-primary" style={{ background: 'var(--ink)' }}>Download All</button>
            <button onClick={tryAnotherFix} className="btn btn-soft">Try Another Fix</button>
            <button onClick={reset} className="btn btn-soft">Start Over</button>
          </div>
          <style>{`
            @media (max-width: 900px) { .headshot-grid { grid-template-columns: repeat(3, 1fr) !important; } }
            @media (max-width: 600px) { .headshot-grid { grid-template-columns: 1fr !important; } }
          `}</style>
        </div>
      )}

      <style>{`
        @media (max-width: 600px) {
          [style*="gridTemplateColumns: 1fr auto 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
