'use client'

import { useState, useEffect } from 'react'

interface Stats {
  enrolled: boolean
  affiliate?: { referral_code: string; promo_code: string; commission_rate: number; status: string; payout_email?: string | null; payout_method?: string | null }
  clicks?: number
  signups?: number
  paying?: number
  pendingCents?: number
  paidCents?: number
  lifetimeCents?: number
}

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/$/, '')

export default function AffiliatePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')
  const [payoutEmail, setPayoutEmail] = useState('')
  const [payoutMethod, setPayoutMethod] = useState('')
  const [payoutSaved, setPayoutSaved] = useState(false)

  async function load() {
    const res = await fetch('/api/affiliate/stats')
    const data = await res.json()
    setStats(data)
    if (data.affiliate) {
      setPayoutEmail(data.affiliate.payout_email || '')
      setPayoutMethod(data.affiliate.payout_method || '')
    }
  }
  useEffect(() => { load() }, [])

  async function savePayout() {
    setBusy(true); setPayoutSaved(false)
    try {
      const res = await fetch('/api/affiliate/payout', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payoutEmail, payoutMethod }),
      })
      if (res.ok) { setPayoutSaved(true); await load(); setTimeout(() => setPayoutSaved(false), 2000) }
    } finally { setBusy(false) }
  }

  async function enroll() {
    setBusy(true)
    try {
      await fetch('/api/affiliate/enroll', { method: 'POST' })
      await load()
    } finally { setBusy(false) }
  }

  const money = (c?: number) => `$${((c ?? 0) / 100).toFixed(2)}`
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 1500)
  }

  if (!stats) return <div style={{ padding: 64, textAlign: 'center', color: 'var(--ink-light)' }}>Loading…</div>

  if (!stats.enrolled) {
    return (
      <div>
        <div className="page-head"><div><h1>Affiliate Program</h1><p style={{ color: 'var(--ink-light)' }}>Earn {20}% recurring commission — for life — on every customer you refer.</p></div></div>
        <div className="card" style={{ padding: 32, maxWidth: 640 }}>
          <h2 style={{ marginTop: 0 }}>Earn for every customer you bring</h2>
          <ul style={{ lineHeight: 1.9, color: 'var(--ink)' }}>
            <li><strong>20% recurring commission</strong> on every payment your referrals make — for as long as they stay subscribed.</li>
            <li>Your referrals get <strong>{15}% off</strong> with your code — easier to sell.</li>
            <li>Get a unique link, ready-made <strong>banners and email copy</strong>.</li>
            <li>Track clicks, signups, and earnings in real time.</li>
          </ul>
          <button className="btn btn-primary" onClick={enroll} disabled={busy} style={{ marginTop: 8 }}>
            {busy ? 'Setting up…' : 'Become an affiliate'}
          </button>
        </div>
      </div>
    )
  }

  const code = stats.affiliate!.promo_code || stats.affiliate!.referral_code
  const link = `${SITE}/r/${code}`
  const emailSwipe = `Subject: A faster way to turn documents into client videos

Hi [Name],

I've been using Docs2Video to turn PDFs, web pages, and notes into polished
explainer videos in minutes — no editing skills needed. It's been a real
time-saver.

If you want to try it, use my link and you'll get ${15}% off:
${link}

Happy to answer any questions.

[Your name]`
  const socialSwipe = `Turn any document into a professional video in minutes with Docs2Video. Use my link for ${15}% off 👉 ${link}`

  return (
    <div>
      <div className="page-head">
        <div><h1>Affiliate Program</h1><p style={{ color: 'var(--ink-light)' }}>{stats.affiliate!.commission_rate}% recurring commission · lifetime</p></div>
      </div>

      {!stats.affiliate!.payout_email && (
        <div className="card" style={{ padding: 16, marginBottom: 20, borderLeft: '4px solid #E8A87C', background: 'var(--cream, #F4F1EC)' }}>
          <strong>⚠ Add your payout details to get paid.</strong> You can earn commissions now, but we can&apos;t pay you until you tell us where to send the money. Scroll to <em>Payout details</em> below.
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Clicks', value: stats.clicks },
          { label: 'Signups', value: stats.signups },
          { label: 'Paying customers', value: stats.paying },
          { label: 'Pending', value: money(stats.pendingCents) },
          { label: 'Paid out', value: money(stats.paidCents) },
          { label: 'Lifetime earned', value: money(stats.lifetimeCents) },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Link + code */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Your referral link & code</h3>
        <label style={{ fontSize: 13, color: 'var(--ink-light)' }}>Share this link</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, marginBottom: 16 }}>
          <input className="input" readOnly value={link} style={{ flex: 1 }} onFocus={e => e.currentTarget.select()} />
          <button className="btn btn-soft" onClick={() => copy(link, 'link')}>{copied === 'link' ? 'Copied!' : 'Copy'}</button>
        </div>
        <label style={{ fontSize: 13, color: 'var(--ink-light)' }}>Or share your promo code (customers enter it at checkout for {15}% off)</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input className="input" readOnly value={code} style={{ flex: 1, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 }} />
          <button className="btn btn-soft" onClick={() => copy(code, 'code')}>{copied === 'code' ? 'Copied!' : 'Copy'}</button>
        </div>
      </div>

      {/* Payout details */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Payout details</h3>
        <p style={{ color: 'var(--ink-light)', fontSize: 14, marginTop: 0 }}>
          Commissions are approved after a 30-day refund hold, then paid manually each cycle. Tell us where to send the money.
        </p>
        <label style={{ fontSize: 13, color: 'var(--ink-light)' }}>Payout email *</label>
        <input className="input" type="email" placeholder="you@example.com" value={payoutEmail}
          onChange={e => setPayoutEmail(e.target.value)} style={{ width: '100%', marginTop: 4, marginBottom: 12 }} />
        <label style={{ fontSize: 13, color: 'var(--ink-light)' }}>Payout method (optional)</label>
        <input className="input" placeholder="e.g. PayPal, Wise, or bank transfer" value={payoutMethod}
          onChange={e => setPayoutMethod(e.target.value)} style={{ width: '100%', marginTop: 4, marginBottom: 12 }} />
        <button className="btn btn-primary btn-sm" onClick={savePayout} disabled={busy || !payoutEmail}>
          {busy ? 'Saving…' : payoutSaved ? 'Saved ✓' : 'Save payout details'}
        </button>
      </div>

      {/* Banners */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Banners</h3>
        <p style={{ color: 'var(--ink-light)', fontSize: 14 }}>Download a banner and link it to your referral URL.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {['leaderboard-728x90', 'medium-300x250', 'social-1200x628'].map(b => (
            <a key={b} href={`/affiliate/${b}.svg`} download className="btn btn-soft" style={{ textDecoration: 'none' }}>
              ⬇ {b}.svg
            </a>
          ))}
        </div>
      </div>

      {/* Swipe copy */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Email & social copy</h3>
        <label style={{ fontSize: 13, color: 'var(--ink-light)' }}>Email template</label>
        <textarea className="input" readOnly value={emailSwipe} rows={12} style={{ width: '100%', marginTop: 4, marginBottom: 8, fontFamily: 'inherit' }} />
        <button className="btn btn-soft btn-sm" onClick={() => copy(emailSwipe, 'email')}>{copied === 'email' ? 'Copied!' : 'Copy email'}</button>

        <label style={{ fontSize: 13, color: 'var(--ink-light)', display: 'block', marginTop: 16 }}>Social post</label>
        <textarea className="input" readOnly value={socialSwipe} rows={3} style={{ width: '100%', marginTop: 4, marginBottom: 8, fontFamily: 'inherit' }} />
        <button className="btn btn-soft btn-sm" onClick={() => copy(socialSwipe, 'social')}>{copied === 'social' ? 'Copied!' : 'Copy post'}</button>
      </div>
    </div>
  )
}
