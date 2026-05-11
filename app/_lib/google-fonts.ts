/**
 * Fetches and caches the top Google Fonts for logo design.
 * Uses the Google Fonts API to get real, verified font names.
 */

let _cachedFonts: string[] | null = null
let _cacheTime = 0
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

export async function getTopGoogleFonts(limit = 300): Promise<string[]> {
  if (_cachedFonts && Date.now() - _cacheTime < CACHE_TTL) {
    return _cachedFonts
  }

  try {
    const apiKey = process.env.GOOGLE_FONTS_API_KEY || process.env.GEMINI_API_KEY
    const res = await fetch(
      `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`,
      { signal: AbortSignal.timeout(5000) }
    )

    if (!res.ok) throw new Error(`Google Fonts API: ${res.status}`)

    const data = await res.json() as { items: { family: string; category: string }[] }
    const fonts = data.items.slice(0, limit).map(f => f.family)

    _cachedFonts = fonts
    _cacheTime = Date.now()
    return fonts
  } catch (err) {
    console.error('[google-fonts] Failed to fetch:', err)
    // Return a solid fallback list if API fails
    return FALLBACK_FONTS
  }
}

// Categorize fonts for logo design context
export function categorizeFontsForPrompt(fonts: string[]): string {
  // We just provide the full list — Marcus's typography knowledge
  // tells him which to pick based on the brief
  return fonts.join(', ')
}

const FALLBACK_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Lato',
  'Oswald', 'Raleway', 'Nunito', 'Playfair Display', 'Merriweather',
  'PT Sans', 'Rubik', 'Work Sans', 'DM Sans', 'Plus Jakarta Sans',
  'Space Grotesk', 'Outfit', 'Sora', 'Lexend', 'Urbanist', 'Manrope',
  'Quicksand', 'Cormorant', 'Libre Baskerville', 'Barlow', 'Bebas Neue',
  'Archivo', 'Jost', 'Red Hat Display', 'Figtree', 'Geist',
  'IBM Plex Sans', 'Source Sans 3', 'Noto Sans', 'Cabin', 'Karla',
  'Lora', 'Bitter', 'Crimson Text', 'EB Garamond', 'DM Serif Display',
  'Fraunces', 'Clash Display', 'General Sans', 'Satoshi', 'Cabinet Grotesk',
]
