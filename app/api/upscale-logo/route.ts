import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { CREDIT_COSTS } from '../../_lib/credits'
import { runCharged } from '../../_lib/credit-charge'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'
import { safeFetch } from '../../_lib/brand-scraper'
import { GoogleGenAI } from '@google/genai'

export const runtime = 'nodejs'
export const maxDuration = 120

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

/**
 * Takes a low-res logo image and creates a high-res recreation using Gemini.
 * Also used by the brand scraper to upscale logos found on websites.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'upscale-logo'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a bit before generating again.' }, { status: 429 })
  }

  const { logoImage, companyName } = await request.json() as {
    logoImage: string // base64 data URL or URL
    companyName?: string
  }

  if (!logoImage) {
    return NextResponse.json({ error: 'Logo image required' }, { status: 400 })
  }

  // Charge up front; a bad image, a failed fetch or an empty AI answer gives
  // the credits back (audit H5).
  return runCharged({ userId: user.id, amount: CREDIT_COSTS['upscale-logo'], action: 'upscale-logo' }, async () => {
  try {
    // Get the image as buffer
    let imageBuffer: Buffer
    let mimeType = 'image/png'

    if (logoImage.startsWith('data:')) {
      const match = logoImage.match(/^data:(image\/\w+);base64,(.+)$/)
      if (!match) return NextResponse.json({ error: 'Invalid image data' }, { status: 400 })
      mimeType = match[1]
      imageBuffer = Buffer.from(match[2], 'base64')
    } else if (logoImage.startsWith('http')) {
      // safeFetch: logoImage is user-supplied, so it must clear the SSRF guard
      // (and every redirect) before we fetch it server-side.
      const res = await safeFetch(logoImage, { timeoutMs: 8000 })
      if (!res || !res.ok) return NextResponse.json({ error: 'Could not fetch logo' }, { status: 400 })
      mimeType = res.headers.get('content-type')?.split(';')[0] ?? 'image/png'
      imageBuffer = Buffer.from(await res.arrayBuffer())
    } else {
      return NextResponse.json({ error: 'Provide a data URL or HTTP URL' }, { status: 400 })
    }

    // Skip SVGs — they're already vector
    if (mimeType.includes('svg')) {
      return NextResponse.json({ error: 'SVG logos are already high quality — no upscaling needed' }, { status: 400 })
    }

    const prompt = `You are looking at a logo${companyName ? ` for "${companyName}"` : ''}. This is a low-resolution version scraped from a website.

Your task: Create a HIGH-RESOLUTION, CLEAN recreation of this EXACT logo.

CRITICAL RULES:
- Recreate the logo as faithfully as possible — same shapes, same colors, same text, same layout
- The result must be CRISP and SHARP with clean edges, as if it were the original vector file
- Output on a pure white background (#FFFFFF)
- Make it large and centered with generous padding
- Reproduce the EXACT text/company name with correct spelling
- Match the EXACT colors from the original
- If the logo has an icon/symbol, recreate it precisely
- DO NOT redesign, improve, or modify the logo — recreate it exactly as it appears
- The output should look like a print-ready, high-resolution PNG of the original logo
- Square format, centered composition`

    const response = await genai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: imageBuffer.toString('base64') } },
        ],
      }],
      config: {
        responseFormat: {
          image: { aspectRatio: '1:1', imageSize: '1024' },
        },
      } as any,
    })

    const responseParts = response.candidates?.[0]?.content?.parts ?? []
    for (const rp of responseParts) {
      if (rp.inlineData) {
        const upscaledBuffer = Buffer.from(rp.inlineData.data!, 'base64')

        // Upload to Supabase
        const admin = createAdminClient()
        const path = `${user.id}/logos/upscaled-${Date.now()}.png`
        const { error: upErr } = await admin.storage.from('videos').upload(path, upscaledBuffer, { contentType: 'image/png', upsert: true })
        // A failed save must not look like success (the user would be charged
        // for a link to nothing) — throwing refunds the credits.
        if (upErr) throw new Error(`upload failed: ${upErr.message}`)
        const { data: urlData } = admin.storage.from('videos').getPublicUrl(path)

        return NextResponse.json({
          imageUrl: urlData.publicUrl,
          message: 'Logo upscaled successfully',
        })
      }
    }

    return NextResponse.json({ error: 'Failed to generate upscaled logo' }, { status: 500 })
  } catch (err) {
    console.error('[upscale-logo] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upscaling failed' }, { status: 500 })
  }
  })
}
