'use client'

import { useState } from 'react'

// Use an existing slide thumbnail from a completed video as the test image
const SAMPLE_SLIDES = [
  {
    label: 'Latest video thumbnail',
    url: 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/0e28a48c-978c-4bf0-93c3-6769229c85cc/68f973c2-dbfc-48e8-a241-6b50e852cdd1_thumb.png',
  },
  {
    label: 'Blue Steps template',
    url: '/style-previews/blue-steps.png',
  },
  {
    label: 'Art Deco template',
    url: '/style-previews/art-deco.png',
  },
]

const TEST_PROMPTS = [
  {
    label: 'Animate slide data',
    prompt: 'Smoothly animate the infographic data shown in @Image1. Numbers should count up and reveal, chart bars should grow from the bottom, text should fade in section by section. Keep the exact layout and design. Subtle camera zoom in. Professional, polished motion graphics feel.',
  },
  {
    label: 'Cinematic intro',
    prompt: 'Create a cinematic intro animation from @Image1. Start with a dramatic zoom out revealing the full infographic. Add subtle particle effects and light flares. The title text should have a premium reveal animation. Background should have a subtle gradient shift. Professional corporate video feel.',
  },
  {
    label: 'Ken Burns style',
    prompt: 'Apply a slow, cinematic Ken Burns pan and zoom effect to @Image1. Start zoomed into the top-left section, slowly pan across the data, then zoom out to reveal the full slide. Smooth, documentary-style camera movement. No text animation, just elegant camera work.',
  },
  {
    label: 'Pure text-to-video (no image)',
    prompt: 'A sleek, modern motion graphics animation showing financial data appearing on a dark blue background. Numbers count up: "$500,000" in large white text, then "$10,000 Annual" appears below. A bar chart grows from left to right showing growth over 30 years. Professional corporate explainer video style. 16:9 landscape.',
  },
]

export default function TestSeedancePage() {
  const [selectedSlide, setSelectedSlide] = useState(0)
  const [selectedPrompt, setSelectedPrompt] = useState(0)
  const [customPrompt, setCustomPrompt] = useState('')
  const [duration, setDuration] = useState('8')
  const [resolution, setResolution] = useState('720p')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ videoUrl?: string; error?: string; seed?: number } | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const isTextOnly = selectedPrompt === 3

  async function handleGenerate() {
    setGenerating(true)
    setResult(null)
    setElapsed(0)

    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000)

    const prompt = customPrompt || TEST_PROMPTS[selectedPrompt].prompt

    try {
      const res = await fetch('/api/test-seedance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: isTextOnly ? 'text-to-video' : 'image-to-video',
          imageUrl: isTextOnly ? undefined : SAMPLE_SLIDES[selectedSlide].url,
          prompt,
          duration,
          resolution,
        }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Failed' })
    }

    clearInterval(timer)
    setGenerating(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #F4F1EC)', padding: 32, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Seedance 2.0 Test Lab</h1>
        <p style={{ fontSize: 14, color: '#8A968D', marginBottom: 32 }}>Test animated video generation from your existing slides</p>

        {/* Source image selection */}
        {!isTextOnly && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8 }}>Source slide</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {SAMPLE_SLIDES.map((slide, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedSlide(i)}
                  style={{
                    border: selectedSlide === i ? '2px solid #6FA13A' : '2px solid #E5DFD3',
                    borderRadius: 10,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    width: 200,
                    transition: 'border-color 0.15s',
                  }}
                >
                  <img src={slide.url} alt={slide.label} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{slide.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prompt selection */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8 }}>Animation style</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {TEST_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => { setSelectedPrompt(i); setCustomPrompt('') }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: selectedPrompt === i ? '#0F1A12' : 'white',
                  color: selectedPrompt === i ? '#C7E8A8' : '#0F1A12',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <textarea
            value={customPrompt || TEST_PROMPTS[selectedPrompt].prompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            style={{
              width: '100%',
              minHeight: 80,
              padding: 14,
              borderRadius: 10,
              border: '1.5px solid #E5DFD3',
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>

        {/* Settings */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Duration</label>
            <select value={duration} onChange={(e) => setDuration(e.target.value)} style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #E5DFD3', fontSize: 13 }}>
              <option value="4">4 sec</option>
              <option value="6">6 sec</option>
              <option value="8">8 sec</option>
              <option value="10">10 sec</option>
              <option value="12">12 sec</option>
              <option value="15">15 sec</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Resolution</label>
            <select value={resolution} onChange={(e) => setResolution(e.target.value)} style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #E5DFD3', fontSize: 13 }}>
              <option value="480p">480p (fast)</option>
              <option value="720p">720p (balanced)</option>
              <option value="1080p">1080p (best)</option>
            </select>
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding: '14px 32px',
            borderRadius: 10,
            border: 'none',
            background: generating ? '#8A968D' : '#0F1A12',
            color: '#C7E8A8',
            fontSize: 15,
            fontWeight: 700,
            cursor: generating ? 'default' : 'pointer',
            marginBottom: 24,
          }}
        >
          {generating ? `Generating... ${elapsed}s` : 'Generate with Seedance 2.0'}
        </button>

        {generating && (
          <div style={{ padding: 24, background: 'white', borderRadius: 10, border: '1px solid #E5DFD3', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 24, height: 24, border: '3px solid #C7E8A8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Seedance is working...</div>
                <div style={{ fontSize: 12, color: '#8A968D' }}>
                  {elapsed < 15 ? 'Queuing request...' :
                   elapsed < 45 ? 'Generating video frames...' :
                   elapsed < 90 ? 'Rendering and encoding...' :
                   'Almost done — finalizing...'}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12, height: 4, background: '#E5DFD3', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: '#C7E8A8',
                borderRadius: 2,
                transition: 'width 1s ease',
                width: elapsed < 15 ? '10%' : elapsed < 45 ? '40%' : elapsed < 90 ? '70%' : '90%',
              }} />
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5DFD3', overflow: 'hidden' }}>
            {result.error ? (
              <div style={{ padding: 24, color: '#b91c1c' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Error</div>
                <div style={{ fontSize: 13 }}>{result.error}</div>
              </div>
            ) : result.videoUrl ? (
              <>
                <video
                  src={result.videoUrl}
                  controls
                  autoPlay
                  style={{ width: '100%', display: 'block' }}
                />
                <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Generated in {elapsed}s</div>
                    <div style={{ fontSize: 12, color: '#8A968D' }}>Seed: {result.seed ?? 'N/A'}</div>
                  </div>
                  <a
                    href={result.videoUrl}
                    download="seedance-test.mp4"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '8px 18px',
                      borderRadius: 10,
                      background: '#0F1A12',
                      color: '#C7E8A8',
                      fontSize: 13,
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    Download MP4
                  </a>
                </div>
              </>
            ) : (
              <div style={{ padding: 24, color: '#8A968D' }}>No video returned</div>
            )}
          </div>
        )}

        {/* Cost estimate */}
        <div style={{ marginTop: 24, padding: 16, background: '#FAF7F2', borderRadius: 10, fontSize: 12, color: '#8A968D' }}>
          <strong>Estimated cost:</strong> ~${(parseInt(duration) * 0.15).toFixed(2)} for {duration}s at {resolution} • Seedance 2.0 via fal.ai
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
