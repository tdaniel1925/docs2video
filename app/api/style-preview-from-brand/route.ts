import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { rateLimit, getRateLimitKey } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300

const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

/**
 * POST /api/style-preview-from-brand
 * Generates 2 preview slides (cover + content) based on brand data.
 * No reference image needed — uses brand colors, industry, and company name.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single()
  const isPaid = ['active', 'starter', 'pro', 'business', 'professional', 'enterprise', 'enterprise-plus', 'enterprise_plus'].includes(profile?.subscription_status ?? '')

  if (!isPaid) {
    const rl = rateLimit(getRateLimitKey(user.id, 'style_preview_brand'), 3, 86400000)
    if (!rl.allowed) return NextResponse.json({ error: 'Free accounts can preview 3 styles per day. Upgrade for unlimited.' }, { status: 429 })
  }

  const body = await request.json()
  const { primaryColor, secondaryColor, companyName, industry, tone, logoUrl } = body as {
    primaryColor?: string
    secondaryColor?: string
    companyName?: string
    industry?: string
    tone?: string
    logoUrl?: string
  }

  if (!VIDEO_ASSEMBLY_URL) {
    return NextResponse.json({ error: 'Video server not configured' }, { status: 500 })
  }

  // Build a style description from brand data
  const colorDesc = primaryColor
    ? `Primary brand color: ${primaryColor}${secondaryColor ? `, secondary: ${secondaryColor}` : ''}. Use these colors prominently.`
    : 'Use a professional, modern color scheme.'

  const industryDesc = industry ? `This is for a ${industry} company.` : ''
  const toneDesc = tone ? `The brand tone is ${tone}.` : 'Professional and modern.'

  const styleDescription = `${colorDesc} ${industryDesc} ${toneDesc} Create a visually striking, premium design that matches this brand identity. Bold typography, clean layout, layered depth with subtle shadows and gradients.`

  try {
    // Generate illustrated previews directly via OpenAI (not VPS — VPS still has old slide-style prompts)
    return await generatePreviewsDirect(styleDescription, companyName || 'Your Company', logoUrl)
  } catch (err) {
    console.error('[style-preview-from-brand] Error:', err)
    return NextResponse.json({ error: 'Preview generation failed' }, { status: 500 })
  }
}

async function generatePreviewsDirect(styleDescription: string, companyName: string, logoUrl?: string) {
  try {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const [coverRes, contentRes] = await Promise.all([
      openai.images.generate({
        model: 'gpt-image-2',
        prompt: `Create an illustrated scene for a video explainer in this style: ${styleDescription}. Scene: A welcoming, establishing shot that introduces "${companyName}". Show a warm, inviting visual metaphor — like opening a door, sunrise over a landscape, or a friendly guide welcoming the viewer. Rich illustrated artwork filling the entire 1920x1080 canvas. No text, no UI elements, no slide layouts — pure illustrated scene. Leave bottom 100px as a clean solid bar area for branding overlay.`,
        size: '1536x1024',
        quality: 'high',
        n: 1,
      }),
      openai.images.generate({
        model: 'gpt-image-2',
        prompt: `Create an illustrated scene for a video explainer in this style: ${styleDescription}. Scene: A visual metaphor showing growth, protection, or progress — like a shield protecting a family, a tree growing strong, or a path leading forward. Rich illustrated artwork filling the entire 1920x1080 canvas. No text, no UI elements, no slide layouts — pure illustrated scene. Leave bottom 100px as a clean solid bar area for branding overlay.`,
        size: '1536x1024',
        quality: 'high',
        n: 1,
      }),
    ])

    let coverBuf: Buffer | null = coverRes.data?.[0]?.b64_json ? Buffer.from(coverRes.data[0].b64_json, 'base64') : null
    let contentBuf: Buffer | null = contentRes.data?.[0]?.b64_json ? Buffer.from(contentRes.data[0].b64_json, 'base64') : null

    // Composite logo onto slides if available
    console.log('[style-preview-from-brand] logoUrl received:', logoUrl ? `"${logoUrl.slice(0, 100)}..."` : 'NONE')
    console.log('[style-preview-from-brand] coverBuf:', coverBuf ? `${coverBuf.length} bytes` : 'null')
    console.log('[style-preview-from-brand] contentBuf:', contentBuf ? `${contentBuf.length} bytes` : 'null')
    if (logoUrl && (coverBuf || contentBuf)) {
      try {
        const sharp = (await import('sharp')).default
        let logoBuf: Buffer | null = null

        if (logoUrl.startsWith('data:')) {
          logoBuf = Buffer.from(logoUrl.split(',')[1], 'base64')
        } else {
          const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
          if (logoRes.ok) logoBuf = Buffer.from(await logoRes.arrayBuffer())
        }

        if (logoBuf) {
          const logoResized = await sharp(logoBuf)
            .resize(160, 100, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer()
          const logoMeta = await sharp(logoResized).metadata()
          const lw = logoMeta.width || 80
          const lh = logoMeta.height || 50

          if (coverBuf) {
            coverBuf = await sharp(coverBuf)
              .composite([{ input: logoResized, top: 20, left: 1536 - lw - 20 }])
              .png()
              .toBuffer()
          }
          if (contentBuf) {
            contentBuf = await sharp(contentBuf)
              .composite([{ input: logoResized, top: 20, left: 1536 - lw - 20 }])
              .png()
              .toBuffer()
          }
          console.log('[style-preview-from-brand] Logo composited on preview slides')
        }
      } catch (logoErr) {
        console.error('[style-preview-from-brand] Logo composite failed:', logoErr instanceof Error ? logoErr.message : 'unknown')
      }
    }

    const cover = coverBuf ? `data:image/png;base64,${coverBuf.toString('base64')}` : null
    const content = contentBuf ? `data:image/png;base64,${contentBuf.toString('base64')}` : null

    return NextResponse.json({
      previews: [cover, content].filter(Boolean),
      styleDescription,
    })
  } catch (err) {
    console.error('[style-preview-from-brand] Direct generation failed:', err)
    return NextResponse.json({ error: 'Preview generation failed' }, { status: 500 })
  }
}
