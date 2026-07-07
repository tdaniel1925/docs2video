import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import PptxGenJS from 'pptxgenjs'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { checkCredits, deductCredits, CREDIT_COSTS } from '../../../_lib/credits'
import { rateLimit, getRateLimitKey, LIMITS } from '../../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300

interface SlideInput {
  index: number
  originalImage: string // base64 of template slide
  type: 'cover' | 'content' | 'data' | 'closing' | 'unknown'
  edit: {
    headline: string
    bullets: string[]
    generateImage: boolean
    imagePrompt: string
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'template-demo'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a bit before generating again.' }, { status: 429 })
  }

  const COST = CREDIT_COSTS['demo-slide']
  const credit = await checkCredits(user.id, COST)
  if (!credit.allowed) {
    return NextResponse.json({ error: `Not enough credits. Need ${COST}, have ${credit.remaining}.` }, { status: 402 })
  }
  if (!(await deductCredits(user.id, COST, 'demo-slide'))) {
    return NextResponse.json({ error: 'Failed to deduct credits.' }, { status: 402 })
  }

  try {
    const body = await request.json()
    const { slides } = body as { slides: SlideInput[] }
    if (!slides?.length) return NextResponse.json({ error: 'No slides provided' }, { status: 400 })

    // Generate AI images where requested
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const aiImages: (string | null)[] = new Array(slides.length).fill(null)

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      if (!slide.edit.generateImage || !slide.edit.imagePrompt) continue

      console.log(`[template-demo] Generating AI image for slide ${i + 1}: "${slide.edit.imagePrompt.slice(0, 50)}"`)

      try {
        // Pass original slide as reference + generate a replacement image
        const parts: any[] = [
          { text: `REFERENCE SLIDE: This is the original slide layout. Generate a NEW illustration image that fits in the image placeholder area of this slide. The image should illustrate: "${slide.edit.imagePrompt}". Style: professional, clean, modern vector illustration. NO text in the image.` },
          { inlineData: { mimeType: 'image/png', data: slide.originalImage } },
        ]

        const response = await genai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts }],
          config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } } as any,
        })

        const rParts = response.candidates?.[0]?.content?.parts ?? []
        for (const rp of rParts) {
          if (rp.inlineData) {
            aiImages[i] = rp.inlineData.data!
            console.log(`[template-demo] AI image generated for slide ${i + 1}`)
            break
          }
        }
      } catch (err: any) {
        console.error(`[template-demo] AI image failed for slide ${i + 1}:`, err.message?.slice(0, 100))
      }
    }

    // Build PPTX
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_WIDE'
    pptx.author = 'Docs2Video'
    pptx.title = slides[0]?.edit.headline || 'Presentation'

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      const edit = slide.edit
      const pptxSlide = pptx.addSlide()

      // Use AI-generated image as background, or fall back to original template slide
      const bgImage = aiImages[i] || slide.originalImage
      pptxSlide.addImage({
        data: `image/png;base64,${bgImage}`,
        x: 0, y: 0, w: '100%', h: '100%',
      })

      // Add editable text overlay — headline
      if (edit.headline) {
        const isTitle = slide.type === 'cover' || slide.type === 'closing'
        pptxSlide.addText(edit.headline, {
          x: 0.5,
          y: isTitle ? 2.5 : 0.4,
          w: 8,
          h: isTitle ? 1.5 : 0.8,
          fontSize: isTitle ? 36 : 24,
          fontFace: 'Arial',
          color: '1B365D',
          bold: true,
          valign: isTitle ? 'middle' : 'top',
          align: isTitle ? 'center' : 'left',
        })
      }

      // Add bullets
      if (edit.bullets?.length > 0) {
        const bulletText = edit.bullets
          .filter(b => b.trim())
          .map(b => ({ text: b, options: { bullet: true, fontSize: 16, color: '333333', breakLine: true } }))

        if (bulletText.length > 0) {
          pptxSlide.addText(bulletText as any, {
            x: 0.5,
            y: 1.5,
            w: 7,
            h: 4,
            fontFace: 'Arial',
            valign: 'top',
          })
        }
      }
    }

    // Generate PPTX buffer
    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer

    // Upload to Supabase storage
    const admin = createAdminClient()
    const fileName = `template-demo-${Date.now()}.pptx`
    const storagePath = `${user.id}/template-demos/${fileName}`

    const { error: uploadErr } = await admin.storage
      .from('brand-assets')
      .upload(storagePath, pptxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        upsert: true,
      })

    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

    const { data: urlData } = admin.storage.from('brand-assets').getPublicUrl(storagePath)

    console.log(`[template-demo] Generated PPTX: ${slides.length} slides, ${Math.round(pptxBuffer.length / 1024)}KB`)
    return NextResponse.json({ downloadUrl: urlData.publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    console.error('[template-demo/generate] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
