'use client'

import { useState, useEffect } from 'react'

interface SocialShareButtonProps {
  creationId: string
  creationType: string
  title: string
  imageUrl?: string
}

const PLATFORMS = [
  { id: 'twitter', label: 'X / Twitter', icon: 'X' },
  { id: 'facebook', label: 'Facebook', icon: 'f' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'in' },
  { id: 'instagram', label: 'Instagram', icon: 'IG' },
]

export default function SocialShareButton({ creationId, creationType, title, imageUrl }: SocialShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [posting, setPosting] = useState<string | null>(null)
  const [result, setResult] = useState<{ message: string; credits: number } | null>(null)
  const [shareStatus, setShareStatus] = useState<{ canEarnMore: boolean; sharesRemaining: number; creditsPerShare: number } | null>(null)

  useEffect(() => {
    if (open) {
      fetch('/api/social-share')
        .then(r => r.json())
        .then(data => setShareStatus(data))
        .catch(() => {})
    }
  }, [open])

  async function handleShare(platform: string) {
    setPosting(platform)
    setResult(null)
    try {
      const res = await fetch('/api/social-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          creationId,
          creationType,
          message: `Check out "${title}" — made with Docs2Video! Create professional videos, infographics & more with AI. #Docs2Video #AI`,
          imageUrl,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ message: data.message, credits: data.creditsAwarded })
        // Refresh status
        fetch('/api/social-share').then(r => r.json()).then(d => setShareStatus(d)).catch(() => {})
      } else {
        setResult({ message: data.error || 'Failed to post', credits: 0 })
      }
    } catch {
      setResult({ message: 'Network error', credits: 0 })
    }
    setPosting(null)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-soft" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Share
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 10, padding: '28px 32px',
            width: 420, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Share to Social Media</h3>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-light)' }}>&times;</button>
            </div>

            {shareStatus?.canEarnMore && (
              <div style={{
                background: 'rgba(168,240,212,0.15)', border: '1px solid var(--mint)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 18 }}>&#127873;</span>
                <span>
                  Earn <strong>{shareStatus.creditsPerShare} free credits</strong> per share!
                  {shareStatus.sharesRemaining > 0 && ` (${shareStatus.sharesRemaining} shares left this month)`}
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleShare(p.id)}
                  disabled={posting !== null}
                  style={{
                    padding: '14px 16px', borderRadius: 10,
                    border: '1px solid var(--border-light, #e2e8f0)',
                    background: posting === p.id ? 'var(--bg-soft)' : 'white',
                    cursor: posting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    opacity: posting && posting !== p.id ? 0.5 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'var(--bg-soft, #f1f5f9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800,
                  }}>
                    {p.icon}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>
                      {posting === p.id ? 'Posting...' : 'Share now'}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {result && (
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                background: result.credits > 0 ? 'rgba(168,240,212,0.15)' : 'var(--bg-soft)',
                border: result.credits > 0 ? '1px solid var(--mint)' : '1px solid var(--border-light)',
                fontSize: 13, fontWeight: 600,
                color: result.credits > 0 ? 'var(--mint-darker, #2d7a4f)' : 'var(--ink-soft)',
              }}>
                {result.message}
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 12, textAlign: 'center' }}>
              Earn up to 5 free credits per month by sharing your creations.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
