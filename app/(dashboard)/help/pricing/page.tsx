'use client'

import Link from 'next/link'

const BULLET = <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span>

export default function PricingHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
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
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          How Credits Work
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Every plan includes <strong style={{ color: 'var(--ink)' }}>monthly credits</strong>. Credits are used when you create videos, slide decks, or PDFs. Different actions cost different amounts of credits.
          </p>
          <p style={{ marginBottom: 10 }}>
            Your credit balance is shown in the top menu bar. Before any action that uses credits, you&apos;ll see the cost and can confirm before proceeding.
          </p>
          <p>
            Monthly credits reset on your billing date. Need more? Buy credit packs anytime on any paid plan — purchased credits never expire.
          </p>
        </div>
      </div>

      {/* Credit Costs */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          What Credits Cost
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--ink)', fontWeight: 700 }}>Action</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--ink)', fontWeight: 700 }}>Credits</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Quick video (under 60s)', '500'],
                ['Standard video (2-3 min)', '1,000'],
                ['Detailed video (5+ min)', '1,500'],
                ['Podcast mode add-on', '+400'],
                ['Slide deck', '600'],
                ['PowerPoint (PPTX)', '800'],
                ['PDF document', '600'],
                ['Infographic', '300'],
                ['Each extra uploaded file', '+150'],
                ['Style preview (first free)', '100'],
                ['Script regeneration (first free)', '50'],
              ].map(([action, cost]) => (
                <tr key={action} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '8px 0' }}>{action}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>{cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Free Plan */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Free — 2 Short Videos
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Every new account starts with <strong style={{ color: 'var(--ink)' }}>2,000 credits</strong> (enough for <strong style={{ color: 'var(--ink)' }}>about 2 standard explainer videos</strong>). Cancel anytime.
          </p>
          <p>
            All features included: AI content extraction, script editing, voice narration, background music, and downloads in MP4, PPTX, and PDF formats.
          </p>
        </div>
      </div>

      {/* Pro */}
      <div style={{
        background: 'white', border: '2px solid var(--ink)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', margin: 0 }}>
            Pro — $79/month — 25,000 Credits
          </h2>
          <span style={{
            background: 'var(--ink)', color: 'white', fontSize: 11, fontWeight: 700,
            padding: '3px 10px', borderRadius: 6,
          }}>POPULAR</span>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Approximately <strong style={{ color: 'var(--ink)' }}>25 standard explainers</strong> or <strong style={{ color: 'var(--ink)' }}>50 quick videos</strong> per month.
          </p>
          <p style={{ marginBottom: 6 }}>{BULLET} Priority video generation</p>
          <p style={{ marginBottom: 6 }}>{BULLET} Unlimited brands</p>
          <p style={{ marginBottom: 6 }}>{BULLET} Style previews included</p>
          <p>{BULLET} Buy extra credits: $5 per 1,000</p>
        </div>
      </div>

      {/* Business */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Business — $199/month — 75,000 Credits
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Approximately <strong style={{ color: 'var(--ink)' }}>75 standard explainers</strong> or <strong style={{ color: 'var(--ink)' }}>150 quick videos</strong> per month.
          </p>
          <p style={{ marginBottom: 6 }}>{BULLET} White-label share pages</p>
          <p style={{ marginBottom: 6 }}>{BULLET} Unlimited style previews</p>
          <p style={{ marginBottom: 6 }}>{BULLET} Priority support</p>
          <p>{BULLET} Buy extra credits: $4 per 1,000</p>
        </div>
      </div>

      {/* Enterprise */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Enterprise — $499/month — 200,000 Credits
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Approximately <strong style={{ color: 'var(--ink)' }}>200 standard explainers</strong> or <strong style={{ color: 'var(--ink)' }}>400 quick videos</strong> per month.
          </p>
          <p style={{ marginBottom: 6 }}>{BULLET} API access and bulk creation</p>
          <p style={{ marginBottom: 6 }}>{BULLET} White-label share pages</p>
          <p style={{ marginBottom: 6 }}>{BULLET} Dedicated support</p>
          <p>{BULLET} Buy extra credits: $3 per 1,000</p>
        </div>
      </div>

      {/* Credit Packs */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Credit Packs
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 16 }}>
            Need more credits? Buy a pack anytime. Purchased credits <strong style={{ color: 'var(--ink)' }}>never expire</strong> — they stay in your account until used.
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
              {[
                ['Starter Pack', '2,500', '$10'],
                ['Power Pack', '7,500', '$25'],
                ['Studio Pack', '18,000', '$50'],
              ].map(([name, credits, price]) => (
                <tr key={name} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '8px 0' }}>{name}</td>
                  <td style={{ padding: '8px 0', textAlign: 'center', fontWeight: 600, color: 'var(--ink)' }}>{credits}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>{price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upgrading / Downgrading */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          How to Upgrade or Downgrade
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>1</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Go to Settings.</strong> Click your profile icon, then select &quot;Settings&quot; from the menu.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>2</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Find the Subscription section.</strong> Your current plan and credit balance are displayed.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
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
