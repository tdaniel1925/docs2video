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

  // Logo strategy: try multiple sources, pick the best one
  const logo: { buffer: Buffer | null; mime: string; url: string | null; source: string; score: number } = { buffer: null, mime: 'image/png', url: null, source: '', score: 0 }
  const domain = parsedUrl.hostname.replace('www.', '')

  async function tryLogoUrl(url: string, source: string): Promise<boolean> {
    try {
      const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const ct = res.headers.get('content-type') ?? ''
        if (ct.startsWith('image/') && !ct.includes('svg')) {
          const buf = Buffer.from(await res.arrayBuffer())
          if (buf.length > 500) { // skip tiny placeholders
            // Score this logo: prefer wider images (real logos) over square icons
            let score = buf.length
            try {
              const sharpMod = await import('sharp')
              const s = sharpMod.default ?? sharpMod
              const meta = await s(buf).metadata()
              const w = meta.width ?? 0
              const h = meta.height ?? 0
              const ratio = w / Math.max(h, 1)
              // Wide logos (ratio > 1.5) are almost always the real logo with text
              // Square icons (ratio ~1) are usually favicons
              if (ratio > 1.5) score += 500000 // heavily prefer wide logos
              if (w >= 400) score += 100000 // prefer larger dimensions
            } catch { /* skip metadata check */ }

            if (!logo.buffer || score > logo.score) {
              logo.buffer = buf
              logo.mime = ct.split(';')[0] || 'image/png'
              logo.url = url
              logo.source = source
              logo.score = score
              console.log(`[brand-scraper] Logo found via ${source}: ${(buf.length / 1024).toFixed(0)}KB (score: ${score}) — ${url.slice(0, 80)}`)
            }
            return true
          }
        }
      }
    } catch { /* skip */ }
    return false
  }

  // Source 1: Logo.dev API (clean, high-res, transparent PNGs)
  // Try ALL sources — scoring picks the best one (wide logos beat square icons)
  await tryLogoUrl(`https://img.logo.dev/${domain}?token=pk_OoIZc53tSDKpqi7uM8wyZQ&size=512&format=png`, 'Logo.dev')
  await tryLogoUrl(`https://www.google.com/s2/favicons?domain=${domain}&sz=256`, 'Google Favicon')

  // Common direct paths
  for (const path of ['/apple-touch-icon.png', '/logo.png', '/images/logo.png', '/assets/logo.png', '/android-chrome-512x512.png']) {
    await tryLogoUrl(`${baseOrigin}${path}`, `Direct path ${path}`)
  }

  // HTML scraped logo
  if (scrapedLogoUrl) {
    await tryLogoUrl(scrapedLogoUrl, 'HTML scrape')
  }

  // WordPress full-size — strip size suffix
  if (scrapedLogoUrl && scrapedLogoUrl.match(/-\d+x\d+\.\w+$/)) {
    const fullUrl = scrapedLogoUrl.replace(/-\d+x\d+(\.\w+)$/, '$1')
    if (fullUrl !== scrapedLogoUrl) {
      await tryLogoUrl(fullUrl, 'WordPress full-size')
    }
  }

  if (!logo.buffer) {
    console.log(`[brand-scraper] No logo found for ${domain} from any source`)
  }

  // Extract dominant colors from logo using Sharp (more reliable than CSS parsing)
  let logoColors: { primary: string; secondary: string } | null = null
  if (logo.buffer && !logo.mime.includes('svg')) {
    try {
      const sharpMod = await import('sharp')
      const sharp = sharpMod.default ?? sharpMod
      const { dominant } = await sharp(logo.buffer).stats()
      const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
      const dominantHex = toHex(dominant.r, dominant.g, dominant.b)
      // Use a contrasting dark/light as secondary based on logo brightness
      const brightness = (dominant.r * 299 + dominant.g * 587 + dominant.b * 114) / 1000
      const secondaryHex = brightness > 128 ? '#1a2b3c' : '#e8edf2'
      logoColors = { primary: dominantHex, secondary: secondaryHex }
      console.log(`[brand-scraper] Logo colors extracted: primary=${dominantHex}, secondary=${secondaryHex}`)
    } catch (colorErr) {
      console.log('[brand-scraper] Logo color extraction failed:', colorErr instanceof Error ? colorErr.message : 'unknown')
    }
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
${logo.buffer ? '\nA logo image from the website is attached below. Analyze it for colors and style.' : ''}

CRITICAL COLOR INSTRUCTIONS:
- Do NOT just pick random CSS hex codes from the list above. Many of those are framework defaults (like #000, #fff, #f8f9fa, #e2e8f0).
- Instead, identify the ACTUAL BRAND COLORS — the colors used for the company logo, main headings, buttons, accent elements, and hero sections.
- The primary color should be the brand's main identifier (usually the logo color or the dominant color on buttons/headers).
- If a logo image is attached, extract the primary color DIRECTLY from the logo.
${logo.buffer ? '- Look at the attached logo image carefully — the main color in the logo IS the primary brand color.' : ''}

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
  if (logo.buffer && !logo.mime.includes('svg')) {
    parts.push({ inlineData: { mimeType: logo.mime, data: logo.buffer.toString('base64') } })
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
      primaryColor: logoColors?.primary ?? allColors[0] ?? '#1B365D',
      secondaryColor: logoColors?.secondary ?? allColors[1] ?? '#4A90D9',
      accentColor: allColors[2] ?? '#FFB347',
      backgroundColor: '#FFFFFF',
      textColor: '#1A1A1A',
      logoUrl: logo.url,
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

  // Process logo: use Sharp only — no AI upscaling (it modifies the design)
  let processedLogoUrl = logo.url
  if (logo.buffer && !logo.mime.includes('svg')) {
    try {
      const sharpMod = await import('sharp')
      const sharp = sharpMod.default ?? sharpMod
      const meta = await sharp(logo.buffer).metadata()
      const w = meta.width ?? 0
      const h = meta.height ?? 0
      console.log(`[brand-scraper] Logo dimensions: ${w}x${h}, ${(logo.buffer.length / 1024).toFixed(0)}KB`)

      // Resize to 512px, convert to clean crisp PNG
      logo.buffer = await sharp(logo.buffer)
        .resize(512, 512, { fit: 'contain', withoutEnlargement: false, background: { r: 255, g: 255, b: 255, alpha: 0 }, kernel: 'lanczos3' })
        .sharpen({ sigma: 1.2 })
        .png({ quality: 100 })
        .toBuffer()

      processedLogoUrl = `data:image/png;base64,${logo.buffer.toString('base64')}`
      console.log(`[brand-scraper] Logo processed with Sharp: ${(logo.buffer.length / 1024).toFixed(0)}KB`)
    } catch (sharpErr) {
      console.log('[brand-scraper] Sharp logo processing failed:', sharpErr instanceof Error ? sharpErr.message : 'unknown')
      processedLogoUrl = `data:${logo.mime};base64,${logo.buffer.toString('base64')}`
    }
  }

  return {
    companyName: (brandData.companyName as string) ?? titleMatch?.[1] ?? parsedUrl.hostname.replace('www.', ''),
    tagline: (brandData.tagline as string) ?? null,
    description: (brandData.description as string) ?? descMatch?.[1] ?? '',
    industry: (brandData.industry as string) ?? 'unknown',
    tone: (brandData.tone as string) ?? 'professional',
    targetAudience: (brandData.targetAudience as string) ?? null,
    primaryColor: logoColors?.primary ?? (brandData.primaryColor as string) ?? '#1B365D',
    secondaryColor: logoColors?.secondary ?? (brandData.secondaryColor as string) ?? '#4A90D9',
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
