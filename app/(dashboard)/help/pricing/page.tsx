'use client'

import Link from 'next/link'
import { PLANS, isSellablePlan } from '../../../_lib/pricing'
import { CREDIT_COSTS, TIER_CREDITS, TIER_APPROX_VIDEOS, MULTI_FILE_SURCHARGE } from '../../../_lib/credits'
import { CREDIT_PACKS, packPrice } from '../../../_lib/credit-packs'

// Every price, credit cost and pack on this page is read from pricing.ts,
// credits.ts and credit-packs.ts. They used to be typed here, so a price
// change left this article quoting the old one.

const BULLET = <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span>
const n = (x: number) => x.toLocaleString('en-US')
const PAID_PLANS = PLANS.filter(p => isSellablePlan(p.tier))

// What each action costs. The video lengths use the names on step 2's length
// picker (Short / Standard / Detailed).
const COSTS: [string, string][] = [
  ['Short video (under 1 minute)', n(CREDIT_COSTS.videoQuick)],
  ['Standard video (2–5 minutes)', n(CREDIT_COSTS.videoStandard)],
  ['Detailed video (5–15 minutes)', n(CREDIT_COSTS.videoDetailed)],
  ['Interactive presentation', n(CREDIT_COSTS.interactive)],
  ['MP4 export of a presentation', n(CREDIT_COSTS.videoExport)],
  ['Commercial', n(CREDIT_COSTS.commercial)],
  ['Each extra uploaded file', '+' + n(MULTI_FILE_SURCHARGE)],
  ['Custom style preview', n(CREDIT_COSTS.stylePreview)],
  // AI Social posting is priced by the social posting route, not credits.ts.
  ['AI Social post (per platform)', '25'],
]

export default function PricingHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Pricing & Credits</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Pricing & Credits</h1>
          <p>Understand how credits work and choose the right plan for your needs.</p>
        </div>
      </div>

      {/* How Credits Work */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          How Credits Work
        </h2>
        <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Every plan includes <strong style={{ color: 'var(--ink)' }}>monthly credits</strong>. Credits are used when you create videos, presentations and commercials. Different actions cost different amounts of credits.
          </p>
          <p style={{ marginBottom: 10 }}>
            Your credit balance is shown in the top menu bar. Before any action that uses credits, you&apos;ll see the cost and can confirm before proceeding.
          </p>
          <p>
            Monthly plan credits reset on your billing date. Need more? Anyone — free or paid — can buy a credit pack anytime from the <strong style={{ color: 'var(--ink)' }}>+ Top Up</strong> button next to your balance. Purchased credits never expire.
          </p>
        </div>
      </div>

      {/* Credit Costs */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          What Credits Cost
        </h2>
        <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--ink)', fontWeight: 700 }}>Action</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--ink)', fontWeight: 700 }}>Credits</th>
              </tr>
            </thead>
            <tbody>
              {COSTS.map(([action, cost]) => (
                <tr key={action} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '8px 0' }}>{action}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>{cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Free plan, then every plan checkout sells. Name, price, credits, the
          approximate video counts and the feature list all come from
          pricing.ts / credits.ts, so this page can't quote an old price. */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Free — {n(TIER_CREDITS.free)} Credits to Start
        </h2>
        <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Every new account starts with <strong style={{ color: 'var(--ink)' }}>{n(TIER_CREDITS.free)} credits</strong> (enough for <strong style={{ color: 'var(--ink)' }}>about {TIER_APPROX_VIDEOS.free.standard} standard explainer videos</strong>). These are a one-time welcome gift, not a monthly refill. You can try Docs2Video first without a card (the free preview on step 3 needs none); you add a card to unlock the credits when you make your first real one, and nothing is charged until they run out.
          </p>
          <p>
            All features included: AI content extraction, script editing, voice narration, background music, and downloads in MP4, PPTX, and PDF formats.
          </p>
        </div>
      </div>

      {PAID_PLANS.map(plan => {
        const recommended = plan.tier === 'pro'
        return (
          <div key={plan.tier} style={{
            background: 'var(--bg-card)', border: recommended ? '2px solid var(--ink)' : '1px solid var(--border-light)', borderRadius: 10,
            padding: '28px 32px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 16 }}>
              <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', margin: 0 }}>
                {plan.label} — {`$${Math.round(plan.monthlyPrice / 100)}`}/month — {n(TIER_CREDITS[plan.tier])} Credits
              </h2>
              {recommended && (
                <span style={{
                  background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 'var(--fs-caption)', fontWeight: 700,
                  padding: '3px 10px', borderRadius: 6,
                }}>RECOMMENDED</span>
              )}
            </div>
            <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
              <p style={{ marginBottom: 10 }}>
                Approximately <strong style={{ color: 'var(--ink)' }}>{TIER_APPROX_VIDEOS[plan.tier].standard} standard explainers</strong> or <strong style={{ color: 'var(--ink)' }}>{TIER_APPROX_VIDEOS[plan.tier].quick} quick videos</strong> per month.
              </p>
              {/* The credits line is already in the heading above. */}
              {plan.features.filter(f => !/^[\d,]+ credits/.test(f)).map(f => (
                <p key={f} style={{ marginBottom: 6 }}>{BULLET} {f}</p>
              ))}
            </div>
          </div>
        )
      })}

      {/* Credit Packs */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Credit Packs
        </h2>
        <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 16 }}>
            Need more credits? Buy a pack anytime, on any plan (including Free): click <strong style={{ color: 'var(--ink)' }}>+ Top Up</strong> next to your credit balance at the top of the screen. Purchased credits <strong style={{ color: 'var(--ink)' }}>never expire</strong> — they stay in your account until used, and are spent after your monthly plan credits.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--ink)', fontWeight: 700 }}>Pack</th>
                <th style={{ textAlign: 'center', padding: '8px 0', color: 'var(--ink)', fontWeight: 700 }}>Credits</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--ink)', fontWeight: 700 }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {CREDIT_PACKS.map(p => (
                <tr key={p.key} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '8px 0' }}>{p.name} pack</td>
                  <td style={{ padding: '8px 0', textAlign: 'center', fontWeight: 600, color: 'var(--ink)' }}>{n(p.credits)}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>{packPrice(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upgrading / Downgrading */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          How to Upgrade or Downgrade
        </h2>
        <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--fs-ui)', flexShrink: 0,
            }}>1</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Go to Settings.</strong> Click your profile icon, then select &quot;Settings&quot; from the menu.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--fs-ui)', flexShrink: 0,
            }}>2</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Choose Billing &amp; credits in the menu on the left.</strong> Three boxes show your plan, your credits and what you used this period.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--fs-ui)', flexShrink: 0,
            }}>3</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Select your new plan.</strong> Upgrades take effect immediately with new credits. Downgrades take effect at the end of your current billing period.
            </div>
          </div>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Cancellation:</strong> Cancel any subscription anytime. Your plan stays active until the end of the billing period. Unused monthly credits are not refunded, but purchased credit packs remain in your account.
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
