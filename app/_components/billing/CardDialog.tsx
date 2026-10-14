'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Check } from 'lucide-react'
import { Button, Dialog } from '../kit'
import { getStripePromise, stripeAppearance, STRIPE_FONTS, plainPaymentError, money } from './stripe-client'
import s from './billing.module.css'

/*
 * ADD A CARD / UPDATE CARD, IN THE APP (replaces the Stripe portal's card
 * page). Stripe's Payment Element saves the card here (SetupIntent — nothing
 * is charged just for saving it).
 *  - An account with NO card yet goes through the trial step
 *    (/api/create-setup-intent → /api/confirm-card), so "one card, one free
 *    trial" is checked exactly as on /setup-payment.
 *  - Everyone else: /api/billing/manage setup_card → card_added. When a
 *    payment is LATE ("fix" mode), the open bill is paid with the new card
 *    right away; a bank security check opens here if needed.
 */

type Mode = 'add' | 'fix'

export default function CardDialog({ open, mode, onClose, onSaved, trialStep, pastDueCents }: {
  open: boolean
  mode: Mode
  onClose: () => void
  onSaved?: () => void
  /** No card on file yet: use the trial card step. */
  trialStep: boolean
  pastDueCents?: number | null
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      modal={false}
      title={mode === 'fix' ? 'Update your card' : 'Add a card'}
      sub={mode === 'fix'
        ? `We’ll pay the late bill${pastDueCents ? ` of ${money(pastDueCents)}` : ''} with this card right away, and use it from now on.`
        : trialStep ? 'Your card starts your free trial — nothing is charged today.' : 'Saved securely with Stripe. Nothing is charged today.'}
    >
      {open && <CardBody mode={mode} trialStep={trialStep} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  )
}

function CardBody({ mode, trialStep, onClose, onSaved }: { mode: Mode; trialStep: boolean; onClose: () => void; onSaved?: () => void }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stripePromise = useMemo(() => getStripePromise(), [])

  // Only once the form is about to show (the server said yes): a Stripe.js
  // that didn't load is then the one thing in the way.
  useEffect(() => {
    if (!clientSecret) return
    getStripePromise().then((st) => { if (!st) setError('The secure payment form didn’t load. Check your internet connection (or turn off a blocker for this page), then try again.') })
  }, [clientSecret])

  // ONE request per pop-up: React's development double-start would otherwise
  // open two payment sessions (and race two new Stripe customers). The
  // "still open?" flag is set on every mount so the answer isn't dropped.
  const started = useRef(false)
  const open = useRef(true)
  useEffect(() => { open.current = true; return () => { open.current = false } }, [])
  useEffect(() => {
    if (started.current) return
    started.current = true
    const req = trialStep
      ? fetch('/api/create-setup-intent', { method: 'POST' })
      : fetch('/api/billing/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setup_card' }) })
    req.then(async (r) => {
      const d = await r.json().catch(() => ({}))
      if (!open.current) return
      if (r.ok && d.clientSecret) setClientSecret(d.clientSecret)
      else setError(d.error || 'We could not open the card form. Please try again.')
    }).catch(() => { if (open.current) setError('Network problem — please try again.') })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialStep])

  if (error) {
    return <div className={s.stack}><p className={s.error} role="alert">{error}</p><div className={s.actions}><Button variant="secondary" onClick={onClose}>Close</Button></div></div>
  }
  if (!clientSecret) {
    return <div className={s.center}><div className={s.spin} aria-hidden="true" /><p>Opening the secure card form…</p></div>
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance(), fonts: STRIPE_FONTS }}>
      <CardForm mode={mode} trialStep={trialStep} onClose={onClose} onSaved={onSaved} />
    </Elements>
  )
}

function CardForm({ mode, trialStep, onClose, onSaved }: { mode: Mode; trialStep: boolean; onClose: () => void; onSaved?: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [makeDefault, setMakeDefault] = useState(true)
  const [done, setDone] = useState<string | null>(null)
  const live = useRef(true)
  // Set on every mount: React's development double-start runs the clean-up
  // once, which would otherwise leave this false and drop every answer.
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])

  async function save() {
    if (!stripe || !elements) return
    // Stripe checks the fields and shows what's wrong next to them; nothing
    // is sent while the form is unfinished.
    const { error: fieldError } = await elements.submit()
    if (fieldError) { setError(fieldError.message ?? 'Please finish the card details above.'); return }
    setBusy(true); setError(null)
    const { error: err, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: `${window.location.origin}/settings?tab=billing&card=added` },
    })
    if (!live.current) return
    if (err || !setupIntent) { setError(plainPaymentError(err as never)); setBusy(false); return }

    if (trialStep) {
      const r = await fetch('/api/confirm-card', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setupIntentId: setupIntent.id }) })
      const d = await r.json().catch(() => ({}))
      if (!live.current) return
      if (!r.ok) { setError(d.error || 'We could not save your card. Please try again.'); setBusy(false); return }
      setDone('Your card is saved and your free trial has started.')
    } else {
      const r = await fetch('/api/billing/manage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'card_added', setupIntentId: setupIntent.id, makeDefault: mode === 'fix' || makeDefault }),
      })
      const d = await r.json().catch(() => ({}))
      if (!live.current) return
      if (!r.ok) { setError(d.error || 'We could not save your card. Please try again.'); setBusy(false); return }
      if (d.retry?.status === 'requires_action') {
        const a = await stripe.handleNextAction({ clientSecret: d.retry.clientSecret })
        if (!live.current) return
        if (a.error || a.paymentIntent?.status !== 'succeeded') {
          setError('Your card is saved, but your bank’s security check wasn’t completed, so the late bill is still unpaid. Press Pay now to try again.')
          setBusy(false)
          onSaved?.()
          return
        }
        setDone('Your card is saved and the late bill is paid. Thank you!')
      } else if (d.retry?.status === 'paid') {
        setDone('Your card is saved and the late bill is paid. Thank you!')
      } else {
        setDone(mode === 'fix' ? 'Your card is saved and will be used from now on.' : 'Your card is saved.')
      }
    }
    setBusy(false)
    onSaved?.()
  }

  if (done) {
    return (
      <div className={s.center} aria-live="polite">
        <div className={s.tick}><Check size={26} /></div>
        <h3>Done</h3>
        <p>{done}</p>
        <Button onClick={onClose}>Close</Button>
      </div>
    )
  }

  return (
    <div className={s.stack}>
      <div className={s.element}>
        <PaymentElement
          options={{ layout: 'tabs', paymentMethodOrder: ['card', 'apple_pay', 'google_pay'], wallets: { applePay: 'auto', googlePay: 'auto' } }}
          onReady={() => setReady(true)}
        />
      </div>
      {mode === 'add' && !trialStep && (
        <label className={s.check}>
          <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
          Use this card for future bills
        </label>
      )}
      {error && <p className={s.error} role="alert">{error}</p>}
      <div className={s.actions}>
        <Button variant="quiet" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={!ready || busy}>
          {busy ? 'Saving…' : mode === 'fix' ? 'Save card and pay' : 'Save card'}
        </Button>
      </div>
    </div>
  )
}
