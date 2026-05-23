'use client'

import Link from 'next/link'

export default function GettingStartedPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Getting Started</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Getting Started</h1>
          <p>Everything you need to set up your account and start creating.</p>
        </div>
      </div>

      {/* Section 1: Creating Your Account */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Creating Your Account
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>1</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Visit the sign-up page.</strong> You will see a split screen with product information on the left and the registration form on the right. On mobile, only the form is shown.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>2</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Enter your details.</strong> Fill in your full name, email address, and choose a password. All fields are required.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>3</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Click "Create Account."</strong> You will receive a confirmation email. Click the link in that email to verify your address and activate your account.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>4</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Complete the Setup Wizard.</strong> After your first login, a four-step wizard walks you through your profile, photos, brand, and default style. You can skip steps and come back later from Settings.
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Adding Your Payment Card */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Adding Your Payment Card
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            A payment card is required to start your free trial. You will not be charged until you create your first paid project after your 5 free videos are used.
          </p>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>1</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Go to Settings.</strong> Click your profile icon in the top-right corner, then select "Settings" from the dropdown. Alternatively, click "Settings" in the left sidebar.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>2</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Find the Subscription section.</strong> Scroll down to "Subscription" where you will see your current plan and a button to manage payment methods.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>3</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Enter your card details.</strong> A secure Stripe form will appear. Enter your card number, expiration date, and CVC. Your information is encrypted and never stored on our servers.
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Your 5 Free Videos */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Understanding Your 5 Free Videos
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            Every new account comes with <strong style={{ color: 'var(--ink)' }}>2 free videos</strong>. This lets you try the full creation experience before you pay anything.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: 'var(--ink)' }}>What is included:</strong> Each free video gives you the complete experience — AI content extraction, script editing, voice narration, background music, and all download formats (MP4, PDF, PPTX).
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: 'var(--ink)' }}>When do free videos expire?</strong> Free videos never expire. Take your time exploring the platform.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>After your free videos:</strong> You can continue on a pay-per-project basis or upgrade to a subscription plan for better rates. Visit the <Link href="/help/pricing" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Pricing & Plans</Link> page for details.
          </p>
        </div>
      </div>

      {/* Section 4: Navigating the Dashboard */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Navigating the Dashboard
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 16 }}>
            After logging in, you land on your Dashboard. Here is what you will see:
          </p>

          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Top Navigation Bar</strong> — Across the top of the screen you will find the Docs2Video logo (click to return to the dashboard), navigation links, and your profile menu on the right.
          </p>

          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Plan Badge</strong> — A card at the top shows your current plan (for example, "Pro Member" or "Free Account") so you always know your pricing tier.
          </p>

          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Total Creations</strong> — A counter showing how many items you have created across all types: videos, infographics, flyers, business cards, and logos.
          </p>

          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Quick Create</strong> — A row of large shortcut buttons, one for each creation type. Each button shows the project name, an icon, and its price. Click any button to jump straight into that creator.
          </p>

          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Recent Creations</strong> — Below the shortcuts, your most recent 8 items appear as cards with thumbnails, titles, and type badges (e.g., "Video," "Flyer"). Click any card to open it. A "View all" link takes you to your full Library.
          </p>

          <p>
            <strong style={{ color: 'var(--ink)' }}>Sidebar / Navigation Links</strong> — Use the navigation to access Create (all creators), Library (all your items), Brands, Templates, Settings, and Help.
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
