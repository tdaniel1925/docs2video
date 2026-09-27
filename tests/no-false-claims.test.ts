import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, relative } from 'path'

/*
 * Guard: false or unprovable marketing claims were removed from everything a
 * visitor, a search engine, a lead or a user can read (2026-09-27). This test
 * scans those source files so none of them can quietly come back.
 *
 * If a claim becomes TRUE and provable (e.g. a real certification), remove it
 * from the list below in the same change that adds the proof.
 */

const ROOT = join(__dirname, '..')

// Folders scanned in full (every .ts/.tsx inside).
const DIRS = [
  'app/(public)',
  'app/(auth)',
  'app/(onboarding)',
  'app/(dashboard)/help',
  'app/(dashboard)/pricing',
  'app/_components',
]

// Single files: metadata, product copy, and the emails sent to leads/users.
const FILES = [
  'app/page.tsx',
  'app/layout.tsx',
  'app/sitemap.ts',
  'app/_lib/brand.ts',
  'app/_lib/industry-pages.ts',
  'app/_lib/pricing.ts',
  'app/_lib/types.ts',
  'app/_lib/welcome-email.ts',
  'app/_lib/notifications.ts',
  // script-generator.ts is not scanned: it holds the carrier-name blocklist.
  'app/api/cron/nurture/route.ts',
  'app/api/cron/referral-prompt/route.ts',
  'app/api/admin/campaigns/nurture/route.ts',
  'app/api/admin/campaign-send/route.ts',
  'app/api/admin/campaigns/[id]/generate/route.ts',
  'app/api/admin/prospect-send/route.ts',
  'app/api/admin/promo-user/route.ts',
  'app/api/help-chat/route.ts',
  'app/api/social-share/route.ts',
]

// Plain strings, matched case-insensitively.
const BANNED: string[] = [
  // user counts / social proof
  'Trusted by', 'Join thousands', '1,200+', 'Used by 500+', '800+ agents', '600+ RIAs', '700+ loan officers',
  '300+ health systems', '400+ attorneys', '150+ universities',
  // fake testimonials and ratings
  'className="testimonial', '&#9733; &#9733;', '★★★★★', 'aggregateRating', 'reviewCount',
  'I watched it twice and showed my wife', 'called me back within an hour', 'Where do we sign?',
  // security certifications we can't prove
  'SOC 2', 'SOC2', 'HIPAA-conscious', 'HIPAA compliant', 'annual third-party audits', 'TLS 1.3',
  // made-up statistics
  '73%', '3.2 hrs', 'Increase comprehension by 35%', 'Reduced by 60%', 'by 60%',
  'Clients watch 3x more', '2.7x more engagement', 'Close 40% Faster', 'close rate improvements of 30-40%',
  '75% more likely', '43% fewer support', '20% higher on assessments', 'LIMRA', 'Forrester', 'Wyzowl',
  'Vidyard', 'Proposify', 'Wistia', 'Brandon Hall', 'Richard Mayer', '$112.50', 'indistinguishable from human',
  'The Data Behind Document Engagement',
  // speed promises beyond the app's own estimate (3–5 minutes)
  'Under 90 seconds<', '90-second turnaround', 'in about 90 seconds', 'Video in 2 minutes', 'in under 2 minutes',
  'under 30 seconds to render', 'in minutes, not hours', 'It only takes about 2 minutes', 'in under five minutes',
  'only 60 seconds long', 'only takes 60 seconds to watch', 'Docs2Video does it in minutes',
  'professional video in minutes', 'Create videos like this in minutes', 'within 24 hours',
  // offers / limits that aren't real
  '2 free short videos', 'Your first 2 videos are free', 'Your first 2 videos are completely free',
  'you both get 2 free video credits', 'receive 2 free video credits', 'unlimited video creation',
  'set up with unlimited access', 'create unlimited videos', 'remove the watermark', 'no credit card required',
  'free forever', 'Free plan includes short videos only', '28 different themes', 'premium styles, HD exports',
  // popularity / compliance promises
  'Most popular', '8 Layers of Compliance', 'stays compliant', 'is compliant no matter which look',
  // real carrier names in examples
  'Prudential', 'MetLife', 'John Hancock', 'Pacific Life', 'Lincoln Financial', 'American General',
]

// Patterns: "<number>+ <kind of customer>" and "<NN>% of clients/…".
const BANNED_RE: RegExp[] = [
  /\b\d[\d,]*\+\s+(?:[a-z]+\s+)?(?:agents|professionals|consultants|attorneys|users|customers|firms|advisors|teams|companies|businesses)\b/i,
  /\b\d{1,3}(?:\.\d)?%\s+of\s+(?:clients|employees|buyers|donors|borrowers|patients|renters|prospects|students|consumers|people)\b/i,
]

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
}

function scannedFiles(): string[] {
  const out: string[] = []
  for (const d of DIRS) walk(join(ROOT, d), out)
  for (const f of FILES) {
    const p = join(ROOT, f)
    if (existsSync(p)) out.push(p)
  }
  return out
}

/** Every banned claim found in a piece of source text. */
export function findFalseClaims(text: string): string[] {
  const hits: string[] = []
  const lower = text.toLowerCase()
  for (const b of BANNED) if (lower.includes(b.toLowerCase())) hits.push(b)
  for (const re of BANNED_RE) {
    const m = text.match(re)
    if (m) hits.push(m[0])
  }
  return hits
}

describe('no false marketing claims', () => {
  it('the checker catches a planted claim (so a pass means something)', () => {
    expect(findFalseClaims('<div className="hero-trust">Trusted by 1,200+ insurance professionals nationwide</div>').length).toBeGreaterThan(0)
    expect(findFalseClaims('We are SOC 2 Type II compliant.')).toContain('SOC 2')
    expect(findFalseClaims('73% of clients never read it')).toContain('73%')
    expect(findFalseClaims('Used by 950+ mortgage professionals')).not.toEqual([])
    expect(findFalseClaims('Start with 2,000 free credits — about 2 videos.')).toEqual([])
  })

  it('scans a real set of public files', () => {
    const files = scannedFiles()
    expect(files.length).toBeGreaterThan(40)
    expect(files.some((f) => f.includes('IndustryPage.tsx'))).toBe(true)
    expect(files.some((f) => f.includes('Docs2VideoHome.tsx'))).toBe(true)
  })

  it('no public page, component, email or help article makes a banned claim', () => {
    const problems: string[] = []
    for (const f of scannedFiles()) {
      const hits = findFalseClaims(readFileSync(f, 'utf8'))
      if (hits.length) problems.push(`${relative(ROOT, f)}: ${hits.join(' | ')}`)
    }
    expect(problems).toEqual([])
  })
})
