'use client'

import Link from 'next/link'
import { PLANS, isSellablePlan } from '../../../_lib/pricing'
import { CREDIT_COSTS, TIER_CREDITS, TIER_APPROX_VIDEOS } from '../../../_lib/credits'
import { packsSentence } from '../../../_lib/credit-packs'
import { NAMES } from '../../../_lib/names'
import { FREE_PREVIEWS_PER_DAY } from '../../../_lib/first-scene-preview'

// Getting started guide. Updated for the light start (overhaul phase 5,
// 2026-10): sign-up → Home → first project (free preview) → a card only when
// you press Make it. The Setup Wizard is optional (Settings).
// Every price and credit amount is read from pricing.ts / credits.ts /
// credit-packs.ts, and button names from names.ts.

const FREE_CREDITS = TIER_CREDITS.free.toLocaleString('en-US')
/** "Pro ($79/mo), Business ($199/mo) or Enterprise ($499/mo)" */
const PAID_PLANS = (() => {
  const parts = PLANS.filter(p => isSellablePlan(p.tier)).map(p => `${p.label} ($${Math.round(p.monthlyPrice / 100)}/mo)`)
  return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`
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
const LINK: React.CSSProperties = { color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }

function Row({ n, last, children }: { n: number; last?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: last ? 0 : 16 }}>
      <div style={NUM}>{n}</div>
      <div>{children}</div>
    </div>
  )
}

export default function GettingStartedPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>
        <Link href="/help" style={LINK}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Getting started</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Getting started</h1>
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
            <strong style={INK}>You land on Home.</strong> No card and no setup pages first. A note at the top says <strong style={INK}>Try it before you add a card.</strong>
          </Row>
          <Row n={4}>
            <strong style={INK}>Make your first project.</strong> Pick a start card, let it read your document and check the story. On step 3 (<strong style={INK}>Make it yours</strong>) press <strong style={INK}>See a free preview</strong> to see the first scene in your look and hear the voice — free, {FREE_PREVIEWS_PER_DAY} a day, no card needed.
          </Row>
          <Row n={5} last>
            <strong style={INK}>Add your brand there too.</strong> On the same step, <strong style={INK}>Add your brand</strong> asks for your name, logo and colours — <strong style={INK}>Fill in from it</strong> reads them from your website. It is optional; with no logo your name shows as text. The old five-page <strong style={INK}>Setup Wizard</strong> is still there if you want it: <strong style={INK}>Run the setup again</strong> in Settings → Profile.
          </Row>
        </div>
      </div>

      {/* Section 2: Adding Your Payment Card */}
      <div style={CARD}>
        <h2 style={H2}>Adding Your Payment Card</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 12 }}>
            You add a card when you press <strong style={INK}>Make it</strong> on your first real video, presentation or slide deck. The page <strong style={INK}>Add your payment method</strong> opens, and after you save the card it takes you straight back to your project. The card unlocks your free credits. <strong style={INK}>Nothing is charged today.</strong> You can add it earlier with <strong style={INK}>Add a card</strong> on Home, or leave the card page with <strong style={INK}>Not now</strong>.
          </p>
          <Row n={1}>
            <strong style={INK}>Choose a plan.</strong> Pick the plan you&rsquo;d like to move to once your free credits run out. You are only billed for it after they are used up.
          </Row>
          <Row n={2}>
            <strong style={INK}>Enter your card details.</strong> A secure Stripe form asks for your card number, expiry date and CVC. Your card details are handled by Stripe and never stored on our servers.
          </Row>
          <Row n={3} last>
            <strong style={INK}>Save your card.</strong> Click the button to save it and continue. Your {FREE_CREDITS} free credits start right away, and you are back where you pressed Make it.
          </Row>
          <p style={{ marginTop: 16 }}>
            To change your card later, open <strong style={INK}>Settings</strong> from the account menu (click your name, top-right), choose <strong style={INK}>Billing &amp; credits</strong>, and click <strong style={INK}>Manage billing &amp; invoices</strong>.
          </p>
        </div>
      </div>

      {/* Section 3: Free credits */}
      <div style={CARD}>
        <h2 style={H2}>Your {FREE_CREDITS} Free Credits</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 12 }}>
            Every new account gets <strong style={INK}>{FREE_CREDITS} free credits</strong> once a card is saved — a one-time welcome gift, enough for about <strong style={INK}>{TIER_APPROX_VIDEOS.free.standard} standard videos</strong> (a standard video is {CREDIT_COSTS.videoStandard.toLocaleString('en-US')} credits).
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={INK}>What is included:</strong> the full experience — AI reading your document, script editing, voice narration, background music, and downloads (MP4, PDF, PPTX).
          </p>
          <p>
            <strong style={INK}>When they run out:</strong> buy a top-up pack anytime with <strong style={INK}>+ Top Up</strong> next to your balance ({packsSentence()} — they never expire), or subscribe to {PAID_PLANS} for a monthly allowance. See{' '}
            <Link href="/help/pricing" style={LINK}>Pricing &amp; plans</Link>.
          </p>
        </div>
      </div>

      {/* Section 4: Navigating the Dashboard */}
      <div style={CARD}>
        <h2 style={H2}>Finding Your Way Around</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 16 }}>
            After logging in, you land on Home. Here is what you will see:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Top bar</strong> — four words: <strong style={INK}>{NAMES.newButton}</strong> (start anything new), <strong style={INK}>{NAMES.library}</strong> (everything you&rsquo;ve made), <strong style={INK}>{NAMES.clients}</strong> (the people you send to) and <strong style={INK}>{NAMES.brands}</strong> (your logos and colors). The Docs2Video logo takes you back Home. On the right: <strong style={INK}>{NAMES.howToUse}</strong>, your credits in gold with <strong style={INK}>+ Top Up</strong> (they turn amber when fewer than {CREDIT_COSTS.videoStandard.toLocaleString('en-US')} are left — one standard video), the bell, and your initial.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>{NAMES.howToUse}</strong> — Opens the steps for the screen you&rsquo;re on, numbered and in plain words. Press Esc or the &times; to close it. On a phone, open the &#9776; menu and choose <strong style={INK}>{NAMES.howToUse} this screen</strong>.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Account menu</strong> — Click your initial (top-right) for your plan and shortcuts to <strong style={INK}>Settings</strong>, <strong style={INK}>Billing &amp; credits</strong>, <strong style={INK}>Analytics</strong>, <strong style={INK}>AI Social</strong>, <strong style={INK}>Affiliate</strong>, the <strong style={INK}>Help Center</strong> and <strong style={INK}>Sign out</strong>. Settings, Analytics and Affiliate share one menu down the left (a row at the top on a phone).
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Create</strong> — Six small tiles: <strong style={INK}>From a document</strong>, <strong style={INK}>From a website</strong>, <strong style={INK}>From an idea</strong> (AI writes it), <strong style={INK}>Paste your text</strong>, <strong style={INK}>A commercial</strong> and <strong style={INK}>Your brand</strong>. Each one opens the first step with that choice already made (Your brand opens Brands). Your free credits are on the same line as the word Create.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Today&rsquo;s clients</strong> — Who clicked to book a call, who watched, and who hasn&rsquo;t opened what you sent — each with the next thing to do, like <strong style={INK}>Send the follow-up</strong>.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Recent</strong> — Your latest work and where each one is at (draft, sent, watched). Click <strong style={INK}>Open</strong> on one, or <strong style={INK}>Continue</strong> on a draft. Go to <strong style={INK}>{NAMES.library}</strong> to see everything.
          </p>
          <p>
            <strong style={INK}>This month</strong> — Beside your projects: emails sent, projects watched, clicks to book a call, your credits left and your plan.
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
