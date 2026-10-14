'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

// ANNUAL REVIEWS — policy dates, "Review due", Prepare review, the send day
// and the Reviews box. Written from the screens' own words (Clients, the
// client page, /clients/[id]/review, Home). Update with those screens.

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '28px 32px', marginBottom: 20 }
const h2: React.CSSProperties = { fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }
const body: React.CSSProperties = { fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }
const B = ({ children }: { children: ReactNode }) => <strong style={{ color: 'var(--ink)' }}>{children}</strong>

export default function AnnualReviewsHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 8, fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Help Center</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Annual reviews</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Annual reviews</h1>
          <p>Every policy has an anniversary. A month before it, we remind you and help you send a short “Your year in review” video — a friendly reason to get back in touch.</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>1. Add a policy date</h2>
        <div style={body}>
          <p style={{ marginBottom: 10 }}>On <B>Clients</B>, press <B>Add a client</B> and fill in <B>Policy date</B> — the day their policy started. For a client you already have, open their page and press <B>Add policy date</B> in the <B>Policy date &amp; annual review</B> box.</p>
          <p>If their document says when the policy was issued, we suggest that date (<B>Use this date</B>). A date we read is only a suggestion: reviews start once you press <B>Yes, that’s right</B>.</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>2. “Review due in 30 days”</h2>
        <div style={body}>
          <p style={{ marginBottom: 10 }}>From 30 days before the anniversary, their row on Clients says <B>Review due in 30 days</B> (counting down), with <B>Prepare review</B>. A card also appears under <B>Today’s clients</B> on Home.</p>
          <p>We email you a short list when a review is 30 days away and again at 7 days, if it isn’t sorted yet. Dates follow your own time zone. A policy that started on 29 February has its anniversary on 28 February in other years.</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>3. Prepare the review</h2>
        <ol style={{ ...body, paddingLeft: 20, margin: 0 }}>
          <li style={{ marginBottom: 10 }}>Press <B>Prepare review</B>. Under <B>This year’s statement</B>, press <B>Upload this year’s statement</B>.</li>
          <li style={{ marginBottom: 10 }}>Under <B>Last year’s document</B>, tick <B>Compare with last year’s document</B> and pick it. With both, the video lines up last year’s numbers next to this year’s. No new statement? Tick <B>Reuse last year’s document</B> instead.</li>
          <li style={{ marginBottom: 10 }}>Press <B>Prepare the review →</B>. We read the documents and open the normal story step, already filled in. Check it, pick the look, and press <B>Make it</B>.</li>
          <li><B>Cost:</B> preparing is free. Making the video costs the normal price shown on <B>Make it</B> (comparing two documents counts the second one, the same as any two-document video).</li>
        </ol>
      </div>

      <div style={card}>
        <h2 style={h2}>4. Pick the send day</h2>
        <div style={body}>
          <p style={{ marginBottom: 10 }}>When the video is made, open the review again. Under <B>When should it go out?</B> choose the <B>Send day</B>, check <B>Their email</B>, and press <B>Schedule it</B>.</p>
          <p style={{ marginBottom: 10 }}>That morning it goes out through your normal Send — the same email, from your connected mailbox if you have one — and you get a note in the bell. You can <B>Change or cancel</B> until then. If it can’t send, it tries again the next day (up to three days), then tells you.</p>
          <p>Not doing one this year? <B>Skip this year</B> (you can undo it).</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>The Reviews box on Home</h2>
        <div style={body}>
          <p><B>Annual reviews</B> on Home counts this year’s reviews: <B>Due</B> (not prepared yet), <B>Prepared</B>, <B>Sent</B>, <B>Watched</B> and <B>Booked</B> (they pressed to book a call), and lists the next clients due.</p>
        </div>
      </div>
    </div>
  )
}
