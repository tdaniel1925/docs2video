'use client'

import Link from 'next/link'

// Account & Settings guide. Audited against the live Settings page 2026-09-26:
// tabs Profile / Integrations / Subscription, plus Re-run Setup Wizard.

const NUM: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--mint)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
}
const CARD: React.CSSProperties = {
  background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
  padding: '28px 32px', marginBottom: 20,
}
const H2: React.CSSProperties = { fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }
const BODY: React.CSSProperties = { fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }
const INK: React.CSSProperties = { color: 'var(--ink)' }

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
          <p>
            Click your name in the top-right corner and choose <strong>Settings</strong>. Settings has three tabs:{' '}
            <strong>Profile</strong>, <strong>Integrations</strong> and <strong>Subscription</strong>.
          </p>
        </div>
      </div>

      {/* Profile */}
      <div style={CARD}>
        <h2 style={H2}>Profile tab</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            Your profile details appear on share pages and closing slides.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Personal Info</strong> — Your full name, company name, phone and role.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Security</strong> — Change your email address or password. Forgot it? See <a href="#reset-password" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Forgot your password?</a> below.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Profile Photos</strong> — A <strong style={INK}>Headshot</strong> (required, used on covers), plus optional <strong style={INK}>Mid-level</strong> and <strong style={INK}>Standing</strong> photos.
          </p>
          <p>
            Your logo, colors and company details live in <strong style={INK}>Brand profiles</strong> — open it from the account menu (top-right). See{' '}
            <Link href="/help/brands" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Profiles &amp; Personalization</Link>.
          </p>
        </div>
      </div>

      {/* Integrations */}
      <div style={CARD}>
        <h2 style={H2}>Integrations tab</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Social Accounts</strong> — Connect your social accounts for the AI Social add-on.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Email Connections</strong> — Connect your own email so videos you send to clients come from your address.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Payment Link (Stripe)</strong> — Paste your Stripe Payment Link to show a <strong style={INK}>Make a Payment</strong> button on your share pages.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Calendar Booking</strong> — Choose Calendly, Cal.com or Google Calendar, paste your booking link and click <strong style={INK}>Save</strong> to show a <strong style={INK}>Book a Call</strong> button. You&rsquo;ll see &ldquo;Saved!&rdquo; next to the button. The link must start with <em>https://</em> (the same goes for your payment link) — anything else is refused with a message, because it would never show as a button on your share pages.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Using Google Calendar?</strong> Google Calendar can&rsquo;t be connected directly, so it works the same way as the others: you paste a link. In Google Calendar, create a <strong style={INK}>booking page</strong> (Google calls it an &ldquo;Appointment schedule&rdquo;), copy that page&rsquo;s link — it starts with <em>https://calendar.app.google/</em> — and paste it here. Clients who click <strong style={INK}>Book a Call</strong> then pick a time on your Google booking page.
          </p>
          <p>
            <strong style={INK}>API &amp; MCP</strong> — Create an API key to make things from your own scripts or an AI assistant. It uses your normal credits.
          </p>
        </div>
      </div>

      {/* Notifications */}
      <div style={CARD}>
        <h2 style={H2}>Notifications</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            The bell at the top of the screen shows when a video is being made, when it&rsquo;s finished, and when one failed (failed creations are refunded automatically).
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Share Page Views</strong> — Know when a client opens your share page. You get an email, and a text if your phone number is saved. Your own visits to your share link never count.
          </p>
          <p>
            You are also emailed when a client opens one of your share pages — and texted, if you added a phone number.
          </p>
          <p style={{ marginTop: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Choosing how many view alerts you get</strong> — Open <strong>Activity</strong> from the menu and pick the <strong>Notifications</strong> tab. Under <strong>View alerts</strong>, choose <em>Each new viewer</em> (one alert per person, then quiet for 12 hours if they come back), <em>First time only</em>, or <em>Off</em>. The choice saves as soon as you click it, and you&apos;ll see &ldquo;Saved.&rdquo; under the options.
          </p>
        </div>
      </div>

      {/* Billing */}
      <div style={CARD}>
        <h2 style={H2}>Subscription tab &amp; billing</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            All billing is handled securely by Stripe. The Subscription tab has three parts:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Credits &amp; Top-Ups</strong> — Your balance, and packs you can buy anytime: 2,500 credits for $10, 7,500 for $25, or 18,000 for $50. Bought credits never expire.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Your Plan</strong> — Your current plan. Click <strong style={INK}>Manage billing &amp; invoices</strong> to update your card, see past invoices and download receipts. Paid plans also show <strong style={INK}>Cancel subscription</strong>.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Plans</strong> — Pay As You Go (free), Pro ($79/mo), Business ($199/mo) and Enterprise ($499/mo).
          </p>
          <p>
            <strong style={INK}>Cancelling</strong> — You can cancel anytime. Your plan stays active until the end of the period you paid for. Bought top-up credits stay in your account.
          </p>
        </div>
      </div>

      {/* Subscription Plans */}
      <div style={CARD}>
        <h2 style={H2}>Changing Your Plan</h2>
        <div style={BODY}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={NUM}>1</div>
            <div>
              <strong style={INK}>Go to Settings {'>'} Subscription.</strong> Scroll to <strong style={INK}>Plans</strong>.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={NUM}>2</div>
            <div>
              <strong style={INK}>Pick the plan you want.</strong> Click <strong style={INK}>Subscribe to [Plan]</strong>, or <strong style={INK}>Switch to [Plan]</strong> if you already have one.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={NUM}>3</div>
            <div>
              <strong style={INK}>Pay on the secure Stripe page.</strong> When you&rsquo;re done you come back to your dashboard with the new plan&rsquo;s credits.
            </div>
          </div>
        </div>
      </div>

      {/* Forgot / set a password */}
      <div style={CARD} id="reset-password">
        <h2 style={H2}>Forgot your password? (or setting one for the first time)</h2>
        <div style={BODY}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={NUM}>1</div>
            <div>
              <strong style={INK}>Ask for a reset link.</strong> On the sign-in page, click <strong style={INK}>Forgot password?</strong>. Type your email address and click <strong style={INK}>Send Reset Link</strong>. You&rsquo;ll see &ldquo;Check Your Email&rdquo;.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={NUM}>2</div>
            <div>
              <strong style={INK}>Open the email and click the link.</strong> It works on any device — your phone is fine. The link works once and expires after a while.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={NUM}>3</div>
            <div>
              <strong style={INK}>Choose your new password.</strong> You land on a page called <strong style={INK}>Set a new password</strong>. Type a password of at least 8 characters, type it again to confirm, and click <strong style={INK}>Save new password</strong>.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={NUM}>4</div>
            <div>
              <strong style={INK}>You&rsquo;re in.</strong> You&rsquo;ll see &ldquo;Password updated&rdquo;. Click <strong style={INK}>Continue</strong> to go to your dashboard.
            </div>
          </div>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>&ldquo;This link has expired&rdquo;?</strong> The link was already used or is too old. Click <strong style={INK}>Send a new reset link</strong> and use the newest email.
          </p>
          <p>
            <strong style={INK}>Bought Docs2Video through Apex?</strong> Your account is made for you. Look for the email &ldquo;Welcome to Docs2Video — set up your account&rdquo; and click <strong style={INK}>Set up my account</strong>. It opens the same <strong style={INK}>Set a new password</strong> page. If that link has expired, use <strong style={INK}>Forgot password?</strong> with the email you bought with.
          </p>
        </div>
      </div>

      {/* Setup Wizard */}
      <div style={CARD}>
        <h2 style={H2}>Re-running the Setup Wizard</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            The Setup Wizard has five steps: <strong style={INK}>Profile</strong>, <strong style={INK}>Photo</strong>, <strong style={INK}>Brand</strong>, <strong style={INK}>Voice</strong> and <strong style={INK}>Style</strong>. It runs automatically when you first sign up, and you can press <strong style={INK}>Skip for now</strong> on any step.
          </p>
          <p>
            To run it again, open <strong style={INK}>Settings</strong> and click <strong style={INK}>Re-run Setup Wizard</strong> at the top. This is useful when you change companies, update your headshot, or want a new default voice or style.
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
