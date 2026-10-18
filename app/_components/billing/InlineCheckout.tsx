'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckoutElementsProvider, PaymentElement, useCheckout } from '@stripe/react-stripe-js/checkout'
import { Check, Lock } from 'lucide-react'
import { Button, Dialog, Note } from '../kit'
import { getPlan, SOCIAL_ADDON_MONTHLY_CENTS, type SellablePlanTier } from '../../_lib/pricing'
import { CREDIT_PACKS, type CreditPackKey } from '../../_lib/credit-packs'
import { getStripePromise, stripeAppearance, STRIPE_FONTS, plainPaymentError, money } from './stripe-client'
import PlanChangePanel from './PlanChangePanel'
import s from './billing.module.css'
import { amountLabel } from '../../_lib/plan-pricing'

/*
 * IN-APP CHECKOUT (2026-10-14). Every purchase — a plan, a credit pack, the AI
 * Social add-on — is paid inside this pop-up with Stripe's Payment Element
 * (cards, Apple Pay / Google Pay where the device offers them, the bank's
 * security check right here). Nobody is sent to a Stripe page.
 *
 *  1. Ask our server for an in-app Checkout Session (the SAME routes as
 *     before: /api/stripe/checkout, /api/credits/buy, /api/social-addon/checkout).
 *  2. Show what they're buying (names and prices from pricing.ts /
 *     credit-packs.ts; today's total from Stripe so a discount shows).
 *  3. Pay → Stripe says paid → wait for the purchase to land on the account
 *     (the webhook does that; /api/billing/checkout-status tells us).
 *  4. "You're all set" — the page never changed.
 */

export type Purchase =
  | { kind: 'plan'; plan: SellablePlanTier; promo?: string | null }
  | { kind: 'pack'; pack: CreditPackKey }
  | { kind: 'social' }

type Start =
  | { phase: 'starting' }
  | { phase: 'pay'; clientSecret: string; sessionId: string; promoCodes: boolean }
  | { phase: 'change' }
  | { phase: 'blocked'; message: string; action?: { label: string; href: string } }
  | { phase: 'error'; message: string }

function describe(p: Purchase) {
  if (p.kind === 'plan') {
    const plan = getPlan(p.plan)
    return {
      title: `${plan.label} plan`,
      line: `${amountLabel(plan.monthlyCredits)} every month`,
      price: `${money(plan.monthlyPrice)} a month`,
      after: `Renews every month at ${money(plan.monthlyPrice)} until you cancel. Change or cancel any time in Settings → Billing.`,
      done: `You’re on ${plan.label}. Your monthly credits are in your account.`,
      pay: 'Start my plan',
    }
  }
  if (p.kind === 'pack') {
    const pack = CREDIT_PACKS.find((x) => x.key === p.pack) ?? CREDIT_PACKS[0]
    return {
      title: `${pack.name} credit pack`,
      line: `${amountLabel(pack.credits)} · never expire`,
      price: `${money(pack.priceCents)} once`,
      after: 'One payment. Pack credits are used after your monthly credits.',
      done: `${amountLabel(pack.credits)} were added to your account.`,
      pay: 'Pay',
    }
  }
  return {
    title: 'AI Social add-on',
    line: 'Auto-post to your social channels',
    price: `${money(SOCIAL_ADDON_MONTHLY_CENTS)} a month`,
    after: `Renews every month at ${money(SOCIAL_ADDON_MONTHLY_CENTS)} until you cancel it in Settings → Billing.`,
    done: 'AI Social is on. Connect your channels to start posting.',
    pay: 'Add AI Social',
  }
}

function endpoint(p: Purchase): { url: string; body?: unknown } {
  if (p.kind === 'plan') return { url: '/api/stripe/checkout', body: { planId: p.plan, ...(p.promo ? { promo: p.promo } : {}) } }
  if (p.kind === 'pack') return { url: '/api/credits/buy', body: { pack: p.pack } }
  return { url: '/api/social-addon/checkout' }
}

export default function InlineCheckout({ purchase, onClose, onPaid }: {
  purchase: Purchase | null
  onClose: () => void
  /** Called once the purchase is on the account (or Stripe confirmed payment). */
  onPaid?: (p: Purchase) => void
}) {
  const info = purchase ? describe(purchase) : null
  return (
    <Dialog
      open={!!purchase}
      onClose={onClose}
      modal={false}
      wide
      title={info ? info.title : ''}
      sub={info ? <>{info.line} · <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{info.price}</span></> : undefined}
    >
      {purchase && <CheckoutBody key={JSON.stringify(purchase)} purchase={purchase} onClose={onClose} onPaid={onPaid} />}
    </Dialog>
  )
}

function CheckoutBody({ purchase, onClose, onPaid }: { purchase: Purchase; onClose: () => void; onPaid?: (p: Purchase) => void }) {
  const [start, setStart] = useState<Start>({ phase: 'starting' })

  // ONE request per pop-up: React's development double-start would otherwise
  // open two payment sessions (and race two new Stripe customers). The
  // "still open?" flag is set on every mount so the answer isn't dropped.
  const started = useRef(false)
  const open = useRef(true)
  useEffect(() => { open.current = true; return () => { open.current = false } }, [])
  useEffect(() => {
    if (started.current) return
    started.current = true
    const { url, body } = endpoint(purchase)
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!open.current) return
        if (res.ok && data.clientSecret) {
          setStart({ phase: 'pay', clientSecret: data.clientSecret, sessionId: data.sessionId, promoCodes: !!data.promoCodes })
        } else if (data.code === 'change_in_place') {
          setStart({ phase: 'change' })
        } else if (data.code === 'card_required') {
          const here = window.location.pathname + window.location.search
          setStart({ phase: 'blocked', message: data.error || 'Add a card first.', action: { label: 'Add a card', href: `/setup-payment?next=${encodeURIComponent(here)}` } })
        } else if (data.code === 'fix_payment') {
          setStart({ phase: 'blocked', message: data.error, action: { label: 'Update card', href: '/settings?tab=billing&fix=card' } })
        } else {
          setStart({ phase: 'error', message: data.error || 'We could not open the payment form. Please try again.' })
        }
      })
      .catch(() => { if (open.current) setStart({ phase: 'error', message: 'Network problem — please check your connection and try again.' }) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase])

  if (start.phase === 'starting') {
    return <div className={s.center}><div className={s.spin} aria-hidden="true" /><p>Opening the secure payment form…</p></div>
  }
  if (start.phase === 'change' && purchase.kind === 'plan') {
    return <PlanChangePanel plan={purchase.plan} onCancel={onClose} onDone={() => onPaid?.(purchase)} />
  }
  if (start.phase === 'blocked') {
    return (
      <div className={s.stack}>
        <Note tone="warn">{start.message}</Note>
        <div className={s.actions}>
          <Button variant="quiet" onClick={onClose}>Not now</Button>
          {start.action && <Button href={start.action.href}>{start.action.label}</Button>}
        </div>
      </div>
    )
  }
  if (start.phase === 'error' || start.phase === 'change') {
    return (
      <div className={s.stack}>
        <p className={s.error} role="alert">{start.phase === 'error' ? start.message : 'Something went wrong.'}</p>
        <div className={s.actions}><Button variant="secondary" onClick={onClose}>Close</Button></div>
      </div>
    )
  }
  return <PayStep purchase={purchase} clientSecret={start.clientSecret} sessionId={start.sessionId} promoCodes={start.promoCodes} onClose={onClose} onPaid={onPaid} />
}

function PayStep({ purchase, clientSecret, sessionId, promoCodes, onClose, onPaid }: {
  purchase: Purchase; clientSecret: string; sessionId: string; promoCodes: boolean; onClose: () => void; onPaid?: (p: Purchase) => void
}) {
  const stripePromise = useMemo(() => getStripePromise(), [])
  const [noStripe, setNoStripe] = useState(false)
  useEffect(() => { stripePromise.then((st) => { if (!st) setNoStripe(true) }) }, [stripePromise])
  const options = useMemo(() => ({
    clientSecret,
    elementsOptions: { appearance: stripeAppearance(), fonts: STRIPE_FONTS, savedPaymentMethod: { enableSave: 'never' as const, enableRedisplay: 'auto' as const } },
  }), [clientSecret])
  if (noStripe) {
    return <div className={s.stack}><p className={s.error} role="alert">The secure payment form didn’t load. Check your internet connection (or turn off a blocker for this page), then try again.</p><div className={s.actions}><Button variant="secondary" onClick={onClose}>Close</Button></div></div>
  }
  return (
    <CheckoutElementsProvider stripe={stripePromise} options={options}>
      <PayForm purchase={purchase} sessionId={sessionId} promoCodes={promoCodes} onClose={onClose} onPaid={onPaid} />
    </CheckoutElementsProvider>
  )
}

/** Wait until the purchase is on the account (webhook), up to ~60 s. */
async function waitForFulfilment(sessionId: string, isLive: () => boolean): Promise<'done' | 'slow'> {
  for (let i = 0; i < 40 && isLive(); i++) {
    try {
      const r = await fetch(`/api/billing/checkout-status?session_id=${encodeURIComponent(sessionId)}`)
      if (r.ok) {
        const d = await r.json()
        if (d.fulfilled) return 'done'
      }
    } catch { /* keep waiting */ }
    await new Promise((res) => setTimeout(res, 1500))
  }
  return 'slow'
}

function PayForm({ purchase, sessionId, promoCodes, onClose, onPaid }: {
  purchase: Purchase; sessionId: string; promoCodes: boolean; onClose: () => void; onPaid?: (p: Purchase) => void
}) {
  const result = useCheckout()
  const info = describe(purchase)
  const [phase, setPhase] = useState<'form' | 'paying' | 'finishing' | 'done' | 'slow'>('form')
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [code, setCode] = useState('')
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  const live = useRef(true)
  // Set on every mount: React's development double-start runs the clean-up
  // once, which would otherwise leave this false and drop every answer.
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])

  if (result.type === 'loading') {
    return <div className={s.center}><div className={s.spin} aria-hidden="true" /><p>Opening the secure payment form…</p></div>
  }
  if (result.type === 'error') {
    return (
      <div className={s.stack}>
        <p className={s.error} role="alert">The payment form didn’t load. Please close this and try again.</p>
        <div className={s.actions}><Button variant="secondary" onClick={onClose}>Close</Button></div>
      </div>
    )
  }
  const checkout = result.checkout

  if (phase === 'finishing') {
    return <div className={s.center} aria-live="polite"><div className={s.spin} aria-hidden="true" /><h3>Payment received</h3><p>Setting it up on your account…</p></div>
  }
  if (phase === 'done' || phase === 'slow') {
    return (
      <div className={s.center} aria-live="polite">
        <div className={s.tick}><Check size={26} /></div>
        <h3>{phase === 'done' ? 'You’re all set' : 'Payment received'}</h3>
        <p>{phase === 'done' ? info.done : 'It can take a minute to show on your account. You can close this — your receipt is in Settings → Billing.'}</p>
        <Button onClick={onClose}>Done</Button>
      </div>
    )
  }

  const discount = checkout.discountAmounts?.[0] ?? null
  const total = checkout.total.total

  async function applyCode() {
    const c = code.trim()
    if (!c) return
    setCodeBusy(true); setCodeError(null)
    const r = await checkout.applyPromotionCode(c)
    setCodeBusy(false)
    if (r.type === 'error') setCodeError('That code isn’t valid for this plan.')
    else setCode('')
  }

  async function pay() {
    setError(null)
    setPhase('paying')
    const r = await checkout.confirm({ redirect: 'if_required' })
    if (!live.current) return
    if (r.type === 'error') {
      // Unfinished fields come back as a validation error; Stripe also marks
      // the field itself.
      const e = r.error as { code?: string; message?: string }
      setError(e.code === 'paymentFailed' ? plainPaymentError(r.error as never) : (e.message || plainPaymentError(r.error as never)))
      setPhase('form')
      return
    }
    setPhase('finishing')
    const end = await waitForFulfilment(sessionId, () => live.current)
    if (!live.current) return
    setPhase(end)
    onPaid?.(purchase)
  }

  return (
    <div className={s.stack}>
      <div className={s.order}>
        <div className={s.row}><span className={s.itemName}>{info.title}</span><b>{info.price}</b></div>
        {discount && (
          <div className={s.row}>
            <span>Discount{discount.promotionCode ? ` (${discount.promotionCode})` : ''}</span>
            <span>−{discount.amount}</span>
          </div>
        )}
        <div className={`${s.row} ${s.rowTotal}`}><span>Today</span><b>{total.amount}</b></div>
        <p className={s.small}>{info.after}</p>
      </div>

      {purchase.kind === 'plan' && promoCodes && (
        discount?.promotionCode ? (
          <div className={s.promoApplied}>
            <span>Code {discount.promotionCode} applied</span>
            <button type="button" className={s.linkBtn} onClick={() => checkout.removePromotionCode()}>Remove</button>
          </div>
        ) : (
          <div>
            <div className={s.promo}>
              <input aria-label="Promo code" placeholder="Promo code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCode() } }} />
              <Button variant="secondary" size="sm" onClick={applyCode} disabled={codeBusy || !code.trim()}>{codeBusy ? 'Checking…' : 'Apply'}</Button>
            </div>
            {codeError && <p className={s.small} role="alert" style={{ color: 'var(--error-text)', marginTop: 6 }}>{codeError}</p>}
          </div>
        )
      )}

      <div className={s.element}>
        <PaymentElement
          options={{ layout: 'tabs', wallets: { applePay: 'auto', googlePay: 'auto' } }}
          onReady={() => setReady(true)}
          onChange={(e) => { if (e.complete) setError(null) }}
        />
      </div>

      {error && <p className={s.error} role="alert">{error}</p>}

      <Button full onClick={pay} disabled={!ready || phase === 'paying'}>
        <Lock size={16} />{phase === 'paying' ? 'Paying…' : `${info.pay} — ${total.amount}`}
      </Button>
      <p className={s.small} style={{ textAlign: 'center' }}>
        Paid securely through Stripe — your card details never touch our servers. <strong>Docs2Video</strong> is the name on your card statement and receipt.
      </p>
    </div>
  )
}
