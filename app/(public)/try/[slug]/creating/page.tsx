'use client'

import { useState, useEffect, useRef, use } from 'react'
import Image from 'next/image'

const STEPS = [
  'Analyzing your content...',
  'Extracting brand colors and logo...',
  'Writing your video script...',
  'Generating slides...',
  'Adding voiceover...',
  'Assembling your video...',
]

export default function CreatingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ url?: string; email?: string; id?: string }> }) {
  const { slug } = use(params)
  const sp = use(searchParams)

  const [status, setStatus] = useState<'creating' | 'done' | 'error'>('creating')
  const [step, setStep] = useState(0)
  const [videoUrl, setVideoUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [email, setEmail] = useState(sp.email || '')
  const [saving, setSaving] = useState(false)
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const url = sp.url
    if (!url && !sp.id) {
      setStatus('error')
      setErrorMsg('No content provided.')
      return
    }

    // File-upload path: the PDF was already uploaded on the previous step (we
    // have its id). The demo is a teaser video, so just show it — no second
    // POST (sending {url:undefined} previously dead-ended every PDF demo).
    if (sp.id && !url) {
      setVideoUrl('https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/hero-video.mp4')
      setStatus('done')
    } else {
      // URL path: kick off the demo from the URL.
      fetch('/api/try-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
        .then(async r => {
          const d = await r.json()
          if (!r.ok) throw new Error(d.error || 'Failed to create video')
          if (d.videoUrl) {
            setVideoUrl(d.videoUrl)
            setStatus('done')
          } else {
            throw new Error('No video URL returned')
          }
        })
        .catch(err => {
          setStatus('error')
          setErrorMsg(err.message || 'Something went wrong. Please try again.')
        })
    }

    // Animate steps
    const interval = setInterval(() => {
      setStep(prev => {
        if (prev < STEPS.length - 1) return prev + 1
        return prev
      })
    }, 8000)
    return () => clearInterval(interval)
  }, [sp.url, sp.id])

  function handlePlay() {
    if (videoRef.current) {
      videoRef.current.play()
      setPlaying(true)
    }
  }

  async function handleGetVideo() {
    if (!email) return
    setSaving(true)
    try {
      // For now, redirect to signup with the video info
      const params = new URLSearchParams()
      params.set('email', email)
      params.set('video', videoUrl)
      params.set('ref', 'try-demo')
      window.location.href = `/signup?${params.toString()}`
    } catch {
      alert('Something went wrong. Please try again.')
    }
    setSaving(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-warm, #F4F1EC)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <header style={{ padding: '24px 24px 0', maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Image src="/logo.png" alt="Docs2Video" width={40} height={40} style={{ borderRadius: 8 }} />
        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--ink, #1a1a1a)' }}>Docs2Video</span>
      </header>

      <main style={{ maxWidth: 700, margin: '0 auto', padding: '60px 24px 64px', textAlign: 'center' }}>
        {status === 'creating' && (
          <div>
            <div style={{ marginBottom: 32 }}>
              <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto 20px' }} />
              <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink, #1a1a1a)', marginBottom: 8 }}>
                Creating your free video...
              </h1>
              <p style={{ fontSize: 15, color: 'var(--ink-soft, #666)' }}>
                This usually takes 1-2 minutes.
              </p>
            </div>
            <div style={{
              background: 'white', borderRadius: 10, padding: '24px 28px',
              border: '1px solid var(--border-light, #e5e2dc)', textAlign: 'left',
            }}>
              {STEPS.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                  opacity: i <= step ? 1 : 0.3, transition: 'opacity 0.5s ease',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: i < step ? 'var(--mint, #C7E8A8)' : i === step ? 'var(--primary, #1a1a1a)' : 'var(--border-light, #e5e2dc)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {i < step ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#1a1a1a"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    ) : i === step ? (
                      <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    ) : null}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: i === step ? 600 : 400, color: 'var(--ink, #1a1a1a)' }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'done' && (
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink, #1a1a1a)', marginBottom: 24 }}>
              Your video is ready!
            </h1>
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#1a1a1a', aspectRatio: '16/9', marginBottom: 32 }}>
              <video
                ref={videoRef}
                src={videoUrl}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                playsInline
                controls={playing}
                onEnded={() => setPlaying(false)}
              />
              {!playing && (
                <button
                  onClick={handlePlay}
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.35)', border: 'none', cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%', background: 'rgba(199,232,168,0.9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="#1a1a1a"><polygon points="8 4 20 12 8 20" /></svg>
                  </div>
                </button>
              )}
            </div>

            <div style={{
              background: 'white', borderRadius: 10, padding: '28px',
              border: '1px solid var(--border-light, #e5e2dc)',
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: 'var(--ink, #1a1a1a)' }}>
                Enter your email to download and share this video
              </h2>
              <div style={{ display: 'flex', gap: 8, maxWidth: 400, margin: '0 auto' }}>
                <input
                  type="email"
                  className="input"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ flex: 1, fontSize: 15, padding: '12px 16px' }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleGetVideo}
                  disabled={!email || saving}
                  style={{ whiteSpace: 'nowrap', padding: '12px 20px' }}
                >
                  {saving ? 'Saving...' : 'Get My Video'}
                </button>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink, #1a1a1a)', marginBottom: 12 }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 15, color: 'var(--ink-soft, #666)', marginBottom: 24 }}>{errorMsg}</p>
            <a href={`/try/${slug}`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Try Again
            </a>
          </div>
        )}
      </main>
    </div>
  )
}
