'use client'

import { useState, useCallback } from 'react'

type Provider = 'openai' | 'gemini'

export default function DemoSlidePage() {
  const [logo, setLogo] = useState<string | null>(null)
  const [logoName, setLogoName] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [prompt, setPrompt] = useState('Take this logo and create a stunning, cinematic presentation slide. Use photorealistic AI-generated backgrounds with depth and lighting. Bold modern typography. Premium agency pitch deck quality. 1920x1080.')
  const [dragOver, setDragOver] = useState(false)

  // Results per provider
  const [results, setResults] = useState<Record<Provider, string | null>>({ openai: null, gemini: null })
  const [loading, setLoading] = useState<Record<Provider, boolean>>({ openai: false, gemini: false })
  const [errors, setErrors] = useState<Record<Provider, string | null>>({ openai: null, gemini: null })
  const [times, setTimes] = useState<Record<Provider, number>>({ openai: 0, gemini: 0 })

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => { setLogo(reader.result as string); setLogoName(file.name) }
    reader.readAsDataURL(file)
  }, [])

  async function generateSingle(provider: Provider) {
    setLoading(prev => ({ ...prev, [provider]: true }))
    setErrors(prev => ({ ...prev, [provider]: null }))
    setResults(prev => ({ ...prev, [provider]: null }))
    const start = Date.now()

    try {
      const res = await fetch('/api/demo-slide-gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoImage: logo || undefined, prompt, companyName: companyName || undefined, provider }),
      })
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch { throw new Error(text.slice(0, 200)) }
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResults(prev => ({ ...prev, [provider]: data.image }))
      setTimes(prev => ({ ...prev, [provider]: Math.round((Date.now() - start) / 1000) }))
    } catch (err) {
      setErrors(prev => ({ ...prev, [provider]: err instanceof Error ? err.message : 'Failed' }))
    } finally {
      setLoading(prev => ({ ...prev, [provider]: false }))
    }
  }

  function generateAll() {
    generateSingle('openai')
    generateSingle('gemini')
  }

  const providers: { id: Provider; label: string; desc: string; color: string }[] = [
    { id: 'openai', label: 'GPT-image-2', desc: 'Best for logos + hero visuals', color: '#10a37f' },
    { id: 'gemini', label: 'Gemini 3 Pro', desc: 'Editorial infographic style', color: '#4285f4' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>Slide Provider Comparison</h1>
          <p>Compare GPT-image-2 vs Gemini side by side. Same logo, same prompt, different providers.</p>
        </div>
      </div>

      {/* Controls */}
      <div className="wizard-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 16, alignItems: 'start' }}>
          {/* Logo */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>Logo</label>
            {logo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: 'var(--bg-soft)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                <img src={logo} alt="Logo" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 6, background: 'white', padding: 2 }} />
                <div style={{ flex: 1, fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{logoName}</div>
                  <button onClick={() => { setLogo(null); setLogoName(null) }} style={{ background: 'none', border: 'none', color: '#c03a1f', fontSize: 11, cursor: 'pointer', padding: 0 }}>Remove</button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f) }; i.click() }}
                style={{ border: dragOver ? '2px solid var(--mint)' : '2px dashed var(--border)', borderRadius: 8, padding: '20px 12px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(168,240,212,0.1)' : 'var(--bg-soft)', fontSize: 12, fontWeight: 600 }}
              >
                Drop logo here
              </div>
            )}
          </div>

          {/* Company */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>Company</label>
            <input type="text" className="input" placeholder="Company name" value={companyName} onChange={e => setCompanyName(e.target.value)} />
          </div>

          {/* Prompt */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>Prompt</label>
            <textarea className="input" style={{ minHeight: 70, resize: 'vertical', fontSize: 13, lineHeight: 1.5 }} value={prompt} onChange={e => setPrompt(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={generateAll} disabled={loading.openai || loading.gemini} className="btn btn-primary" style={{ flex: 1 }}>
            {loading.openai || loading.gemini ? 'Generating...' : 'Generate Both'}
          </button>
          {providers.map(p => (
            <button key={p.id} onClick={() => generateSingle(p.id)} disabled={loading[p.id]} className="btn btn-soft" style={{ borderLeft: `3px solid ${p.color}` }}>
              {loading[p.id] ? `${p.label}...` : p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {providers.map(p => (
          <div key={p.id} style={{ background: 'white', borderRadius: 10, border: '1px solid var(--border-light)', overflow: 'hidden' }}>
            {/* Provider header */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, color: p.color }}>{p.label}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-light)', marginLeft: 8 }}>{p.desc}</span>
              </div>
              {times[p.id] > 0 && results[p.id] && (
                <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>{times[p.id]}s</span>
              )}
            </div>

            {/* Result area */}
            <div style={{ minHeight: 300 }}>
              {loading[p.id] && (
                <div style={{ padding: '80px 24px', textAlign: 'center' }}>
                  <div className="spinner" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: p.color }}>{p.label} generating...</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>15-45 seconds</div>
                </div>
              )}

              {errors[p.id] && !loading[p.id] && (
                <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#c03a1f', fontWeight: 600, marginBottom: 8 }}>Failed</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)', maxWidth: 300, margin: '0 auto' }}>{errors[p.id]}</div>
                  <button onClick={() => generateSingle(p.id)} className="btn btn-soft btn-sm" style={{ marginTop: 12 }}>Retry</button>
                </div>
              )}

              {results[p.id] && !loading[p.id] && (
                <>
                  <img src={results[p.id]!} alt={`${p.label} result`} style={{ width: '100%', display: 'block' }} />
                  <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>{times[p.id]}s · {p.label}</span>
                    <button onClick={() => {
                      const a = document.createElement('a')
                      a.href = results[p.id]!
                      a.download = `${p.id}-slide.png`
                      a.click()
                    }} className="btn btn-soft btn-sm">Download</button>
                  </div>
                </>
              )}

              {!results[p.id] && !loading[p.id] && !errors[p.id] && (
                <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--ink-light)' }}>
                  <div style={{ fontSize: 13 }}>Click Generate to see result</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
