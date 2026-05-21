'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ScriptPage() {
  const router = useRouter()
  const [createState, setCreateState] = useState<any>(null)
  const [detailLevel, setDetailLevel] = useState<'quick' | 'standard' | 'detailed'>('standard')
  const [narrationStyle, setNarrationStyle] = useState<'solo' | 'podcast'>('solo')
  const [scenes, setScenes] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    setCreateState(state)
    if (state.detailLevel) setDetailLevel(state.detailLevel)
    if (state.narrationStyle) setNarrationStyle(state.narrationStyle)
    if (state.scenes) setScenes(state.scenes)
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyData: state.extractedData,
          brandId: state.selectedBrand || state.autoBrandId,
          detailed: detailLevel === 'detailed',
          detailLevel,
          narrationStyle,
          purpose: state.purpose,
          industry: state.extractedData?.industry || 'general',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Script generation failed')

      setScenes(data.scenes)
      state.scenes = data.scenes
      state.detailLevel = detailLevel
      state.narrationStyle = narrationStyle
      localStorage.setItem('d2v_create', JSON.stringify(state))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate script')
    }
    setGenerating(false)
  }

  function handleContinue() {
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    state.scenes = scenes
    state.detailLevel = detailLevel
    state.narrationStyle = narrationStyle
    localStorage.setItem('d2v_create', JSON.stringify(state))
    router.push('/create/options')
  }

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
          {scenes.length > 0 ? 'Your script' : 'Configure your video'}
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 40, lineHeight: 1.6 }}>
          {scenes.length > 0 ? 'Edit the narration for each scene. This is what the voice will say.' : 'Choose the length and style, then generate your script.'}
        </p>

        {scenes.length === 0 && (
          <>
            {/* Detail level */}
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Video length</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
              {[
                { id: 'quick' as const, title: 'Highlights', desc: '30-60 seconds', sub: '3-4 slides' },
                { id: 'standard' as const, title: 'Standard', desc: '2-4 minutes', sub: '8-14 slides' },
                { id: 'detailed' as const, title: 'Detailed', desc: '5-10 minutes', sub: '15-25 slides' },
              ].map(level => (
                <button
                  key={level.id}
                  onClick={() => setDetailLevel(level.id)}
                  style={{
                    padding: '24px 20px', borderRadius: 14,
                    border: detailLevel === level.id ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                    background: detailLevel === level.id ? 'rgba(168,240,212,0.06)' : 'white',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{level.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-light)', marginBottom: 2 }}>{level.desc}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{level.sub}</div>
                </button>
              ))}
            </div>

            {/* Narration style */}
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Narration style</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
              <button
                onClick={() => setNarrationStyle('solo')}
                style={{
                  padding: '24px 20px', borderRadius: 14,
                  border: narrationStyle === 'solo' ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                  background: narrationStyle === 'solo' ? 'rgba(168,240,212,0.06)' : 'white',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Solo Narrator</div>
                <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>One professional voice. Clean, focused, traditional.</div>
              </button>
              <button
                onClick={() => setNarrationStyle('podcast')}
                style={{
                  padding: '24px 20px', borderRadius: 14,
                  border: narrationStyle === 'podcast' ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                  background: narrationStyle === 'podcast' ? 'rgba(168,240,212,0.06)' : 'white',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Two Narrators</div>
                <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>Professional discussion format. More engaging.</div>
              </button>
            </div>

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14, marginBottom: 20 }}>
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                width: '100%', padding: '18px', borderRadius: 12, border: 'none',
                background: 'var(--ink)', color: 'white', fontSize: 17, fontWeight: 700,
                cursor: generating ? 'wait' : 'pointer', fontFamily: 'inherit',
                opacity: generating ? 0.7 : 1, transition: 'opacity 0.2s',
              }}
            >
              {generating ? 'Generating script...' : 'Generate Script →'}
            </button>
          </>
        )}

        {/* Script editor */}
        {scenes.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 20, textAlign: 'center' }}>
              {scenes.length} scenes &middot; ~{Math.round(scenes.reduce((sum: number, s: any) => sum + (s.narration?.split(/\s+/).length || 0), 0) / 2.5)}s estimated
            </div>

            {scenes.map((scene: any, i: number) => (
              <div key={i} style={{
                marginBottom: 16, borderRadius: 14, padding: 20,
                background: 'white', border: '1px solid var(--border-light)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%', background: 'var(--mint)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 13, flexShrink: 0,
                  }}>{i + 1}</span>
                  <input
                    type="text"
                    value={scene.title}
                    onChange={e => {
                      const updated = [...scenes]
                      updated[i] = { ...updated[i], title: e.target.value }
                      setScenes(updated)
                    }}
                    style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 16, flex: 1, outline: 'none', color: 'var(--ink)', fontFamily: 'inherit' }}
                  />
                </div>
                <textarea
                  value={scene.narration}
                  onChange={e => {
                    const updated = [...scenes]
                    updated[i] = { ...updated[i], narration: e.target.value }
                    setScenes(updated)
                  }}
                  style={{
                    width: '100%', minHeight: 80, resize: 'vertical', border: '1px solid var(--border-light)',
                    borderRadius: 8, padding: 12, fontSize: 14, lineHeight: 1.6,
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>
                  ~{Math.round((scene.narration?.split(/\s+/).length || 0) / 2.5)}s &middot; {scene.narration?.split(/\s+/).length || 0} words
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => { setScenes([]); setError(null) }} style={{
                padding: '16px 28px', borderRadius: 12, border: '2px solid var(--border)',
                background: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-soft)', fontFamily: 'inherit',
              }}>
                Regenerate
              </button>
              <button onClick={handleContinue} style={{
                flex: 1, padding: '16px 28px', borderRadius: 12, border: 'none',
                background: 'var(--ink)', color: 'white', fontSize: 17, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Continue to options &rarr;
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
