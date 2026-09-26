'use client'

import Link from 'next/link'

// Audited against the live share page (app/(public)/watch/[id]) on 2026-09-26.
// The share page has no AI chat and no MP4/PDF/PPTX downloads for the client —
// only the original PDF, and only when the agent turns it on.

const CARD: React.CSSProperties = {
  background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
  padding: '28px 32px', marginBottom: 20,
}
const H2: React.CSSProperties = { fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }
const BODY: React.CSSProperties = { fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }
const STEP_NUM: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--mint)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
}
const INK: React.CSSProperties = { color: 'var(--ink)' }

export default function SharingVideosPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Sharing & the Client Page</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Sharing & the Client Page</h1>
          <p>How to send a video to a client, and exactly what they see when they open it.</p>
        </div>
      </div>

      {/* How to Share */}
      <div style={CARD}>
        <h2 style={H2}>How to Share Your Video</h2>
        <div style={BODY}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={STEP_NUM}>1</div>
            <div>
              <strong style={INK}>Open the video.</strong> Click <strong style={INK}>Library</strong> in the top bar, then click the video you want to share. You land on the video page with the player and a row of buttons.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={STEP_NUM}>2</div>
            <div>
              <strong style={INK}>Click &ldquo;Send to Client.&rdquo;</strong> A window opens. Enter the <strong style={INK}>Client email</strong>, their name (optional) and your <strong style={INK}>Email message</strong>, then send. They get an email with your message and a <strong style={INK}>Watch Video</strong> button.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={STEP_NUM}>3</div>
            <div>
              <strong style={INK}>Or copy the link.</strong> Click <strong style={INK}>Copy Link</strong> to copy the share page address. Paste it into an email, a text message, or anywhere else.
            </div>
          </div>
        </div>
      </div>

      {/* Share Page Features */}
      <div style={CARD}>
        <h2 style={H2}>What Your Client Sees</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 12 }}>
            Every completed video gets its own public page at <strong style={INK}>docs2video.com/watch/[video-id]</strong>. Your client does not need an account — they click the link and it opens in their browser, on a computer, tablet or phone.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Welcome banner</strong> — If you named a client when you made the video, the page greets them: &ldquo;Hi [Client] — prepared for you by [You].&rdquo;
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>A note from you</strong> — If you wrote a <strong style={INK}>Note to your client</strong> on the Style step, it shows above the video as &ldquo;A note from [You].&rdquo;
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>The video</strong> — A player with play/pause, volume and full screen.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Your details</strong> — Your name, photo, company and contact information, taken from the profile you picked on the Presenter step.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Download Original PDF</strong> — Only if you turned on <strong style={INK}>Let the client download the original PDF</strong> on the Style step. This is the only download on the page; your client cannot download the video, slides or PowerPoint.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Book a Call</strong> and <strong style={INK}>Make a Payment</strong> — These buttons appear when you have added a booking link (Calendly, Cal.com or Google Calendar) or a payment link. Set them up in <strong style={INK}>Settings &gt; Integrations</strong> (account menu, top-right).
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Ask a question</strong> — On interactive presentations, your client can send you a question from the last slide. It arrives in your email.
          </p>
          <p>
            <strong style={INK}>Branding</strong> — A small &ldquo;Powered by Docs2Video&rdquo; line appears at the top and bottom of the page. On the <strong style={INK}>Business</strong> and <strong style={INK}>Enterprise</strong> plans it is removed (white-label).
          </p>
        </div>
      </div>

      {/* Quotes, payment status and follow-ups */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Quotes, Payments and Follow-Ups
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Add a quote.</strong> On the video page, scroll to <strong>Quote / Invoice</strong> and click <strong>Add Quote</strong>. Enter the client&apos;s name and email and your line items, then click <strong>Save Quote</strong>. You&apos;ll see &ldquo;Quote saved&rdquo; — if saving fails, the page says so and keeps your form open.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Mark the deal.</strong> We can&apos;t tell when a client pays you (a click on your payment link isn&apos;t a payment). When it happens, open the video page and click <strong>Mark as paid</strong>, <strong>Mark as accepted</strong> or <strong>Mark as declined</strong> under the quote. The status label changes right away. Paid and accepted also mark the client as converted. Changed your mind? Click <strong>Reopen</strong>.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Automatic follow-ups (off unless you turn them on).</strong> Tick <strong>Automatic follow-ups</strong> under the quote to send up to two short reminders — about 3 and 7 days after the quote — from your connected email account. Each reminder has an unsubscribe link, and they stop as soon as you mark the deal paid, accepted or declined, or the client unsubscribes. You need a connected email account and the client&apos;s email on the quote.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Follow-up plan drafts.</strong> The <strong>Follow-Up Plan</strong> section writes draft emails for you, labeled with the day we suggest sending them. They are never sent by themselves — click <strong>Send now</strong> on each one when you&apos;re ready, or <strong>Skip</strong>.
          </p>
        </div>
      </div>

      {/* Insurance Disclaimers */}
      <div style={CARD}>
        <h2 style={H2}>Insurance Disclosures</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 12 }}>
            If your video was made from an insurance illustration or proposal, the share page includes the legal disclosures automatically. They sit in a <strong style={INK}>View Legal Disclosures</strong> section that your client can click to open.
          </p>
          <p>
            For more on how insurance compliance works, see the <Link href="/help/insurance" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Insurance Illustrations</Link> guide.
          </p>
        </div>
      </div>

      {/* Knowing when they watch */}
      <div style={CARD}>
        <h2 style={H2}>Knowing When They Watch</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            When someone opens your share page you get an email (and a text, if you added a phone number) telling you which video they opened and on what device.
          </p>
          <p>
            To see how far people watched and who clicked your buttons, open the account menu (top-right) and choose <strong style={INK}>Analytics</strong>.
          </p>
        </div>
      </div>

      {/* Your own downloads */}
      <div style={CARD}>
        <h2 style={H2}>Downloading Files for Yourself</h2>
        <div style={BODY}>
          <p>
            On the video page, the <strong style={INK}>MP4</strong>, <strong style={INK}>PDF</strong>, <strong style={INK}>PPTX</strong> and <strong style={INK}>Script</strong> buttons download the files for you — to attach to an email, present in a meeting, or post elsewhere. See <Link href="/help/downloads" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Downloads & Formats</Link>.
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
