import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import OpenAI from 'openai'
import FirecrawlApp from '@mendable/firecrawl-js'
import sharp from 'sharp'
import type { ExtractedData } from '../../_lib/extract-types'
import { scrapeBrand } from '../../_lib/brand-scraper'

export const runtime = 'nodejs'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

let _firecrawl: InstanceType<typeof FirecrawlApp> | null = null
function getFirecrawl() {
  if (!_firecrawl) _firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
  return _firecrawl
}

const THEME_PROMPT = `You are an expert web designer analyzing a website's visual identity. Based on the HTML/CSS below, create a slide presentation style prompt that captures this website's look and feel.

Return ONLY valid JSON (no markdown, no code fences):
{
  "name": "string — a short creative name for this style (2-3 words)",
  "description": "string — one sentence describing the visual style",
  "colors": {
    "primary": "hex color",
    "secondary": "hex color",
    "accent": "hex color",
    "background": "hex color",
    "text": "hex color"
  },
  "prompt": "string — A detailed visual style prompt for generating presentation slides that match this website's aesthetic. Describe: background treatment, color palette, typography style, layout approach, visual effects, mood/tone. Be specific about colors, gradients, textures, and spacing. This prompt will be used by an image generation AI to create branded slides."
}

Rules:
- Extract ACTUAL colors from the CSS/HTML — don't guess
- The prompt should be 2-4 sentences, highly specific and visual
- Focus on what makes this site's design unique
- The style should work on a 16:9 presentation slide`

const EXTRACTION_PROMPT = `You are an expert content analyst. You will receive raw text extracted from a web page.

Your job is to analyze the text and extract the most important information into a structured format.

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "title": "string — a clear, concise title summarizing the content",
  "subtitle": "string or null — a supporting subtitle if appropriate",
  "source": "string or null — the source or origin of the content if identifiable",
  "companyName": "string or null — the exact company/organization name as written on the site (preserve apostrophes, capitalization)",
  "contactInfo": {
    "phone": "string or null — any phone number found anywhere on the page including footer",
    "email": "string or null — any email address found anywhere on the page including footer",
    "website": "string or null — the main website URL",
    "address": "string or null — any physical address found"
  },
  "keyMetrics": [
    { "label": "string", "value": "string", "highlight": true/false }
  ],
  "sections": [
    { "title": "string", "content": "string" }
  ],
  "bulletPoints": ["string"],
  "additionalNotes": ["string"]
}

Rules:
- CONTACT INFO: Carefully scan the ENTIRE text including headers, footers, sidebars for phone numbers, email addresses, and physical addresses. Check the very bottom of the content — footers often have contact info.
- COMPANY NAME: Extract the exact company name with correct spelling, apostrophes, and capitalization
- Extract any numbers, percentages, dollar amounts, dates, or quantifiable data as keyMetrics
- Mark the 2-3 most important metrics with "highlight": true
- Break the content into logical sections with clear titles
- Pull out key takeaways or action items as bulletPoints
- Include any caveats, disclaimers, or supplementary info in additionalNotes
- If the text is short, still create a meaningful structure
- Be smart about understanding context — infer the topic and purpose
- keyMetrics should have concise labels and values (e.g. label: "Revenue", value: "$1.2M")
- Aim for 3-8 keyMetrics, 2-5 sections, and 3-10 bulletPoints`

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

    // Extract nav links and scrape key pages (about, pricing, services, contact)
    const baseOrigin = parsedUrl.origin
    const navKeywords = /\b(about|pricing|services|contact|features|solutions|products|plans|testimonials|reviews|faq|how-it-works|case-studies|clients)\b/i
    const navLinks: string[] = []
    const linkMatches = html.match(/href=["']([^"']+)["']/gi) || []
    for (const m of linkMatches) {
      const href = m.match(/href=["']([^"']+)["']/)?.[1]
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

    if (markdown.includes('502') && markdown.includes('Server Error') || markdown.includes('403 Forbidden')) {
      return NextResponse.json({ error: 'The website returned an error. Please try again in a moment.' }, { status: 400 })
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

    // Use the EXACT text from Firecrawl (no AI guessing about page content)
    const truncated = markdown.slice(0, 50000)
    const htmlForTheme = html.slice(0, 30000)

    // Run content structuring and theme analysis in parallel with OpenAI
    const openai = getOpenAI()
    const [contentResponse, themeResponse] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: `${EXTRACTION_PROMPT}\n\nHere is the EXACT text from ${parsedUrl.hostname} (extracted by web scraper — do NOT add any information not present here):\n\n${truncated}` },
        ],
        temperature: 0.3,
      }),
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: `${THEME_PROMPT}\n\nHere is the HTML/CSS from ${parsedUrl.hostname}:\n\n${htmlForTheme}` },
        ],
        temperature: 0.5,
      }),
    ])

    const raw = contentResponse.choices[0]?.message?.content?.trim() ?? ''
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

    const data: ExtractedData = JSON.parse(cleaned)
    if (!data.source) {
      data.source = parsedUrl.hostname
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
      const themeRaw = themeResponse.choices[0]?.message?.content?.trim() ?? ''
      const themeCleaned = themeRaw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
      suggestedTheme = JSON.parse(themeCleaned)
    } catch {
      console.error('[extract-url] Failed to parse theme suggestion')
    }

    // Auto-create brand from scraped URL
    let autoBrandId: string | null = null
    let autoLogoUrl: string | null = null
    try {
      console.log('[extract-url] Scraping brand from URL...')
      const brandAnalysis = await scrapeBrand(url, { markdown, html })

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
        console.log(`[extract-url] Auto-created brand: ${brandAnalysis.companyName} (${autoBrandId}), logo: ${logoFileUrl ? 'yes' : 'no'}`)
      }
    } catch (brandErr) {
      console.error('[extract-url] Brand scraping failed:', brandErr instanceof Error ? brandErr.message : 'unknown')
    }

    return NextResponse.json({ ...data, suggestedTheme, autoBrandId, autoLogoUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'URL extraction failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
