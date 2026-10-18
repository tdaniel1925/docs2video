'use client'

import { useState } from 'react'
import { getPlan } from '../_lib/pricing'
import InlineCheckout from './billing/InlineCheckout'

const PRO = getPlan('pro')

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
}

/** "Upgrade for more credits" — Pro is paid right here in the in-app
 *  checkout (InlineCheckout, 2026-10-14); nobody is sent to a Stripe page. */
export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const [paying, setPaying] = useState(false)

  if (!open) return null
  if (paying) {
    return <InlineCheckout purchase={{ kind: 'plan', plan: 'pro' }} onClose={() => { setPaying(false); onClose() }} />
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
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 10, padding: '36px 32px',
          maxWidth: 440, width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{
          fontSize: 'var(--fs-h3)', fontWeight: 800, color: 'var(--ink)',
          marginBottom: 8, letterSpacing: '-0.02em',
        }}>
          Upgrade for more credits
        </h2>
        <p style={{
          fontSize: 'var(--fs-body)', color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 24,
        }}>
          A paid plan gives you a fresh pool of credits every month for videos, presentations and commercials.
        </p>

        {/* Pro plan */}
        <div style={{
          padding: '16px 20px', borderRadius: 10,
          border: '2px solid var(--accent-ink)', marginBottom: 20,
          background: 'rgba(199, 232, 168, 0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--ink)' }}>Pro</span>
            <span style={{ fontSize: 'var(--fs-ui)', fontWeight: 700, color: 'var(--ink-soft)' }}>${PRO.monthlyPrice / 100}/mo</span>
          </div>
          <p style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-light)', marginBottom: 12, lineHeight: 1.4 }}>
            {PRO.monthlyCredits.toLocaleString('en-US')} credits/mo (~{PRO.approxStandardVideos} standard videos)
          </p>
          <button
            onClick={() => setPaying(true)}
            style={{
              width: '100%', padding: '10px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: 'var(--ink)', fontSize: 'var(--fs-ui)', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Upgrade to Pro
          </button>
        </div>

        {/* Maybe later */}
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '12px', borderRadius: 8,
            border: '1.5px solid var(--border-light)', background: 'var(--bg-card)',
            fontSize: 'var(--fs-ui)', fontWeight: 600, color: 'var(--ink-soft)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
