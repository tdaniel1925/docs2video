'use client'
import { tidyUrlInput } from '../../../_lib/normalize-url'

import { useState, useRef, use } from 'react'
import { PageHead } from '../../../_components/marketing/PageHead'
import { useToast } from '../../../_components/Toast'

const DEMO_VIDEO_URL = 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/hero-video.mp4'

function toTitleCase(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export default function TryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string; email?: string; url?: string }> }) {
  const { slug } = use(params)
  const sp = use(searchParams)
  const notify = useToast()
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
        .catch(() => notify('Upload failed. Please try again.', 'error'))
      return
    }
    const params = new URLSearchParams()
    params.set('url', url)
    if (sp.email) params.set('email', sp.email)
    window.location.href = `/try/${slug}/creating?${params.toString()}`
  }

  return (
    <>
      <PageHead kicker={companyName ? `A free demo for ${companyName}` : 'Try it free'} title={headline} sub="Turn a document or website into a short, branded, narrated video." />

      {/* Demo video */}
      <section className="hp-sample" aria-label="A sample video">
        <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--d2v-page)' }}>
          <video
            ref={videoRef}
            src={DEMO_VIDEO_URL}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            playsInline
            onEnded={() => setPlaying(false)}
          />
          {!playing && (
            <button onClick={handlePlay} aria-label="Play the sample video" className="hp-play-cover">
              <span className="hp-play" aria-hidden="true">▶</span>
            </button>
          )}
        </div>
      </section>

      {/* Try it yourself */}
      <section className="hp-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }} aria-labelledby="try-title">
        <h2 id="try-title" className="hp-h3">Try it free with <span className="hp-blue">your own content</span></h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            onBlur={() => setUrl((v) => tidyUrlInput(v))}
            className="input"
            aria-label="Your website or document link"
            placeholder="Paste your website or document URL"
            value={url}
            onChange={e => { setUrl(e.target.value); setFile(null) }}
          />
          <div className="hp-row" style={{ gap: 12 }}>
            <span style={{ flex: 1, height: 1, background: 'var(--d2v-line)' }} />
            <span className="hp-caps hp-dim">or</span>
            <span style={{ flex: 1, height: 1, background: 'var(--d2v-line)' }} />
          </div>
          <button type="button" className="btn btn-soft btn-full" onClick={() => fileRef.current?.click()}>
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
          <button className="btn btn-primary btn-lg btn-full" onClick={handleCreate} disabled={!url && !file}>
            Create my free video &rarr;
          </button>
          <p className="hp-small">No signup required. Your first video is free.</p>
        </div>
      </section>

      {/* Benefits */}
      <section className="hp-grid" aria-label="What you get">
        {[
          { title: 'Start from a document', desc: 'A PDF or your website' },
          { title: 'Branded with your colors', desc: 'Your logo and colors' },
          { title: 'Share one link', desc: 'Plays on any phone or laptop' },
        ].map(b => (
          <div key={b.title} className="hp-card">
            <span className="hp-check" aria-hidden="true">✓ </span><h3>{b.title}</h3>
            <p className="hp-small">{b.desc}</p>
          </div>
        ))}
      </section>
    </>
  )
}
