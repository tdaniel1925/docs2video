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

      {/* Billing — everything happens inside Docs2Video (2026-10-14): you
          pay, change plan, cancel, manage cards and download receipts here;
          no Stripe page opens. */}
      <div style={CARD}>
        <h2 style={H2}>Billing &amp; credits</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            Everything about paying happens right here in Docs2Video — you never get sent to another website. Payments are processed securely by Stripe; your card details go straight to Stripe, never to us. The page opens with three boxes:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Current plan</strong> — Your plan&rsquo;s name and price, and <strong style={INK}>Next charge</strong>: how much you&rsquo;ll pay and when (the same name shows under your name in the account menu). <strong style={INK}>Cancel plan</strong> is here too.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Credits available</strong> — Your balance, with a bar showing how much of this month&rsquo;s credits is left, plus any credits from packs. <strong style={INK}>Buy credits</strong> takes you to the packs.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>This period</strong> — How many credits you&rsquo;ve used since your period started.
          </p>
          <p>
            Below them: <strong style={INK}>Plans</strong> — {PLAN_LIST}; <strong style={INK}>Credit packs</strong> you can buy anytime: {packsSentence()} (they never expire); <strong style={INK}>Payment methods</strong>; <strong style={INK}>Invoices and receipts</strong>; and <strong style={INK}>Billing details</strong>.
          </p>
        </div>
      </div>

      <div style={CARD}>
        <h2 style={H2}>Paying for a plan, a credit pack or AI Social</h2>
        <div style={BODY}>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={NUM}>1</div>
            <div>
              <strong style={INK}>Press the button.</strong> <strong style={INK}>Subscribe to [Plan]</strong> under Plans, <strong style={INK}>Buy</strong> next to a credit pack (or <strong style={INK}>+ Top up</strong> in the top bar), or <strong style={INK}>Add AI Social</strong>. A payment window opens on top of the page.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={NUM}>2</div>
            <div>
              <strong style={INK}>Check what you&rsquo;re buying.</strong> The top shows the name, the price and <strong style={INK}>Today</strong> — what you pay now. Have a promo code for a plan (like WELCOME50)? Type it in <strong style={INK}>Promo code</strong> and press <strong style={INK}>Apply</strong>; the discount shows straight away. A code from our email is already applied.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={NUM}>3</div>
            <div>
              <strong style={INK}>Enter your card</strong> — or pick a card you saved before, or Apple Pay / Google Pay if your device has them. Some banks then show a short security check (a code or a tap in your banking app); it opens right there.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <div style={NUM}>4</div>
            <div>
              <strong style={INK}>Press Pay.</strong> You see <strong style={INK}>Payment received</strong> for a few seconds, then <strong style={INK}>You&rsquo;re all set</strong> once your plan or credits are on your account. If the card is declined you see why, and nothing is charged — try another card.
            </div>
          </div>
        </div>
      </div>

      <div style={CARD}>
        <h2 style={H2}>Changing your plan</h2>
        <div style={BODY}>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={NUM}>1</div>
            <div>
              <strong style={INK}>Go to Settings → Billing &amp; credits.</strong> Under <strong style={INK}>Plans</strong>, press <strong style={INK}>Switch to [Plan]</strong>.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={NUM}>2</div>
            <div>
              <strong style={INK}>See the price first.</strong> The window shows your plan now and the new one. Going up: <strong style={INK}>You pay today</strong> is just the difference for the rest of this month, and the extra credits arrive straight away. Going down: <strong style={INK}>Nothing to pay today</strong> — the lower price starts at your next renewal and you keep this month&rsquo;s credits.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <div style={NUM}>3</div>
            <div>
              <strong style={INK}>Press Upgrade — pay $… (or Switch to [Plan]).</strong> Your saved card is used. When it&rsquo;s done you see <strong style={INK}>You&rsquo;re on [Plan]</strong>. Changed your mind? Press <strong style={INK}>Keep [your plan]</strong> and nothing changes.
            </div>
          </div>
        </div>
      </div>

      <div style={CARD} id="cancel">
        <h2 style={H2}>Cancelling (and changing your mind)</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            Press <strong style={INK}>Cancel plan</strong> (or <strong style={INK}>Downgrade</strong> on Pay As You Go). Tell us why if you like — it&rsquo;s optional — then press <strong style={INK}>Cancel plan</strong>. You keep your plan and credits until the end of the period you paid for; after that you move to Pay As You Go and aren&rsquo;t charged again. Credits from packs stay.
          </p>
          <p style={{ marginBottom: 10 }}>
            Until that date the box says <strong style={INK}>Ends [date]</strong> with a <strong style={INK}>Keep my plan</strong> button — press it and your plan carries on as if nothing happened.
          </p>
          <p style={{ marginBottom: 10 }}>
            Still on your free trial? The button reads <strong style={INK}>Turn off the automatic plan</strong>: nothing is charged when your free credits run out, and you keep the credits you have.
          </p>
          <p>
            The AI Social add-on has its own <strong style={INK}>Cancel add-on</strong> / <strong style={INK}>Keep AI Social</strong> buttons and never touches your main plan.
          </p>
        </div>
      </div>

      <div style={CARD} id="cards">
        <h2 style={H2}>Cards, invoices and billing details</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Payment methods</strong> — your saved cards. <strong style={INK}>Add a card</strong> opens a card form right on the page (nothing is charged for saving it); tick <strong style={INK}>Use this card for future bills</strong> to make it the one we charge. <strong style={INK}>Make default</strong> switches which card is charged; <strong style={INK}>Remove</strong> asks first. You can&rsquo;t remove your only card while a plan or free trial uses it — add another first.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Invoices and receipts</strong> — every payment with its date, amount and status (<strong style={INK}>Paid</strong> or <strong style={INK}>Due</strong>). <strong style={INK}>PDF</strong> opens the receipt to save or print.
          </p>
          <p>
            <strong style={INK}>Billing details</strong> — the name or company, email and address printed on your invoices. Receipts go to that email. Press <strong style={INK}>Save details</strong>.
          </p>
        </div>
      </div>

      <div style={CARD} id="payment-failed">
        <h2 style={H2}>If a payment doesn&rsquo;t go through</h2>
        <div style={BODY}>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={NUM}>1</div>
            <div>
              <strong style={INK}>You&rsquo;ll see a red note</strong> on your Home page and in Billing: &ldquo;Your last payment didn&rsquo;t go through.&rdquo; New videos are paused until it&rsquo;s paid.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={NUM}>2</div>
            <div>
              <strong style={INK}>Press Update card</strong> and enter a card (or press <strong style={INK}>Pay now with [your card]</strong> to try your saved card again).
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <div style={NUM}>3</div>
            <div>
              <strong style={INK}>That&rsquo;s it.</strong> We pay the late bill with that card straight away and you see &ldquo;the late bill is paid&rdquo;. Your account unlocks within a few seconds.
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
