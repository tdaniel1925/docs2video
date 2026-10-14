'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Button, Note } from '../kit'
import type { SellablePlanTier } from '../../_lib/pricing'
import { getStripePromise, plainPaymentError, money, day } from './stripe-client'
import s from './billing.module.css'

/*
 * CHANGE PLAN, IN THE APP (replaces the Stripe portal's plan switch).
 * Shows exactly what happens before anything is charged:
 *   upgrade   → "Today you pay $X" (Stripe's own proration preview) and the
 *               new monthly price from the next renewal date;
 *   downgrade → "Nothing to pay today", the new price from the next renewal,
 *               and that this month's credits stay.
 * Confirm changes the SAME subscription (never a second one). If the bank
 * wants a security check, it opens right here (Stripe's 3D Secure window).
 * The plan on the account changes when Stripe's webhook confirms it; this
 * waits for that, then says so.
 */

type Preview = {
  direction: 'upgrade' | 'downgrade'
  from: { label: string; priceCents: number | null }
  to: { label: string; priceCents: number; monthlyCredits: number; tier: string }
  dueNowCents: number
  nextAmountCents: number
  nextDate: string | null
  prorationDate: number
}

async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/billing/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

/** Wait for the webhook to put the new plan on the account (~45 s max). */
async function waitForPlan(tier: string, isLive: () => boolean): Promise<boolean> {
  for (let i = 0; i < 30 && isLive(); i++) {
    try {
      const r = await fetch('/api/billing/manage')
      if (r.ok) {
        const d = await r.json()
        if (d?.plan?.tier === tier && !d.plan.pendingChange) return true
      }
    } catch { /* keep waiting */ }
    await new Promise((res) => setTimeout(res, 1500))
  }
  return false
}

export default function PlanChangePanel({ plan, onCancel, onDone }: { plan: SellablePlanTier; onCancel: () => void; onDone?: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'working' | 'done' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const live = useRef(true)
  // Set on every mount: React's development double-start runs the clean-up
  // once, which would otherwise leave this false and drop every answer.
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])

  // Asked once per pop-up (React's development double-start would ask twice).
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    post({ action: 'preview_plan', plan }).then(({ ok, data }) => {
      if (!live.current) return
      if (ok) { setPreview(data); setPhase('ready') }
      else { setError(data.error || 'We could not work out the price just now.'); setCode(data.code ?? null); setPhase('error') }
    }).catch(() => { if (live.current) { setError('Network problem — please try again.'); setPhase('error') } })
  }, [plan])

  async function confirm() {
    if (!preview) return
    setPhase('working'); setError(null)
    const { ok, data } = await post({ action: 'change_plan', plan, prorationDate: preview.prorationDate })
    if (!live.current) return
    if (!ok) { setError(data.error || 'Your plan was not changed. Please try again.'); setPhase('ready'); return }

    if (data.status === 'requires_action') {
      const stripe = await getStripePromise()
      const r = stripe ? await stripe.handleNextAction({ clientSecret: data.clientSecret }) : null
      if (!live.current) return
      if (!r || r.error || r.paymentIntent?.status !== 'succeeded') {
        // Drop the waiting change so the unpaid bill is never retried later.
        await post({ action: 'abandon_plan_change', invoiceId: data.invoiceId }).catch(() => {})
        setError(r?.error ? plainPaymentError(r.error) : 'Your bank’s security check wasn’t completed, so your plan was not changed.')
        setPhase('ready')
        return
      }
    }
    await waitForPlan(preview.to.tier, () => live.current)
    if (!live.current) return
    setPhase('done')
    onDone?.()
  }

  if (phase === 'loading') {
    return <div className={s.center}><div className={s.spin} aria-hidden="true" /><p>Working out the price…</p></div>
  }
  if (phase === 'error') {
    return (
      <div className={s.stack}>
        <Note tone="warn">{error}</Note>
        <div className={s.actions}>
          <Button variant="secondary" onClick={onCancel}>Close</Button>
          {code === 'fix_payment' && <Button href="/settings?tab=billing&fix=card">Update card</Button>}
        </div>
      </div>
    )
  }
  if (phase === 'done' && preview) {
    return (
      <div className={s.center} aria-live="polite">
        <div className={s.tick}><Check size={26} /></div>
        <h3>You’re on {preview.to.label}</h3>
        <p>{preview.direction === 'upgrade'
          ? `The extra credits for ${preview.to.label} are in your account.`
          : `From ${day(preview.nextDate)} you pay ${money(preview.to.priceCents)} a month. You keep this month’s credits.`}</p>
        <Button onClick={onCancel}>Done</Button>
      </div>
    )
  }
  if (!preview) return null
  const up = preview.direction === 'upgrade'
  return (
    <div className={s.stack}>
      <div className={s.compare}>
        <div className={s.compareBox}><span>Now</span><b>{preview.from.label}</b><span>{money(preview.from.priceCents)} a month</span></div>
        <ArrowRight className={s.arrow} size={20} aria-hidden="true" />
        <div className={s.compareBox} data-new=""><span>New</span><b>{preview.to.label}</b><span>{money(preview.to.priceCents)} a month · {preview.to.monthlyCredits.toLocaleString('en-US')} credits</span></div>
      </div>
      <div className={s.order}>
        <div className={`${s.row} ${s.rowTotal}`} style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
          <span>{up ? 'You pay today' : 'Nothing to pay today'}</span><b>{money(preview.dueNowCents)}</b>
        </div>
        <p className={s.small}>
          {up
            ? `That’s the difference for the rest of this month, charged to your card on file. Your extra credits are added straight away. From ${day(preview.nextDate)} you pay ${money(preview.to.priceCents)} a month.`
            : `From ${day(preview.nextDate)} you pay ${money(preview.nextAmountCents)}. You keep the credits you already have this month.`}
        </p>
      </div>
      {error && <p className={s.error} role="alert">{error}</p>}
      <div className={s.actions}>
        <Button variant="quiet" onClick={onCancel}>Keep {preview.from.label}</Button>
        <Button onClick={confirm} disabled={phase === 'working'}>
          {phase === 'working' ? 'Changing…' : up ? `Upgrade — pay ${money(preview.dueNowCents)}` : `Switch to ${preview.to.label}`}
        </Button>
      </div>
    </div>
  )
}
