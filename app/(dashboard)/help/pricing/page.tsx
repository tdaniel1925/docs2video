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
          <p>Understand your options, from the free trial to agency-level plans.</p>
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

      {/* Pay Per Project */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Pay Per Project — $10
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            No subscription needed. Simply pay <strong style={{ color: 'var(--ink)' }}>$10 per video project</strong> when you create one. This is ideal if you only make videos occasionally.
          </p>
          <p>
            There is no monthly fee, no commitment, and no expiration. Create a video whenever you need one, pay for it at checkout, and it is yours forever.
          </p>
        </div>
      </div>

      {/* Pro */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', margin: 0 }}>
            Pro Plan — $25/month + $6/project
          </h2>
          <span style={{
            background: 'var(--mint)', color: 'var(--ink)', fontSize: 11, fontWeight: 700,
            padding: '3px 10px', borderRadius: 20,
          }}>POPULAR</span>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            The Pro plan is designed for professionals who create videos regularly. For <strong style={{ color: 'var(--ink)' }}>$25 per month</strong>, you get access to Pro features plus a reduced per-project rate of <strong style={{ color: 'var(--ink)' }}>$6 per video</strong>.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Pro benefits include:</strong>
          </p>
          <p style={{ marginBottom: 6 }}>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Significantly lower per-project pricing
          </p>
          <p style={{ marginBottom: 6 }}>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Access to AI Proposal creator
          </p>
          <p style={{ marginBottom: 6 }}>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Priority video generation
          </p>
          <p>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Cancel anytime with no penalty
          </p>
        </div>
      </div>

      {/* Business */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Business Plan — $99/month
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            The Business plan includes <strong style={{ color: 'var(--ink)' }}>50 projects per month</strong> for a flat rate of <strong style={{ color: 'var(--ink)' }}>$99/month</strong>. No per-project fees for those 50 projects.
          </p>
          <p style={{ marginBottom: 10 }}>
            This plan is ideal for teams and professionals who produce a high volume of content. All Pro features are included.
          </p>
          <p>
            If you exceed 50 projects in a month, additional projects are billed at the Pro per-project rate.
          </p>
        </div>
      </div>

      {/* Agency */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Agency Plan — $249/month
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Built for agencies and large teams. The Agency plan includes <strong style={{ color: 'var(--ink)' }}>150 projects per month</strong> plus <strong style={{ color: 'var(--ink)' }}>5 course builds</strong> for <strong style={{ color: 'var(--ink)' }}>$249/month</strong>.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Agency benefits include:</strong>
          </p>
          <p style={{ marginBottom: 6 }}>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> 150 projects per month (videos, infographics, flyers, cards, logos)
          </p>
          <p style={{ marginBottom: 6 }}>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> 5 course builds per month (multi-episode video series)
          </p>
          <p style={{ marginBottom: 6 }}>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> All Pro and Business features
          </p>
          <p>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Priority support
          </p>
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
