'use client'

import { useState, useRef, use } from 'react'
import Image from 'next/image'

const DEMO_VIDEO_URL = 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/hero-video.mp4'

function toTitleCase(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export default function TryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string; email?: string; url?: string }> }) {
  const { slug } = use(params)
  const sp = use(searchParams)
  const companyName = slug && slug !== 'demo' ? toTitleCase(slug) : ''
  const headline = companyName
    ? `See what Docs2Video can do for ${companyName}`
    : 'Try Docs2Video free — no signup required'

  const [url, setUrl] = useState(sp.url || '')
  const [file, setFile] = useState<File | null>(null)
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handlePlay() {
    if (videoRef.current) {
      videoRef.current.play()
      setPlaying(true)
    }
  }

  function handleCreate() {
    if (!url && !file) return
    if (file) {
      // Upload file via form submission
      const formData = new FormData()
      formData.append('file', file)
      fetch('/api/try-demo', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(d => {
          if (d.id) {
            window.location.href = `/try/${slug}/creating?id=${d.id}&email=${encodeURIComponent(sp.email || '')}`
          }
        })
        .catch(() => alert('Upload failed. Please try again.'))
      return
    }
    const params = new URLSearchParams()
    params.set('url', url)
    if (sp.email) params.set('email', sp.email)
    window.location.href = `/try/${slug}/creating?${params.toString()}`
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-warm, #F4F1EC)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <header style={{ padding: '24px 24px 0', maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Image src="/logo.png" alt="Docs2Video" width={40} height={40} style={{ borderRadius: 8 }} />
        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--ink, #1a1a1a)' }}>Docs2Video</span>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px 64px' }}>
        {/* Headline */}
        <section style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink, #1a1a1a)', marginBottom: 8, lineHeight: 1.2 }}>
            {headline}
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-soft, #666)', maxWidth: 500, margin: '0 auto' }}>
            Turn any document or website into a professional branded video in minutes.
          </p>
        </section>

        {/* Demo Video */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#1a1a1a', aspectRatio: '16/9' }}>
            <video
              ref={videoRef}
              src={DEMO_VIDEO_URL}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              playsInline
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
        </section>

        {/* Try It Yourself */}
        <section style={{
          background: 'white', borderRadius: 10, padding: '32px 28px',
          border: '1px solid var(--border-light, #e5e2dc)', marginBottom: 48,
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, textAlign: 'center', color: 'var(--ink, #1a1a1a)' }}>
            Try it free with your own content
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500, margin: '0 auto' }}>
            <input
              type="url"
              className="input"
              placeholder="Paste your website or document URL"
              value={url}
              onChange={e => { setUrl(e.target.value); setFile(null) }}
              style={{ width: '100%', fontSize: 15, padding: '12px 16px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-light, #e5e2dc)' }} />
              <span style={{ fontSize: 13, color: 'var(--ink-soft, #666)', fontWeight: 600 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-light, #e5e2dc)' }} />
            </div>
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => fileRef.current?.click()}
              style={{ width: '100%', fontSize: 14, padding: '12px 16px' }}
            >
              {file ? file.name : 'Upload a PDF'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) { setFile(f); setUrl('') }
              }}
            />
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!url && !file}
              style={{ width: '100%', fontSize: 16, padding: '14px 24px', fontWeight: 700, marginTop: 4 }}
            >
              Create My Free Video &rarr;
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft, #666)', textAlign: 'center', marginTop: 12 }}>
            No signup required. Your first video is free.
          </p>
        </section>

        {/* Benefits */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 48 }}>
          {[
            { icon: '📄', title: 'Upload any document', desc: 'Video in 2 minutes' },
            { icon: '🎨', title: 'Branded with YOUR colors', desc: 'Logo, fonts, and palette' },
            { icon: '📈', title: 'Clients watch 3x more', desc: 'Than PDFs or emails' },
          ].map(b => (
            <div key={b.title} style={{
              background: 'white', borderRadius: 10, padding: '24px 20px',
              border: '1px solid var(--border-light, #e5e2dc)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{b.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--ink, #1a1a1a)' }}>{b.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--ink-soft, #666)', margin: 0 }}>{b.desc}</p>
            </div>
          ))}
        </section>

        {/* Testimonial */}
        <section style={{
          background: 'white', borderRadius: 10, padding: '28px 24px',
          border: '1px solid var(--border-light, #e5e2dc)', textAlign: 'center', marginBottom: 48,
        }}>
          <p style={{ fontSize: 16, fontStyle: 'italic', color: 'var(--ink, #1a1a1a)', lineHeight: 1.6, marginBottom: 12 }}>
            &ldquo;I sent a client a Docs2Video instead of a PDF and they called me back within an hour.
            They said they actually understood the policy for the first time.&rdquo;
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-soft, #666)', fontWeight: 600 }}>
            &mdash; Insurance Agent, Financial Services
          </p>
        </section>

        {/* Footer */}
        <footer style={{ textAlign: 'center', padding: '24px 0', borderTop: '1px solid var(--border-light, #e5e2dc)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Image src="/logo.png" alt="Docs2Video" width={24} height={24} style={{ borderRadius: 4 }} />
            <span style={{ fontSize: 13, color: 'var(--ink-soft, #666)' }}>Powered by Docs2Video</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
