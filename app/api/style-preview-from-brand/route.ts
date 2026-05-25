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
    const vpsRes = await fetch(`${VIDEO_ASSEMBLY_URL}/style-preview-from-brand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': VIDEO_ASSEMBLY_SECRET,
      },
      body: JSON.stringify({
        styleDescription,
        companyName: companyName || 'Your Company',
        userId: user.id,
      }),
      signal: AbortSignal.timeout(240000),
    })

    // If VPS doesn't have this endpoint, fall back to generating via OpenAI directly
    if (vpsRes.status === 404) {
      return await generatePreviewsDirect(styleDescription, companyName || 'Your Company')
    }

    if (!vpsRes.ok) {
      const errText = await vpsRes.text().catch(() => 'Unknown error')
      console.error('[style-preview-from-brand] VPS error:', vpsRes.status, errText)
      // Fall back to direct generation
      return await generatePreviewsDirect(styleDescription, companyName || 'Your Company', logoUrl)
    }

    const data = await vpsRes.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[style-preview-from-brand] Error:', err)
    // Fall back to direct generation
    return await generatePreviewsDirect(styleDescription, companyName || 'Your Company', logoUrl)
  }
}

async function generatePreviewsDirect(styleDescription: string, companyName: string, logoUrl?: string) {
  try {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const [coverRes, contentRes] = await Promise.all([
      openai.images.generate({
        model: 'gpt-image-2',
        prompt: `Create a presentation COVER slide in this style: ${styleDescription}. Title: "${companyName}", subtitle: "Company Overview". 1920x1080 landscape. Fill entire canvas. Leave top-right corner clear for a logo overlay.`,
        size: '1536x1024',
        quality: 'high',
        n: 1,
      }),
      openai.images.generate({
        model: 'gpt-image-2',
        prompt: `Create a presentation CONTENT slide in this style: ${styleDescription}. Title: "KEY HIGHLIGHTS". Show 3 data sections with placeholder metrics. 1920x1080 landscape. Fill entire canvas. Leave top-right corner clear for a logo overlay.`,
        size: '1536x1024',
        quality: 'high',
        n: 1,
      }),
    ])

    let coverBuf: Buffer | null = coverRes.data?.[0]?.b64_json ? Buffer.from(coverRes.data[0].b64_json, 'base64') : null
    let contentBuf: Buffer | null = contentRes.data?.[0]?.b64_json ? Buffer.from(contentRes.data[0].b64_json, 'base64') : null

    // Composite logo onto slides if available
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
            .resize(200, 120, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer()
          const logoMeta = await sharp(logoResized).metadata()
          const lw = logoMeta.width || 100

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
