'use client'

import Link from 'next/link'
import { PLANS, isSellablePlan } from '../../../_lib/pricing'
import { packsSentence } from '../../../_lib/credit-packs'
import { NAMES } from '../../../_lib/names'

// Account & Settings guide. Rewritten for the round-B account area (2026-10-08):
// a menu down the left — Profile, Billing & credits, Brand kit, Email &
// sending, Analytics, Affiliate (+ AI Social with the add-on).
// Prices and pack sizes are read from pricing.ts / credit-packs.ts so this page
// can't quote an old price.

/** "Pay As You Go (free), Pro ($79/mo), Business ($199/mo) and Enterprise ($499/mo)" */
const PLAN_LIST = (() => {
  const parts = PLANS.filter(p => p.tier === 'free' || isSellablePlan(p.tier))
    .map(p => p.monthlyPrice > 0 ? `${p.label} ($${Math.round(p.monthlyPrice / 100)}/mo)` : `${p.label} (free)`)
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
})()

const NUM: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--accent)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--fs-ui)', flexShrink: 0,
}
const CARD: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
  padding: '28px 32px', marginBottom: 20,
}
const H2: React.CSSProperties = { fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }
const BODY: React.CSSProperties = { fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }
const INK: React.CSSProperties = { color: 'var(--ink)' }

export default function AccountHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Account & settings</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Account & settings</h1>
          <p>
            Click your initial in the top-right corner and choose <strong>Settings</strong> (or <strong>Billing &amp; credits</strong> to go straight there).
            Your account has a menu down the left — on a phone it is a row at the top you can swipe sideways:{' '}
            <strong>Profile</strong>, <strong>Billing &amp; credits</strong>, <strong>Brand kit</strong>, <strong>Email &amp; sending</strong>,{' '}
            <strong>Analytics</strong> and <strong>Affiliate</strong>. If you have the AI Social add-on, <strong>AI Social</strong> is there too.
            Old bookmarks still work: they open the matching part.
          </p>
        </div>
      </div>

      {/* Profile */}
      <div style={CARD}>
        <h2 style={H2}>Profile</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            Your profile details appear on share pages and closing slides.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Your details</strong> — Your full name, company name, phone and role. Click <strong style={INK}>Save changes</strong>; you&rsquo;ll see &ldquo;Saved!&rdquo;.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Appearance</strong> — Pick <strong style={INK}>System</strong>, <strong style={INK}>Light</strong> or <strong style={INK}>Dark</strong>. The app is dark unless you pick otherwise; System follows your computer&rsquo;s setting. The screen changes as soon as you click — there is nothing to save. The choice is kept on this browser only, so a new computer or phone starts dark. For a quick switch, click your initial at the top right and choose <strong style={INK}>Light mode</strong> (or <strong style={INK}>Dark mode</strong>). Share pages you send to clients always stay light.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Security</strong> — Change your email address or password. Forgot it? See <a href="#reset-password" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Forgot your password?</a> below.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Profile photos</strong> — A <strong style={INK}>Headshot</strong> (required, used on covers), plus optional <strong style={INK}>Mid-level</strong> and <strong style={INK}>Standing</strong> photos.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>API keys</strong> — Create an API key to make things from your own scripts or an AI assistant. It uses your normal credits.
          </p>
          <p>
            <strong style={INK}>Delete account</strong> — At the very bottom. It asks twice before anything happens, and it can&rsquo;t be undone.
          </p>
        </div>
      </div>

      {/* Brand kit */}
      <div style={CARD}>
        <h2 style={H2}>Brand kit</h2>
        <div style={BODY}>
          <p>
            Shows your default brand — its logo and colors. Click <strong style={INK}>Change logo</strong> or <strong style={INK}>Edit colors</strong>, or <strong style={INK}>See all brands</strong> to open <strong style={INK}>{NAMES.brands}</strong> (also in the top bar). See{' '}
            <Link href="/help/brands" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Brands &amp; personalization</Link>.
          </p>
        </div>
      </div>

      {/* Email & sending */}
      <div style={CARD}>
        <h2 style={H2}>Email &amp; sending</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Connected email</strong> — Connect your own email (Microsoft 365, Gmail or SMTP) so videos you send to clients come from your address. <strong style={INK}>Send a test email</strong> checks it works.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Booking link</strong> — Choose Calendly, Cal.com or Google Calendar, paste your booking link and click <strong style={INK}>Save</strong> to show a <strong style={INK}>Book a Call</strong> button. You&rsquo;ll see &ldquo;Saved!&rdquo; next to the button. The link must start with <em>https://</em> (the same goes for your payment link) — anything else is refused with a message, because it would never show as a button on your share pages.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Using Google Calendar?</strong> Google Calendar can&rsquo;t be connected directly, so it works the same way as the others: you paste a link. In Google Calendar, create a <strong style={INK}>booking page</strong> (Google calls it an &ldquo;Appointment schedule&rdquo;), copy that page&rsquo;s link — it starts with <em>https://calendar.app.google/</em> — and paste it here. Clients who click <strong style={INK}>Book a Call</strong> then pick a time on your Google booking page.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Payment link</strong> — Paste your Stripe Payment Link to show a <strong style={INK}>Make a Payment</strong> button on your share pages.
          </p>
          <p>
            <strong style={INK}>View alerts</strong> — How often you hear when a client opens something you shared (see Notifications below).
          </p>
        </div>
      </div>

      {/* AI Social */}
      <div style={CARD}>
        <h2 style={H2}>AI Social</h2>
        <div style={BODY}>
          <p>
            Shown in the menu once you have the AI Social add-on. <strong style={INK}>Social accounts</strong> connects the accounts it posts to; pick a <strong style={INK}>Social voice</strong> and what to post about, then click <strong style={INK}>Save</strong>. <strong style={INK}>Open AI Social</strong> goes to the posting page.
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
            <strong style={{ color: 'var(--ink)' }}>Choosing how many view alerts you get</strong> — Open <strong>Settings → Email &amp; sending</strong> (or <strong>Activity</strong> → <strong>Notifications</strong>). Under <strong>View alerts</strong>, choose <em>Each new viewer</em> (one alert per person, then quiet for 12 hours if they come back), <em>First time only</em>, or <em>Off</em>. The choice saves as soon as you click it, and you&apos;ll see &ldquo;Saved.&rdquo; under the options.
          </p>
        </div>
      </div>

      {/* Billing */}
      <div style={CARD}>
        <h2 style={H2}>Billing &amp; credits</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            All billing is handled securely by Stripe. The page opens with three boxes:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Current plan</strong> — Your plan&rsquo;s name and price, and the date it renews (the same name shows under your name in the account menu). <strong style={INK}>Manage billing &amp; invoices</strong> opens Stripe to update your card or download receipts.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Credits available</strong> — Your balance, with a bar showing how much of this month&rsquo;s credits is left, plus any credits from packs. <strong style={INK}>Buy credits</strong> opens the top-up window.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>This period</strong> — How many credits you&rsquo;ve used since your period started.
          </p>
          <p style={{ marginBottom: 10 }}>
            Below them: <strong style={INK}>Plans</strong> — {PLAN_LIST}; <strong style={INK}>Credit packs</strong> you can buy anytime: {packsSentence()} (they never expire); and <strong style={INK}>Invoices and receipts</strong>, with <strong style={INK}>See invoices</strong> and, on a paid plan, <strong style={INK}>Cancel subscription</strong>.
          </p>
          <p>
            <strong style={INK}>Cancelling</strong> — You can cancel anytime. Your plan stays active until the end of the period you paid for. Bought top-up credits stay in your account.
          </p>
        </div>
      </div>

      {/* Subscription Plans */}
      <div style={CARD}>
        <h2 style={H2}>Changing your plan</h2>
        <div style={BODY}>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={NUM}>1</div>
            <div>
              <strong style={INK}>Go to Settings → Billing &amp; credits.</strong> Scroll to <strong style={INK}>Plans</strong>.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={NUM}>2</div>
            <div>
              <strong style={INK}>Pick the plan you want.</strong> Click <strong style={INK}>Subscribe to [Plan]</strong>, or <strong style={INK}>Switch to [Plan]</strong> if you already have one.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
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
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={NUM}>1</div>
            <div>
              <strong style={INK}>Ask for a reset link.</strong> On the sign-in page, click <strong style={INK}>Forgot password?</strong>. Type your email address and click <strong style={INK}>Send Reset Link</strong>. You&rsquo;ll see &ldquo;Check Your Email&rdquo;.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={NUM}>2</div>
            <div>
              <strong style={INK}>Open the email and click the link.</strong> It works on any device — your phone is fine. The link works once and expires after a while.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={NUM}>3</div>
            <div>
              <strong style={INK}>Choose your new password.</strong> You land on a page called <strong style={INK}>Set a new password</strong>. Type a password of at least 8 characters, type it again to confirm, and click <strong style={INK}>Save new password</strong>.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
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
        <h2 style={H2}>Running the setup again</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            The Setup Wizard has five steps: <strong style={INK}>Profile</strong>, <strong style={INK}>Photo</strong>, <strong style={INK}>Brand</strong>, <strong style={INK}>Voice</strong> and <strong style={INK}>Style</strong>. It is optional: new accounts go straight to Home, and your brand, voice and look are picked inside your first project. You can press <strong style={INK}>Skip for now</strong> on any step.
          </p>
          <p>
            To run it again, open <strong style={INK}>Settings → Profile</strong> and click <strong style={INK}>Run the setup again</strong>. This is useful when you change companies, update your headshot, or want a new default voice or style.
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
