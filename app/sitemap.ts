import type { MetadataRoute } from 'next'
import { getBrand } from './_lib/brand-server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const brand = await getBrand()
  const base = `https://${brand.domain}`
  const now = new Date()

  // Text2Art has no blog and no industry landing pages, and it must not point
  // search engines at Docs2Video's video marketing copy under its own domain.
  if (brand.id === 'text2art') {
    return ['/', '/privacy', '/terms', '/cookies', '/contact', '/login', '/signup'].map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: path === '/' ? 'weekly' : 'monthly',
      priority: path === '/' ? 1.0 : 0.5,
    }))
  }

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
