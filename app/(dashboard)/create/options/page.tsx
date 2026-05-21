'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../_lib/supabase/client'
import { VOICE_OPTIONS } from '../../../_lib/types'
import type { Brand } from '../../../_lib/types'

export default function OptionsPage() {
  const router = useRouter()
  const [createState, setCreateState] = useState<any>(null)
  const [selectedVoice, setSelectedVoice] = useState<string>(VOICE_OPTIONS[0].id)
  const [aiMusic, setAiMusic] = useState(false)
  const [musicPrompt, setMusicPrompt] = useState('')
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    setCreateState(state)
    if (state.selectedBrand || state.autoBrandId) setSelectedBrand(state.selectedBrand || state.autoBrandId)

    const supabase = createClient()
    supabase.from('brands').select('*').order('is_default', { ascending: false }).then(({ data }) => {
      if (data) setBrands(data as Brand[])
    })
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)

    try {
      const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
      const supabase = createClient()

      // Create video record
      const createRes = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyData: state.extractedData,
          brandId: selectedBrand,
          voiceId: selectedVoice,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create video')

      // Save pipeline input
      await supabase.from('videos').update({
        script: {
          _pipeline_input: {
            policyData: state.extractedData,
            brandId: selectedBrand,
            voiceId: selectedVoice,
            styleId: state.themeAccepted ? 'custom-url-theme' : undefined,
            customStylePrompt: state.customStylePrompt || undefined,
            narrationStyle: state.narrationStyle || 'solo',
            aiMusic,
            musicPrompt: aiMusic ? musicPrompt : undefined,
            scenes: state.scenes,
            purpose: state.purpose,
            industry: state.extractedData?.industry || 'general',
          },
        },
      }).eq('id', createData.id)

      // Clean up
      localStorage.removeItem('d2v_create')

      // Navigate to generating page
      router.push(`/create/generating?id=${createData.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setGenerating(false)
    }
  }

  if (!createState) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
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
          Final options
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 40, lineHeight: 1.6 }}>
          Choose a voice, add music, and select your brand.
        </p>

        {/* Voice selection */}
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Voice</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 32 }}>
          {VOICE_OPTIONS.map(voice => (
            <button
              key={voice.id}
              onClick={() => setSelectedVoice(voice.id)}
              style={{
                padding: '16px', borderRadius: 12,
                border: selectedVoice === voice.id ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                background: selectedVoice === voice.id ? 'rgba(168,240,212,0.06)' : 'white',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{voice.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>{voice.description}</div>
            </button>
          ))}
        </div>

        {/* Music */}
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Background music</h3>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => setAiMusic(false)}
            style={{
              padding: '14px 24px', borderRadius: 10,
              border: !aiMusic ? '2px solid var(--mint)' : '2px solid var(--border-light)',
              background: !aiMusic ? 'rgba(168,240,212,0.06)' : 'white',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            No Music
          </button>
          <button
            onClick={() => {
              setAiMusic(true)
              if (!musicPrompt) setMusicPrompt('Professional ambient background music, subtle and warm')
            }}
            style={{
              padding: '14px 24px', borderRadius: 10,
              border: aiMusic ? '2px solid var(--mint)' : '2px solid var(--border-light)',
              background: aiMusic ? 'rgba(168,240,212,0.06)' : 'white',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            AI Music
          </button>
        </div>
        {aiMusic && (
          <input
            type="text"
            value={musicPrompt}
            onChange={e => setMusicPrompt(e.target.value)}
            placeholder="Describe the music style..."
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)',
              fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 32,
            }}
          />
        )}
        {!aiMusic && <div style={{ height: 32 }} />}

        {/* Brand selection */}
        {brands.length > 0 && (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Brand</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
              <button
                onClick={() => setSelectedBrand(null)}
                style={{
                  padding: '12px 20px', borderRadius: 10,
                  border: !selectedBrand ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                  background: !selectedBrand ? 'rgba(168,240,212,0.06)' : 'white',
                  cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                }}
              >
                No brand
              </button>
              {brands.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBrand(b.id)}
                  style={{
                    padding: '12px 20px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8,
                    border: selectedBrand === b.id ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                    background: selectedBrand === b.id ? 'rgba(168,240,212,0.06)' : 'white',
                    cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                  }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: b.primary_color }} />
                  {b.name}
                </button>
              ))}
            </div>
          </>
        )}

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Generate */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => router.push('/create/script')} style={{
            padding: '16px 28px', borderRadius: 12, border: '2px solid var(--border)',
            background: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-soft)', fontFamily: 'inherit',
          }}>
            &larr; Back
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              flex: 1, padding: '18px 28px', borderRadius: 12, border: 'none',
              background: generating ? 'var(--ink-soft)' : 'var(--ink)', color: 'white',
              fontSize: 18, fontWeight: 800, cursor: generating ? 'wait' : 'pointer',
              fontFamily: 'inherit', letterSpacing: '-0.02em',
            }}
          >
            {generating ? 'Creating your video...' : 'Generate Video →'}
          </button>
        </div>
      </div>
    </div>
  )
}
