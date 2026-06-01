import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import FirecrawlApp from '@mendable/firecrawl-js'
import sharp from 'sharp'
import type { ExtractedData } from '../../_lib/extract-types'
import { scrapeBrand } from '../../_lib/brand-scraper'
import { THEME_PROMPT, EXTRACTION_PROMPT } from '../../_lib/prompts'
import { wrapUserData } from '../../_lib/prompt-safety'
import { classifyFromText } from '../../_lib/document-classifier'

export const runtime = 'nodejs'
export const maxDuration = 300

let _claude: Anthropic | null = null
function getClaude() {
  if (!_claude) _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return _claude
}

let _firecrawl: InstanceType<typeof FirecrawlApp> | null = null
function getFirecrawl() {
  if (!_firecrawl) _firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
  return _firecrawl
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_beta, credits_remaining')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_beta && (!profile || profile.credits_remaining <= 0)) {
    return NextResponse.json({ error: 'No credits remaining' }, { status: 403 })
  }

  const body = await request.json()
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

  try {
    // Scrape main page + key nav pages for comprehensive content
    console.log(`[extract-url] Firecrawl scraping ${parsedUrl.toString()}...`)
    const mainResult = await getFirecrawl().scrape(parsedUrl.toString(), {
      formats: ['markdown', 'html'],
    }) as any

    let markdown = mainResult?.markdown || mainResult?.data?.markdown || ''
    let html = mainResult?.html || mainResult?.data?.html || ''

    // Extract nav links from both HTML and markdown, then scrape key pages
    const baseOrigin = parsedUrl.origin
    const navKeywords = /\b(about|pricing|services|contact|features|solutions|products|plans|testimonials|reviews|faq|how-it-works|case-studies|clients)\b/i
    const navLinks: string[] = []
    // From HTML
    const htmlLinkMatches = html.match(/href=["']([^"']+)["']/gi) || []
    // From markdown [text](url)
    const mdLinkMatches = markdown.match(/\]\(([^)]+)\)/g) || []
    const allHrefs = [
      ...htmlLinkMatches.map((m: string) => m.match(/href=["']([^"']+)["']/)?.[1]).filter(Boolean),
      ...mdLinkMatches.map((m: string) => m.match(/\]\(([^)]+)\)/)?.[1]).filter(Boolean),
    ]
    for (const rawHref of allHrefs) {
      const href = (rawHref as string).replace(/[)>\s]+$/, '') // clean trailing chars
      if (href && navKeywords.test(href) && !href.includes('#') && !href.includes('mailto:')) {
        let fullUrl = href
        if (!fullUrl.startsWith('http')) {
          try { fullUrl = new URL(href, baseOrigin).href } catch { continue }
        }
        if (fullUrl.startsWith(baseOrigin) && !navLinks.includes(fullUrl)) {
          navLinks.push(fullUrl)
        }
      }
    }

    // Always try /contact if not already found
    const contactUrl = `${baseOrigin}/contact/`
    if (!navLinks.some((l: string) => l.includes('contact'))) {
      navLinks.unshift(contactUrl) // prioritize contact page
    }

    // Scrape up to 3 nav pages in parallel
    if (navLinks.length > 0) {
      console.log(`[extract-url] Scraping ${Math.min(navLinks.length, 3)} nav pages: ${navLinks.slice(0, 5).join(', ')}`)
      const navResults = await Promise.allSettled(
        navLinks.slice(0, 5).map(url =>
          getFirecrawl().scrape(url, { formats: ['markdown'] }).catch(() => null)
        )
      )
      for (const r of navResults) {
        if (r.status === 'fulfilled' && r.value) {
          const navMd = (r.value as any)?.markdown || (r.value as any)?.data?.markdown || ''
          if (navMd.length > 50) {
            markdown += `\n\n---\n\n${navMd}`
          }
        }
      }
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
    const [contentResponse, themeResponse] = await Promise.all([
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
    ])

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
      const brandAnalysis = await scrapeBrand(url, { markdown, html })
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
      classification = await classifyFromText(truncated)
    } catch (classErr) {
      console.error('[extract-url] Classification failed, continuing without:', classErr instanceof Error ? classErr.message : 'unknown')
    }

    return NextResponse.json({ ...data, suggestedTheme, autoBrandId, autoLogoUrl, autoBrandInfo, classification })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'URL extraction failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
