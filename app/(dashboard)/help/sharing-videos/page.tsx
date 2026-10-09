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
  width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--accent)',
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
        <span>Sharing & the client page</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Sharing & the client page</h1>
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
              <strong style={INK}>Open the video.</strong> Click <strong style={INK}>Library</strong> in the top bar, then click the video you want to share. The top of its page is <strong style={INK}>Ready to send</strong>: on the left, a picture of exactly what your client will see; on the right, the send panel.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={STEP_NUM}>2</div>
            <div>
              <strong style={INK}>Check &ldquo;What&rsquo;s left.&rdquo;</strong> At the top of the send panel, small chips list anything missing from their page — your client&rsquo;s email, a note, a booking link, your photo or name, a payment link for a quote. Press one to go straight to the fix. When nothing is missing it says <strong style={INK}>All set</strong>.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={STEP_NUM}>3</div>
            <div>
              <strong style={INK}>Write a note and send.</strong> Write <strong style={INK}>A short note</strong> (it shows on their page and in the email), turn the pieces on or off, then press <strong style={INK}>Send to [your client]</strong>. They get an email with your note and a <strong style={INK}>Watch Video</strong> button. If the app doesn&rsquo;t have their email yet, type it in (and their name, if you like). To send it to someone else this once, press <strong style={INK}>Send to someone else</strong>. The line under the button says whether it goes from your own connected email or from our address (replies still come to you). You see &ldquo;✓ Sent to …&rdquo; when it has really gone.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={STEP_NUM}>4</div>
            <div>
              <strong style={INK}>Or send it yourself.</strong> Press <strong style={INK}>or copy the link</strong> to copy the share page address, or <strong style={INK}>Copy the email</strong> to copy the whole email (your note, a View button and the link) and paste it into Gmail or Outlook. Copying sends nothing — you press Send there. On insurance videos, a copied link comes with the policy disclosure.
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
            <strong style={INK}>A note from you</strong> — If you wrote <strong style={INK}>A note to your client</strong> on step 3 (Make it yours), it shows above the video as &ldquo;A note from [You].&rdquo;
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>The video</strong> — A player with play/pause, volume and full screen.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Your details</strong> — Your name, photo, company and contact information, taken from the brand you picked on step 3 (Make it yours).
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Download Original PDF</strong> — Only if you turned on <strong style={INK}>Let them download the original PDF</strong> on step 3 (Make it yours). This is the only download on the page; your client cannot download the video, slides or PowerPoint.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={INK}>Book a Call</strong> and <strong style={INK}>Make a Payment</strong> — These buttons appear when you have added a booking link (Calendly, Cal.com or Google Calendar) or a payment link. Set them up in <strong style={INK}>Settings &gt; Email &amp; sending</strong> (account menu, top-right). The link must be a full web address starting with <em>https://</em>, or the button won&rsquo;t appear. For Google Calendar, paste the link of a Google <strong style={INK}>booking page</strong> (an &ldquo;Appointment schedule&rdquo;) — Google Calendar can&rsquo;t be connected directly.
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
            <strong style={{ color: 'var(--ink)' }}>Add a quote.</strong> On the video page, press <strong>Add a quote</strong> in the send panel, or scroll to <strong>More for this video</strong> and open the <strong>Quote / invoice</strong> tab, then click <strong>Add a quote</strong>. Enter the client&apos;s name and email and your line items, then click <strong>Save quote</strong>. You&apos;ll see &ldquo;Quote saved&rdquo; — if saving fails, the page says so and keeps your form open.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Mark the deal.</strong> We can&apos;t tell when a client pays you (a click on your payment link isn&apos;t a payment). When it happens, open the video page and click <strong>Mark as paid</strong>, <strong>Mark as accepted</strong> or <strong>Mark as declined</strong> under the quote. The status label changes right away. Paid and accepted also mark the client as converted. Changed your mind? Click <strong>Reopen</strong>.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Automatic follow-ups (off unless you turn them on).</strong> Tick <strong>Automatic follow-ups</strong> under the quote to send up to two short reminders — about 3 and 7 days after the quote — from your connected email account. Each reminder has an unsubscribe link, and they stop as soon as you mark the deal paid, accepted or declined, or the client unsubscribes. You need a connected email account and the client&apos;s email on the quote.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Follow-up plan drafts.</strong> The <strong>Follow-Up Plan</strong> tab (under More for this video) writes draft emails for you, labeled with the day we suggest sending them. They are never sent by themselves — click <strong>Send now</strong> on each one when you&apos;re ready, or <strong>Skip</strong>.
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
            For more on how insurance compliance works, see the <Link href="/help/insurance" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Insurance illustrations</Link> guide.
          </p>
        </div>
      </div>

      {/* Knowing when they watch */}
      <div style={CARD}>
        <h2 style={H2}>Knowing When They Watch</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            When someone opens your share page you get an email (and a text, if you added a phone number) telling you which video they opened and on what device. To choose when that happens — each new viewer, first time only, or off — open the bell, press <strong style={INK}>View all</strong>, then <strong style={INK}>Notifications</strong>, or use the <strong style={INK}>change when</strong> link on the video page.
          </p>
          <p style={{ marginBottom: 10 }}>
            On the video page, <strong style={INK}>Who watched</strong> lists each person you emailed it to: when you sent it, whether they opened the email, and a bar in four parts showing how far into the video they got (a quarter, half, three quarters, the end) and when. It also shows if they pressed Book a call or Pay. People who opened a copied link are listed by their device. Your own visits don&rsquo;t count. Presentations show when they were opened and clicked into, not how far.
          </p>
          <p>
            For totals across all your videos, open the account menu (top-right) and choose <strong style={INK}>Analytics</strong>.
          </p>
        </div>
      </div>

      {/* Your own downloads */}
      <div style={CARD}>
        <h2 style={H2}>Downloading Files for Yourself</h2>
        <div style={BODY}>
          <p>
            On the video page, the <strong style={INK}>Download</strong> menu (top-right) has the files this video has — <strong style={INK}>MP4</strong>, <strong style={INK}>PDF</strong>, <strong style={INK}>PowerPoint</strong> and <strong style={INK}>Script</strong> — for you — to attach to an email, present in a meeting, or post elsewhere. See <Link href="/help/downloads" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Downloads & formats</Link>.
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
