import type { Metadata } from 'next'

// /try/[slug] pages are personalized demo invitations (one per prospect
// company), so they get a real title and link preview but stay out of search.
function toTitleCase(slug: string): string {
  return slug.split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const company = slug && slug !== 'demo' ? toTitleCase(decodeURIComponent(slug)) : ''
  const title = company ? `A free demo video for ${company} | Docs2Video` : 'Try a free demo video | Docs2Video'
  const description = 'Paste a document or website and watch Docs2Video turn it into a narrated explainer video in minutes.'
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, images: [{ url: '/og-docs2video.png', width: 1200, height: 630 }] },
  }
}

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return children
}
