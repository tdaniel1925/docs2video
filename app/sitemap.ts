import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://docs2video.com'
  const now = new Date()

  const staticPages = [
    '/',
    '/blog',
    '/contact',
    '/pricing',
    '/privacy',
    '/terms',
    '/cookies',
    '/login',
    '/signup',
  ]

  const blogArticles = [
    '/blog/why-video-beats-pdf',
    '/blog/insurance-agents-video-explainers',
    '/blog/ai-narration-vs-recording-yourself',
    '/blog/turn-proposal-into-video',
  ]

  const industryPages = [
    '/for/insurance',
    '/for/financial-services',
    '/for/real-estate',
    '/for/mortgage',
    '/for/healthcare',
    '/for/medical',
    '/for/legal',
    '/for/education',
    '/for/consulting',
    '/for/coaching',
    '/for/fitness',
    '/for/human-resources',
    '/for/non-profit',
    '/for/property-management',
  ]

  const allPages = [...staticPages, ...blogArticles, ...industryPages]

  return allPages.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1.0 : path.startsWith('/blog') ? 0.7 : path.startsWith('/for/') ? 0.8 : 0.6,
  }))
}
