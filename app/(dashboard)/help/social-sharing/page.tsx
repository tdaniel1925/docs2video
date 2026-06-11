'use client'

import Link from 'next/link'

export default function SocialSharingHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Social Sharing</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Social Sharing</h1>
          <p>Generate social media posts from your videos and share them across platforms.</p>
        </div>
      </div>

      {/* Generating Social Posts */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Generating Social Posts from Videos
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            Docs2Video can generate ready-to-post social media content based on your video. The AI writes platform-appropriate posts tailored for each social network.
          </p>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>1</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Open a completed video.</strong> Go to your Library and click on any finished video.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>2</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Click the "Share" button.</strong> Look for the share options in the action bar below the video player.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>3</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Choose a platform.</strong> Select LinkedIn, Twitter, or Facebook. The AI generates a post optimized for that platform, including appropriate length, hashtags, and tone.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>4</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Copy and paste.</strong> Click the copy button to copy the generated post text. Open the social platform and paste it into a new post. The share page link is included automatically.
            </div>
          </div>
        </div>
      </div>

      {/* Platform-Specific Tips */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Platform-Specific Tips
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>LinkedIn</strong> — Posts are written in a professional tone with industry-relevant hashtags. LinkedIn posts tend to perform well with a brief insight or takeaway from the video followed by the share link.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Twitter / X</strong> — Posts are concise and fit within character limits. The AI focuses on a compelling hook and includes the share link.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Facebook</strong> — Posts use a conversational tone with a brief description of what the viewer will learn from the video.
          </p>
        </div>
      </div>

      {/* Sharing the Link Directly */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Sharing the Link Directly
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Every completed video has a share page URL at <strong style={{ color: 'var(--ink)' }}>docs2video.com/watch/[id]</strong>. You can copy this link and share it anywhere — email, text message, Slack, or any social platform.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Copy Link button:</strong> On the video detail page, click "Copy Link" to copy the URL to your clipboard.
          </p>
          <p>
            When someone opens the link, they see a professionally branded share page with a video player, AI chatbot, and your contact information.
          </p>
        </div>
      </div>

      {/* Email Sharing */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Email Sharing
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            Click <strong style={{ color: 'var(--ink)' }}>Share with Client</strong> on any video to open the email sharing dialog. Enter the recipient's email address and an optional personal message.
          </p>
          <p style={{ marginBottom: 10 }}>
            Docs2Video sends a professional email with a preview thumbnail and a link to your share page. The email uses your brand styling.
          </p>
          <p>
            You can track whether the recipient opened the share page from the video analytics on the detail page.
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
