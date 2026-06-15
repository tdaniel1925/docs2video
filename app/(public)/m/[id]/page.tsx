'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'

interface CampaignContact {
  id: string
  campaign_id: string
  name: string
  email: string
  company: string | null
  industry: string | null
  video_id: string | null
  video_watched_at: string | null
  unsubscribed: boolean
}

interface Campaign {
  discount_code: string
  discount_pct: number
  discount_months: number
}

interface Video {
  id: string
  video_url: string | null
  thumbnail_url: string | null
  slide_urls: string[] | null
  music_url: string | null
  title: string | null
}

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://docs2video.com'

export default function MarketingWatchPage() {
  const params = useParams()
  const [contact, setContact] = useState<CampaignContact | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [video, setVideo] = useState<Video | null>(null)
  const [notFound, setNotFound] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const musicRef = useRef<HTMLAudioElement>(null)
  const viewTracked = useRef(false)
  const [musicVolume, setMusicVolume] = useState(0.01)
  const [musicMuted, setMusicMuted] = useState(false)

  useEffect(() => {
    async function load() {
      const contactId = params.id as string

      // Read via the server endpoint (campaign tables are no longer anon-readable
      // after the RLS security fix — the endpoint uses the service role, scoped).
      let data: any = null
      try {
        const res = await fetch(`/api/public/campaign-view/${contactId}`)
        if (!res.ok) { setNotFound(true); return }
        data = await res.json()
      } catch {
        setNotFound(true)
        return
      }

      if (!data?.contact) { setNotFound(true); return }
      setContact(data.contact)
      if (data.campaign) setCampaign(data.campaign)
      if (data.video) setVideo(data.video)

      // Track analytics view once (server already recorded video_watched_at).
      if (!viewTracked.current) {
        viewTracked.current = true
        if (data.contact.video_id) {
          fetch('/api/track-view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId: data.contact.video_id, event: 'view', metadata: { source: 'campaign', contactId } }),
          }).catch(() => {})
        }
      }
    }
    load()
  }, [params.id])

  if (notFound) {
    return (
      <div style={rootStyle}>
        <style>{pageCSS}</style>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Video Not Found</h1>
            <p style={{ fontSize: 15, color: '#666' }}>This video may have been removed or the link is invalid.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!contact || !video) {
    return (
      <div style={rootStyle}>
        <style>{pageCSS}</style>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      </div>
    )
  }

  const signupUrl = `/signup?email=${encodeURIComponent(contact.email)}&ref=${encodeURIComponent(campaign?.discount_code ?? '')}`

  return (
    <div style={rootStyle}>
      <style>{pageCSS}</style>

      {/* Header */}
      <header style={headerStyle}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#1a1a1a' }}>Docs2Video</h1>
        <span style={{ fontSize: 12, color: '#888' }}>Personalized for {contact.name}</span>
      </header>

      {/* Video Section */}
      <div style={contentStyle}>
        <div style={videoWrapStyle}>
          <video
            ref={videoRef}
            src={video.video_url!}
            poster={video.thumbnail_url ?? undefined}
            controls
            autoPlay
            playsInline
            onPlay={() => {
              if (musicRef.current && video?.music_url) musicRef.current.play().catch(() => {})
            }}
            onPause={() => {
              if (musicRef.current) musicRef.current.pause()
            }}
            onSeeking={() => {
              if (musicRef.current && videoRef.current) {
                const musicDur = musicRef.current.duration
                if (musicDur && musicDur > 0) {
                  musicRef.current.currentTime = videoRef.current.currentTime % musicDur
                }
              }
            }}
            style={{ width: '100%', display: 'block', borderRadius: 10 }}
          />
          {video.music_url && (
            <audio
              ref={musicRef}
              src={video.music_url}
              loop
              preload="auto"
              style={{ display: 'none' }}
            />
          )}
        </div>

        {/* Music volume control */}
        {video.music_url && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 0 16px',
            fontSize: 12,
            color: '#666',
          }}>
            <button
              onClick={() => {
                setMusicMuted(m => {
                  const next = !m
                  if (musicRef.current) musicRef.current.muted = next
                  return next
                })
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                color: musicMuted ? '#aaa' : '#666',
              }}
              title={musicMuted ? 'Unmute music' : 'Mute music'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
                {musicMuted && <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" />}
              </svg>
            </button>
            <span style={{ fontWeight: 600, minWidth: 40 }}>Music</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={musicMuted ? 0 : musicVolume}
              onChange={e => {
                const v = parseFloat(e.target.value)
                setMusicVolume(v)
                setMusicMuted(v === 0)
                if (musicRef.current) {
                  musicRef.current.volume = v
                  musicRef.current.muted = v === 0
                }
              }}
              style={{ flex: 1, maxWidth: 140 }}
            />
            <span style={{ fontSize: 11, color: '#999', minWidth: 30 }}>
              {musicMuted ? 'Off' : `${Math.round(musicVolume * 100)}%`}
            </span>
          </div>
        )}

        {/* CTA Section */}
        {campaign && (
          <div style={ctaSectionStyle}>
            <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', color: '#1a1a1a' }}>
              Ready to try it?
            </h2>
            <p style={{ fontSize: 16, color: '#444', margin: '0 0 20px', lineHeight: 1.5 }}>
              Get {campaign.discount_pct}% off for {campaign.discount_months} months
            </p>

            {/* Discount Code */}
            <div style={discountBoxStyle}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#166534', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your exclusive code</p>
              <div style={codeBoxStyle}>
                <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: 3, color: '#1a1a1a' }}>{campaign.discount_code}</span>
              </div>
            </div>

            {/* CTA Button */}
            <a href={signupUrl} style={ctaButtonStyle}>
              Start Free
            </a>
            <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>
              Start free with 2 short videos.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={footerStyle}>
        <p style={{ fontSize: 11, color: '#999', margin: 0 }}>
          Docs2Video -- Turn any document into a professional video explainer.
          <br />
          <a href="/privacy" style={{ color: '#999' }}>Privacy Policy</a>
          {!contact.unsubscribed && (
            <>
              {' | '}
              <a href={`/unsubscribe/${contact.id}`} style={{ color: '#999' }}>Unsubscribe</a>
            </>
          )}
        </p>
      </footer>
    </div>
  )
}

// Styles
const rootStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafb',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 32px',
  borderBottom: '1px solid #e8edf2',
  background: '#fff',
}

const contentStyle: React.CSSProperties = {
  maxWidth: 800,
  margin: '0 auto',
  padding: '32px 24px',
}

const videoWrapStyle: React.CSSProperties = {
  background: '#000',
  borderRadius: 10,
  overflow: 'hidden',
  marginBottom: 32,
  border: '1px solid #e2e2e2',
}

const ctaSectionStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '32px 0',
}

const discountBoxStyle: React.CSSProperties = {
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: 10,
  padding: 24,
  textAlign: 'center',
  marginBottom: 24,
}

const codeBoxStyle: React.CSSProperties = {
  display: 'inline-block',
  background: '#fff',
  border: '2px dashed #4ade80',
  borderRadius: 8,
  padding: '12px 28px',
}

const ctaButtonStyle: React.CSSProperties = {
  display: 'inline-block',
  background: '#C7E8A8',
  color: '#1a1a1a',
  padding: '16px 48px',
  borderRadius: 10,
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: 17,
}

const footerStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '24px 0',
  borderTop: '1px solid #e8edf2',
}

const pageCSS = `
  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid #e2e2e2;
    border-top-color: #1a1a1a;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`
