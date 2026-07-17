import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import FirecrawlApp from '@mendable/firecrawl-js'
import sharp from 'sharp'
import type { ExtractedData } from '../../_lib/extract-types'
import { scrapeBrand } from '../../_lib/brand-scraper'
import { THEME_PROMPT, EXTRACTION_PROMPT } from '../../_lib/prompts'
import { logError } from '../../_lib/error-logger'
import { wrapUserData } from '../../_lib/prompt-safety'
import { classifyFromText } from '../../_lib/document-classifier'
import { resolveRequestUser } from '../../_lib/api-auth'
import { checkCredits } from '../../_lib/credits'

export const runtime = 'nodejs'
export const maxDuration = 300

let _claude: Anthropic | null = null
function getClaude() {
  if (!_claude) _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
  return _claude
}

let _firecrawl: InstanceType<typeof FirecrawlApp> | null = null
function getFirecrawl() {
  if (!_firecrawl) _firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
  return _firecrawl
}

// Bound every external call. Firecrawl has NO client timeout — a bot-blocking
// site (e.g. a 403-ing ColdFusion page) made it hang until the function hit
// Vercel's maxDuration, and Vercel then returned its PLAIN-TEXT error page,
// which the wizard couldn't parse ("Unexpected token 'A' … is not valid JSON").
// With per-call timeouts the route always answers with real JSON first.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)),
  ])
}

function stripHtml(html: string): string {
  // Remove script and style tags and their content
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  text = text.replace(/&nbsp;/g, ' ')
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const resolved = await resolveRequestUser(request, async () => (await supabase.auth.getUser()).data.user)
  if (!resolved) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const user = { id: resolved.userId }

  // Internal API calls are metered against the API credit pool at the /api/v1
  // layer, so skip the UI credit gate here.
  if (!resolved.isInternal) {
    const credit = await checkCredits(user.id, 1)
    if (!credit.allowed) {
      return NextResponse.json({ error: 'No credits remaining' }, { status: 403 })
    }
  }

  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { url } = body as { url: string }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  }

  // Basic URL validation
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol')
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL. Please provide a valid http or https URL.' }, { status: 400 })
  }

  const startedAt = Date.now()
  try {
    // Scrape main page + key nav pages for comprehensive content
    console.log(`[extract-url] Firecrawl scraping ${parsedUrl.toString()}...`)
    let mainResult: any
    try {
      mainResult = await withTimeout(getFirecrawl().scrape(parsedUrl.toString(), {
        formats: ['markdown', 'html'],
      }) as Promise<any>, 90_000, 'Website scrape')
    } catch (scrapeErr) {
      console.error('[extract-url] Main scrape failed:', scrapeErr instanceof Error ? scrapeErr.message : scrapeErr)
      return NextResponse.json({
        error: 'This site is blocking automated access or responding too slowly. Try again in a moment — or copy the page text and use "Paste text" instead.',
      }, { status: 400 })
    }

    let markdown = mainResult?.markdown || mainResult?.data?.markdown || ''
    let html = mainResult?.html || mainResult?.data?.html || ''

    // ── Discover the site's important pages, then scrape them in parallel so we
    //    get a full picture of the site (not just the homepage) and stay fast. ──
    const baseOrigin = parsedUrl.origin
    // Pages that carry the "what this company is/does" story. Broad on purpose.
    const navKeywords = /\b(about|about-us|company|who-we-are|mission|team|pricing|plans|services|service|features|solutions|products|product|offerings|capabilities|industries|use-cases|how-it-works|process|approach|contact|testimonials|reviews|case-studies|clients|customers|portfolio|work|faq|benefits|why|overview)\b/i
    const navLinks: string[] = []
    const pushLink = (raw: string) => {
      const href = raw.replace(/[)>\s]+$/, '')
      if (!href || href.includes('#') || href.includes('mailto:') || href.includes('tel:')) return
      let fullUrl = href
      if (!fullUrl.startsWith('http')) {
        try { fullUrl = new URL(href, baseOrigin).href } catch { return }
      }
      // same-origin only, skip files/assets, dedupe (ignore trailing slash)
      if (!fullUrl.startsWith(baseOrigin)) return
      if (/\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|mp4|css|js)(\?|$)/i.test(fullUrl)) return
      const norm = fullUrl.replace(/\/$/, '')
      if (fullUrl !== parsedUrl.toString().replace(/\/$/, '') &&
          !navLinks.some((l) => l.replace(/\/$/, '') === norm)) {
        navLinks.push(fullUrl)
      }
    }

    // 1) Fast comprehensive discovery: try sitemap.xml (gives the real page list).
    try {
      const sm = await withTimeout(getFirecrawl().scrape(`${baseOrigin}/sitemap.xml`, { formats: ['rawHtml', 'html'] }) as Promise<any>, 20_000, 'Sitemap scrape').catch(() => null) as any
      const smXml = sm?.rawHtml || sm?.html || sm?.data?.rawHtml || ''
      if (smXml) {
        const locs = (smXml.match(/<loc>([^<]+)<\/loc>/gi) || [])
          .map((m: string) => m.replace(/<\/?loc>/gi, '').trim())
        // Prefer story pages from the sitemap first, then any same-origin page.
        for (const loc of locs) if (navKeywords.test(loc)) pushLink(loc)
        for (const loc of locs) pushLink(loc)
      }
    } catch { /* no sitemap — fall back to link scraping */ }

    // 2) Also harvest nav links from the homepage HTML + markdown (story pages first).
    const htmlLinkMatches = html.match(/href=["']([^"']+)["']/gi) || []
    const mdLinkMatches = markdown.match(/\]\(([^)]+)\)/g) || []
    const allHrefs = [
      ...htmlLinkMatches.map((m: string) => m.match(/href=["']([^"']+)["']/)?.[1]).filter(Boolean),
      ...mdLinkMatches.map((m: string) => m.match(/\]\(([^)]+)\)/)?.[1]).filter(Boolean),
    ] as string[]
    for (const href of allHrefs) if (navKeywords.test(href)) pushLink(href)

    // Always include /contact if we haven't picked it up.
    if (!navLinks.some((l: string) => l.includes('contact'))) {
      navLinks.unshift(`${baseOrigin}/contact/`)
    }

    // 3) Scrape up to 8 discovered pages in parallel (fast; whole site picture).
    // Skip entirely if the main scrape already burned most of the clock — the
    // homepage content alone still produces a usable video.
    const MAX_PAGES = 8
    const toScrape = Date.now() - startedAt < 120_000 ? navLinks.slice(0, MAX_PAGES) : []
    if (toScrape.length > 0) {
      console.log(`[extract-url] Scraping ${toScrape.length} site pages in parallel: ${toScrape.join(', ')}`)
      const navResults = await Promise.allSettled(
        toScrape.map(url =>
          withTimeout(getFirecrawl().scrape(url, { formats: ['markdown'] }) as Promise<any>, 30_000, 'Page scrape').catch(() => null)
        )
      )
      let pagesAdded = 0
      for (const r of navResults) {
        if (r.status === 'fulfilled' && r.value) {
          const navMd = (r.value as any)?.markdown || (r.value as any)?.data?.markdown || ''
          if (navMd.length > 50) {
            markdown += `\n\n---\n\n${navMd}`
            pagesAdded++
          }
        }
      }
      console.log(`[extract-url] Merged ${pagesAdded} additional page(s); homepage + ${pagesAdded} = full-site context`)
    }

    if (!markdown || markdown.length < 50) {
      console.error('[extract-url] Firecrawl returned insufficient content:', markdown?.slice(0, 200))
      return NextResponse.json({ error: 'Could not extract meaningful content from this URL. The site may be blocking scrapers or temporarily unavailable.' }, { status: 400 })
    }

    if ((markdown.includes('502') && markdown.includes('Server Error')) || markdown.includes('403 Forbidden')) {
      return NextResponse.json({ error: 'The website returned an error. Please try again in a moment.' }, { status: 400 })
    }

    // FIX 8: Paywall detection
    const mainContentOnly = mainResult?.markdown || mainResult?.data?.markdown || ''
    if (mainContentOnly.length < 100) {
      const lower = mainContentOnly.toLowerCase()
      const paywallStrings = ['subscribe to read', 'sign in to continue', 'premium content', 'members only', 'login to view', 'create an account to continue']
      if (paywallStrings.some(s => lower.includes(s))) {
        return NextResponse.json({ error: 'This page appears to be behind a login or paywall. Try copying the text and pasting it instead.' }, { status: 400 })
      }
    }

    console.log(`[extract-url] Total content: ${markdown.length} chars markdown from ${1 + navLinks.slice(0, 5).length} pages`)

    // Extract contact info directly with regex — don't rely on AI
    const phoneMatches = markdown.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || []
    const emailMatches = markdown.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
    const directContactInfo = {
      phone: phoneMatches.find((p: string) => !p.startsWith('159') && p.length >= 10) || null,
      email: emailMatches.find((e: string) => !e.includes('example') && !e.includes('test')) || null,
      website: parsedUrl.origin,
    }
    console.log(`[extract-url] Direct contact extraction: phone=${directContactInfo.phone}, email=${directContactInfo.email}`)

    // Truncation strategy: keep first 40k + last 10k (footer has contact/disclaimers)
    const isTruncated = markdown.length > 50000
    let truncated: string
    if (isTruncated) {
      const head = markdown.slice(0, 40000)
      const tail = markdown.slice(-10000)
      truncated = `${head}\n\n[... TRUNCATED: chars 40001–${markdown.length - 10000} omitted (${markdown.length - 50000} chars). Data tables in the middle section may be missing. ...]\n\n${tail}`
      console.log(`[extract-url] Content truncated: ${markdown.length} → 50000 chars (kept first 40k + last 10k)`)
    } else {
      truncated = markdown
    }
    const htmlForTheme = html.slice(0, 30000)

    // Run content structuring and theme analysis in parallel with Claude Opus
    const claude = getClaude()
    const [contentResponse, themeResponse] = await withTimeout(Promise.all([
      claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [
          { role: 'user', content: `${EXTRACTION_PROMPT}\n\nHere is the EXACT text from ${parsedUrl.hostname} (extracted by web scraper — do NOT add any information not present here):\n\n${wrapUserData(truncated)}\n\nReturn ONLY valid JSON, no markdown code fences.` },
        ],
      }),
      claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [
          { role: 'user', content: `${THEME_PROMPT}\n\nHere is the HTML/CSS from ${parsedUrl.hostname}:\n\n${wrapUserData(htmlForTheme)}\n\nReturn ONLY valid JSON, no markdown code fences.` },
        ],
      }),
    ]), 120_000, 'Content analysis')

    const raw = (contentResponse.content[0]?.type === 'text' ? contentResponse.content[0].text : '').trim()
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

    const data: ExtractedData = JSON.parse(cleaned)
    if (!data.source) {
      data.source = parsedUrl.hostname
    }
    if (isTruncated) {
      data.truncated = true
    }

    // Fix company name — extract from HTML as ground truth (AI often strips apostrophes)
    const ogSiteName = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1]
    const htmlTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
    const groundTruthName = ogSiteName || (htmlTitle ? htmlTitle.split(/[|\-–—]/)[0].trim() : null)
    if (groundTruthName && (data as any).companyName) {
      // If AI stripped an apostrophe or changed casing, use the HTML version
      const aiName = (data as any).companyName.toLowerCase().replace(/['']/g, '')
      const htmlName = groundTruthName.toLowerCase().replace(/['']/g, '')
      if (aiName === htmlName && (data as any).companyName !== groundTruthName) {
        console.log(`[extract-url] Corrected company name: "${(data as any).companyName}" → "${groundTruthName}"`)
        ;(data as any).companyName = groundTruthName
      }
    }

    // Merge direct regex contact extraction — more reliable than AI detection
    if (!(data as any).contactInfo) (data as any).contactInfo = {}
    const ci = (data as any).contactInfo
    if (!ci.phone && directContactInfo.phone) ci.phone = directContactInfo.phone
    if (!ci.email && directContactInfo.email) ci.email = directContactInfo.email
    if (!ci.website) ci.website = directContactInfo.website

    // Parse theme suggestion
    let suggestedTheme = null
    try {
      const themeRaw = (themeResponse.content[0]?.type === 'text' ? themeResponse.content[0].text : '').trim()
      const themeCleaned = themeRaw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
      suggestedTheme = JSON.parse(themeCleaned)
    } catch {
      console.error('[extract-url] Failed to parse theme suggestion')
    }

    // Auto-create brand from scraped URL
    let autoBrandId: string | null = null
    let autoLogoUrl: string | null = null
    let autoBrandInfo: Record<string, unknown> | null = null
    try {
      console.log('[extract-url] Scraping brand from URL...')
      const brandAnalysis = await withTimeout(scrapeBrand(url, { markdown, html }), 60_000, 'Brand analysis')
      autoBrandInfo = {
        primary_color: brandAnalysis.primaryColor || null,
        secondary_color: brandAnalysis.secondaryColor || null,
        industry: brandAnalysis.industry || null,
        tone: brandAnalysis.tone || null,
        name: brandAnalysis.companyName || null,
        tagline: brandAnalysis.tagline || null,
        description: brandAnalysis.description || null,
        website: url,
        services: brandAnalysis.services || [],
        logoUrl: brandAnalysis.logoUrl || null,
      }

      // Upload logo to Supabase storage (brand scraper already processed it)
      let logoFileUrl: string | null = null
      try {
        if (brandAnalysis.logoUrl) {
          let logoBuffer: Buffer | null = null

          if (brandAnalysis.logoUrl.startsWith('data:')) {
            // Brand scraper already processed — extract base64
            const base64Data = brandAnalysis.logoUrl.split(',')[1]
            logoBuffer = Buffer.from(base64Data, 'base64')
          } else {
            // Raw URL — download and convert to PNG
            const logoRes = await fetch(brandAnalysis.logoUrl, { signal: AbortSignal.timeout(8000) })
            if (logoRes.ok) {
              const ct = logoRes.headers.get('content-type') || ''
              if (!ct.includes('svg')) {
                const rawBuf = Buffer.from(await logoRes.arrayBuffer())
                // Convert to PNG with Sharp
                logoBuffer = await sharp(rawBuf)
                  .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
                  .png()
                  .toBuffer()
              }
            }
          }

          if (logoBuffer && logoBuffer.length > 100) {
            const logoPath = `${user.id}/brand_logo_${Date.now()}.png`
            const { error: uploadErr } = await supabase.storage.from('videos').upload(logoPath, logoBuffer, { contentType: 'image/png', upsert: true })
            if (uploadErr) {
              console.error(`[extract-url] Logo upload failed: ${uploadErr.message}`)
            } else {
              const { data: logoUrlData } = supabase.storage.from('videos').getPublicUrl(logoPath)
              logoFileUrl = logoUrlData.publicUrl
              console.log(`[extract-url] Logo uploaded to storage: ${(logoBuffer.length / 1024).toFixed(0)}KB → ${logoFileUrl}`)
            }
          }
        }
      } catch (logoErr) {
        console.log('[extract-url] Logo upload failed, skipping:', logoErr instanceof Error ? logoErr.message : 'unknown')
      }

      const { data: newBrand, error: brandError } = await supabase.from('brands').insert({
        user_id: user.id,
        name: brandAnalysis.companyName || parsedUrl.hostname.replace('www.', ''),
        logo_url: brandAnalysis.logoUrl?.startsWith('data:') ? null : (brandAnalysis.logoUrl || null),
        logo_file_url: logoFileUrl,
        primary_color: brandAnalysis.primaryColor || '#1B365D',
        secondary_color: brandAnalysis.secondaryColor || '#4A90D9',
        accent_color: brandAnalysis.accentColor || '#FFB347',
        background_color: brandAnalysis.backgroundColor || '#0a1628',
        text_color: brandAnalysis.textColor || '#FFFFFF',
        tagline: brandAnalysis.tagline || null,
        description: brandAnalysis.description || null,
        industry: brandAnalysis.industry || null,
        tone: brandAnalysis.tone || null,
        target_audience: brandAnalysis.targetAudience || null,
        fonts: brandAnalysis.fonts || [],
        brand_values: brandAnalysis.brandValues || [],
        services: brandAnalysis.services || [],
        social_links: brandAnalysis.socialLinks || {},
        content_themes: brandAnalysis.contentThemes || [],
        competitor_notes: brandAnalysis.competitorNotes || null,
        unique_selling_points: brandAnalysis.uniqueSellingPoints || [],
        // Persist scraped contact into brand_guide_data — the SAME store the
        // render path reads for the closing contact line. Without this the
        // scraped phone/email/website was captured but never reached the brand,
        // so a from-URL brand rendered with no contact info.
        brand_guide_data: (directContactInfo.phone || directContactInfo.email || directContactInfo.website)
          ? { phone: directContactInfo.phone || undefined, email: directContactInfo.email || undefined, website: directContactInfo.website || undefined }
          : undefined,
        is_default: false,
      }).select('id').single()

      if (brandError) {
        console.error('[extract-url] Brand creation failed:', brandError.message)
      } else {
        autoBrandId = newBrand.id
        autoLogoUrl = logoFileUrl
        // Add uploaded logo URL to brand info for client
        if (autoLogoUrl && autoBrandInfo) {
          (autoBrandInfo as Record<string, unknown>).logoFileUrl = autoLogoUrl
        }
        console.log(`[extract-url] Auto-created brand: ${brandAnalysis.companyName} (${autoBrandId}), logo: ${logoFileUrl ? 'yes' : 'no'}`)
      }
    } catch (brandErr) {
      console.error('[extract-url] Brand scraping failed:', brandErr instanceof Error ? brandErr.message : 'unknown')
    }

    // FIX 4: Classify the extracted content
    let classification = null
    try {
      classification = await withTimeout(classifyFromText(truncated, undefined, 'website'), 45_000, 'Classification')
    } catch (classErr) {
      console.error('[extract-url] Classification failed, continuing without:', classErr instanceof Error ? classErr.message : 'unknown')
    }

    return NextResponse.json({ ...data, suggestedTheme, autoBrandId, autoLogoUrl, autoBrandInfo, classification })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'URL extraction failed'
    logError('extract-url', err, { url: (typeof url === 'string' ? url : undefined) })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
