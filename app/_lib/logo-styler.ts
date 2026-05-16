import OpenAI from 'openai'
import { SLIDE_STYLES } from './types'
import { createAdminClient } from './supabase/admin'

let client: OpenAI | null = null
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return client
}

/**
 * Style treatments per template — describes how the logo should look in each style.
 */
const STYLE_TREATMENTS: Record<string, string> = {
  'executive': 'Render the logo with a premium gold metallic finish and subtle emboss shadow on a dark charcoal surface. Sophisticated and authoritative.',
  'steampunk': 'Render the logo as a bronze metallic engraving with mechanical gear textures and warm vintage lighting. Steampunk aesthetic.',
  'social-grid': 'Render the logo clean and modern on a white card with a soft drop shadow. Minimal and lifestyle-ready.',
  'blue-steps': 'Render the logo with a friendly teal/blue color treatment and soft rounded shadow. Educational and approachable.',
  'isometric': 'Render the logo as a 3D isometric object with colorful gradients and a light shadow. Modern and tech-forward.',
  'flat-vector': 'Render the logo in flat bold solid colors with clean edges, no gradients. Professional vector style.',
  'doodle': 'Render the logo as if hand-drawn with a sketchy pen outline style. Playful and creative.',
  'watercolor': 'Render the logo with soft watercolor paint effects and pastel color bleeding at the edges. Artistic and gentle.',
  'neon-cyber': 'Render the logo with electric neon glow effects on a pure black background. Futuristic cyberpunk style with light bloom.',
  'line-art': 'Render the logo as a thin clean line-art outline with minimal color fill. Professional and technical.',
  'vintage-craft': 'Render the logo with a vintage stamp/badge treatment on dark craft paper texture. Warm and nostalgic.',
  'flat-cartoon': 'Render the logo with bright cheerful flat colors and a subtle cartoon-style outline. Friendly and engaging.',
  'colorful-steps': 'Render the logo with vibrant multi-colored gradient treatment. Energetic and playful.',
  'timeline': 'Render the logo clean on a white surface with a subtle professional shadow. Corporate and organized.',
  'profile-resume': 'Render the logo with bold contrasting colors and a strong shadow. Executive and impactful.',
  'anime-pop': 'Render the logo with bold black outlines, neon colors, and halftone dot pattern effects. Anime pop-art explosion style.',
  'felt-craft': 'Render the logo as if made from cut felt fabric with visible texture and stitching details. Handmade craft aesthetic.',
  'botanical-warm': 'Render the logo with warm earthy tones, parchment texture overlay, and subtle ornamental floral border accents. Vintage botanical style.',
}

/**
 * Generate a styled version of a logo for a specific template style using GPT Image.
 */
export async function generateStyledLogo(
  logoUrl: string,
  styleId: string,
  brandColors: { primary: string; secondary: string }
): Promise<Buffer> {
  const openai = getClient()
  const treatment = STYLE_TREATMENTS[styleId] || 'Render the logo with a professional polished treatment matching a modern presentation style.'

  const response = await openai.images.edit({
    model: 'gpt-image-1',
    image: await fetchAsFile(logoUrl),
    prompt: `Take this exact logo and apply the following visual treatment while preserving its exact shape, proportions, text, and details. Do NOT alter the logo design itself — only add stylistic effects around and onto it.

Treatment: ${treatment}

Brand colors for reference: Primary ${brandColors.primary}, Secondary ${brandColors.secondary}. Use these as accent influences where appropriate.

CRITICAL RULES:
- Preserve the EXACT logo shape, text, and proportions — do not redraw or reinterpret
- Output on a TRANSPARENT background (PNG with alpha)
- The logo should be centered and fill most of the frame
- Only add style effects (glow, texture, shadow, color treatment) — never change the logo itself
- Output size: 800x400 pixels`,
    size: '1024x1024',
  })

  // Extract image data from response
  const imageData = response.data?.[0]
  if (!imageData) throw new Error('No image generated')

  if (imageData.b64_json) {
    return Buffer.from(imageData.b64_json, 'base64')
  } else if (imageData.url) {
    const res = await fetch(imageData.url)
    return Buffer.from(await res.arrayBuffer())
  }

  throw new Error('No image data in response')
}

/**
 * Generate styled logos for ALL template styles and store them.
 * Called during brand creation/update when a logo is provided.
 */
export async function generateFullLogoKit(
  brandId: string,
  logoUrl: string,
  brandColors: { primary: string; secondary: string }
): Promise<{ styleId: string; url: string }[]> {
  const supabase = createAdminClient()
  const results: { styleId: string; url: string }[] = []

  // Generate in batches of 3 to avoid rate limits
  const styles = SLIDE_STYLES.map(s => s.id)
  const batchSize = 3

  for (let i = 0; i < styles.length; i += batchSize) {
    const batch = styles.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(
      batch.map(async (styleId) => {
        try {
          const styledBuffer = await generateStyledLogo(logoUrl, styleId, brandColors)

          // Upload to Supabase storage
          const path = `logo-kit/${brandId}/${styleId}.png`
          const { error } = await supabase.storage
            .from('brand-assets')
            .upload(path, styledBuffer, {
              contentType: 'image/png',
              upsert: true,
            })

          if (error) throw error

          const { data: urlData } = supabase.storage
            .from('brand-assets')
            .getPublicUrl(path)

          return { styleId, url: urlData.publicUrl }
        } catch (err) {
          console.error(`[logo-kit] Failed to generate ${styleId}:`, err)
          return null
        }
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
      }
    }
  }

  // Store the logo kit mapping in the brand record
  if (results.length > 0) {
    await supabase
      .from('brands')
      .update({ logo_kit: Object.fromEntries(results.map(r => [r.styleId, r.url])) })
      .eq('id', brandId)
  }

  return results
}

/**
 * Get the styled logo URL for a given brand + style.
 * Falls back to raw logo if styled version not available.
 */
export function getStyledLogoUrl(
  brand: { logo_url?: string | null; logo_kit?: Record<string, string> | null },
  styleId: string
): string | null {
  if (brand.logo_kit?.[styleId]) return brand.logo_kit[styleId]
  return brand.logo_url ?? null
}

/**
 * Fetch a URL and return as a File object for OpenAI API.
 */
async function fetchAsFile(url: string): Promise<File> {
  const res = await fetch(url)
  const buffer = await res.arrayBuffer()
  return new File([buffer], 'logo.png', { type: 'image/png' })
}
