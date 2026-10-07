'use client'

import Link from 'next/link'

// Audited 2026-09-26. Two different things live here:
//  1. the free "Social Posts" button on a video page (writes copy-and-paste posts)
//  2. the paid AI Social add-on at /social-media (connects accounts and posts)

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

function Step({ n, last, children }: { n: number; last?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: last ? 0 : 16 }}>
      <div style={STEP_NUM}>{n}</div>
      <div>{children}</div>
    </div>
  )
}

export default function SocialSharingHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Social Posts & AI Social</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Social Posts & AI Social</h1>
          <p>Two ways to get your videos onto social media: free copy-and-paste posts, or the AI Social add-on that posts for you.</p>
        </div>
      </div>

      {/* Free Social Posts */}
      <div style={CARD}>
        <h2 style={H2}>Social Posts (free, on every video)</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 12 }}>
            Get ready-to-post text for a finished video. There is no charge.
          </p>
          <Step n={1}>
            <strong style={INK}>Open a completed video.</strong> Click <strong style={INK}>Library</strong> in the top bar, then click a finished video.
          </Step>
          <Step n={2}>
            <strong style={INK}>Open &ldquo;More,&rdquo; then &ldquo;Social posts.&rdquo;</strong> <strong style={INK}>More</strong> is the menu at the top-right of the video page.
          </Step>
          <Step n={3}>
            <strong style={INK}>Wait a moment.</strong> The AI writes three posts at once — one each for <strong style={INK}>LinkedIn</strong>, <strong style={INK}>X/Twitter</strong> and <strong style={INK}>Facebook</strong> — each with a link to your share page.
          </Step>
          <Step n={4} last>
            <strong style={INK}>Copy and paste.</strong> Click <strong style={INK}>Copy</strong> next to the post you want, open that social site, and paste it into a new post.
          </Step>
        </div>
      </div>

      {/* AI Social add-on */}
      <div style={CARD}>
        <h2 style={H2}>AI Social add-on ($50/month)</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 12 }}>
            AI Social connects your social accounts so the app can post for you. The AI writes captions in your chosen tone, and you can post straight away or set a posting schedule.
          </p>
          <Step n={1}>
            <strong style={INK}>Open AI Social.</strong> Click your name (top-right) to open the account menu and choose <strong style={INK}>AI Social</strong>. If you don&rsquo;t have the add-on yet, you&rsquo;ll see what it includes and an <strong style={INK}>Add AI Social — $50/mo</strong> button that takes you to checkout.
          </Step>
          <Step n={2}>
            <strong style={INK}>Connect your accounts.</strong> After subscribing, click <strong style={INK}>Connect Social Accounts in Settings</strong>. This opens <strong style={INK}>Settings &gt; Integrations</strong>, where you connect each social account.
          </Step>
          <Step n={3}>
            <strong style={INK}>Set up your voice.</strong> Back in AI Social, the <strong style={INK}>Brand &amp; Setup</strong> tab lets you pick a tone (professional, casual, and so on), the topics you post about, and how often to post (daily, 3 times a week, or weekly).
          </Step>
          <Step n={4}>
            <strong style={INK}>Write a post.</strong> On the <strong style={INK}>Create Post</strong> tab, tick the platforms, describe what the post is about, and press <strong style={INK}>Generate Captions</strong>. Edit the captions if you like, then press <strong style={INK}>Post Now</strong>.
          </Step>
          <Step n={5} last>
            <strong style={INK}>Or start from something you made.</strong> The <strong style={INK}>From Your Content</strong> tab lists your videos. Press <strong style={INK}>Generate Posts</strong> next to one, then post it to a platform.
          </Step>

          <p style={{ marginTop: 20, marginBottom: 8 }}><strong style={INK}>What it costs in credits</strong> (on top of the $50/month):</p>
          <p style={{ marginBottom: 6 }}>&bull; Writing captions: <strong style={INK}>25 credits</strong> each time you press Generate.</p>
          <p>&bull; Posting: <strong style={INK}>25 credits per platform</strong> each time you post. Posting to 3 platforms = 75 credits.</p>
        </div>
      </div>

      {/* Sharing the Link Directly */}
      <div style={CARD}>
        <h2 style={H2}>Sharing the Link Directly</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 10 }}>
            Every completed video has its own share page at <strong style={INK}>docs2video.com/watch/[id]</strong>. On the video page, press <strong style={INK}>or copy the link</strong> (under the Send button) and paste it anywhere — email, text message, or any social site.
          </p>
          <p>
            To email it to a client instead, use the send panel at the top of the video page and press <strong style={INK}>Send to</strong> your client. See <Link href="/help/sharing-videos" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Sharing & the Client Page</Link> for what they see when they open it.
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
