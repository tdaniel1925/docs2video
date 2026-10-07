'use client'

import Link from 'next/link'
import { PLANS, isSellablePlan } from '../../../_lib/pricing'
import { CREDIT_COSTS, TIER_CREDITS, TIER_APPROX_VIDEOS } from '../../../_lib/credits'
import { packsSentence } from '../../../_lib/credit-packs'
import { NAMES } from '../../../_lib/names'

// Getting Started guide. Audited against the live UI 2026-09-26: sign-up →
// card page (one-time free credits) → 5-step Setup Wizard → dashboard.
// Every price and credit amount is read from pricing.ts / credits.ts /
// credit-packs.ts, and button names from names.ts.

const FREE_CREDITS = TIER_CREDITS.free.toLocaleString('en-US')
/** "Pro ($79/mo), Business ($199/mo) or Enterprise ($499/mo)" */
const PAID_PLANS = (() => {
  const parts = PLANS.filter(p => isSellablePlan(p.tier)).map(p => `${p.label} ($${Math.round(p.monthlyPrice / 100)}/mo)`)
  return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`
})()

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
const LINK: React.CSSProperties = { color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }

function Row({ n, last, children }: { n: number; last?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: last ? 0 : 16 }}>
      <div style={NUM}>{n}</div>
      <div>{children}</div>
    </div>
  )
}

export default function GettingStartedPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={LINK}>
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
      <div style={CARD}>
        <h2 style={H2}>Creating Your Account</h2>
        <div style={BODY}>
          <Row n={1}>
            <strong style={INK}>Visit the sign-up page.</strong> Fill in your name, email address and a password.
          </Row>
          <Row n={2}>
            <strong style={INK}>Confirm your email.</strong> We send you an email with a link. Click it to confirm your address.
          </Row>
          <Row n={3}>
            <strong style={INK}>Add your payment card.</strong> A page titled <strong style={INK}>Add your payment method</strong> asks for your card (see below).
          </Row>
          <Row n={4} last>
            <strong style={INK}>Complete the Setup Wizard.</strong> Five short steps: <strong style={INK}>Profile</strong>, <strong style={INK}>Photo</strong>, <strong style={INK}>Brand</strong>, <strong style={INK}>Voice</strong> and <strong style={INK}>Style</strong>. You can press <strong style={INK}>Skip for now</strong>, and run it again later with <strong style={INK}>Re-run Setup Wizard</strong> at the top of Settings.
          </Row>
        </div>
      </div>

      {/* Section 2: Adding Your Payment Card */}
      <div style={CARD}>
        <h2 style={H2}>Adding Your Payment Card</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 12 }}>
            A card is needed to unlock your free credits. <strong style={INK}>Nothing is charged today.</strong>
          </p>
          <Row n={1}>
            <strong style={INK}>Choose a plan.</strong> Pick the plan you&rsquo;d like to move to once your free credits run out. You are only billed for it after they are used up.
          </Row>
          <Row n={2}>
            <strong style={INK}>Enter your card details.</strong> A secure Stripe form asks for your card number, expiry date and CVC. Your card details are handled by Stripe and never stored on our servers.
          </Row>
          <Row n={3} last>
            <strong style={INK}>Save your card.</strong> Click the button to save it and continue. Your {FREE_CREDITS} free credits are added right away.
          </Row>
          <p style={{ marginTop: 16 }}>
            To change your card later, open <strong style={INK}>Settings</strong> from the account menu (click your name, top-right), go to the <strong style={INK}>Subscription</strong> tab, and click <strong style={INK}>Manage billing &amp; invoices</strong>.
          </p>
        </div>
      </div>

      {/* Section 3: Free credits */}
      <div style={CARD}>
        <h2 style={H2}>Your {FREE_CREDITS} Free Credits</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 12 }}>
            Every new account gets <strong style={INK}>{FREE_CREDITS} free credits</strong> — a one-time welcome gift, enough for about <strong style={INK}>{TIER_APPROX_VIDEOS.free.standard} standard videos</strong> (a standard video is {CREDIT_COSTS.videoStandard.toLocaleString('en-US')} credits).
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={INK}>What is included:</strong> the full experience — AI reading your document, script editing, voice narration, background music, and downloads (MP4, PDF, PPTX).
          </p>
          <p>
            <strong style={INK}>When they run out:</strong> buy a top-up pack anytime with <strong style={INK}>+ Top Up</strong> next to your balance ({packsSentence()} — they never expire), or subscribe to {PAID_PLANS} for a monthly allowance. See{' '}
            <Link href="/help/pricing" style={LINK}>Pricing &amp; Plans</Link>.
          </p>
        </div>
      </div>

      {/* Section 4: Navigating the Dashboard */}
      <div style={CARD}>
        <h2 style={H2}>Finding Your Way Around</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 16 }}>
            After logging in, you land on your Dashboard. Here is what you will see:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Top bar</strong> — <strong style={INK}>Dashboard</strong>, <strong style={INK}>{NAMES.newButton}</strong> (start anything new), <strong style={INK}>{NAMES.library}</strong> (everything you&rsquo;ve made) and <strong style={INK}>Clients</strong>. Your credit balance, with a <strong style={INK}>+ Top Up</strong> button, is on the right.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Account menu</strong> — Click your name (top-right) for your plan, your credits and <strong style={INK}>Top Up</strong>, <strong style={INK}>Analytics</strong>, <strong style={INK}>AI Social</strong>, <strong style={INK}>{NAMES.brands}</strong>, <strong style={INK}>Settings</strong>, <strong style={INK}>Affiliate Program</strong>, <strong style={INK}>Help Center</strong> and <strong style={INK}>Sign Out</strong>.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Projects</strong> — Your latest work and where each one is at (draft, sent, watched). Click <strong style={INK}>Open</strong> on one, or <strong style={INK}>Continue</strong> on a draft. Go to <strong style={INK}>{NAMES.library}</strong> to see everything.
          </p>
          <p>
            <strong style={INK}>This month</strong> — On the right: emails sent, projects watched, clicks to book a call, your credits left and your plan.
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
