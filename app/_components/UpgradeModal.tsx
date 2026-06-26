'use client'

import { useState } from 'react'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
}

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const [loading, setLoading] = useState<string | null>(null)

  if (!open) return null

  async function handleUpgrade(planId: string) {
    setLoading(planId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setLoading(null)
      }
    } catch {
      setLoading(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 10, padding: '36px 32px',
          maxWidth: 440, width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{
          fontSize: 22, fontWeight: 800, color: 'var(--ink)',
          marginBottom: 8, letterSpacing: '-0.02em',
        }}>
          Upgrade to create longer videos
        </h2>
        <p style={{
          fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 24,
        }}>
          Free plan includes short videos only. Upgrade for medium and long explainers with more detail.
        </p>

        {/* Pro plan */}
        <div style={{
          padding: '16px 20px', borderRadius: 10,
          border: '2px solid var(--mint)', marginBottom: 20,
          background: 'rgba(199, 232, 168, 0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Pro</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)' }}>$79/mo</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 12, lineHeight: 1.4 }}>
            25,000 credits/mo (~25 standard videos), all lengths, priority generation
          </p>
          <button
            onClick={() => handleUpgrade('pro')}
            disabled={loading === 'pro'}
            style={{
              width: '100%', padding: '10px', borderRadius: 8, border: 'none',
              background: 'var(--mint)', color: 'var(--ink)', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              opacity: loading === 'pro' ? 0.6 : 1,
            }}
          >
            {loading === 'pro' ? 'Redirecting...' : 'Upgrade to Pro'}
          </button>
        </div>

        {/* Maybe later */}
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '12px', borderRadius: 8,
            border: '1.5px solid var(--border-light)', background: 'white',
            fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
