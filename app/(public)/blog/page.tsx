import Link from 'next/link'
import type { Metadata } from 'next'
import { PageHead } from '../../_components/marketing/SiteChrome'

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
    <>
      <PageHead kicker="Blog" title="Notes on getting" blue="documents understood" sub="Tips, guides, and insights on turning documents into video content that gets watched." />
      <div className="hp-posts">
        {POSTS.map(post => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="hp-card hp-card-link hp-post">
            <span className="hp-meta"><span className="hp-tag">{post.category}</span><span>{post.date}</span><span>{post.readTime} read</span></span>
            <h2>{post.title}</h2>
            <p>{post.excerpt}</p>
            <span className="hp-caps hp-blue">Read it →</span>
          </Link>
        ))}
      </div>
    </>
  )
}
