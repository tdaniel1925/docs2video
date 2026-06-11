'use client'

import { useState, useRef } from 'react'

type Step = 'info' | 'results'

interface SignatureResult {
  style: string
  html: string
  previewUrl: string
}

const STEP_LABELS = [
  { key: 'info', label: '1. Your Info' },
  { key: 'results', label: '2. Your Signatures' },
]

function getStepIndex(step: Step): number {
  return STEP_LABELS.findIndex(s => s.key === step)
}

export default function EmailSignaturePage() {
  const [step, setStep] = useState<Step>('info')

  // Step 1 state
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#2c5282')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Step 2 state
  const [generating, setGenerating] = useState(false)
  const [signatures, setSignatures] = useState<SignatureResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)

  const logoInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File | null, type: 'logo' | 'photo') => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (type === 'logo') {
        setLogoFile(file)
        setLogoPreview(dataUrl)
      } else {
        setPhotoFile(file)
        setPhotoPreview(dataUrl)
      }
    }
    reader.readAsDataURL(file)
  }

  const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) return null
      const data = await res.json()
      return data.url || null
    } catch {
      return null
    }
  }

  const handleGenerate = async () => {
    setStep('results')
    setGenerating(true)
    setError(null)
    setSignatures([])

    try {
      // Upload files if provided
      let logoUrl: string | undefined
      let photoUrl: string | undefined

      if (logoFile) {
        const url = await uploadFile(logoFile)
        if (url) logoUrl = url
      }
      if (photoFile) {
        const url = await uploadFile(photoFile)
        if (url) photoUrl = url
      }

      const res = await fetch('/api/generate-email-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          title: title || undefined,
          company: company || undefined,
          email: email || undefined,
          phone: phone || undefined,
          website: website || undefined,
          logoUrl,
          photoUrl,
          primaryColor,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate signatures')
      }

      const data = await res.json()
      setSignatures(data.signatures)
      setSelectedIndex(0)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyHtml = async (html: string, index: number) => {
    try {
      await navigator.clipboard.writeText(html)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = html
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }
  }

  const handleDownload = (html: string, style: string) => {
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fullName} - ${style} Email Signature</title></head><body style="margin:20px;font-family:Arial,sans-serif;">${html}</body></html>`
    const blob = new Blob([fullHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `email-signature-${style.toLowerCase()}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleRestart = () => {
    setStep('info')
    setSignatures([])
    setError(null)
    setSelectedIndex(0)
  }

  const currentStepIndex = getStepIndex(step)

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    fontSize: 15,
    background: 'var(--bg-card, #fff)',
    color: 'var(--ink)',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
        Email Signature Generator
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 32 }}>
        Create professional email signatures in 5 different styles.
      </p>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
        {STEP_LABELS.map((s, i) => (
          <div
            key={s.key}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i <= currentStepIndex ? 'var(--mint)' : 'var(--border)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {/* Step 1: Info */}
      {step === 'info' && (
        <div className="wizard-card">
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Your info</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            Enter the details for your email signature.
          </p>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Full Name <span style={{ color: 'var(--error, #e53e3e)' }}>*</span>
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="Your full name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Job Title
              </label>
              <input
                type="text"
                className="input-text"
                placeholder="e.g. Marketing Director"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Company Name
              </label>
              <input
                type="text"
                className="input-text"
                placeholder="Your company"
                value={company}
                onChange={e => setCompany(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Email
              </label>
              <input
                type="email"
                className="input-text"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Phone
              </label>
              <input
                type="text"
                className="input-text"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Website
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="www.yourcompany.com"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* File uploads */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Logo (optional)
              </label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handleFileSelect(e.target.files?.[0] || null, 'logo')}
              />
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => logoInputRef.current?.click()}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}
              >
                {logoPreview ? 'Change Logo' : 'Upload Logo'}
              </button>
              {logoPreview && (
                <div style={{ marginTop: 8, textAlign: 'center' }}>
                  <img src={logoPreview} alt="Logo preview" style={{ maxHeight: 40, maxWidth: '100%' }} />
                </div>
              )}
            </div>
            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Photo (optional)
              </label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handleFileSelect(e.target.files?.[0] || null, 'photo')}
              />
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => photoInputRef.current?.click()}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}
              >
                {photoPreview ? 'Change Photo' : 'Upload Photo'}
              </button>
              {photoPreview && (
                <div style={{ marginTop: 8, textAlign: 'center' }}>
                  <img src={photoPreview} alt="Photo preview" style={{ maxHeight: 50, maxWidth: '100%', borderRadius: '50%' }} />
                </div>
              )}
            </div>
          </div>

          {/* Color picker */}
          <div style={{ marginBottom: 24 }}>
            <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Primary Color
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                style={{ width: 44, height: 36, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: 2 }}
              />
              <input
                type="text"
                className="input-text"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                style={{ ...inputStyle, width: 120 }}
              />
            </div>
          </div>

          <button
            className="btn btn-mint"
            disabled={!fullName.trim()}
            onClick={handleGenerate}
            style={{ width: '100%', padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600 }}
          >
            Generate 5 Signatures
          </button>
          <div style={{
            textAlign: 'center', marginTop: 12, padding: '10px 16px',
            background: 'var(--bg-soft, #f8fafc)', borderRadius: 10,
            border: '1px solid var(--border, #e2e8f0)',
            fontSize: 13, color: 'var(--ink-soft)',
          }}>
            Email Signatures (5 styles) — <strong style={{ color: 'var(--ink)' }}>$9</strong>
          </div>
        </div>
      )}

      {/* Step 2: Results */}
      {step === 'results' && (
        <div className="wizard-card">
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Your email signatures</h2>

          {generating && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ maxWidth: 360, margin: '0 auto 20px', height: 6, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 10, background: 'var(--mint)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  width: '60%',
                }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
                Generating 5 signature styles...
              </div>
            </div>
          )}

          {error && !generating && (
            <div style={{
              padding: '16px 20px',
              borderRadius: 10,
              background: 'rgba(229,62,62,0.08)',
              border: '1px solid rgba(229,62,62,0.2)',
              color: '#e53e3e',
              fontSize: 14,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {!generating && signatures.length > 0 && (
            <>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
                Click any signature to select it, then copy the HTML or download the file.
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button
                  className="btn btn-soft"
                  onClick={handleRestart}
                  style={{ padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
                >
                  Create Another
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {signatures.map((sig, i) => (
                  <div
                    key={sig.style}
                    onClick={() => setSelectedIndex(i)}
                    style={{
                      border: selectedIndex === i ? `2px solid var(--mint)` : '1px solid var(--border)',
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: 'var(--bg-card, #fff)',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    {/* Header */}
                    <div style={{
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border)',
                      background: selectedIndex === i ? 'rgba(72,187,120,0.05)' : 'transparent',
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                        {sig.style}
                        {selectedIndex === i && (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: 'var(--mint)', textTransform: 'uppercase' }}>
                            Selected
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-soft"
                          onClick={(e) => { e.stopPropagation(); handleCopyHtml(sig.html, i) }}
                          style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12 }}
                        >
                          {copiedIndex === i ? 'Copied!' : 'Copy HTML'}
                        </button>
                        <button
                          className="btn btn-soft"
                          onClick={(e) => { e.stopPropagation(); handleDownload(sig.html, sig.style) }}
                          style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12 }}
                        >
                          Download
                        </button>
                      </div>
                    </div>

                    {/* Preview */}
                    <div
                      style={{ padding: '20px 24px', background: '#ffffff' }}
                      dangerouslySetInnerHTML={{ __html: sig.html }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {!generating && signatures.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              No signatures generated yet.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
