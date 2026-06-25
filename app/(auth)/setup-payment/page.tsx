'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function CardForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  // Plan the trial converts to when the free credits run out (Stripe bills the
  // saved card then). Defaults to Starter — the easiest first yes.
  const [plan, setPlan] = useState<'starter' | 'pro' | 'business'>('starter')

  useEffect(() => {
    async function createIntent() {
      try {
        const res = await fetch('/api/create-setup-intent', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to initialize payment setup')
        setClientSecret(data.clientSecret)
        setCustomerId(data.customerId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize')
      }
    }
    createIntent()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements || !clientSecret) return

    setLoading(true)
    setError(null)

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) { setLoading(false); return }

    const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card: cardElement },
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Card setup failed')
      setLoading(false)
      return
    }

    // Confirm card saved on backend
    try {
      const confirmRes = await fetch('/api/confirm-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, plan }),
      })
      if (!confirmRes.ok) {
        const data = await confirmRes.json()
        throw new Error(data.error || 'Failed to confirm card')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save card')
      setLoading(false)
      return
    }

    // Return to wherever the user was sent from (e.g. the produce flow), or
    // fall back to onboarding.
    router.push(next || '/setup')
  }

  return (
    <>
      <h1>Add your payment method</h1>
      <p className="auth-sub">
        Start your free trial — your 2,000 free credits unlock as soon as your card is on file. No charge today.
      </p>

      <div style={{
        background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
        border: '1px solid #bbf7d0',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 24,
        fontSize: 13,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <strong style={{ color: '#166534' }}>2,000 free credits included</strong>
        </div>
        <p style={{ color: '#15803d', marginTop: 6, marginBottom: 0 }}>
          Enough for your first videos — a standard video is 1,000 credits. Top up or upgrade anytime. Cancel anytime.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Plan picker — what the trial converts to once the free credits run out. */}
        <div className="form-group">
          <label className="input-label">Choose your plan (billed only after your free credits run out)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { id: 'starter', name: 'Starter', price: '$29/mo', sub: '5,000 credits' },
              { id: 'pro', name: 'Pro', price: '$79/mo', sub: '25,000 credits' },
              { id: 'business', name: 'Business', price: '$199/mo', sub: '75,000 credits' },
            ] as const).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                style={{
                  flex: 1, textAlign: 'left', padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  border: plan === p.id ? '2px solid #16a34a' : '1px solid var(--border)',
                  background: plan === p.id ? '#f0fdf4' : 'white',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{p.name}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#16a34a' }}>{p.price}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{p.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="input-label">Card details</label>
          <div style={{
            padding: '12px 14px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'white',
          }}>
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#1a1a2e',
                    '::placeholder': { color: '#9ca3af' },
                  },
                },
              }}
            />
          </div>
        </div>

        {error && (
          <div className="form-group" style={{ color: '#c0392b', fontSize: 14 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !stripe || !clientSecret}
          className="btn btn-primary btn-lg btn-full"
        >
          {loading ? 'Saving card...' : (next ? 'Save card & continue \u2192' : 'Continue to setup \u2192')}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--ink-light)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 4 }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Secured by Stripe. Your card is never stored on our servers.
      </div>
    </>
  )
}

export default function SetupPaymentPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>}>
      <Elements stripe={stripePromise}>
        <CardForm />
      </Elements>
    </Suspense>
  )
}
