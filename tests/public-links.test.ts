import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, relative } from 'path'

/*
 * EVERY LINK ON THE PUBLIC SITE GOES SOMEWHERE REAL (redesign 2026-10-18).
 *
 * The front page was rebuilt and every page it linked to was still the old
 * design — or gone. This reads every in-site link written in the public
 * site's source (the shell, the front page, the field pages, the public and
 * sign-in pages) and checks each one is a route this app has. It also checks
 * every public page sits in the shell (SitePage), so none is left in the old
 * look.
 */
const ROOT = join(__dirname, '..')
const APP = join(ROOT, 'app')
const read = (p: string) => readFileSync(p, 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

/** Every route the app serves, as a pattern: route groups dropped, [param] matches one segment, [...x] the rest. */
function routePatterns(): RegExp[] {
  return walk(APP)
    .filter((f) => /[\\/](page\.tsx|route\.ts)$/.test(f))
    .map((f) => {
      const segs = relative(APP, f).split(/[\\/]/).slice(0, -1).filter((s) => !/^\(.*\)$/.test(s))
      const body = segs.map((s) => (/^\[\.\.\..+\]$/.test(s) ? '.+' : /^\[.+\]$/.test(s) ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/')
      return new RegExp(`^/${body}$`)
    })
}
export function isRoute(path: string, routes = routePatterns()): boolean {
  const clean = (path.split(/[?#]/)[0] || '/').replace(/\/$/, '') || '/'
  return clean === '/' || routes.some((r) => r.test(clean))
}

/** In-site links written as literals in a source file: href="/x", href: '/x', href={'/x'}. */
export function internalHrefs(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/href(?:=|:\s*)\{?["'`](\/[^"'`$]*)["'`]/g)) out.push(m[1])
  return out
}

const PUBLIC_SOURCES = [
  ...walk(join(APP, '_components', 'marketing')).filter((f) => f.endsWith('.tsx')),
  join(APP, '_components', 'IndustryPage.tsx'),
  join(APP, 'not-found.tsx'),
  ...walk(join(APP, '(public)')).filter((f) => f.endsWith('.tsx') && !/[\\/](watch|m)[\\/]/.test(f)),
  ...walk(join(APP, '(auth)')).filter((f) => f.endsWith('.tsx')),
]

describe('public site links', () => {
  it('the checker works', () => {
    const routes = routePatterns()
    expect(isRoute('/for/insurance', routes)).toBe(true)
    expect(isRoute('/blog/why-video-beats-pdf', routes)).toBe(true)
    expect(isRoute('/#how', routes)).toBe(true)
    expect(isRoute('/signup?ref=abc', routes)).toBe(true)
    expect(isRoute('/no-such-page', routes)).toBe(false)
    expect(isRoute('/for/no-such-field', routes)).toBe(false)
    expect(internalHrefs(`<Link href="/a">x</Link> <a href='/b#c'> { href: '/d', label: 'D' } href={'/e'}`)).toEqual(['/a', '/b#c', '/d', '/e'])
  })

  it('every in-site link on the public site is a page the app has', () => {
    const routes = routePatterns()
    const bad: string[] = []
    let seen = 0
    for (const f of PUBLIC_SOURCES) {
      for (const h of internalHrefs(read(f))) {
        seen++
        if (!isRoute(h, routes)) bad.push(`${relative(ROOT, f)} → ${h}`)
      }
    }
    expect(seen).toBeGreaterThan(40)
    expect(bad).toEqual([])
  })

  it('every public page sits in the one shell — none left in the old look', () => {
    // Each public section's layout wraps its pages in SitePage; sign-in uses SiteFrame.
    for (const d of ['for', 'plans', 'blog', 'contact', 'terms', 'privacy', 'cookies', 'share-demo', 'try/[slug]', 'unsubscribe/[id]']) {
      const f = join(APP, '(public)', d, 'layout.tsx')
      expect(existsSync(f), d).toBe(true)
      expect(read(f), d).toMatch(/<SitePage[ >]/)
    }
    expect(read(join(APP, '(auth)', 'layout.tsx'))).toMatch(/<SiteFrame>/)
    expect(read(join(APP, 'not-found.tsx'))).toMatch(/<SiteFrame>/)
    expect(read(join(APP, '_components', 'marketing', 'Docs2VideoHome.tsx'))).toMatch(/<SiteFrame>/)
    // the old light marketing header and footer are gone
    for (const old of ['SiteHeader.tsx', 'SiteFooter.tsx', 'MarketingMenu.tsx']) expect(existsSync(join(APP, '_components', 'marketing', old)), old).toBe(false)
  })

  it('the shell links to every field page that exists, and each field page has its picture', () => {
    const chrome = read(join(APP, '_components', 'marketing', 'SiteChrome.tsx'))
    for (const h of internalHrefs(chrome).filter((h) => h.startsWith('/for/'))) {
      expect(existsSync(join(APP, '(public)', h.slice(1), 'page.tsx')), h).toBe(true)
    }
    const industry = read(join(APP, '_components', 'IndustryPage.tsx'))
    for (const m of industry.matchAll(/src: '(\/home\/[a-z0-9-]+\.jpg)'/g)) expect(existsSync(join(ROOT, 'public', m[1])), m[1]).toBe(true)
  })
})
