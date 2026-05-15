'use client'

import Link from 'next/link'

export default function SharingVideosPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Sharing Videos with Clients</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Sharing Videos with Clients</h1>
          <p>How to share your videos, what clients see, and all available download options.</p>
        </div>
      </div>

      {/* Share Page Features */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          The Share Page
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            Every completed video gets its own public share page. This is a professionally branded landing page designed to impress your clients. The URL looks like <strong style={{ color: 'var(--ink)' }}>docs2video.com/watch/[video-id]</strong>. Here is what appears on the share page:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Video Player</strong> — A full-featured video player at the top of the page with play/pause, volume, fullscreen, and progress controls. Below the player, clickable slide thumbnails let the viewer jump to any section of the video.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>AI Chat Assistant</strong> — A chat widget that your client can use to ask questions about the video content. The AI knows everything in the video plus information from your company website (if you have set one up in your brand settings). Clients can ask things like "What are the key benefits?" or "How does the pricing work?" and get instant, accurate answers.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Calendar Booking</strong> — If you have connected Calendly in your Settings, a booking widget appears on the share page. Clients can schedule a meeting with you directly, without leaving the page. This is perfect for follow-up conversations after they watch the video.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Your Branding</strong> — The page uses your brand logo, colors, and contact information. Your name, title, photo, and company appear so the client knows exactly who sent them the video.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Download Links</strong> — Clients can download the video as MP4, the slides as a PDF, or the presentation as a PPTX file from the share page.
          </p>
        </div>
      </div>

      {/* How to Share */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          How to Share Your Video
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>1</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Open the video.</strong> Go to your Library and click on the video you want to share. You will land on the video detail page with the player and all options.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>2</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Click "Share with Client."</strong> A dialog appears where you enter the client's email address. An email will be sent with your branding and a link to the share page.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>3</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Or copy the link.</strong> Click "Copy Link" to copy the share page URL to your clipboard. Paste it into an email, text message, social media post, or anywhere else you want to share it.
            </div>
          </div>
        </div>
      </div>

      {/* Insurance Disclaimers */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Insurance Disclaimer Handling
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            If your video was created from an insurance illustration or proposal, the share page automatically includes compliance disclaimers. These appear as a clearly visible notice before the video content, ensuring your clients understand that the video is for educational purposes and that specific guarantees depend on the policy terms.
          </p>
          <p>
            For more details on how insurance compliance works, see the <Link href="/help/insurance" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Insurance Illustrations</Link> guide.
          </p>
        </div>
      </div>

      {/* Client Interaction */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          How Clients Interact with the Share Page
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Your clients do not need a Docs2Video account to view the share page. They simply click the link and everything loads in their browser. Here is what they can do:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Watch the video</strong> — The player works on desktop, tablet, and mobile. It auto-adapts to the screen size.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Ask questions via AI chat</strong> — The chat assistant is always available on the page. Clients can ask follow-up questions about anything covered in the video.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Book a meeting</strong> — If Calendly is connected, clients can pick a time slot and schedule a call with you right from the share page.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Download materials</strong> — Clients can download the video file (MP4), a PDF of the slides, or an editable PowerPoint file (PPTX) if you have enabled those options.
          </p>
        </div>
      </div>

      {/* Download Options */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Download Options
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>MP4 Video</strong> — The full video with narration, music, and transitions. Ready to play on any device, upload to YouTube, or attach to an email.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>PDF Slides</strong> — Each video slide exported as a page in a PDF document. Great for printing, attaching to proposals, or sharing as a leave-behind document.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>PPTX Presentation</strong> — An editable PowerPoint file with each slide. You can open it in PowerPoint or Google Slides to customize further, add your own slides, or present it live in a meeting.
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
