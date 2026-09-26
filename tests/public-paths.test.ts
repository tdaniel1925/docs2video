import { describe, it, expect } from 'vitest'
import { isPublicPath, legacyRedirect } from '../app/_lib/public-paths'

describe('proxy allow-list (logged-out visitors)', () => {
  it('lets marketing pages and email links through', () => {
    for (const p of [
      '/', '/blog', '/blog/why-video-beats-pdf', '/contact', '/pricing', '/plans',
      '/m/2b1f', '/unsubscribe/2b1f', '/for/insurance', '/watch/abc', '/r/CODE',
      '/privacy', '/terms', '/cookies', '/login', '/signup', '/forgot-password',
      '/reset-password', '/auth/callback', '/auth/confirm', '/restylez', '/try/abc',
    ]) {
      expect(isPublicPath(p), p).toBe(true)
    }
  })

  it('keeps the signed-in app private', () => {
    for (const p of [
      '/dashboard', '/settings', '/admin', '/create/client', '/videos/1', '/setup',
      '/setup-payment', '/demo-slide', '/format', '/blogger', '/rx', '/help',
    ]) {
      expect(isPublicPath(p), p).toBe(false)
    }
  })

  it('lets public API routes through and nothing else', () => {
    for (const p of ['/api/contact', '/api/capture-lead', '/api/public/unsubscribe/1', '/api/watch/1/ask', '/api/demo-video', '/api/health', '/api/auth/google/callback', '/api/affiliate/r']) {
      expect(isPublicPath(p), p).toBe(true)
    }
    for (const p of ['/api/generate-video', '/api/demo-slide-gpt', '/api/email-connections', '/api/affiliate/stats', '/api/contacts', '/api/credits/balance']) {
      expect(isPublicPath(p), p).toBe(false)
    }
  })

  it('page prefixes do not open API routes with the same name', () => {
    expect(isPublicPath('/api/blog')).toBe(false)
  })
})

describe('legacy /industries links', () => {
  it('redirects to the /for page', () => {
    expect(legacyRedirect('/industries/insurance')).toBe('/for/insurance')
    expect(legacyRedirect('/industries/')).toBe('/')
    expect(legacyRedirect('/industries')).toBe('/')
    expect(legacyRedirect('/for/insurance')).toBeNull()
  })
})
