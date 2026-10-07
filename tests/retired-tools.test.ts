import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match'
import nextConfig from '../next.config'

/**
 * Retired tools stay retired (Phase 1 clean-up, 2026-10).
 *
 * These tools were hidden from every menu but their API routes still charged
 * credits to anyone who called them directly (audit 2026-09-26). The routes
 * and pages are now deleted. If one comes back — a revert, a bad merge, a
 * copy-paste — this fails before it can spend anyone's credits again.
 */
const ROOT = path.resolve(__dirname, '..')

const REMOVED_API_ROUTES = [
  'generate-ads',
  'brand-kit',
  'generate-business-card',
  'course-builder',
  'generate-email-signature',
  'generate-headshot',
  'image-remix',
  'generate-infographic',
  'social-campaign',
  'generate-social-kit',
  'template-chat',
  'templates',
  // The first infographic maker: no caller left, but it still charged 300
  // credits to anyone who POSTed to it directly.
  'generate',
]

// Old page → where an old bookmark should land now.
const REMOVED_PAGES: Record<string, string> = {
  ads: '/design',
  'business-cards': '/design',
  'social-kit': '/social-media',
  'social-campaigns': '/social-media',
  'brand-kit': '/dashboard',
  'course-builder': '/dashboard',
  'email-signature': '/dashboard',
  headshot: '/dashboard',
  'image-remix': '/dashboard',
  'infographic-creator': '/dashboard',
  templates: '/dashboard',
  infographics: '/dashboard',
}

// Any route.ts (or route.js) anywhere under a folder means the endpoint is live.
function routeFilesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  const found: string[] = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) found.push(...routeFilesUnder(full))
    else if (/^route\.(t|j)sx?$/.test(name)) found.push(path.relative(ROOT, full))
  }
  return found
}

function pageFilesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  const found: string[] = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) found.push(...pageFilesUnder(full))
    else if (/^(page|layout)\.(t|j)sx?$/.test(name)) found.push(path.relative(ROOT, full))
  }
  return found
}

describe('retired tools stay deleted', () => {
  it('none of the removed API routes exist', () => {
    const back = REMOVED_API_ROUTES.flatMap((r) => routeFilesUnder(path.join(ROOT, 'app', 'api', r)))
    expect(back, 'a retired API route is back — it would charge credits again').toEqual([])
  })

  it('none of the removed pages exist', () => {
    const back = Object.keys(REMOVED_PAGES).flatMap((p) => pageFilesUnder(path.join(ROOT, 'app', '(dashboard)', p)))
    expect(back, 'a retired page is back').toEqual([])
  })
})

describe('old bookmarks to retired tools still land somewhere', () => {
  it('every retired page has a permanent redirect to its replacement', async () => {
    const rules = (await nextConfig.redirects?.()) ?? []
    for (const [page, dest] of Object.entries(REMOVED_PAGES)) {
      for (const url of [`/${page}`, `/${page}/`, `/${page}/some-old-id`]) {
        const hit = rules.find((r) => getPathMatch(r.source)(url))
        expect(hit, `${url} has no redirect`).toBeTruthy()
        expect(hit!.destination, url).toBe(dest)
        expect('permanent' in hit! && hit.permanent, url).toBe(true)
      }
    }
  })

  it('the redirects do not catch live pages that share a prefix', async () => {
    const rules = (await nextConfig.redirects?.()) ?? []
    for (const url of ['/admin', '/design', '/social-media', '/dashboard', '/template-demo', '/videos', '/logo-creator']) {
      expect(rules.find((r) => getPathMatch(r.source)(url)), url).toBeUndefined()
    }
  })
})
