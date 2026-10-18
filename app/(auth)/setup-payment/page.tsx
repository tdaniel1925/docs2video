'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getStripePromise, stripeAppearance, STRIPE_FONTS, plainPaymentError } from '../../_components/billing/stripe-client'
import { useBrand } from '../../_components/BrandProvider'
import { safeNextPath } from '../../_lib/safe-redirect'
import { SELLABLE_PLAN_TIERS, getPlan, type SellablePlanTier } from '../../_lib/pricing'

// Literals, not an import: app/_lib/credits.ts reaches for the Supabase service
// role client, which must never be pulled into a client bundle. Keep in sync
// with CREDIT_COSTS.flyer and TIER_CREDITS.free.
const FLYER_COST = 200
const FREE_CREDITS = 2000

/*
 * THE TRIAL CARD STEP. The card is saved right here with Stripe's Payment
 * Element (card, Apple Pay / Google Pay where the device has them); the
 * bank's security check opens on this page. Nothing is charged. Afterwards
 * /api/confirm-card checks the card with Stripe (one card, one free trial).
 */
function CardForm({ clientSecret }: { clientSecret: string }) {
  const brand = useBrand()
  const router = useRouter()
  const searchParams = useSearchParams()
  // `next` comes from the URL — only a plain in-app path is honored, so a
  // crafted link can't bounce the user to another site after card entry.
  const rawNext = searchParams.get('next')
  const next = rawNext ? (safeNextPath(rawNext, '') || null) : null
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  // Plan the trial converts to when the free credits run out (Stripe bills the
  // saved card then). Only plans checkout sells — Starter is retired.
  const [plan, setPlan] = useState<SellablePlanTier>('pro')

  /** Tell our server the card is saved (it re-checks with Stripe). */
  async function finish(setupIntentId: string, chosen: string) {
    const confirmRes = await fetch('/api/confirm-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupIntentId, plan: chosen }),
    })
    if (!confirmRes.ok) {
      const data = await confirmRes.json().catch(() => ({}))
      throw new Error(data.error || 'We could not save your card. Please try again.')
    }
    // Back to wherever the user was sent from (step 3's "Make it" sends ?next=
    // back to it), or Home. (It used to go on to the setup wizard; since the
    // light start nobody is sent through that — see light-start.ts.)
    router.push(next || brand.home)
  }

  // Back from a bank page (only a few payment methods need one).
  useEffect(() => {
    const seti = searchParams.get('setup_intent')
    const status = searchParams.get('redirect_status')
    if (!seti || !status) return
    if (status !== 'succeeded') { setError('Your card wasn’t saved. Please try again.'); return }
    setLoading(true)
    finish(seti, searchParams.get('plan') || 'pro').catch((err) => {
      setError(err instanceof Error ? err.message : 'We could not save your card.')
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements || !clientSecret) return

    setLoading(true)
    setError(null)

    const back = new URL(window.location.href)
    back.searchParams.set('plan', plan)
    const { error: stripeError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: back.toString() },
    })

    if (stripeError || !setupIntent) {
      setError(plainPaymentError(stripeError as never))
      setLoading(false)
      return
    }

    // The server re-checks this SetupIntent with Stripe against the user's
    // OWN customer before granting the trial.
    try {
      await finish(setupIntent.id, plan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save card')
      setLoading(false)
    }
  }

  return (
    <>
      <h1>Add your payment method</h1>
      <p className="auth-sub">
        Start your free trial — your 2,000 free credits unlock as soon as your card is on file. No charge today.
      </p>

      <div style={{
        background: 'var(--success-bg)',
        border: '1px solid var(--success)',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 24,
        fontSize: 13,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--success)' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <strong style={{ color: 'var(--success)' }}>2,000 free credits included</strong>
        </div>
        <p style={{ color: 'var(--ink-soft)', marginTop: 6, marginBottom: 0 }}>
          {brand.showVideoFeatures
            ? 'Enough for your first videos — a standard video is 1,000 credits. Top up or upgrade anytime. Cancel anytime.'
            : `Enough for your first ${Math.floor(FREE_CREDITS / FLYER_COST)} designs — each design is ${FLYER_COST} credits. Top up or upgrade anytime. Cancel anytime.`}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Plan picker — what the trial converts to once the free credits run out. */}
        <div className="form-group">
          <label className="input-label">Choose your plan (billed only after your free credits run out)</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SELLABLE_PLAN_TIERS.map((tier) => {
              const info = getPlan(tier)
              return {
                id: tier,
                name: info.label,
                price: `$${Math.round(info.monthlyPrice / 100)}/mo`,
                sub: `${info.monthlyCredits.toLocaleString()} credits`,
              }
            }).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                style={{
                  flex: 1, textAlign: 'left', padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  border: plan === p.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: plan === p.id ? 'var(--accent-soft)' : 'var(--bg-card)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{p.name}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent-ink)' }}>{p.price}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>{p.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="input-label">Card details</label>
          {clientSecret ? (
            <PaymentElement
              options={{ layout: 'tabs', paymentMethodOrder: ['card', 'apple_pay', 'google_pay'], wallets: { applePay: 'auto', googlePay: 'auto' } }}
              onReady={() => setReady(true)}
            />
          ) : (
            <div style={{ padding: '12px 0', color: 'var(--ink-light)', fontSize: 14 }}>Opening the secure card form…</div>
          )}
        </div>

        {error && (
          <div className="form-group form-error" role="alert">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !stripe || !clientSecret || !ready}
          className="btn btn-primary btn-lg btn-full"
        >
          {loading ? 'Saving card...' : (next ? 'Save card & continue \u2192' : 'Save card \u2192')}
        </button>
      </form>

      {/* LIGHT START: on Docs2Video nobody has to add a card to look around,
          only to make a real video, so there is always a way back. */}
      {brand.showVideoFeatures && (
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 14 }}>
          <Link href={next || '/dashboard'}>{next ? 'Not now, go back' : 'Not now, try it first'}</Link>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--ink-light)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 4 }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Secured by Stripe. Your card is never stored on our servers.
      </div>
    </>
  )
}

function CardStep() {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const stripePromise = getStripePromise()
  useEffect(() => {
    stripePromise.then((st) => { if (!st) setInitError('The secure payment form didn’t load. Check your internet connection (or turn off a blocker for this page), then try again.') })
    fetch('/api/create-setup-intent', { method: 'POST' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.clientSecret) throw new Error(data.error || 'We could not open the secure card form. Please refresh and try again.')
        setClientSecret(data.clientSecret)
      })
      .catch((err) => setInitError(err instanceof Error ? err.message : 'Failed to initialize'))
  }, [])
  if (initError) return <><h1>Add your payment method</h1><div className="form-group" style={{ color: 'var(--error-text)', fontSize: 14 }}>{initError}</div></>
  // The Payment Element needs the SetupIntent before it can show.
  if (!clientSecret) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /><p style={{ marginTop: 12, color: 'var(--ink-light)', fontSize: 14 }}>Opening the secure card form…</p></div>
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance(), fonts: STRIPE_FONTS }}>
      <CardForm clientSecret={clientSecret} />
    </Elements>
  )
}

export default function SetupPaymentPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>}>
      <CardStep />
    </Suspense>
  )
}
