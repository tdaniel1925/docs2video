'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Coins, ExternalLink, Ban, ShieldCheck } from 'lucide-react'
import { Dialog, Button, Note } from '../../../_components/kit'
import { useToast } from '../../../_components/Toast'
import { useConfirm } from './useConfirm'

/*
 * The money / access buttons for ONE account, used on the Users list and on
 * the account's own page. Every one asks first (kit pop-up):
 *   - Give credits: real amounts (100 / 500 / 1,000 / your own) + a required
 *     reason, written to the audit log.
 *   - Change plan: says plainly that Stripe keeps billing what it bills; when
 *     the existing plan-change code can do it, offers "Change it in Stripe".
 *   - Make / remove admin, Ban / Unban.
 */

export const CREDIT_AMOUNTS = [100, 500, 1000] as const
const PLANS = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'business', label: 'Business' },
  { value: 'enterprise', label: 'Enterprise' },
]

export interface AccountLite {
  id: string
  email: string
  full_name?: string | null
  subscription_status: string | null
  is_admin?: boolean
  is_beta?: boolean
}

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'That didn’t work')
  return d
}

export default function UserMoneyActions({ user, onChanged, compact = false, show = ['credits', 'plan', 'admin', 'beta', 'ban'] }: {
  user: AccountLite
  onChanged: () => void
  compact?: boolean
  show?: ('credits' | 'plan' | 'admin' | 'beta' | 'ban')[]
}) {
  const notify = useToast()
  const [ask, confirmDialog] = useConfirm()
  const [busy, setBusy] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [plan, setPlan] = useState<string | null>(null)
  const name = user.full_name || user.email
  const banned = (user.subscription_status || '').toLowerCase() === 'banned'

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true)
    try { await fn(); notify(done, 'success'); onChanged() } catch (e) { notify(e instanceof Error ? e.message : 'That didn’t work', 'error') }
    setBusy(false)
  }

  async function toggleAdmin() {
    const making = !user.is_admin
    const r = await ask({
      title: making ? `Make ${name} an admin?` : `Remove admin from ${name}?`,
      body: making
        ? 'An admin can see every customer, change plans, give credits, log in as anyone and change billing.'
        : 'They will lose the admin pages straight away.',
      danger: making,
      confirmLabel: making ? 'Make admin' : 'Remove admin',
    })
    if (!r.ok) return
    await run(() => post('/api/admin/manage-access', { userId: user.id, field: 'is_admin', value: making }), making ? 'Now an admin.' : 'Admin removed.')
  }

  async function toggleBeta() {
    const making = !user.is_beta
    const r = await ask({
      title: making ? `Make ${name} a beta account?` : `Remove beta from ${name}?`,
      body: making ? 'Beta accounts make videos for free (no credits are taken).' : 'They will pay credits for videos again.',
      confirmLabel: making ? 'Make beta' : 'Remove beta',
    })
    if (!r.ok) return
    await run(() => post('/api/admin/manage-access', { userId: user.id, field: 'is_beta', value: making }), making ? 'Now a beta account.' : 'Beta removed.')
  }

  async function toggleBan() {
    const r = await ask({
      title: banned ? `Unban ${name}?` : `Ban ${name}?`,
      body: banned
        ? 'They can sign in and make videos again. Their plan is set back to Free — change it after if they pay.'
        : 'They can’t make anything any more. Stripe is NOT changed — cancel their subscription in Billing & Sales too if they pay.',
      danger: !banned,
      reasonLabel: 'Why? (saved in the audit log)',
      confirmLabel: banned ? 'Unban' : 'Ban',
    })
    if (!r.ok) return
    await run(() => post('/api/admin/user-action', { userId: user.id, action: 'toggle_ban', reason: r.reason }), banned ? 'Unbanned.' : 'Banned.')
  }

  const btn = (label: ReactNode, onClick: () => void, key: string) => (
    <Button key={key} size="sm" variant="secondary" disabled={busy} onClick={onClick}>{label}</Button>
  )

  return (
    <div className="admin-actions">
      {show.includes('plan') && (
        <select
          aria-label={`Change plan for ${user.email}`}
          className="input admin-select"
          disabled={busy}
          value=""
          onChange={(e) => { if (e.target.value) setPlan(e.target.value) }}
        >
          <option value="" disabled>{compact ? 'Plan…' : 'Change plan…'}</option>
          {PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      )}
      {show.includes('credits') && btn(<><Coins size={14} aria-hidden="true" /> Give credits</>, () => setCreditsOpen(true), 'credits')}
      {show.includes('admin') && btn(<><ShieldCheck size={14} aria-hidden="true" /> {user.is_admin ? 'Remove admin' : 'Make admin'}</>, toggleAdmin, 'admin')}
      {show.includes('beta') && btn(user.is_beta ? 'Remove beta' : 'Make beta', toggleBeta, 'beta')}
      {show.includes('ban') && btn(<><Ban size={14} aria-hidden="true" /> {banned ? 'Unban' : 'Ban'}</>, toggleBan, 'ban')}

      {creditsOpen && (
        <GiveCreditsDialog user={user} onClose={() => setCreditsOpen(false)} onDone={() => { setCreditsOpen(false); onChanged() }} />
      )}
      {plan && (
        <PlanChangeDialog user={user} plan={plan} onClose={() => setPlan(null)} onDone={() => { setPlan(null); onChanged() }} />
      )}
      {confirmDialog}
    </div>
  )
}

export function GiveCreditsDialog({ user, onClose, onDone }: { user: AccountLite; onClose: () => void; onDone: () => void }) {
  const notify = useToast()
  const [amount, setAmount] = useState<number | 'custom'>(500)
  const [custom, setCustom] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const n = amount === 'custom' ? Math.floor(Number(custom) || 0) : amount
  const amountOk = n > 0 && n <= 100_000
  const reasonOk = reason.trim().length >= 3

  async function give() {
    setBusy(true)
    try {
      await post('/api/admin/user-action', { userId: user.id, action: 'add_credits', value: n, reason: reason.trim() })
      notify(`${n.toLocaleString('en-US')} credits given to ${user.email}.`, 'success')
      onDone()
    } catch (e) { notify(e instanceof Error ? e.message : 'That didn’t work', 'error') }
    setBusy(false)
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Give credits to ${user.full_name || user.email}`}
      sub="Added to their extra credits (they don’t run out at the end of the month). Saved in the audit log with your reason."
      footer={
        <div className="admin-dialog-buttons">
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !amountOk || !reasonOk} disabledReason={!amountOk ? 'Pick an amount (1 to 100,000).' : !reasonOk ? 'Write a short reason.' : undefined} onClick={give}>
            {busy ? 'Giving…' : `Give ${amountOk ? n.toLocaleString('en-US') : ''} credits`}
          </Button>
        </div>
      }
    >
      <div className="admin-choice-row" role="radiogroup" aria-label="How many credits">
        {CREDIT_AMOUNTS.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={amount === a} className={`admin-choice ${amount === a ? 'is-on' : ''}`} onClick={() => setAmount(a)}>
            {a.toLocaleString('en-US')}
          </button>
        ))}
        <button type="button" role="radio" aria-checked={amount === 'custom'} className={`admin-choice ${amount === 'custom' ? 'is-on' : ''}`} onClick={() => setAmount('custom')}>Other</button>
      </div>
      {amount === 'custom' && (
        <label className="admin-field">
          <span className="admin-field-label">How many credits</span>
          <input className="input" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))} placeholder="e.g. 2500" autoFocus />
        </label>
      )}
      <label className="admin-field">
        <span className="admin-field-label">Why? (required, saved in the audit log)</span>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Make-good for the failed video on Oct 9" />
      </label>
    </Dialog>
  )
}

interface PlanPreview {
  email: string
  appPlan: string
  stripeBills: string
  canChangeInStripe: boolean
  direction?: 'upgrade' | 'downgrade' | null
  newPrice?: string | null
  why: string
  stripeUrl: string | null
}

export function PlanChangeDialog({ user, plan, onClose, onDone }: { user: AccountLite; plan: string; onClose: () => void; onDone: () => void }) {
  const notify = useToast()
  const [preview, setPreview] = useState<PlanPreview | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const planName = PLANS.find((p) => p.value === plan)?.label ?? plan

  useEffect(() => {
    let live = true
    fetch(`/api/admin/plan-change?userId=${encodeURIComponent(user.id)}&plan=${encodeURIComponent(plan)}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); if (live) setPreview(d) })
      .catch((e) => { if (live) setErr(e instanceof Error ? e.message : 'Stripe could not be read') })
    return () => { live = false }
  }, [user.id, plan])

  async function appOnly() {
    setBusy(true)
    try {
      await post('/api/admin/user-action', { userId: user.id, action: 'change_plan', value: plan, reason: 'admin plan change (app only)' })
      notify(`Plan set to ${planName} in the app. Stripe was not changed.`, 'success')
      onDone()
    } catch (e) { notify(e instanceof Error ? e.message : 'That didn’t work', 'error') }
    setBusy(false)
  }
  async function inStripe() {
    setBusy(true)
    try {
      await post('/api/admin/plan-change', { userId: user.id, plan })
      notify(`Changed to ${planName} in Stripe. The app updates itself in a moment.`, 'success')
      onDone()
    } catch (e) { notify(e instanceof Error ? e.message : 'Stripe change failed', 'error') }
    setBusy(false)
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Change ${user.full_name || user.email} to ${planName}?`}
      footer={
        <div className="admin-dialog-buttons">
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" disabled={busy || (!preview && !err)} onClick={appOnly}>Change it here only</Button>
          {preview?.canChangeInStripe && (
            <Button disabled={busy} onClick={inStripe}>Change it in Stripe</Button>
          )}
        </div>
      }
    >
      {!preview && !err && <p className="admin-dialog-text">Checking what Stripe bills…</p>}
      {err && <Note tone="warn">{err}. You can still change it here only — Stripe keeps billing whatever it bills now.</Note>}
      {preview && (
        <>
          <dl className="admin-facts">
            <div><dt>In the app now</dt><dd>{preview.appPlan}</dd></div>
            <div><dt>Stripe bills now</dt><dd>{preview.stripeBills}</dd></div>
          </dl>
          <Note tone="warn" title="Stripe keeps billing.">
            “Change it here only” changes what the app allows — it does NOT change what Stripe charges.
            {preview.why ? ` ${preview.why}` : ''}
          </Note>
          {preview.canChangeInStripe && (
            <p className="admin-dialog-text">
              <b>Change it in Stripe</b> moves their subscription to {planName}{preview.newPrice ? ` (${preview.newPrice})` : ''}.
              {preview.direction === 'upgrade' ? ' The difference is charged to their card now; if it declines, nothing changes.' : ' The lower price starts at their next renewal; they keep this month’s credits.'}
              {' '}The app plan and credits update by themselves once Stripe confirms.
            </p>
          )}
          {preview.stripeUrl && (
            <p className="admin-dialog-text">
              <a href={preview.stripeUrl} target="_blank" rel="noopener noreferrer">Open this customer in Stripe <ExternalLink size={13} aria-hidden="true" /></a>
            </p>
          )}
        </>
      )}
    </Dialog>
  )
}
