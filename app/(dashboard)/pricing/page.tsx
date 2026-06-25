'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../_lib/supabase/client'
import { PLANS, getUserTier, type PlanTier } from '../../_lib/pricing'

export default function PricingPage() {
  const router = useRouter()
  const [currentTier, setCurrentTier] = useState<PlanTier>('free')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('subscription_status').eq('id', user.id).single().then(({ data }) => {
        if (data) setCurrentTier(getUserTier(data.subscription_status))
      })
    })
  }, [])

  async function handleSubscribe(tier: PlanTier) {
    if (tier === 'free') return
    setLoading(tier)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: tier }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout')
      if (data.url) window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(null)
    }
  }

  async function handleManage() {
    setLoading('manage')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      setError('Could not open billing portal')
      setLoading(null)
    }
  }

  const paidPlans = PLANS.filter(p => p.tier !== 'free')

  return (
    <div style={{ flex: 1, padding: '48px 24px', width: '100%' }}>
      <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 8, color: 'var(--ink)' }}>
        Choose your plan
      </h1>
      <p style={{ fontSize: 17, color: 'var(--ink-soft)', textAlign: 'center', marginBottom: 12, lineHeight: 1.6 }}>
        Every plan includes credits for videos, slide decks, and PDFs.
      </p>
      <p style={{ fontSize: 14, color: 'var(--ink-light)', textAlign: 'center', marginBottom: 40 }}>
        Need more? Buy extra credits anytime on any paid plan.
      </p>

      {error && (
        <div style={{ maxWidth: 500, margin: '0 auto 24px', padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Free tier card */}
      <div style={{
        width: '100%', margin: '0 0 32px', padding: '24px 28px', borderRadius: 10,
        background: currentTier === 'free' ? 'rgba(59,181,200,0.06)' : 'white',
        border: currentTier === 'free' ? '2px solid var(--mint)' : '1px solid var(--border-light)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Pay Per Video</div>
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 12 }}>No subscription required</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>$0<span style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink-light)' }}>/mo</span></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--mint)', marginBottom: 4 }}>2 short videos</div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>1,000 credits included</div>
        {currentTier === 'free' && (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mint)', padding: '8px 0' }}>Current plan</div>
        )}
      </div>

      {/* Paid plans grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${paidPlans.length}, 1fr)`, gap: 12 }}>
        {paidPlans.map(plan => {
          const isCurrent = currentTier === plan.tier
          const isPopular = plan.tier === 'pro'
          return (
            <div key={plan.tier} style={{
              padding: '24px 20px', borderRadius: 10, position: 'relative',
              background: isCurrent ? 'rgba(59,181,200,0.06)' : 'white',
              border: isCurrent ? '2px solid var(--mint)' : isPopular ? '2px solid var(--ink)' : '1px solid var(--border-light)',
              display: 'flex', flexDirection: 'column',
            }}>
              {isPopular && (
                <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  padding: '2px 12px', borderRadius: 6, background: 'var(--ink)', color: 'white',
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Most Popular
                </div>
              )}
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--ink)' }}>{plan.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>
                ${plan.monthlyPrice / 100}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-light)' }}>/mo</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--mint)', marginBottom: 2 }}>
                {plan.monthlyCredits.toLocaleString()} credits
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>
                ~{plan.approxStandardVideos} standard explainers
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-light)', marginBottom: 16 }}>
                or ~{plan.approxQuickVideos} quick videos, ~{Math.floor(plan.monthlyCredits / 600)} slide decks
              </div>

              <div style={{ flex: 1, marginBottom: 16 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6, lineHeight: 1.4 }}>
                    {f}
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <button
                  onClick={handleManage}
                  disabled={loading === 'manage'}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'white', color: 'var(--ink-soft)', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {loading === 'manage' ? 'Loading...' : 'Manage plan'}
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.tier)}
                  disabled={loading === plan.tier}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                    background: isPopular ? 'var(--ink)' : 'var(--mint)',
                    color: 'white', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    opacity: loading === plan.tier ? 0.7 : 1,
                  }}
                >
                  {loading === plan.tier ? 'Loading...' : currentTier !== 'free' ? 'Switch plan' : 'Subscribe'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 13, color: 'var(--ink-light)', textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
        All plans can be cancelled anytime. Billing is monthly. Credits reset each billing cycle.
        <br />Extra credits available on paid plans at $3-5 per 1,000 credits.
      </p>
    </div>
  )
}
