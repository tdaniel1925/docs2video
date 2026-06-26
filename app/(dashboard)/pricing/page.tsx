'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../_lib/supabase/client'
import { PLANS, getUserTier, type PlanTier } from '../../_lib/pricing'

export default function PricingPage() {
  const [currentTier, setCurrentTier] = useState<PlanTier>('free')
  const [addonActive, setAddonActive] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('subscription_status, social_addon_active').eq('id', user.id).single().then(({ data }) => {
        if (data) {
          setCurrentTier(getUserTier((data as any).subscription_status))
          setAddonActive(!!(data as any).social_addon_active)
        }
      })
    })
  }, [])

  async function handleSubscribe(tier: PlanTier) {
    if (tier === 'free') return
    setLoading(tier)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      else { setError('Could not open billing portal'); setLoading(null) }
    } catch { setError('Could not open billing portal'); setLoading(null) }
  }

  async function handleAddon() {
    setLoading('addon')
    try {
      const res = await fetch('/api/social-addon/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else { setError(data.error || 'Could not start checkout'); setLoading(null) }
    } catch { setError('Could not start checkout'); setLoading(null) }
  }

  // Starter ($29) is retired — keep its definition for back-compat but hide it.
  const paidPlans = PLANS.filter(p => p.tier !== 'free' && p.tier !== 'starter')

  return (
    <div style={{ flex: 1, padding: '48px 24px', width: '100%', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 10, color: 'var(--ink)' }}>
        Simple, credit-based pricing
      </h1>
      <p style={{ fontSize: 17, color: 'var(--ink-soft)', textAlign: 'center', marginBottom: 36, lineHeight: 1.6, maxWidth: 620, marginInline: 'auto' }}>
        One pool of credits for videos, slide decks, and PDFs. A standard video is 1,000 credits.
        Cancel anytime; credits reset each cycle. Top up whenever you need more.
      </p>

      {error && (
        <div style={{ maxWidth: 520, margin: '0 auto 28px', padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Plan grid: Free + paid tiers, responsive auto-fit. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, alignItems: 'stretch' }}>
        {/* Free / Pay-Per-Video */}
        <PlanCard
          name="Pay As You Go"
          price="$0"
          highlight={currentTier === 'free' ? 'current' : 'none'}
          creditLine="2,000 free credits"
          subLine="~2 videos to try · then top up"
          features={['Full quality, no watermark', 'Share pages with AI chat', 'Download MP4, PDF, PPTX', 'No subscription required']}
          cta={currentTier === 'free' ? { label: 'Current plan', disabled: true } : null}
        />

        {paidPlans.map(plan => {
          const isCurrent = currentTier === plan.tier
          const isPopular = plan.tier === 'pro'
          return (
            <PlanCard
              key={plan.tier}
              name={plan.label}
              price={`$${plan.monthlyPrice / 100}`}
              perMonth
              highlight={isCurrent ? 'current' : isPopular ? 'popular' : 'none'}
              creditLine={`${plan.monthlyCredits.toLocaleString()} credits / mo`}
              subLine={`~${plan.approxStandardVideos} standard videos · ~${Math.floor(plan.monthlyCredits / 600)} slide decks`}
              features={plan.features}
              cta={isCurrent
                ? { label: loading === 'manage' ? 'Loading…' : 'Manage plan', onClick: handleManage, disabled: loading === 'manage', variant: 'soft' }
                : { label: loading === plan.tier ? 'Loading…' : currentTier !== 'free' ? 'Switch plan' : 'Subscribe', onClick: () => handleSubscribe(plan.tier), disabled: loading === plan.tier, variant: isPopular ? 'dark' : 'mint' }}
            />
          )
        })}
      </div>

      {/* AI Social add-on band */}
      <div style={{ marginTop: 40, padding: '28px 32px', borderRadius: 14, background: 'linear-gradient(135deg,#0b1220,#16233b)', color: 'white', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ maxWidth: 620 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#7dd3fc', marginBottom: 6 }}>Add-on</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>AI Social — auto-post to your channels</div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', margin: 0, lineHeight: 1.55 }}>
            Connect X, Instagram, Facebook, LinkedIn, YouTube + more. AI writes captions and creates
            branded images, then posts your content (incl. videos) on a schedule. Content generation
            uses your normal credits.
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 800 }}>$50<span style={{ fontSize: 14, fontWeight: 500, opacity: 0.7 }}>/mo</span></div>
          {addonActive ? (
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: '#86efac' }}>✓ Active</div>
          ) : (
            <button onClick={handleAddon} disabled={loading === 'addon'} style={{ marginTop: 10, padding: '11px 22px', borderRadius: 8, border: 'none', background: '#C9F24E', color: '#0b1220', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {loading === 'addon' ? 'Starting…' : 'Add AI Social'}
            </button>
          )}
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--ink-light)', textAlign: 'center', marginTop: 28, lineHeight: 1.6 }}>
        All plans cancel anytime · billed monthly · credits reset each cycle · extra credits available on paid plans.
      </p>
    </div>
  )
}

/* ── Reusable plan card ── */
function PlanCard(props: {
  name: string; price: string; perMonth?: boolean
  highlight: 'current' | 'popular' | 'none'
  creditLine: string; subLine: string; features: string[]
  cta: { label: string; onClick?: () => void; disabled?: boolean; variant?: 'mint' | 'dark' | 'soft' } | null
}) {
  const { highlight } = props
  const border = highlight === 'current' ? '2px solid var(--mint)' : highlight === 'popular' ? '2px solid var(--ink)' : '1px solid var(--border-light)'
  const bg = highlight === 'current' ? 'rgba(59,181,200,0.06)' : 'white'
  const btnBg = props.cta?.variant === 'dark' ? 'var(--ink)' : props.cta?.variant === 'soft' ? 'white' : 'var(--mint)'
  const btnColor = props.cta?.variant === 'soft' ? 'var(--ink-soft)' : 'white'
  const btnBorder = props.cta?.variant === 'soft' ? '1px solid var(--border)' : 'none'
  return (
    <div style={{ position: 'relative', padding: '26px 22px', borderRadius: 12, background: bg, border, display: 'flex', flexDirection: 'column' }}>
      {highlight === 'popular' && (
        <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', padding: '3px 14px', borderRadius: 6, background: 'var(--ink)', color: 'white', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
          Most Popular
        </div>
      )}
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, color: 'var(--ink)' }}>{props.name}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>
        {props.price}{props.perMonth && <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-light)' }}>/mo</span>}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--mint)', marginBottom: 2 }}>{props.creditLine}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 16 }}>{props.subLine}</div>
      <div style={{ flex: 1, marginBottom: 16 }}>
        {props.features.map((f, i) => (
          <div key={i} style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 7, lineHeight: 1.4, display: 'flex', gap: 8 }}>
            <span style={{ color: 'var(--mint)', fontWeight: 800 }}>✓</span><span>{f}</span>
          </div>
        ))}
      </div>
      {props.cta && (
        <button onClick={props.cta.onClick} disabled={props.cta.disabled}
          style={{ width: '100%', padding: '12px', borderRadius: 8, border: btnBorder, background: btnBg, color: btnColor, fontSize: 14, fontWeight: 700, cursor: props.cta.onClick ? 'pointer' : 'default', fontFamily: 'inherit', opacity: props.cta.disabled && props.cta.onClick ? 0.7 : 1 }}>
          {props.cta.label}
        </button>
      )}
    </div>
  )
}
