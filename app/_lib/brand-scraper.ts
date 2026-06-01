import Anthropic from '@anthropic-ai/sdk'
import { buildBrandAnalysisPrompt } from './prompts'

let _claude: Anthropic | null = null
function getClaude() {
  if (!_claude) _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return _claude
}

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

export async function scrapeBrand(url: string, firecrawlContent?: { markdown: string; html: string }): Promise<BrandAnalysis> {
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

  // Use Firecrawl content if provided (accurate), otherwise fall back to manual fetch
  let mainHtml: string = ''
  let pageText: string = ''
  if (firecrawlContent?.markdown) {
    pageText = firecrawlContent.markdown
    console.log('[brand-scraper] Using Firecrawl markdown for brand analysis')
  }

  // Always fetch raw HTML for logo/color/font extraction — Firecrawl HTML may strip tags
  const rawHtml = await fetchPage(fullUrl)
  mainHtml = rawHtml || firecrawlContent?.html || ''
  if (!pageText) {
    if (!mainHtml) throw new Error('Could not reach website.')
    pageText = mainHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const titleMatch = mainHtml.match(/<title[^>]*>([^<]+)<\/title>/i)
  const descMatch = mainHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    ?? mainHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)

  const allColors = extractColors(mainHtml)
  const fonts = extractFonts(mainHtml)
  const socialLinks = extractSocialLinks(mainHtml)
  const jsonLd = extractJsonLd(mainHtml)
  const scrapedLogoUrl = extractLogoUrl(mainHtml, fullUrl)
  console.log(`[brand-scraper] Logo URL from HTML: ${scrapedLogoUrl?.slice(0, 80) ?? 'none'}`)

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

  // Try multiple sources — scoring picks the best one (wide logos beat square icons)
  // HTML scrape first (most likely to find the real logo), then fallbacks
  if (scrapedLogoUrl) {
    await tryLogoUrl(scrapedLogoUrl, 'HTML scrape')
  }

  // WordPress full-size — strip size suffix
  if (scrapedLogoUrl && scrapedLogoUrl.match(/-\d+x\d+\.\w+$/)) {
    const fullUrl2 = scrapedLogoUrl.replace(/-\d+x\d+(\.\w+)$/, '$1')
    if (fullUrl2 !== scrapedLogoUrl) {
      await tryLogoUrl(fullUrl2, 'WordPress full-size')
    }
  }

  // Google Favicon as fallback (256px)
  await tryLogoUrl(`https://www.google.com/s2/favicons?domain=${domain}&sz=256`, 'Google Favicon')

  // Common direct paths as last resort
  for (const path of ['/apple-touch-icon.png', '/logo.png', '/images/logo.png', '/assets/logo.png', '/android-chrome-512x512.png']) {
    await tryLogoUrl(`${baseOrigin}${path}`, `Direct path ${path}`)
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
      const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
      // Sample logo at small size and find most saturated (colorful) pixels — skip white/black/gray
      const { data, info } = await sharp(logo.buffer).resize(20, 20, { fit: 'cover' }).raw().toBuffer({ resolveWithObject: true })
      const colorCounts: Record<string, { r: number; g: number; b: number; count: number }> = {}
      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        // Skip near-white, near-black, and gray pixels
        const max = Math.max(r, g, b), min = Math.min(r, g, b)
        const saturation = max === 0 ? 0 : (max - min) / max
        if (saturation < 0.15) continue // skip grays/whites/blacks
        // Quantize to reduce noise
        const qr = Math.round(r / 32) * 32, qg = Math.round(g / 32) * 32, qb = Math.round(b / 32) * 32
        const key = `${qr},${qg},${qb}`
        if (!colorCounts[key]) colorCounts[key] = { r: qr, g: qg, b: qb, count: 0 }
        colorCounts[key].count++
      }
      const sorted = Object.values(colorCounts).sort((a, b) => b.count - a.count)
      if (sorted.length > 0) {
        const primary = sorted[0]
        const secondary = sorted.length > 1 ? sorted[1] : { r: 26, g: 43, b: 60 }
        logoColors = {
          primary: toHex(primary.r, primary.g, primary.b),
          secondary: toHex(secondary.r, secondary.g, secondary.b),
        }
        console.log(`[brand-scraper] Logo colors: primary=${logoColors.primary}, secondary=${logoColors.secondary} (from ${sorted.length} colors)`)
      } else {
        console.log('[brand-scraper] No saturated colors found in logo, using defaults')
      }
    } catch (colorErr) {
      console.log('[brand-scraper] Logo color extraction failed:', colorErr instanceof Error ? colorErr.message : 'unknown')
    }
  }

  const prompt = buildBrandAnalysisPrompt(
    fullUrl,
    titleMatch?.[1]?.trim(),
    descMatch?.[1],
    pageText,
    jsonLd,
    allColors,
    fonts,
    socialLinks,
    !!logo.buffer,
  )

  const response = await getClaude().messages.create({
    model: 'claude-sonnet-4-20250808',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt + '\n\nReturn ONLY valid JSON, no markdown code fences.' }],
  })

  const text = (response.content[0]?.type === 'text' ? response.content[0].text : '').trim()
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
