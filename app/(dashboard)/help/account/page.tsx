'use client'

import Link from 'next/link'

export default function AccountHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Account & Settings</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Account & Settings</h1>
          <p>Manage your profile, notifications, billing, and subscription from Settings.</p>
        </div>
      </div>

      {/* Profile */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Your Profile
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Go to <strong style={{ color: 'var(--ink)' }}>Settings</strong> to update your profile information. Your profile data appears on video share pages and closing slides.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Name and Title</strong> — Your full name and job title. These appear on the closing slide of every video you create.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Company</strong> — Your company or organization name.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Phone and Email</strong> — Contact information shown on share pages so clients can reach you directly.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Photos</strong> — Upload a headshot (used on title slides), a mid-level photo, and a standing photo (used on closing slides). Only the headshot is required.
          </p>
        </div>
      </div>

      {/* Notifications */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Notifications
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Docs2Video sends notifications for key events like video completion and client engagement. You can manage notification preferences from your Settings page.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Video Complete</strong> — Notified when your video finishes generating, especially useful if you navigate away during generation.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Share Page Views</strong> — Know when a client opens your share page and watches your video.
          </p>
        </div>
      </div>

      {/* Billing */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Billing Management
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            All billing is handled through Stripe. Go to <strong style={{ color: 'var(--ink)' }}>Settings {'>'} Subscription</strong> to view your current plan and payment details.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Update Payment Method</strong> — Click "Manage" in the Subscription section to update your credit card or switch to a different payment method through Stripe's secure portal.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>View Invoices</strong> — Past invoices are available through the Stripe portal. Click "Manage" to access your billing history and download receipts.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Cancel Subscription</strong> — You can cancel anytime. Your plan stays active until the end of your current billing period. After cancellation, you revert to pay-per-video pricing.
          </p>
        </div>
      </div>

      {/* Subscription Plans */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Changing Your Plan
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>1</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Go to Settings {'>'} Subscription.</strong> Your current plan and usage are displayed at the top.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>2</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Select the plan you want.</strong> Click Upgrade or Downgrade next to the target plan.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>3</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Confirm the change.</strong> Upgrades take effect immediately. Downgrades take effect at the end of your current billing period so you keep your current features until then.
            </div>
          </div>
        </div>
      </div>

      {/* Setup Wizard */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Re-running the Setup Wizard
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            The Setup Wizard walks you through profile setup, photos, branding, and default style. It runs automatically when you first sign up.
          </p>
          <p>
            To run it again at any time, go to <strong style={{ color: 'var(--ink)' }}>Settings</strong> and click <strong style={{ color: 'var(--ink)' }}>Re-run Setup Wizard</strong>. This is useful when you change companies, update your headshot, or want to set a new default template.
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
