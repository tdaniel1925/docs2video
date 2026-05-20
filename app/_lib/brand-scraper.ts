import { GoogleGenAI } from '@google/genai'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export function extractColors(html: string): string[] {
  const hexColorMatches = html.match(/#[0-9a-fA-F]{6}\b/g) || []
  const cssColors = [...new Set(hexColorMatches)].slice(0, 20)

  const customPropMatches = html.match(/--[\w-]*(?:primary|brand|accent|main|secondary|highlight|theme)[\w-]*:\s*([^;}\n]+)/gi) || []
  const customPropColors = customPropMatches
    .map(m => m.replace(/.*:\s*/, '').trim())
    .filter(c => c.startsWith('#') || c.startsWith('rgb'))

  const headerBgMatches = html.match(/(?:header|nav|\.navbar|\.header)[^{}]*\{[^}]*background(?:-color)?:\s*([^;}\n]+)/gi) || []
  const buttonBgMatches = html.match(/(?:\.btn|button|\.cta|\.button)[^{}]*\{[^}]*background(?:-color)?:\s*([^;}\n]+)/gi) || []
  const linkColorMatches = html.match(/\ba\b[^{}]*\{[^}]*color:\s*([^;}\n]+)/gi) || []

  const elementColors = [...headerBgMatches, ...buttonBgMatches, ...linkColorMatches]
    .map(m => m.replace(/.*(?:background(?:-color)?|color):\s*/i, '').trim())
    .filter(c => c.startsWith('#') || c.startsWith('rgb'))

  return [...new Set([...cssColors, ...customPropColors, ...elementColors])].slice(0, 30)
}

export function extractFonts(html: string): string[] {
  const fontMatches = html.match(/font-family:\s*['"]?([^'";,}]+)/gi) || []
  return [...new Set(fontMatches.map(f => f.replace(/font-family:\s*['"]?/i, '').trim()))].slice(0, 8)
}

export function extractSocialLinks(html: string): Record<string, string> {
  const socialPatterns: Record<string, RegExp> = {
    facebook: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'\s]+)["']/i,
    twitter: /href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"'\s]+)["']/i,
    instagram: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'\s]+)["']/i,
    linkedin: /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/[^"'\s]+)["']/i,
    youtube: /href=["'](https?:\/\/(?:www\.)?youtube\.com\/[^"'\s]+)["']/i,
    tiktok: /href=["'](https?:\/\/(?:www\.)?tiktok\.com\/[^"'\s]+)["']/i,
    pinterest: /href=["'](https?:\/\/(?:www\.)?pinterest\.com\/[^"'\s]+)["']/i,
  }
  const links: Record<string, string> = {}
  for (const [platform, regex] of Object.entries(socialPatterns)) {
    const match = html.match(regex)
    if (match) links[platform] = match[1]
  }
  return links
}

export function extractJsonLd(html: string): string {
  const matches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  return matches.map(m => m.replace(/<\/?script[^>]*>/gi, '').trim()).join('\n').slice(0, 3000)
}

export function extractLogoUrl(html: string, baseUrl: string): string | null {
  function resolve(url: string): string | null {
    if (!url || url.startsWith('data:')) return null
    if (url.startsWith('http')) return url
    try { return new URL(url, baseUrl).href } catch { return null }
  }

  // Try to strip WordPress size suffixes to get original full-size image
  // e.g. "logo-70x25.png" → "logo.png", "logo-300x150.jpg" → "logo.jpg"
  function getFullSizeUrl(url: string): string {
    return url.replace(/-\d+x\d+(\.\w+)$/, '$1')
  }

  const candidates: { url: string; priority: number }[] = []

  // 1. HEADER/NAV logos (highest priority — this is THE logo)
  const headerBlock = html.match(/<(?:header|nav)[\s\S]*?<\/(?:header|nav)>/i)?.[0] ?? ''
  const headerImgs = headerBlock.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi) || []
  for (const img of headerImgs) {
    const src = img.match(/src=["']([^"']+)["']/i)?.[1]
    if (src) {
      const resolved = resolve(src)
      if (resolved && !resolved.includes('.svg')) {
        candidates.push({ url: getFullSizeUrl(resolved), priority: 10 })
        if (getFullSizeUrl(resolved) !== resolved) candidates.push({ url: resolved, priority: 9 })
      }
    }
    // Check srcset for larger versions
    const srcset = img.match(/srcset=["']([^"']+)["']/i)?.[1]
    if (srcset) {
      const parts = srcset.split(',').map(s => s.trim())
      for (const part of parts) {
        const [url] = part.split(/\s+/)
        const resolved = resolve(url)
        if (resolved && !resolved.includes('.svg')) {
          candidates.push({ url: resolved, priority: 11 }) // srcset versions are usually best
        }
      }
    }
  }

  // 2. Any img with "logo" in class, alt, or src (medium priority)
  const logoImgs = html.match(/<img[^>]*(?:class=["'][^"']*logo[^"']*["']|alt=["'][^"']*logo[^"']*["']|src=["'][^"']*logo[^"']*["'])[^>]*>/gi) || []
  for (const img of logoImgs) {
    const src = img.match(/src=["']([^"']+)["']/i)?.[1]
    if (src) {
      const resolved = resolve(src)
      if (resolved && !resolved.includes('.svg')) {
        candidates.push({ url: getFullSizeUrl(resolved), priority: 7 })
        if (getFullSizeUrl(resolved) !== resolved) candidates.push({ url: resolved, priority: 6 })
      }
    }
    const srcset = img.match(/srcset=["']([^"']+)["']/i)?.[1]
    if (srcset) {
      const parts = srcset.split(',').map(s => s.trim())
      for (const part of parts) {
        const [url] = part.split(/\s+/)
        const resolved = resolve(url)
        if (resolved && !resolved.includes('.svg')) candidates.push({ url: resolved, priority: 8 })
      }
    }
  }

  // 3. Apple touch icon (decent fallback — usually 180x180)
  const touchIcon = html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon["']/i)?.[1]
  if (touchIcon) {
    const resolved = resolve(touchIcon)
    if (resolved) candidates.push({ url: resolved, priority: 4 })
  }

  // 4. og:image (low priority — often a hero image, not the logo)
  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1]
  if (ogImage) {
    const resolved = resolve(ogImage)
    if (resolved) candidates.push({ url: resolved, priority: 2 })
  }

  // Sort by priority (highest first), deduplicate, return best
  candidates.sort((a, b) => b.priority - a.priority)
  const seen = new Set<string>()
  for (const c of candidates) {
    if (seen.has(c.url)) continue
    seen.add(c.url)
    return c.url
  }

  return null
}

export interface BrandAnalysis {
  companyName: string
  tagline: string | null
  description: string
  industry: string
  tone: string
  targetAudience: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  logoUrl: string | null
  fonts: string[]
  brandValues: string[]
  services: string[]
  uniqueSellingPoints: string[]
  contentThemes: string[]
  socialMediaBio: string | null
  hashtagSuggestions: string[]
  toneGuide: { doSay: string[]; dontSay: string[]; samplePosts: string[] } | null
  competitorNotes: string | null
  colorPsychology: string | null
  socialLinks: Record<string, string>
}

export async function scrapeBrand(url: string): Promise<BrandAnalysis> {
  let fullUrl = url.trim()
  if (!fullUrl.startsWith('http')) fullUrl = 'https://' + fullUrl

  let parsedUrl: URL
  try {
    parsedUrl = new URL(fullUrl)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid protocol')
  } catch {
    throw new Error('Invalid URL format')
  }

  const baseOrigin = parsedUrl.origin

  const [mainHtml, aboutHtml, servicesHtml, contactHtml] = await Promise.all([
    fetchPage(fullUrl).then(h => {
      if (!h) throw new Error('MAIN_FETCH_FAILED')
      return h
    }),
    fetchPage(`${baseOrigin}/about`).then(h => h || fetchPage(`${baseOrigin}/about-us`)),
    fetchPage(`${baseOrigin}/services`).then(h => h || fetchPage(`${baseOrigin}/what-we-do`)),
    fetchPage(`${baseOrigin}/contact`),
  ]).catch(err => {
    if (err?.message === 'MAIN_FETCH_FAILED') throw err
    return [null, null, null, null] as (string | null)[]
  }) as [string, string | null, string | null, string | null]

  if (!mainHtml) {
    throw new Error('Could not reach website. The site may be blocking automated requests.')
  }

  const titleMatch = mainHtml.match(/<title[^>]*>([^<]+)<\/title>/i)
  const descMatch = mainHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    ?? mainHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)

  const allHtml = [mainHtml, aboutHtml, servicesHtml, contactHtml].filter(Boolean).join('\n')
  const allColors = extractColors(allHtml)
  const fonts = extractFonts(allHtml)
  const socialLinks = extractSocialLinks(allHtml)
  const jsonLd = extractJsonLd(mainHtml)
  const scrapedLogoUrl = extractLogoUrl(mainHtml, fullUrl)

  const trimmedMain = mainHtml.slice(0, 20000)
  const trimmedAbout = aboutHtml ? aboutHtml.slice(0, 8000) : ''
  const trimmedServices = servicesHtml ? servicesHtml.slice(0, 8000) : ''

  // Logo strategy: Logo.dev first (clean high-res), then scraped fallback
  let logoBuffer: Buffer | null = null
  let logoMime = 'image/png'
  let logoUrl: string | null = null

  // 1. Try Logo.dev API — best quality, clean transparent PNGs
  const domain = parsedUrl.hostname.replace('www.', '')
  try {
    const logoDevUrl = `https://img.logo.dev/${domain}?token=pk_OoIZc53tSDKpqi7uM8wyZQ&size=512&format=png`
    const logoDevRes = await fetch(logoDevUrl, { signal: AbortSignal.timeout(5000) })
    if (logoDevRes.ok) {
      const ct = logoDevRes.headers.get('content-type') ?? ''
      if (ct.startsWith('image/')) {
        logoBuffer = Buffer.from(await logoDevRes.arrayBuffer())
        logoMime = 'image/png'
        logoUrl = logoDevUrl
        console.log(`[brand-scraper] Logo.dev found logo for ${domain}: ${(logoBuffer.length / 1024).toFixed(0)}KB`)
      }
    }
  } catch {
    console.log(`[brand-scraper] Logo.dev lookup failed for ${domain}`)
  }

  // 2. Fallback: scrape logo from website HTML
  if (!logoBuffer && scrapedLogoUrl) {
    try {
      const logoRes = await fetch(scrapedLogoUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(5000) })
      if (logoRes.ok) {
        const ct = logoRes.headers.get('content-type') ?? 'image/png'
        if (ct.startsWith('image/') && !ct.includes('svg')) {
          logoBuffer = Buffer.from(await logoRes.arrayBuffer())
          logoMime = ct.split(';')[0]
          logoUrl = scrapedLogoUrl
          console.log(`[brand-scraper] Scraped logo fallback: ${(logoBuffer.length / 1024).toFixed(0)}KB`)
        }
      }
    } catch { /* skip */ }
  }

  const prompt = `You are a professional brand strategist. Analyze this website thoroughly and create a complete brand guide.

Website: ${fullUrl}
${titleMatch?.[1] ? `Page title: ${titleMatch[1].trim()}` : ''}
${descMatch?.[1] ? `Meta description: ${descMatch[1]}` : ''}

Main page text content (extracted from HTML):
${mainHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)}

${trimmedAbout ? `About page text:\n${aboutHtml!.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000)}\n` : ''}

${trimmedServices ? `Services page text:\n${servicesHtml!.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000)}\n` : ''}

${jsonLd ? `Structured data (JSON-LD):\n${jsonLd}\n` : ''}

CSS colors found on the website: ${allColors.join(', ')}
Fonts found: ${fonts.join(', ')}
Social links found: ${JSON.stringify(socialLinks)}
${logoBuffer ? '\nA logo image from the website is attached below. Analyze it for colors and style.' : ''}

CRITICAL COLOR INSTRUCTIONS:
- Do NOT just pick random CSS hex codes from the list above. Many of those are framework defaults (like #000, #fff, #f8f9fa, #e2e8f0).
- Instead, identify the ACTUAL BRAND COLORS — the colors used for the company logo, main headings, buttons, accent elements, and hero sections.
- The primary color should be the brand's main identifier (usually the logo color or the dominant color on buttons/headers).
- If a logo image is attached, extract the primary color DIRECTLY from the logo.
${logoBuffer ? '- Look at the attached logo image carefully — the main color in the logo IS the primary brand color.' : ''}

Create a comprehensive brand analysis. Return ONLY valid JSON (no markdown, no code fences):
{
  "companyName": "string",
  "tagline": "string (the company's tagline or slogan)",
  "description": "string (2-3 sentence brand description)",
  "industry": "string (what industry/niche)",
  "tone": "string (brand voice - professional, friendly, luxury, playful, authoritative, etc.)",
  "targetAudience": "string (who they serve - be specific)",
  "primaryColor": "#hex (THE MAIN BRAND COLOR — from the logo or dominant UI elements, NOT a framework default)",
  "secondaryColor": "#hex",
  "accentColor": "#hex",
  "backgroundColor": "#hex",
  "textColor": "#hex",
  "fonts": ["array of font families found or recommended"],
  "brandValues": ["array of 3-5 core values the brand communicates"],
  "services": ["array of main services/products offered"],
  "uniqueSellingPoints": ["array of 3-5 things that make them different"],
  "contentThemes": ["array of 5-8 content themes/topics they should post about on social media"],
  "socialMediaBio": "string (suggested social media bio based on brand identity)",
  "hashtagSuggestions": ["array of 10-15 relevant hashtags"],
  "toneGuide": {
    "doSay": ["phrases/approaches that match the brand"],
    "dontSay": ["phrases/approaches to avoid"],
    "samplePosts": ["3 example social media post captions in their brand voice"]
  },
  "competitorNotes": "string (observations about positioning based on the website)",
  "colorPsychology": "string (why these colors work for this brand)"
}`

  // Build content parts — include logo image if available for visual color analysis
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    { text: prompt },
  ]
  if (logoBuffer && !logoMime.includes('svg')) {
    parts.push({ inlineData: { mimeType: logoMime, data: logoBuffer.toString('base64') } })
  }

  const response = await genai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [{ role: 'user', parts }],
  })

  const text = response.text?.trim() ?? ''
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

  let brandData: Record<string, unknown>
  try {
    brandData = JSON.parse(cleaned)
  } catch {
    return {
      companyName: titleMatch?.[1]?.trim() ?? parsedUrl.hostname.replace('www.', ''),
      tagline: null,
      description: descMatch?.[1] ?? '',
      industry: 'unknown',
      tone: 'professional',
      targetAudience: null,
      primaryColor: allColors[0] ?? '#1B365D',
      secondaryColor: allColors[1] ?? '#4A90D9',
      accentColor: allColors[2] ?? '#FFB347',
      backgroundColor: '#FFFFFF',
      textColor: '#1A1A1A',
      logoUrl,
      fonts,
      brandValues: [],
      services: [],
      uniqueSellingPoints: [],
      contentThemes: [],
      socialMediaBio: null,
      hashtagSuggestions: [],
      toneGuide: null,
      competitorNotes: null,
      colorPsychology: null,
      socialLinks,
    }
  }

  // Process logo: resize small logos with Sharp first, then upscale with OpenAI if needed
  let processedLogoUrl = logoUrl
  if (logoBuffer && !logoMime.includes('svg')) {
    const sharpMod = await import('sharp')
    const sharp = sharpMod.default ?? sharpMod

    // First: use Sharp to ensure minimum size (OpenAI needs at least 256x256)
    try {
      const meta = await sharp(logoBuffer).metadata()
      const w = meta.width ?? 0
      const h = meta.height ?? 0
      console.log(`[brand-scraper] Logo dimensions: ${w}x${h}, ${(logoBuffer.length / 1024).toFixed(0)}KB`)

      if (w < 256 || h < 256) {
        // Resize up to at least 512px on the longest side with white background
        logoBuffer = await sharp(logoBuffer)
          .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png()
          .toBuffer()
        console.log(`[brand-scraper] Logo padded to 512x512 (${(logoBuffer.length / 1024).toFixed(0)}KB)`)
      }
    } catch (sharpErr) {
      console.log('[brand-scraper] Sharp logo processing failed:', sharpErr instanceof Error ? sharpErr.message : 'unknown')
    }

    // Now try OpenAI upscale for small logos (under 15KB after padding)
    if (logoBuffer.length < 15000) {
      try {
        const OpenAI = (await import('openai')).default
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        console.log(`[brand-scraper] Upscaling logo with OpenAI (${(logoBuffer.length / 1024).toFixed(0)}KB)...`)
        const logoFile = new File([new Uint8Array(logoBuffer)], 'logo.png', { type: 'image/png' })
        const response = await openai.images.edit({
          model: 'gpt-image-2',
          image: logoFile,
          prompt: 'Upscale this logo to high resolution. Keep the EXACT same design, colors, shapes, and text. Do not modify, redesign, or add anything. Output on clean white background, crisp edges, centered.',
          size: '1024x1024',
          quality: 'high',
          n: 1,
        })
        const imageData = response.data?.[0]
        if (imageData?.b64_json) {
          processedLogoUrl = `data:image/png;base64,${imageData.b64_json}`
          console.log('[brand-scraper] Logo upscaled successfully')
        } else {
          processedLogoUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`
        }
      } catch (err) {
        console.log('[brand-scraper] Logo upscale failed, using padded version:', err instanceof Error ? err.message : 'unknown')
        processedLogoUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`
      }
    } else {
      // Logo is good quality already
      processedLogoUrl = `data:${logoMime};base64,${logoBuffer.toString('base64')}`
      console.log(`[brand-scraper] Logo good quality (${(logoBuffer.length / 1024).toFixed(0)}KB), using as-is`)
    }
  }

  return {
    companyName: (brandData.companyName as string) ?? titleMatch?.[1] ?? parsedUrl.hostname.replace('www.', ''),
    tagline: (brandData.tagline as string) ?? null,
    description: (brandData.description as string) ?? descMatch?.[1] ?? '',
    industry: (brandData.industry as string) ?? 'unknown',
    tone: (brandData.tone as string) ?? 'professional',
    targetAudience: (brandData.targetAudience as string) ?? null,
    primaryColor: (brandData.primaryColor as string) ?? '#1B365D',
    secondaryColor: (brandData.secondaryColor as string) ?? '#4A90D9',
    accentColor: (brandData.accentColor as string) ?? '#FFB347',
    backgroundColor: (brandData.backgroundColor as string) ?? '#FFFFFF',
    textColor: (brandData.textColor as string) ?? '#1A1A1A',
    logoUrl: processedLogoUrl,
    fonts: (brandData.fonts as string[]) ?? fonts,
    brandValues: (brandData.brandValues as string[]) ?? [],
    services: (brandData.services as string[]) ?? [],
    uniqueSellingPoints: (brandData.uniqueSellingPoints as string[]) ?? [],
    contentThemes: (brandData.contentThemes as string[]) ?? [],
    socialMediaBio: (brandData.socialMediaBio as string) ?? null,
    hashtagSuggestions: (brandData.hashtagSuggestions as string[]) ?? [],
    toneGuide: (brandData.toneGuide as BrandAnalysis['toneGuide']) ?? null,
    competitorNotes: (brandData.competitorNotes as string) ?? null,
    colorPsychology: (brandData.colorPsychology as string) ?? null,
    socialLinks: { ...socialLinks, ...(brandData.socialLinks as Record<string, string> ?? {}) },
  }
}
