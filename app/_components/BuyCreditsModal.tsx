'use client'

import { useState } from 'react'
import { CREDIT_PACKS, packPrice } from '../_lib/credit-packs'

interface BuyCreditsModalProps {
  open: boolean
  onClose: () => void
  /** Optional: when opened because a generation was blocked, show how many are needed. */
  needed?: number
  /** Optional: current balance, to contextualize the shortfall. */
  balance?: number
}

// The packs come from credit-packs.ts — one list for every screen that sells
// or describes them (it was typed here, in Settings and on the pricing page).
const PACKS = CREDIT_PACKS.map(p => ({ ...p, price: packPrice(p), highlight: p.bestValue }))

export default function BuyCreditsModal({ open, onClose, needed, balance }: BuyCreditsModalProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // LIGHT START: an account with no card is sent to add one first (the server
  // answers code 'card_required') — credits it bought couldn't be spent yet.
  const [needsCard, setNeedsCard] = useState(false)

  if (!open) return null

  async function buy(pack: string) {
    setError(null)
    setLoading(pack)
    try {
      const res = await fetch('/api/credits/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url && /^https?:\/\//.test(data.url)) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Could not start checkout. Please try again.')
        setNeedsCard(data.code === 'card_required')
        setLoading(null)
      }
    } catch {
      setError('Network error — please check your connection and try again.')
      setLoading(null)
    }
  }

  const blocked = typeof needed === 'number'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 10, padding: '36px 32px',
          maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em' }}>
          {blocked ? 'You need more credits' : 'Buy credits'}
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 24 }}>
          {blocked
            ? `This needs ${needed?.toLocaleString()} credits${typeof balance === 'number' ? `, and you have ${balance.toLocaleString()}` : ''}. Top up below — credits never expire and are used after your monthly allotment.`
            : 'Top up your balance. Credits never expire and are used after your monthly allotment runs out.'}
        </p>

        {error && (
          <div role="alert" style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            background: 'var(--error-bg)', border: '1.5px solid var(--error-border)',
            color: 'var(--error-text)', fontSize: 13, fontWeight: 600, lineHeight: 1.4,
          }}>
            {error}
            {needsCard && (
              <>
                {' '}
                <a href={`/setup-payment?next=${encodeURIComponent(window.location.pathname + window.location.search)}`} style={{ color: 'var(--link)', textDecoration: 'underline' }}>Add a card</a>
              </>
            )}
          </div>
        )}

        {PACKS.map(p => (
          <div key={p.key} style={{
            padding: '16px 20px', borderRadius: 10, marginBottom: 12,
            border: p.highlight ? '2px solid var(--accent-ink)' : '1.5px solid var(--border-light)',
            background: p.highlight ? 'rgba(199, 232, 168, 0.06)' : 'var(--bg-soft)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                {p.name} pack{p.highlight ? ' · Best value' : ''}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)' }}>{p.price}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 12, lineHeight: 1.4 }}>
              {p.credits.toLocaleString()} credits
            </p>
            <button
              onClick={() => buy(p.key)}
              disabled={loading === p.key}
              style={{
                width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                background: p.highlight ? 'var(--accent)' : 'var(--ink)',
                color: p.highlight ? 'var(--ink)' : 'var(--on-ink)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                opacity: loading === p.key ? 0.6 : 1,
              }}
            >
              {loading === p.key ? 'Redirecting…' : `Buy ${p.name} pack`}
            </button>
          </div>
        ))}

        {/* SAY WHOSE NAME IS ON THE CHARGE. Payments run through one Stripe
            account, so a Text2Art customer's statement and receipt both read
            Docs2Video. An unrecognised name on a card statement is a chargeback
            waiting to happen — saying so beforehand costs nothing, while the
            surprise costs the payment and the trust. */}
        <p style={{
          fontSize: 12, color: 'var(--ink-light)', lineHeight: 1.5,
          marginTop: 16, textAlign: 'center',
        }}>
          Payments are handled securely by Stripe. <strong>Docs2Video</strong> is the name
          that appears on your card statement and receipt.
        </p>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '12px', borderRadius: 8, marginTop: 8,
            border: '1.5px solid var(--border-light)', background: 'white',
            fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {blocked ? 'Not now' : 'Close'}
        </button>
      </div>
    </div>
  )
}
