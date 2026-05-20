'use client'

import Link from 'next/link'

export default function PricingHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Pricing & Plans</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Pricing & Plans</h1>
          <p>Understand your options, from the free trial to enterprise-level plans.</p>
        </div>
      </div>

      {/* Free Trial */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Free Trial — 5 Videos
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Every new account starts with <strong style={{ color: 'var(--ink)' }}>5 free explainer videos</strong>. A payment card is required to sign up, but you will not be charged during the trial.
          </p>
          <p style={{ marginBottom: 10 }}>
            Free videos include all features: AI content extraction, full script editing, voice narration, background music, and downloads in MP4, PDF, and PPTX formats.
          </p>
          <p>
            Your free videos never expire. Once they are used, you can choose any paid plan or continue on a pay-per-project basis.
          </p>
        </div>
      </div>

      {/* Pay Per Video */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Pay Per Video — $10
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            No subscription needed. You get <strong style={{ color: 'var(--ink)' }}>1 free video</strong> to try, then pay <strong style={{ color: 'var(--ink)' }}>$10 per video</strong>. Ideal if you only make videos occasionally.
          </p>
          <p>
            No monthly fee, no commitment, no expiration. Full quality, no watermark, share pages with AI chat, download as MP4, PDF, or PPTX.
          </p>
        </div>
      </div>

      {/* Starter */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Starter Plan — $29/month
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Includes <strong style={{ color: 'var(--ink)' }}>5 videos per month</strong>. Additional videos are <strong style={{ color: 'var(--ink)' }}>$5 each</strong>.
          </p>
          <p style={{ marginBottom: 6 }}><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Multi-voice podcast narration</p>
          <p style={{ marginBottom: 6 }}><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> 2 brand profiles</p>
          <p><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> All slide templates</p>
        </div>
      </div>

      {/* Pro */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', margin: 0 }}>
            Pro Plan — $79/month
          </h2>
          <span style={{
            background: 'var(--mint)', color: 'var(--ink)', fontSize: 11, fontWeight: 700,
            padding: '3px 10px', borderRadius: 20,
          }}>POPULAR</span>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Includes <strong style={{ color: 'var(--ink)' }}>20 videos per month</strong>. Additional videos are <strong style={{ color: 'var(--ink)' }}>$5 each</strong>.
          </p>
          <p style={{ marginBottom: 6 }}><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Priority video generation</p>
          <p style={{ marginBottom: 6 }}><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Unlimited brands</p>
          <p style={{ marginBottom: 6 }}><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> 5 free slide edits per video</p>
          <p><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Cancel anytime</p>
        </div>
      </div>

      {/* Business */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Business Plan — $199/month
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Includes <strong style={{ color: 'var(--ink)' }}>75 videos per month</strong>. Additional videos are <strong style={{ color: 'var(--ink)' }}>$5 each</strong>.
          </p>
          <p style={{ marginBottom: 6 }}><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> White-label share pages</p>
          <p style={{ marginBottom: 6 }}><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> 10 free slide edits per video</p>
          <p><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Priority support</p>
        </div>
      </div>

      {/* Enterprise */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Enterprise Plan — $499/month
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Includes <strong style={{ color: 'var(--ink)' }}>200 videos per month</strong>. Additional videos are <strong style={{ color: 'var(--ink)' }}>$5 each</strong>.
          </p>
          <p style={{ marginBottom: 6 }}><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Unlimited slide edits</p>
          <p style={{ marginBottom: 6 }}><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> White-label share pages</p>
          <p style={{ marginBottom: 6 }}><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> API access and bulk creation</p>
          <p><span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Dedicated support</p>
        </div>
      </div>

      {/* Upgrading / Downgrading */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          How to Upgrade or Downgrade
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>1</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Go to Settings.</strong> Click your profile icon, then select "Settings" from the menu.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>2</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Find the Subscription section.</strong> Your current plan is displayed along with options to change it.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>3</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Select your new plan.</strong> Click "Upgrade" or "Downgrade" next to the plan you want. Changes take effect immediately for upgrades. Downgrades take effect at the end of your current billing period.
            </div>
          </div>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Cancellation:</strong> You can cancel any subscription at any time. Your plan remains active until the end of the current billing period, and you are not charged again. After cancellation, your account reverts to pay-per-project pricing.
          </p>
        </div>
      </div>

      {/* Back link */}
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link href="/help" className="btn btn-soft">
          Back to Help Center
        </Link>
      </div>
    </div>
  )
}
