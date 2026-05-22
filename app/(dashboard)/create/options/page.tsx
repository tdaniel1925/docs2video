'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../_lib/supabase/client'
import { VOICE_OPTIONS } from '../../../_lib/types'
import type { Brand } from '../../../_lib/types'

const VOICE_SAMPLES: Record<string, string> = {
  nova: 'Hello, I\'m Sarah. I have a warm, friendly voice that\'s perfect for explainer videos and client presentations.',
  shimmer: 'Hi there, I\'m Emily. My voice is clear and approachable, great for educational content.',
  onyx: 'Hello, I\'m James. My voice carries authority and depth, ideal for professional reports.',
  echo: 'Hey, I\'m Michael. I have a conversational tone that works well for casual presentations.',
  alloy: 'Hello, I\'m Alex. My voice is neutral and versatile, suitable for any type of content.',
  fable: 'Good day, I\'m Oliver. I bring an expressive, storytelling quality to your narration.',
}

export default function OptionsPage() {
  const router = useRouter()
  const [createState, setCreateState] = useState<any>(null)
  const [selectedVoice, setSelectedVoice] = useState<string>(VOICE_OPTIONS[0].id)
  const [aiMusic, setAiMusic] = useState(false)
  const [musicPrompt, setMusicPrompt] = useState('')
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [outputFormat, setOutputFormat] = useState<'video' | 'deck'>('video')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookingUrl, setBookingUrl] = useState('')
  const [paymentLink, setPaymentLink] = useState('')
  const [playingVoice, setPlayingVoice] = useState<string | null>(null)
  const [generatingPreview, setGeneratingPreview] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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
      const policyData = { ...state.extractedData, contactPhone: state.contactPhone, contactEmail: state.contactEmail, contactWebsite: state.contactWebsite, pricingInfo: state.pricingInfo, ctaUrl: state.ctaUrl }

      if (outputFormat === 'deck') {
        // DECK OUTPUT — generate slides as PPTX, no audio
        const slides = (state.scenes || []).map((s: any) => ({
          headline: s.slideData?.headline || s.title || '',
          subheadline: s.subtitle || '',
          bodyPoints: s.slideData?.bullets || (s.narration?.split(/[.!?]+/).filter((t: string) => t.trim().length > 10).slice(0, 4).map((t: string) => t.trim())) || [],
          stats: s.slideData?.stats || [],
          slideType: s.scene === 1 ? 'cover' : s.scene === (state.scenes || []).length ? 'closing' : 'content',
        }))

        const deckRes = await fetch('/api/generate-deck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: state.extractedData?.title || 'Presentation',
            slides,
            brandId: selectedBrand,
            primaryColor: state.extractedData?.primaryColor,
            secondaryColor: state.extractedData?.secondaryColor,
          }),
        })
        const deckData = await deckRes.json()
        if (!deckRes.ok) throw new Error(typeof deckData.error === 'string' ? deckData.error : JSON.stringify(deckData.error) || 'Deck generation failed')

        localStorage.removeItem('d2v_create')
        // Redirect to the deck download or dashboard
        if (deckData.url) {
          window.open(deckData.url, '_blank')
          router.push('/dashboard')
        } else {
          router.push('/dashboard')
        }
        return
      }

      // VIDEO OUTPUT — create record + trigger pipeline
      const createRes = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyData, brandId: selectedBrand, voiceId: selectedVoice }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(typeof createData.error === 'string' ? createData.error : JSON.stringify(createData.error) || 'Failed to create video')

      await supabase.from('videos').update({
        script: {
          _pipeline_input: {
            policyData, brandId: selectedBrand, voiceId: selectedVoice,
            styleId: state.themeAccepted ? 'custom-url-theme' : undefined,
            customStylePrompt: state.customStylePrompt || undefined,
            narrationStyle: state.narrationStyle || 'solo',
            aiMusic, musicPrompt: aiMusic ? musicPrompt : undefined,
            scenes: state.scenes, purpose: state.purpose,
            industry: state.extractedData?.industry || 'general',
            bookingUrl: bookingUrl.trim() || undefined,
            paymentLink: paymentLink.trim() || undefined,
          },
        },
      }).eq('id', createData.id)

      const genRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: createData.id, policyData, brandId: selectedBrand, voiceId: selectedVoice,
          styleId: state.themeAccepted ? 'custom-url-theme' : undefined,
          customStylePrompt: state.customStylePrompt || undefined,
          narrationStyle: state.narrationStyle || 'solo',
          aiMusic, musicPrompt: aiMusic ? musicPrompt : undefined,
          preGeneratedScenes: state.scenes, purpose: state.purpose,
          industry: state.extractedData?.industry || 'general',
          bookingUrl: bookingUrl.trim() || undefined,
          paymentLink: paymentLink.trim() || undefined,
        }),
      })
      const genData = await genRes.json()
      if (!genRes.ok) {
        setError(genData.error || 'Video pipeline failed to start. Your video was saved but generation may not have started.')
        setGenerating(false)
        return
      }

      localStorage.removeItem('d2v_create')
      router.push(`/create/generating?id=${createData.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err)
      setError(msg || 'Generation failed')
      setGenerating(false)
    }
  }

  async function previewVoice(voiceId: string) {
    if (playingVoice === voiceId) {
      audioRef.current?.pause()
      setPlayingVoice(null)
      return
    }
    if (audioRef.current) audioRef.current.pause()
    setGeneratingPreview(voiceId)
    try {
      const res = await fetch('/api/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: VOICE_SAMPLES[voiceId] || 'Hello, this is a voice preview.', voiceId }),
      })
      if (!res.ok) throw new Error('Preview failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => setPlayingVoice(null)
      audio.play()
      audioRef.current = audio
      setPlayingVoice(voiceId)
    } catch { /* skip */ }
    setGeneratingPreview(null)
  }

  if (!createState) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
  }

  return (
    <div style={{
      flex: 1, padding: '40px 24px', maxWidth: 800, margin: '0 auto', width: '100%',
    }}>

      <div style={{ animation: 'fadeInUp 0.4s ease' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Final options
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 40, lineHeight: 1.6 }}>
          Choose a voice, add music, and select your brand.
        </p>

        {/* Output format */}
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Output format</h3>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>Choose what to create from your script.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
          <button
            onClick={() => setOutputFormat('video')}
            style={{
              padding: '20px', borderRadius: 14,
              border: outputFormat === 'video' ? '2px solid var(--mint)' : '2px solid var(--border-light)',
              background: outputFormat === 'video' ? 'rgba(168,240,212,0.06)' : 'white',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>&#127909;</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Video</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>Narrated video with slides, voice, and music. MP4 download + share page.</div>
          </button>
          <button
            onClick={() => setOutputFormat('deck')}
            style={{
              padding: '20px', borderRadius: 14,
              border: outputFormat === 'deck' ? '2px solid var(--mint)' : '2px solid var(--border-light)',
              background: outputFormat === 'deck' ? 'rgba(168,240,212,0.06)' : 'white',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>&#128202;</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Slide Deck</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>PPTX presentation with designed slides. No audio, just visuals. Download and present.</div>
          </button>
        </div>

        {/* Voice selection — only for video */}
        {outputFormat === 'video' && (
        <>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Voice</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 32 }}>
          {VOICE_OPTIONS.map(voice => (
            <div
              key={voice.id}
              onClick={() => setSelectedVoice(voice.id)}
              style={{
                padding: '16px', borderRadius: 12,
                border: selectedVoice === voice.id ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                background: selectedVoice === voice.id ? 'rgba(168,240,212,0.06)' : 'white',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{voice.name}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); previewVoice(voice.id) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                    fontWeight: 600, color: playingVoice === voice.id ? 'var(--mint-darker, #2d7a4f)' : 'var(--ink-light)',
                    fontFamily: 'inherit', padding: '2px 6px',
                  }}
                >
                  {generatingPreview === voice.id ? '...' : playingVoice === voice.id ? '■ Stop' : '▶ Preview'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>{voice.description}</div>
            </div>
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
        </>
        )}

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

        {/* Share page links */}
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Share page buttons <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-light)' }}>(optional)</span></h3>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>Add links so viewers can book a call or make a payment directly from your video&apos;s share page.</p>
        <div style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4, display: 'block' }}>Booking link</label>
            <input
              type="url"
              value={bookingUrl}
              onChange={e => setBookingUrl(e.target.value)}
              placeholder="Paste your Calendly, Cal.com, or any booking URL"
              style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4, display: 'block' }}>Payment link</label>
            <input
              type="url"
              value={paymentLink}
              onChange={e => setPaymentLink(e.target.value)}
              placeholder="Paste your Stripe, PayPal, Square, or any payment URL"
              style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>
        </div>

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
            {generating ? (outputFormat === 'deck' ? 'Creating your deck...' : 'Creating your video...') : (outputFormat === 'deck' ? 'Generate Deck →' : 'Generate Video →')}
          </button>
        </div>
      </div>
    </div>
  )
}
