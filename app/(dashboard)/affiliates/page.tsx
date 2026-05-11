'use client'

import { useState, useEffect } from 'react'

interface Affiliate {
  id: string
  referral_code: string
  commission_rate: number
  total_earned: number
  total_paid: number
  total_referrals: number
  total_conversions: number
  credits_earned: number
  status: string
  payout_email: string
  created_at: string
}

interface Referral {
  id: string
  status: string
  signup_at: string | null
  conversion_at: string | null
  commission_amount: number
  commission_paid: boolean
  created_at: string
}

export default function AffiliatesPage() {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)
  const [payoutEmail, setPayoutEmail] = useState('')

  useEffect(() => {
    fetch('/api/affiliates')
      .then(r => r.json())
      .then(data => {
        if (data.affiliate) {
          setAffiliate(data.affiliate)
          setReferrals(data.referrals ?? [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleJoin() {
    setJoining(true)
    try {
      const res = await fetch('/api/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutEmail: payoutEmail || undefined }),
      })
      const data = await res.json()
      if (data.affiliate) setAffiliate(data.affiliate)
    } catch { /* ignore */ }
    setJoining(false)
  }

  function copyLink() {
    if (!affiliate) return
    navigator.clipboard.writeText(`https://docs2video.com/?ref=${affiliate.referral_code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatCents = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

  if (loading) {
    return (
      <div style={{ padding: 64, textAlign: 'center', color: 'var(--ink-light)' }}>
        <div className="spinner" />
      </div>
    )
  }

  // Not enrolled yet
  if (!affiliate) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="page-head">
          <div>
            <h1>Affiliate Program</h1>
            <p>Earn commissions by referring new users to Docs2Video.</p>
          </div>
        </div>

        <div className="wizard-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#128176;</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Earn While You Share</h2>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Get a unique referral link. When someone signs up and subscribes through your link, you earn <strong>20% commission</strong> on their first payment plus <strong>5 free credits</strong> per signup.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            <div style={{ padding: '20px 16px', background: 'var(--bg-soft)', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--mint-darker, #2d7a4f)' }}>20%</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>Commission</div>
            </div>
            <div style={{ padding: '20px 16px', background: 'var(--bg-soft)', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--mint-darker, #2d7a4f)' }}>+5</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>Credits per signup</div>
            </div>
            <div style={{ padding: '20px 16px', background: 'var(--bg-soft)', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--mint-darker, #2d7a4f)' }}>30 days</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>Cookie window</div>
            </div>
          </div>

          <div style={{ maxWidth: 320, margin: '0 auto' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Payout Email (optional)</label>
              <input
                type="email"
                className="input"
                placeholder="Where to send payouts"
                value={payoutEmail}
                onChange={e => setPayoutEmail(e.target.value)}
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              {joining ? 'Joining...' : 'Join Affiliate Program'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Enrolled — show dashboard
  const unpaidBalance = affiliate.total_earned - affiliate.total_paid
  const referralLink = `https://docs2video.com/?ref=${affiliate.referral_code}`

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Affiliate Dashboard</h1>
          <p>Track your referrals and earnings.</p>
        </div>
      </div>

      {/* Referral link */}
      <div className="settings-card" style={{ marginBottom: 24 }}>
        <h3>Your Referral Link</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            className="input"
            readOnly
            value={referralLink}
            style={{ flex: 1, fontSize: 14, fontFamily: 'monospace' }}
            onClick={e => (e.target as HTMLInputElement).select()}
          />
          <button onClick={copyLink} className="btn btn-primary">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 8 }}>
          Share this link anywhere. You earn 20% commission on first payments and 5 free credits per signup.
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Clicks</div>
          <div className="stat-value">{affiliate.total_referrals}</div>
        </div>
        <div className="stat-card mint">
          <div className="stat-label">Signups</div>
          <div className="stat-value">{referrals.filter(r => ['signed_up', 'converted', 'paid'].includes(r.status)).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Conversions</div>
          <div className="stat-value">{affiliate.total_conversions}</div>
        </div>
        <div className="stat-card peach">
          <div className="stat-label">Credits Earned</div>
          <div className="stat-value">{affiliate.credits_earned}</div>
        </div>
      </div>

      {/* Earnings */}
      <div className="settings-card" style={{ marginBottom: 24 }}>
        <h3>Earnings</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{ padding: '16px 20px', background: 'var(--bg-soft)', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-light)', marginBottom: 4 }}>Total Earned</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{formatCents(affiliate.total_earned)}</div>
          </div>
          <div style={{ padding: '16px 20px', background: 'var(--bg-soft)', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-light)', marginBottom: 4 }}>Paid Out</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{formatCents(affiliate.total_paid)}</div>
          </div>
          <div style={{ padding: '16px 20px', background: 'rgba(168,240,212,0.15)', border: '1px solid var(--mint)', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-light)', marginBottom: 4 }}>Unpaid Balance</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--mint-darker, #2d7a4f)' }}>{formatCents(unpaidBalance)}</div>
          </div>
        </div>
        {unpaidBalance >= 5000 && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-soft)' }}>
            Payouts are processed monthly for balances over $50. Sent to {affiliate.payout_email}.
          </div>
        )}
      </div>

      {/* Recent referrals */}
      <div className="settings-card">
        <h3>Recent Referrals</h3>
        {referrals.length === 0 ? (
          <p style={{ color: 'var(--ink-light)', fontSize: 14 }}>No referrals yet. Share your link to get started!</p>
        ) : (
          <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
            {referrals.map((ref, i) => (
              <div key={ref.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: i < referrals.length - 1 ? '1px solid var(--border-light)' : 'none',
                fontSize: 13,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`tag ${
                    ref.status === 'converted' || ref.status === 'paid' ? 'mint' :
                    ref.status === 'signed_up' ? 'sky' :
                    'peach'
                  }`} style={{ fontSize: 11 }}>
                    {ref.status === 'clicked' ? 'Click' :
                     ref.status === 'signed_up' ? 'Signed Up' :
                     ref.status === 'converted' ? 'Converted' :
                     ref.status === 'paid' ? 'Paid' : ref.status}
                  </span>
                </div>
                <div style={{ color: 'var(--ink-light)' }}>
                  {new Date(ref.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                {ref.commission_amount > 0 && (
                  <div style={{ fontWeight: 700, color: 'var(--mint-darker, #2d7a4f)' }}>
                    {formatCents(ref.commission_amount)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="settings-card" style={{ marginTop: 24 }}>
        <h3>How It Works</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
          {[
            { step: '1', title: 'Share', desc: 'Send your referral link to anyone' },
            { step: '2', title: 'They Sign Up', desc: 'You get 5 free credits instantly' },
            { step: '3', title: 'They Subscribe', desc: 'You earn 20% of their first payment' },
            { step: '4', title: 'Get Paid', desc: 'Monthly payouts for balances over $50' },
          ].map(s => (
            <div key={s.step} style={{ textAlign: 'center', padding: '16px 12px' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--mint)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 800, fontSize: 14,
                margin: '0 auto 8px',
              }}>
                {s.step}
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
