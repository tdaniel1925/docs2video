'use client'

import { useEffect, useState } from 'react'
import { Check, ExternalLink, ReceiptText } from 'lucide-react'
import { useBrand } from '../../_components/BrandProvider'
import BuyCreditsModal from '../../_components/BuyCreditsModal'
import { Button } from '../../_components/kit'
import { useToast } from '../../_components/Toast'
import type { Profile } from '../../_lib/types'
import { PLANS, getPlan, getUserTier, isSellablePlan, type PlanTier } from '../../_lib/pricing'
import { TIER_CREDITS, TIER_APPROX_VIDEOS, CREDIT_COSTS } from '../../_lib/credits'
import { CREDIT_PACKS, packPrice } from '../../_lib/credit-packs'
import { planName } from '../../_lib/names'
import { creditBar, type BillingSummary } from './billing-summary'
import s from './settings.module.css'

// Text2Art's plan cards talk about designs, not videos, so they can't use the
// Docs2Video feature list in pricing.ts. No prices here — those come from
// PLANS for both storefronts.
const TEXT2ART_PLAN_FEATURES: Record<PlanTier, string[]> = {
  free: ['No monthly fee', 'Full print quality', 'Top up any time'],
  starter: ['Top up any time', 'Full print quality'],
  pro: ['Top up any time', 'Unlimited brands', 'API access'],
  business: ['Top up any time', 'Every size and format', 'Priority support'],
  enterprise: ['Top up any time', 'API access', 'Dedicated support'],
}

const PAID_STATUSES = ['active', 'starter', 'pro', 'professional', 'business', 'agency', 'enterprise', 'enterprise-plus', 'enterprise_plus', 'past_due']

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

/**
 * SETTINGS → BILLING & CREDITS (round B). VidWiz's order: three summary cards
 * (your plan · your credits · this period), then the plans, then the credit
 * packs, then invoices. Every button calls the SAME routes as before
 * (/api/stripe/portal, /api/subscribe, the top-up window) — only the layout
 * changed. Prices come from pricing.ts and credit-packs.ts only.
 */
export default function BillingSection({ profile }: { profile: Profile }) {
  const storefront = useBrand()
  const notify = useToast()
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [showBuyCredits, setShowBuyCredits] = useState(false)

  useEffect(() => {
    fetch('/api/billing/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.total === 'number') setSummary(d) })
      .catch(() => {})
  }, [])

  const status = profile.subscription_status?.toLowerCase() ?? ''
  const tier = getUserTier(status)
  const plan = getPlan(tier)
  const hasCustomer = !!profile.stripe_customer_id
  const isPaid = PAID_STATUSES.includes(status)

  /** What a plan gets you, said in the units this storefront sells. Derived
   *  from TIER_CREDITS and credits.ts so it can't drift. */
  const allowance = (t: PlanTier) => {
    const credits = TIER_CREDITS[t]
    if (storefront.showVideoFeatures) {
      return t === 'enterprise'
        ? `${TIER_APPROX_VIDEOS[t].standard} videos/mo + API`
        : `${TIER_APPROX_VIDEOS[t].standard} videos/mo included`
    }
    const designs = Math.floor(credits / CREDIT_COSTS.flyer)
    return `${credits.toLocaleString()} credits/mo — about ${designs} designs`
  }

  async function openPortal() {
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (data.url) window.location.href = data.url
    else notify(data.error || 'We could not open billing just now. Please try again in a minute.', 'error')
  }

  async function choosePlan(t: PlanTier) {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: t }),
    })
    const data = await res.json().catch(() => ({}))
    // url = Stripe Checkout, the billing portal, or back here after an
    // in-place plan change.
    if (data.url) window.location.href = data.url
    else notify(data.error || 'Could not change your plan. Please try again.', 'error')
  }

  const bar = creditBar(summary, tier)
  const renew = day(summary?.renewsAt ?? null)
  const since = day(summary?.cycleStart ?? null)
  const planLine = status === 'past_due'
    ? 'Your last payment didn’t go through. Update your card under Manage billing.'
    : tier === 'free'
      ? 'Free credits to start, then top up as you need them.'
      : renew
        ? (summary?.cancelsAtPeriodEnd ? `Ends ${renew}` : `Renews ${renew}`)
        : allowance(tier)

  return (
    <div className={s.stack}>
      {/* ── 1. Three summary cards ── */}
      <div className={s.summary}>
        <section className={`kit-card ${s.sumCard}`} aria-labelledby="sum-plan">
          <h2 id="sum-plan" className="kit-label">Current plan</h2>
          {/* The plan's name from pricing.ts via names.ts — the avatar menu's words. */}
          <p className={s.sumBig}>{planName(profile.subscription_status)}</p>
          <p className={s.sumPrice}>
            {plan.monthlyPrice > 0
              ? <><b>{`$${Math.round(plan.monthlyPrice / 100)}`}</b> a month</>
              : 'No monthly fee'}
          </p>
          <p className={s.sumLine}>{planLine}</p>
          {hasCustomer && (
            <Button variant="secondary" size="sm" onClick={openPortal}>
              <ReceiptText size={16} />Manage billing &amp; invoices
            </Button>
          )}
        </section>

        <section className={`kit-card ${s.sumCard}`} aria-labelledby="sum-credits">
          <h2 id="sum-credits" className="kit-label">Credits available</h2>
          <p className={`${s.sumBig} ${s.money}`}>{summary ? summary.total.toLocaleString() : '—'}</p>
          <div
            className={s.bar}
            role="meter"
            aria-label="Monthly credits left"
            aria-valuemin={0}
            aria-valuemax={bar.of}
            aria-valuenow={bar.left}
          >
            <span style={{ width: `${bar.pct}%` }} />
          </div>
          <p className={s.sumLine}>
            {bar.left.toLocaleString()} of {bar.of.toLocaleString()} {tier === 'free' ? 'free' : 'monthly'}
            {summary && summary.topup > 0 && <> · {summary.topup.toLocaleString()} from credit packs</>}
          </p>
          <Button size="sm" onClick={() => setShowBuyCredits(true)}>Buy credits</Button>
        </section>

        <section className={`kit-card ${s.sumCard}`} aria-labelledby="sum-period">
          <h2 id="sum-period" className="kit-label">This period</h2>
          <p className={s.sumBig}>{summary ? summary.cycleUsed.toLocaleString() : '—'}<span className={s.unit}> credits used</span></p>
          {storefront.showVideoFeatures && summary && summary.cycleUsed > 0 && (
            <p className={s.sumLine}>About {Math.max(1, Math.round(summary.cycleUsed / CREDIT_COSTS.videoStandard)).toLocaleString()} standard {Math.round(summary.cycleUsed / CREDIT_COSTS.videoStandard) === 1 ? 'video' : 'videos'}’ worth</p>
          )}
          {since && <p className={s.sumLine}>Since {since}</p>}
        </section>
      </div>

      {/* Both storefronts bill through ONE Stripe account, so the name on the
          statement is Docs2Video whichever site the customer bought from. Said
          here plainly rather than discovered on a bank statement. */}
      {storefront.id !== 'docs2video' && (
        <p className={s.hint}>
          Billing is handled by <strong>Docs2Video</strong> — that is the name on your card statement and receipts.
        </p>
      )}

      {/* ── 2. Plans ── */}
      <section aria-labelledby="billing-plans">
        <h2 id="billing-plans" className={s.h2}>Plans</h2>
        <p className={s.hint}>Change or cancel any time. Unused monthly credits don’t roll over; credits from packs never expire.</p>
        <div className={s.plans}>
          {/* Built from pricing.ts — name, price and (on Docs2Video) the
              feature list the pricing page shows. Starter is retired, so only
              free + the plans checkout sells get a card. */}
          {PLANS.filter((p) => p.tier === 'free' || isSellablePlan(p.tier)).map((p) => {
            const isCurrent = tier === p.tier
            const highlight = storefront.showVideoFeatures && p.tier === 'free'
              ? `${TIER_CREDITS.free.toLocaleString()} free credits (~${TIER_APPROX_VIDEOS.free.standard} videos), one time`
              : allowance(p.tier)
            const features = storefront.showVideoFeatures
              ? p.features.filter((f) => !/^[\d,]+ (free )?credits/.test(f))
              : TEXT2ART_PLAN_FEATURES[p.tier]
            return (
              <div key={p.tier} className={`kit-card ${s.plan}`} data-current={isCurrent || undefined}>
                <div className={s.planHead}>
                  <h3 className={s.planName}>{p.label}</h3>
                </div>
                <p className={s.planPrice}>
                  {/* Price from pricing.ts (audit L5). */}
                  <b>{`$${Math.round(p.monthlyPrice / 100)}`}</b>{p.monthlyPrice > 0 && <span>/month</span>}
                </p>
                <p className={s.planHighlight}>{highlight}</p>
                <ul className={s.planList}>
                  {features.map((f) => <li key={f}><Check size={14} />{f}</li>)}
                </ul>
                <div className={s.planAction}>
                  {isCurrent ? (
                    <span className={s.planWell}>Your plan</span>
                  ) : p.tier === 'free' ? (
                    hasCustomer
                      ? <Button variant="secondary" size="sm" full onClick={openPortal}>Downgrade</Button>
                      : <span className={s.planWell}>Default</span>
                  ) : (
                    <Button size="sm" full onClick={() => choosePlan(p.tier)}>
                      {tier !== 'free' ? `Switch to ${p.label}` : `Subscribe to ${p.label}`}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 3. Credit packs (same packs, names and prices as the top-up
          window — credit-packs.ts) ── */}
      <section aria-labelledby="billing-packs">
        <h2 id="billing-packs" className={s.h2}>Credit packs</h2>
        <p className={s.hint}>Top up any time. Pack credits never expire and are used after your monthly credits.</p>
        <div className={s.packs}>
          {CREDIT_PACKS.map((p) => (
            <div key={p.key} className={`kit-card ${s.pack}`}>
              <h3 className={s.packName}>{p.credits.toLocaleString()} credits</h3>
              <p className={s.packMeta}><span className={s.money}>{packPrice(p)}</span> · {p.name} pack · never expire</p>
              <Button variant="secondary" size="sm" onClick={() => setShowBuyCredits(true)} aria-label={`Top up with the ${p.name} pack`}>Buy</Button>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Invoices ── */}
      <section className={`kit-card ${s.invoices}`} aria-labelledby="billing-invoices">
        <div>
          <h2 id="billing-invoices" className={s.h2}>Invoices and receipts</h2>
          <p className={s.hint}>
            {hasCustomer
              ? 'Your invoices, card and plan changes live in the Stripe billing page.'
              : 'You haven’t paid for anything yet, so there are no invoices. They appear here after your first purchase.'}
          </p>
        </div>
        {hasCustomer && (
          <div className={s.invoiceActions}>
            <Button variant="secondary" size="sm" onClick={openPortal}><ExternalLink size={16} />See invoices</Button>
            {isPaid && <Button variant="quiet" size="sm" onClick={openPortal}>Cancel subscription</Button>}
          </div>
        )}
      </section>

      <BuyCreditsModal open={showBuyCredits} onClose={() => setShowBuyCredits(false)} />
    </div>
  )
}
