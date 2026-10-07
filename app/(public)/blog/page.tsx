import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog | Docs2Video',
  description: 'Tips, guides, and insights on turning documents into professional video content.',
}

const POSTS = [
  {
    slug: 'why-video-beats-pdf',
    title: 'Why Video Beats PDF for Getting Documents Understood',
    excerpt: 'Long PDFs often go unread. Here\'s why a short narrated video is easier to take in, and how to make the switch.',
    date: 'May 23, 2026',
    category: 'Insights',
    readTime: '5 min',
  },
  {
    slug: 'insurance-agents-video-explainers',
    title: 'How Insurance Agents Are Using Video to Explain Policies',
    excerpt: 'Life insurance illustrations are complex. A short video explainer helps clients understand what they are looking at.',
    date: 'May 21, 2026',
    category: 'Use Cases',
    readTime: '6 min',
  },
  {
    slug: 'ai-narration-vs-recording-yourself',
    title: 'AI Narration vs. Recording Yourself: Which Is Better for Business Videos?',
    excerpt: 'AI voices have come a long way. We compare quality, cost, speed, and consistency to help you decide.',
    date: 'May 19, 2026',
    category: 'Guides',
    readTime: '4 min',
  },
  {
    slug: 'turn-proposal-into-video',
    title: '5 Steps to Turn Any Business Proposal Into a Video That Wins',
    excerpt: 'Stop sending proposals that sit unread in inboxes. Learn how to convert your next proposal into a compelling video pitch.',
    date: 'May 16, 2026',
    category: 'Guides',
    readTime: '5 min',
  },
]

export default function BlogPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <img src="/logo-big.png" alt="Docs2Video" style={{ height: 56, marginBottom: 24 }} />
          </Link>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Blog</h1>
          <p style={{ fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            Tips, guides, and insights on turning documents into video content that gets watched.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {POSTS.map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{
                display: 'block', padding: '28px 32px', borderRadius: 10,
                background: 'var(--surface)', border: '1px solid var(--border)',
                textDecoration: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
                <span style={{
                  padding: '2px 10px', borderRadius: 6, background: 'var(--accent-soft)',
                  color: 'var(--accent-ink)', fontWeight: 600,
                }}>{post.category}</span>
                <span style={{ color: 'var(--ink-light)' }}>{post.date}</span>
                <span style={{ color: 'var(--ink-light)' }}>{post.readTime} read</span>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.3 }}>
                {post.title}
              </h2>
              <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
                {post.excerpt}
              </p>
            </Link>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <Link href="/" style={{ fontSize: 14, color: 'var(--ink-light)', textDecoration: 'none' }}>
            &larr; Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
