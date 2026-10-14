'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, CreditCard, FileDown, Plus } from 'lucide-react'
import { useBrand } from '../../_components/BrandProvider'
import { Button, Chip, Dialog, Note } from '../../_components/kit'
import { useToast } from '../../_components/Toast'
import InlineCheckout, { type Purchase } from '../../_components/billing/InlineCheckout'
import PlanChangePanel from '../../_components/billing/PlanChangePanel'
import CardDialog from '../../_components/billing/CardDialog'
import { money, day } from '../../_components/billing/stripe-client'
import type { Profile } from '../../_lib/types'
import { PLANS, getPlan, getUserTier, isSellablePlan, SOCIAL_ADDON_MONTHLY_CENTS, type PlanTier, type SellablePlanTier } from '../../_lib/pricing'
import { TIER_CREDITS, TIER_APPROX_VIDEOS, CREDIT_COSTS } from '../../_lib/credits'
import { CREDIT_PACKS, packPrice } from '../../_lib/credit-packs'
import { planName } from '../../_lib/names'
import type { BillingState } from '../../_lib/billing-manage'
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

const CANCEL_REASONS: Array<[string, string]> = [
  ['too_expensive', 'It costs too much'],
  ['unused', 'I’m not using it enough'],
  ['missing_features', 'It’s missing something I need'],
  ['switched_service', 'I’m switching to something else'],
  ['too_complex', 'It’s too hard to use'],
  ['low_quality', 'The videos aren’t good enough'],
  ['other', 'Something else'],
]

const COUNTRIES: Array<[string, string]> = [
  ['US', 'United States'], ['CA', 'Canada'], ['GB', 'United Kingdom'], ['AU', 'Australia'], ['NZ', 'New Zealand'],
  ['IE', 'Ireland'], ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'],
  ['BE', 'Belgium'], ['SE', 'Sweden'], ['NO', 'Norway'], ['DK', 'Denmark'], ['FI', 'Finland'], ['CH', 'Switzerland'],
  ['AT', 'Austria'], ['PT', 'Portugal'], ['PL', 'Poland'], ['MX', 'Mexico'], ['BR', 'Brazil'], ['IN', 'India'],
  ['SG', 'Singapore'], ['JP', 'Japan'], ['ZA', 'South Africa'], ['AE', 'United Arab Emirates'], ['PH', 'Philippines'],
]

async function manage(body: Record<string, unknown>) {
  const res = await fetch('/api/billing/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

const statusChip = (st: string) =>
  st === 'paid' ? <Chip tone="ok">Paid</Chip>
    : st === 'open' ? <Chip tone="warn">Due</Chip>
      : st === 'void' ? <Chip>Cancelled</Chip>
        : st === 'uncollectible' ? <Chip tone="stop">Not paid</Chip>
          : <Chip>{st}</Chip>

/**
 * SETTINGS → BILLING & CREDITS — everything in the app (2026-10-14; the
 * Stripe billing portal and Stripe-hosted checkout are retired).
 * Order: late-payment fix (if any) · three summary cards (plan + next charge ·
 * credits · this period) · plans · credit packs · AI Social add-on · payment
 * methods · invoices and receipts · billing details.
 * Buying opens InlineCheckout (Stripe's Payment Element in our pop-up);
 * changing plan opens PlanChangePanel (proration preview first); cards, cancel
 * and resume go through /api/billing/manage. Prices come from pricing.ts and
 * credit-packs.ts only.
 */
export default function BillingSection({ profile }: { profile: Profile }) {
  const storefront = useBrand()
  const notify = useToast()
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [billing, setBilling] = useState<BillingState | null>(null)
  const [billingError, setBillingError] = useState(false)
  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [changeTo, setChangeTo] = useState<SellablePlanTier | null>(null)
  const [cancelWhich, setCancelWhich] = useState<'plan' | 'social' | null>(null)
  const [cardMode, setCardMode] = useState<'add' | 'fix' | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [cardOnFile, setCardOnFile] = useState<boolean>(!!profile.card_on_file)

  const loadSummary = useCallback(() => {
    fetch('/api/billing/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.total === 'number') setSummary(d) })
      .catch(() => {})
  }, [])
  const loadBilling = useCallback(async () => {
    try {
      const r = await fetch('/api/billing/manage')
      if (!r.ok) throw new Error()
      const d = (await r.json()) as BillingState
      setBilling(d)
      setBillingError(false)
      if (d.cards.length > 0) setCardOnFile(true)
      return d
    } catch {
      setBillingError(true)
      return null
    }
  }, [])
  const reload = useCallback(() => {
    loadSummary(); loadBilling()
    // The top bar's credit count.
    window.dispatchEvent(new Event('d2v:credits-changed'))
  }, [loadSummary, loadBilling])

  useEffect(() => { loadSummary(); loadBilling() }, [loadSummary, loadBilling])

  // Links that land here: ?fix=card (dashboard's late-payment banner),
  // ?checkout=cs_… (back from a bank page some payment methods need),
  // ?setup_intent=…&redirect_status=… (same, for saving a card).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const clean = (keys: string[]) => {
      keys.forEach((k) => q.delete(k))
      window.history.replaceState(null, '', `${window.location.pathname}${q.toString() ? `?${q}` : ''}`)
    }
    if (q.get('fix') === 'card') { setCardMode('fix'); clean(['fix']) }
    const cs = q.get('checkout')
    if (cs && /^cs_/.test(cs)) {
      clean(['checkout'])
      notify('Finishing your payment…', 'success')
      ;(async () => {
        for (let i = 0; i < 30; i++) {
          const r = await fetch(`/api/billing/checkout-status?session_id=${encodeURIComponent(cs)}`).catch(() => null)
          const d = r && r.ok ? await r.json() : null
          if (d?.fulfilled) { notify('Payment received — you’re all set.', 'success'); reload(); return }
          if (d && d.status === 'open' && i > 3) { notify('That payment wasn’t finished, so nothing was charged.', 'error'); return }
          await new Promise((res) => setTimeout(res, 1500))
        }
        reload()
      })()
    }
    const seti = q.get('setup_intent')
    if (seti && q.get('redirect_status')) {
      clean(['setup_intent', 'setup_intent_client_secret', 'redirect_status', 'card'])
      if (q.get('redirect_status') === 'succeeded') {
        manage({ action: 'card_added', setupIntentId: seti, makeDefault: true }).then(({ ok }) => {
          notify(ok ? 'Your card is saved.' : 'We could not save that card. Please try again.', ok ? 'success' : 'error')
          reload()
        })
      }
    }
  }, [notify, reload])

  const status = profile.subscription_status?.toLowerCase() ?? ''
  const live = billing?.plan ?? null
  // Stripe's answer wins once it's loaded (the profile prop is read once).
  const tier: PlanTier = live && live.status !== 'trialing' && live.tier ? live.tier : getUserTier(status)
  const plan = getPlan(tier)
  const pastDue = billing?.pastDue ?? null
  const isPastDue = !!pastDue || status === 'past_due'
  const paying = !!live && live.status === 'active'
  const defaultCard = billing?.cards.find((c) => c.isDefault) ?? billing?.cards[0] ?? null

  /** What a plan gets you, said in the units this storefront sells. */
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

  function choosePlan(t: SellablePlanTier) {
    if (isPastDue) { setCardMode('fix'); return }
    if (paying) setChangeTo(t)
    else setPurchase({ kind: 'plan', plan: t })
  }

  async function resume(which: 'plan' | 'social') {
    setBusy(`resume-${which}`)
    const { ok, data } = await manage({ action: 'resume', which })
    setBusy(null)
    notify(ok ? (which === 'plan' ? 'Your plan will keep renewing.' : 'AI Social will keep renewing.') : data.error || 'That didn’t work. Please try again.', ok ? 'success' : 'error')
    if (ok) reload()
  }

  async function makeDefault(id: string) {
    setBusy(`default-${id}`)
    const { ok, data } = await manage({ action: 'set_default', cardId: id })
    setBusy(null)
    notify(ok ? 'That card will be used for your next bills.' : data.error || 'That didn’t work. Please try again.', ok ? 'success' : 'error')
    if (ok) loadBilling()
  }

  async function payNow() {
    if (!defaultCard) { setCardMode('fix'); return }
    setBusy('paynow')
    const { ok, data } = await manage({ action: 'retry_payment', cardId: defaultCard.id })
    if (ok && data.status === 'requires_action') {
      const { getStripePromise } = await import('../../_components/billing/stripe-client')
      const stripe = await getStripePromise()
      const r = stripe ? await stripe.handleNextAction({ clientSecret: data.clientSecret }) : null
      setBusy(null)
      if (!r || r.error || r.paymentIntent?.status !== 'succeeded') { notify('Your bank’s security check wasn’t completed, so the bill is still unpaid.', 'error'); return }
      notify('Paid — thank you! Your account is unlocked in a few seconds.', 'success')
      setTimeout(reload, 2500)
      return
    }
    setBusy(null)
    if (ok && data.status === 'paid') { notify('Paid — thank you! Your account is unlocked in a few seconds.', 'success'); setTimeout(reload, 2500) }
    else if (ok) { notify('There’s no late bill to pay right now.', 'success'); reload() }
    else notify(data.error || 'That card was declined. Try another card.', 'error')
  }

  const bar = creditBar(summary, tier)
  const since = day(summary?.cycleStart ?? null)
  const planLine = isPastDue
    ? 'Your last payment didn’t go through.'
    : live?.status === 'trialing'
      ? `Free trial — your ${live.label} plan starts when your free credits run out.`
      : live?.cancelAtPeriodEnd
        ? `Ends ${day(live.cancelAt ?? live.periodEnd)} — you keep everything until then.`
        : billing?.nextCharge
          ? `Next charge ${money(billing.nextCharge.amountCents)} on ${day(billing.nextCharge.date)}`
          : tier === 'free'
            ? 'Free credits to start, then top up as you need them.'
            : allowance(tier)

  return (
    <div className={s.stack}>
      {/* ── 0. Late payment: fix it right here ── */}
      {isPastDue && (
        <Note
          tone="stop"
          title={`Your last payment${pastDue ? ` of ${money(pastDue.amountCents)}` : ''} didn’t go through.`}
          action={
            <span className={s.noteActions}>
              <Button size="sm" onClick={() => setCardMode('fix')}><CreditCard size={16} />Update card</Button>
              {defaultCard && pastDue && (
                <Button size="sm" variant="secondary" onClick={payNow} disabled={busy === 'paynow'}>
                  {busy === 'paynow' ? 'Paying…' : `Pay now with ${defaultCard.brand} •••• ${defaultCard.last4 ?? ''}`}
                </Button>
              )}
            </span>
          }
        >
          New videos are paused until it’s paid. Update your card and we’ll pay the bill straight away.
        </Note>
      )}

      {/* ── 1. Three summary cards ── */}
      <div className={s.summary}>
        <section className={`kit-card ${s.sumCard}`} aria-labelledby="sum-plan">
          <h2 id="sum-plan" className="kit-label">Current plan</h2>
          <p className={s.sumBig}>{live && live.status !== 'trialing' && live.tier ? live.label : planName(profile.subscription_status)}</p>
          <p className={s.sumPrice}>
            {plan.monthlyPrice > 0
              ? <><b>{money(plan.monthlyPrice)}</b> a month</>
              : 'No monthly fee'}
          </p>
          <p className={s.sumLine} data-testid="plan-line">{planLine}</p>
          {live?.cancelAtPeriodEnd ? (
            <Button size="sm" onClick={() => resume('plan')} disabled={busy === 'resume-plan'}>{busy === 'resume-plan' ? 'One moment…' : 'Keep my plan'}</Button>
          ) : live && !isPastDue ? (
            <Button variant="quiet" size="sm" onClick={() => setCancelWhich('plan')}>
              {live.status === 'trialing' ? 'Turn off the automatic plan' : 'Cancel plan'}
            </Button>
          ) : null}
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
          <Button size="sm" onClick={() => document.getElementById('billing-packs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Buy credits</Button>
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
          statement is Docs2Video whichever site the customer bought from. */}
      {storefront.id !== 'docs2video' && (
        <p className={s.hint}>
          Billing is handled by <strong>Docs2Video</strong> — that is the name on your card statement and receipts.
        </p>
      )}

      {/* ── 2. Plans ── */}
      <section aria-labelledby="billing-plans">
        <h2 id="billing-plans" className={s.h2}>Plans</h2>
        <p className={s.hint}>Change or cancel any time. You see the price before anything is charged. Unused monthly credits don’t roll over; credits from packs never expire.</p>
        <div className={s.plans}>
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
                  <b>{money(p.monthlyPrice)}</b>{p.monthlyPrice > 0 && <span>/month</span>}
                </p>
                <p className={s.planHighlight}>{highlight}</p>
                <ul className={s.planList}>
                  {features.map((f) => <li key={f}><Check size={14} />{f}</li>)}
                </ul>
                <div className={s.planAction}>
                  {isCurrent ? (
                    <span className={s.planWell}>Your plan</span>
                  ) : p.tier === 'free' ? (
                    paying && !live?.cancelAtPeriodEnd
                      ? <Button variant="secondary" size="sm" full onClick={() => setCancelWhich('plan')}>Downgrade</Button>
                      : <span className={s.planWell}>Default</span>
                  ) : isSellablePlan(p.tier) ? (
                    <Button size="sm" full onClick={() => choosePlan(p.tier as SellablePlanTier)}>
                      {paying ? `Switch to ${p.label}` : `Subscribe to ${p.label}`}
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 3. Credit packs (credit-packs.ts) ── */}
      <section aria-labelledby="billing-packs">
        <h2 id="billing-packs" className={s.h2}>Credit packs</h2>
        <p className={s.hint}>Top up any time. Pack credits never expire and are used after your monthly credits.</p>
        <div className={s.packs}>
          {CREDIT_PACKS.map((p) => (
            <div key={p.key} className={`kit-card ${s.pack}`}>
              <h3 className={s.packName}>{p.credits.toLocaleString()} credits</h3>
              <p className={s.packMeta}><span className={s.money}>{packPrice(p)}</span> · {p.name} pack · never expire</p>
              <Button variant="secondary" size="sm" onClick={() => setPurchase({ kind: 'pack', pack: p.key })} aria-label={`Buy the ${p.name} pack`}>Buy</Button>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. AI Social add-on (only when it's on the account) ── */}
      {billing?.addon && (
        <section className={`kit-card ${s.rowCard}`} aria-labelledby="billing-addon">
          <div>
            <h2 id="billing-addon" className={s.h2}>AI Social add-on</h2>
            <p className={s.hint}>
              {money(billing.addon.priceCents ?? SOCIAL_ADDON_MONTHLY_CENTS)} a month ·{' '}
              {billing.addon.cancelAtPeriodEnd ? `ends ${day(billing.addon.periodEnd)}` : `renews ${day(billing.addon.periodEnd)}`}
            </p>
          </div>
          {billing.addon.cancelAtPeriodEnd
            ? <Button size="sm" onClick={() => resume('social')} disabled={busy === 'resume-social'}>Keep AI Social</Button>
            : <Button variant="quiet" size="sm" onClick={() => setCancelWhich('social')}>Cancel add-on</Button>}
        </section>
      )}

      {/* ── 5. Payment methods ── */}
      <section aria-labelledby="billing-cards">
        <div className={s.sectionHead}>
          <h2 id="billing-cards" className={s.h2}>Payment methods</h2>
          <Button variant="secondary" size="sm" onClick={() => setCardMode('add')}><Plus size={16} />Add a card</Button>
        </div>
        {billingError ? (
          <p className={s.hint}>We couldn’t load your cards just now. <button type="button" className={s.inlineLink} onClick={() => loadBilling()}>Try again</button></p>
        ) : !billing ? (
          <p className={s.hint}>Loading…</p>
        ) : billing.cards.length === 0 ? (
          <p className={s.hint}>No card saved yet.</p>
        ) : (
          <ul className={s.cardList}>
            {billing.cards.map((c) => (
              <li key={c.id} className={`kit-card ${s.cardRow}`}>
                <CreditCard size={20} aria-hidden="true" className={s.cardIcon} />
                <div className={s.cardText}>
                  <b>{c.brand}{c.last4 ? ` •••• ${c.last4}` : ''}</b>
                  <span>
                    {c.expMonth && c.expYear ? `Expires ${String(c.expMonth).padStart(2, '0')}/${String(c.expYear).slice(-2)}` : ''}
                    {c.wallet ? ` · ${c.wallet}` : ''}
                  </span>
                </div>
                {c.isDefault && <Chip tone="ok">Default</Chip>}
                <div className={s.cardActions}>
                  {!c.isDefault && <Button variant="quiet" size="sm" onClick={() => makeDefault(c.id)} disabled={busy === `default-${c.id}`}>Make default</Button>}
                  <Button variant="quiet" size="sm" onClick={() => setRemoveId(c.id)} aria-label={`Remove ${c.brand} ending ${c.last4 ?? ''}`}>Remove</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 6. Invoices and receipts ── */}
      <section aria-labelledby="billing-invoices">
        <h2 id="billing-invoices" className={s.h2}>Invoices and receipts</h2>
        {!billing || billing.invoices.length === 0 ? (
          <p className={s.hint}>
            {billing && !billing.hasCustomer
              ? 'You haven’t paid for anything yet, so there are no invoices. They appear here after your first purchase.'
              : billing ? 'No invoices yet.' : 'Loading…'}
          </p>
        ) : (
          <div className={`kit-card ${s.invTableWrap}`}>
            <table className={s.invTable}>
              <thead>
                <tr><th scope="col">Date</th><th scope="col">What</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col"><span className={s.srOnly}>Download</span></th></tr>
              </thead>
              <tbody>
                {billing.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td data-label="Date">{day(inv.date)}</td>
                    <td data-label="What">{inv.description}{inv.number ? <span className={s.invNum}> · {inv.number}</span> : null}</td>
                    <td data-label="Amount" className={s.money}>{money(inv.amountCents)}</td>
                    <td data-label="Status">{statusChip(inv.status)}</td>
                    <td className={s.invPdf}>
                      {inv.pdf && <a href={inv.pdf} target="_blank" rel="noopener noreferrer" className="kit-btn kit-btn--quiet kit-btn--sm" aria-label={`Download PDF for ${day(inv.date)}`}><FileDown size={16} />PDF</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 7. Billing details (name, email and address on invoices) ── */}
      {billing?.hasCustomer && <BillingDetails billing={billing} onSaved={() => { notify('Billing details saved.', 'success'); loadBilling() }} />}

      <InlineCheckout purchase={purchase} onClose={() => { setPurchase(null); reload() }} onPaid={() => reload()} />

      <Dialog open={!!changeTo} onClose={() => { setChangeTo(null); reload() }} modal={false} wide title={changeTo ? `Change to ${getPlan(changeTo).label}` : ''} sub="You see the price before anything is charged.">
        {changeTo && <PlanChangePanel plan={changeTo} onCancel={() => { setChangeTo(null); reload() }} onDone={reload} />}
      </Dialog>

      <CancelDialog which={cancelWhich} billing={billing} onClose={() => setCancelWhich(null)} onDone={(msg) => { setCancelWhich(null); notify(msg, 'success'); reload() }} />

      <CardDialog
        open={!!cardMode}
        mode={cardMode ?? 'add'}
        trialStep={!cardOnFile && !(billing && billing.cards.length > 0)}
        pastDueCents={pastDue?.amountCents ?? null}
        onClose={() => { setCardMode(null); reload() }}
        onSaved={() => { setCardOnFile(true); reload() }}
      />

      <Dialog
        open={!!removeId}
        onClose={() => setRemoveId(null)}
        title="Remove this card?"
        sub="It won’t be charged again. You can add it back any time."
        footer={
          <>
            <Button variant="quiet" onClick={() => setRemoveId(null)}>Keep it</Button>
            <Button
              disabled={busy === 'remove'}
              onClick={async () => {
                const id = removeId
                setBusy('remove')
                const { ok, data } = await manage({ action: 'remove_card', cardId: id })
                setBusy(null)
                setRemoveId(null)
                notify(ok ? 'Card removed.' : data.error || 'That didn’t work. Please try again.', ok ? 'success' : 'error')
                if (ok) loadBilling()
              }}
            >
              {busy === 'remove' ? 'Removing…' : 'Remove card'}
            </Button>
          </>
        }
      >
        {(() => {
          const c = billing?.cards.find((x) => x.id === removeId)
          return c ? <p>{c.brand}{c.last4 ? ` •••• ${c.last4}` : ''}{c.isDefault ? ' — your bills use this card now; we’ll move them to your other card.' : ''}</p> : null
        })()}
      </Dialog>
    </div>
  )
}

function CancelDialog({ which, billing, onClose, onDone }: {
  which: 'plan' | 'social' | null
  billing: BillingState | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (which) { setReason(''); setComment(''); setError(null) } }, [which])

  const plan = billing?.plan ?? null
  const trial = which === 'plan' && plan?.status === 'trialing'
  const endsNow = which === 'plan' && !!plan && plan.status !== 'active' && plan.status !== 'trialing'
  const ends = which === 'social' ? billing?.addon?.periodEnd : plan?.periodEnd
  const title = which === 'social' ? 'Cancel AI Social?' : trial ? 'Turn off the automatic plan?' : 'Cancel your plan?'
  const sub = which === 'social'
    ? `AI Social keeps working until ${day(ends)}. After that, posting stops and you aren’t charged again.`
    : trial
      ? 'Nothing will be charged when your free credits run out. You keep the credits you have, and you can pick a plan any time.'
      : endsNow
        ? 'Your plan stops now and you won’t be charged again.'
        : `You keep your plan and credits until ${day(ends)}. After that you move to Free and aren’t charged again. You can change your mind before then.`

  async function go() {
    setBusy(true); setError(null)
    const { ok, data } = await manage({ action: 'cancel', which, reason, comment })
    setBusy(false)
    if (!ok) { setError(data.error || 'That didn’t work. Please try again.'); return }
    onDone(data.status === 'stopped_now'
      ? (trial ? 'Done — nothing will be charged when your free credits run out.' : 'Your plan has stopped.')
      : `Cancelled — you keep everything until ${day(data.endsAt ?? ends)}.`)
  }

  return (
    <Dialog
      open={!!which}
      onClose={onClose}
      title={title}
      sub={sub}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>{which === 'social' ? 'Keep AI Social' : 'Keep my plan'}</Button>
          <Button onClick={go} disabled={busy}>{busy ? 'One moment…' : which === 'social' ? 'Cancel add-on' : trial ? 'Turn it off' : 'Cancel plan'}</Button>
        </>
      }
    >
      <fieldset className={s.reasons}>
        <legend className={s.reasonsLegend}>Mind telling us why? (optional)</legend>
        {CANCEL_REASONS.map(([value, label]) => (
          <label key={value}>
            <input type="radio" name="cancel-reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
            {label}
          </label>
        ))}
        <textarea className={s.reasonText} aria-label="Anything else?" placeholder="Anything else? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      </fieldset>
      {error && <p className={s.errorText} role="alert">{error}</p>}
    </Dialog>
  )
}

function BillingDetails({ billing, onSaved }: { billing: BillingState; onSaved: () => void }) {
  const a = billing.details.address
  const [form, setForm] = useState({
    name: billing.details.name ?? '',
    email: billing.details.email ?? '',
    line1: a?.line1 ?? '', line2: a?.line2 ?? '', city: a?.city ?? '',
    state: a?.state ?? '', postal_code: a?.postal_code ?? '', country: a?.country ?? 'US',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { ok, data } = await manage({
      action: 'update_details', name: form.name, email: form.email,
      address: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, postal_code: form.postal_code, country: form.country },
    })
    setBusy(false)
    if (ok) onSaved()
    else setError(data.error || 'That didn’t save. Please try again.')
  }

  return (
    <section aria-labelledby="billing-details">
      <h2 id="billing-details" className={s.h2}>Billing details</h2>
      <p className={s.hint}>The name, email and address printed on your invoices. Receipts go to this email.</p>
      <form className={`kit-card ${s.detailsForm}`} onSubmit={save}>
        <label className={s.field}><span>Name or company</span><input value={form.name} onChange={set('name')} autoComplete="organization" maxLength={120} /></label>
        <label className={s.field}><span>Email for receipts</span><input type="email" value={form.email} onChange={set('email')} autoComplete="email" maxLength={200} /></label>
        <label className={`${s.field} ${s.fieldWide}`}><span>Address</span><input value={form.line1} onChange={set('line1')} autoComplete="address-line1" maxLength={200} /></label>
        <label className={`${s.field} ${s.fieldWide}`}><span>Address line 2 (optional)</span><input value={form.line2} onChange={set('line2')} autoComplete="address-line2" maxLength={200} /></label>
        <label className={s.field}><span>City</span><input value={form.city} onChange={set('city')} autoComplete="address-level2" maxLength={100} /></label>
        <label className={s.field}><span>State or region</span><input value={form.state} onChange={set('state')} autoComplete="address-level1" maxLength={100} /></label>
        <label className={s.field}><span>ZIP or postcode</span><input value={form.postal_code} onChange={set('postal_code')} autoComplete="postal-code" maxLength={20} /></label>
        <label className={s.field}><span>Country</span>
          <select value={form.country} onChange={set('country')} autoComplete="country">
            {!COUNTRIES.some(([c]) => c === form.country) && form.country && <option value={form.country}>{form.country}</option>}
            {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </label>
        {error && <p className={`${s.errorText} ${s.fieldWide}`} role="alert">{error}</p>}
        <div className={s.fieldWide}><Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save details'}</Button></div>
      </form>
    </section>
  )
}
