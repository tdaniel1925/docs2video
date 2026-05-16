import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { GoogleGenAI } from '@google/genai'
import { deductCredits } from '../../_lib/credits'
import { generatePptx, buildBackgroundPrompt } from '../../_lib/pptx-generator'
import type { DeckSlide, DeckOptions } from '../../_lib/pptx-generator'
import { sendNotification, createJob, updateJobProgress } from '../../_lib/notify'

export const runtime = 'nodejs'
export const maxDuration = 600

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const {
    title,
    slides: slideSpecs,
    brandId,
    primaryColor,
    secondaryColor,
    accentColor,
    referenceImage,
  } = body as {
    title: string
    slides: { headline: string; subheadline?: string; bodyPoints: string[]; stats?: { value: string; label: string }[]; slideType: 'cover' | 'content' | 'data' | 'quote' | 'closing' }[]
    brandId?: string
    primaryColor?: string
    secondaryColor?: string
    accentColor?: string
    referenceImage?: string
  }

  if (!slideSpecs?.length) {
    return NextResponse.json({ error: 'No slides provided' }, { status: 400 })
  }

  // Credit check: 2 credits per deck (skip for admin/beta)
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin, is_beta, credits_remaining').eq('id', user.id).single()
  if (!profile?.is_admin && !profile?.is_beta && (!profile || profile.credits_remaining < 2)) {
    return NextResponse.json({ error: 'Insufficient credits. Need 2 credits for a deck.' }, { status: 403 })
  }

  // Load brand if selected
  let brand: any = null
  if (brandId) {
    const { data } = await supabase.from('brands').select('*').eq('id', brandId).single()
    brand = data
  }

  const colors = {
    primary: primaryColor ?? brand?.primary_color ?? '#1B365D',
    secondary: secondaryColor ?? brand?.secondary_color ?? '#4A90D9',
    accent: accentColor ?? brand?.accent_color ?? '#FFB347',
    text: brand?.text_color ?? '#FFFFFF',
  }

  // Load logo
  let logoBuffer: Buffer | null = null
  const logoUrl = brand?.logo_file_url ?? brand?.logo_url ?? null
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
      if (res.ok) logoBuffer = Buffer.from(await res.arrayBuffer())
    } catch { /* skip */ }
  }

  const guideData = brand?.brand_guide_data as Record<string, string> | null
  const contactInfo = {
    phone: guideData?.phone ?? '',
    website: guideData?.website ?? '',
  }

  // Create job tracker
  const jobId = await createJob(admin, user.id, {
    type: 'deck',
    title: `Deck: ${title}`,
    metadata: { slideCount: slideSpecs.length },
  })

  try {
    if (jobId) await updateJobProgress(admin, jobId, 5, 'running')

    // Generate background images for each slide
    const deckSlides: DeckSlide[] = []

    for (let i = 0; i < slideSpecs.length; i++) {
      const spec = slideSpecs[i]
      const progress = 10 + Math.round((i / slideSpecs.length) * 70)
      if (jobId) await updateJobProgress(admin, jobId, progress, 'running')

      console.log(`[deck] Generating background ${i + 1}/${slideSpecs.length}...`)

      const prompt = buildBackgroundPrompt(
        spec.slideType,
        spec.headline,
        colors.primary,
        colors.secondary,
        colors.accent,
        referenceImage,
      )

      const parts: any[] = [{ text: prompt }]
      if (referenceImage) {
        const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/)
        if (match) {
          parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
        }
      }

      try {
        const response = await genai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts }],
          config: {
            responseFormat: {
              image: { aspectRatio: '16:9', imageSize: '4K' },
            },
          } as any,
        })

        const responseParts = response.candidates?.[0]?.content?.parts ?? []
        let bgBuffer: Buffer | null = null
        for (const rp of responseParts) {
          if (rp.inlineData) {
            bgBuffer = Buffer.from(rp.inlineData.data!, 'base64')
            break
          }
        }

        if (!bgBuffer) throw new Error('No image returned')

        deckSlides.push({
          ...spec,
          backgroundImage: bgBuffer,
        })
      } catch (err) {
        console.error(`[deck] Background ${i + 1} failed:`, err)
        // Create a simple colored background fallback
        const sharpMod = await import('sharp')
        const sharp = sharpMod.default ?? sharpMod
        const fallbackBg = await sharp({
          create: {
            width: 1920, height: 1080, channels: 4,
            background: { r: 240, g: 244, b: 248, alpha: 1 },
          },
        }).png().toBuffer()
        deckSlides.push({ ...spec, backgroundImage: fallbackBg })
      }
    }

    if (jobId) await updateJobProgress(admin, jobId, 85, 'running')
    console.log(`[deck] Generating PPTX...`)

    // Generate the PPTX
    const pptxBuffer = await generatePptx(deckSlides, {
      brandName: brand?.name ?? title,
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      accentColor: colors.accent,
      textColor: colors.text,
      logoBuffer,
      contactInfo,
    })

    // Upload to Supabase Storage
    const path = `${user.id}/decks/${Date.now()}.pptx`
    await admin.storage.from('videos').upload(path, pptxBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      upsert: true,
    })
    const { data: urlData } = admin.storage.from('videos').getPublicUrl(path)

    // Deduct credits
    await deductCredits(admin, user.id, 2)

    // Log creation
    await admin.from('creations').insert({
      user_id: user.id,
      type: 'deck',
      title: `Deck: ${title}`,
      file_url: urlData.publicUrl,
      credits_used: 2,
    })

    if (jobId) await updateJobProgress(admin, jobId, 100, 'completed', { result_url: urlData.publicUrl })
    await sendNotification(admin, user.id, {
      type: 'system',
      title: 'Deck ready!',
      message: `Your presentation "${title}" is ready to download.`,
      link: urlData.publicUrl,
    })

    return NextResponse.json({
      success: true,
      downloadUrl: urlData.publicUrl,
      slideCount: deckSlides.length,
    })
  } catch (err) {
    console.error('[deck] Error:', err)
    const message = err instanceof Error ? err.message : 'Deck generation failed'
    if (jobId) await updateJobProgress(admin, jobId, 0, 'failed', { error_message: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
