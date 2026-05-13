'use client'

import { useState, useCallback } from 'react'

export default function DemoSlidePage() {
  const [logo, setLogo] = useState<string | null>(null)
  const [logoName, setLogoName] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [prompt, setPrompt] = useState('Create a professional 1920x1080 infographic slide about this company. Include the logo prominently. Add a contact bar at the bottom. Make it look like a premium presentation slide with data visualizations and clean typography.')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      setLogo(reader.result as string)
      setLogoName(file.name)
    }
    reader.readAsDataURL(file)
  }, [])

  async function handleGenerate() {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/demo-slide-gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoImage: logo || undefined,
          prompt,
          companyName: companyName || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setResult(data.image)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>GPT-4o Slide Demo</h1>
          <p>Test GPT-4o image generation with logo placement. Upload a logo and see the results.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Left — Controls */}
        <div style={{ width: '40%' }}>
          <div className="wizard-card">
            {/* Logo upload */}
            <div style={{ marginBottom: 20 }}>
              <label className="input-label" style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                Company Logo
              </label>
              {logo ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg-soft)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
                  <img src={logo} alt="Logo" style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 8, background: 'white', padding: 4 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{logoName}</div>
                    <button onClick={() => { setLogo(null); setLogoName(null) }} className="btn btn-soft btn-sm" style={{ marginTop: 4 }}>Remove</button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*'
                    input.onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f) }
                    input.click()
                  }}
                  style={{
                    border: dragOver ? '2px solid var(--mint)' : '2px dashed var(--border)',
                    borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
                    background: dragOver ? 'rgba(168,240,212,0.1)' : 'var(--bg-soft)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 6 }}>+</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Drop logo or click to upload</div>
                </div>
              )}
            </div>

            {/* Company name */}
            <div style={{ marginBottom: 20 }}>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                Company Name
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Gulf Coast Alloys"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
              />
            </div>

            {/* Prompt */}
            <div style={{ marginBottom: 20 }}>
              <label className="input-label" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                Prompt
              </label>
              <textarea
                className="input"
                style={{ minHeight: 120, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              {loading ? 'Generating with GPT-4o...' : 'Generate Slide'}
            </button>

            {error && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(192,58,31,0.1)', fontSize: 13, color: '#C03A1F' }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right — Result */}
        <div style={{ width: '60%' }}>
          {loading && (
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--border-light)', padding: '80px 32px', textAlign: 'center' }}>
              <div className="spinner" style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>GPT-4o is generating your slide...</div>
              <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 6 }}>This takes 15-30 seconds</div>
            </div>
          )}

          {result && !loading && (
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--border-light)', overflow: 'hidden' }}>
              <img src={result} alt="Generated slide" style={{ width: '100%', display: 'block' }} />
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: 13, color: 'var(--ink-light)' }}>Generated with GPT-4o</span>
                <button
                  onClick={() => {
                    const a = document.createElement('a')
                    a.href = result
                    a.download = 'gpt4o-slide.png'
                    a.click()
                  }}
                  className="btn btn-soft btn-sm"
                >
                  Download
                </button>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--border-light)', padding: '80px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.3 }}>🖼️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-soft)' }}>Your slide will appear here</div>
              <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 6 }}>Upload a logo and click Generate</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
