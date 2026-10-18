'use client'

import { useState } from 'react'
import { CREDIT_PACKS, packPrice, type CreditPackKey } from '../_lib/credit-packs'
import InlineCheckout from './billing/InlineCheckout'
import { amountLabel, amountNoun } from '../_lib/plan-pricing'

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

/**
 * THE TOP-UP WINDOW. Pick a pack, then pay for it right here: the window
 * hands over to the in-app checkout (InlineCheckout — Stripe's Payment
 * Element in our own pop-up, 2026-10-14). Nobody is sent to a Stripe page.
 * An account with no card yet is told to add one first (the server answers
 * code 'card_required'; the checkout shows "Add a card").
 */
export default function BuyCreditsModal({ open, onClose, needed, balance }: BuyCreditsModalProps) {
  const [chosen, setChosen] = useState<CreditPackKey | null>(null)

  if (!open) return null

  if (chosen) {
    return (
      <InlineCheckout
        purchase={{ kind: 'pack', pack: chosen }}
        onClose={() => { setChosen(null); onClose() }}
        onPaid={() => window.dispatchEvent(new Event('d2v:credits-changed'))}
      />
    )
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-credits-title"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 10, padding: '36px 32px',
          maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <h2 id="buy-credits-title" style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em' }}>
          {blocked ? `You need more ${amountNoun()}` : `Buy ${amountNoun()}`}
        </h2>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 24 }}>
          {blocked
            ? `This needs ${amountLabel(needed ?? 0)}${typeof balance === 'number' ? `, and you have ${amountLabel(balance)}` : ''}. Top up below — they never expire and are used after your monthly allotment.`
            : 'Top up your balance. Credits never expire and are used after your monthly allotment runs out.'}
        </p>

        {PACKS.map(p => (
          <div key={p.key} style={{
            padding: '16px 20px', borderRadius: 10, marginBottom: 12,
            border: p.highlight ? '2px solid var(--accent-ink)' : '1.5px solid var(--border-light)',
            background: p.highlight ? 'rgba(199, 232, 168, 0.06)' : 'var(--bg-soft)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--ink)' }}>
                {p.name} pack{p.highlight ? ' · Best value' : ''}
              </span>
              <span style={{ fontSize: 'var(--fs-ui)', fontWeight: 700, color: 'var(--ink-soft)' }}>{p.price}</span>
            </div>
            <p style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-light)', marginBottom: 12, lineHeight: 1.4 }}>
              {amountLabel(p.credits)}
            </p>
            <button
              onClick={() => setChosen(p.key)}
              style={{
                width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                background: p.highlight ? 'var(--accent)' : 'var(--ink)',
                color: p.highlight ? 'var(--ink)' : 'var(--on-ink)',
                fontSize: 'var(--fs-ui)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {`Buy ${p.name} pack`}
            </button>
          </div>
        ))}

        {/* SAY WHOSE NAME IS ON THE CHARGE. Payments run through one Stripe
            account, so a Text2Art customer's statement and receipt both read
            Docs2Video. An unrecognised name on a card statement is a chargeback
            waiting to happen — saying so beforehand costs nothing, while the
            surprise costs the payment and the trust. */}
        <p style={{
          fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', lineHeight: 1.5,
          marginTop: 16, textAlign: 'center',
        }}>
          You pay right here, securely through Stripe. <strong>Docs2Video</strong> is the name
          that appears on your card statement and receipt.
        </p>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '12px', borderRadius: 8, marginTop: 8,
            border: '1.5px solid var(--border-light)', background: 'var(--bg-card)',
            fontSize: 'var(--fs-ui)', fontWeight: 600, color: 'var(--ink-soft)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {blocked ? 'Not now' : 'Close'}
        </button>
      </div>
    </div>
  )
}
