import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { deductCredits, checkCredits, CREDIT_COSTS } from '../../_lib/credits'
import { generatePptx } from '../../_lib/pptx-generator'
import type { DeckSlide } from '../../_lib/pptx-generator'
import { sendNotification, createJob, updateJobProgress } from '../../_lib/notify'
import { buildSimpleSlidePrompt, getStylePrompt } from '../../_lib/slide-engine/simple-prompt'
import type { SimpleSlideInput } from '../../_lib/slide-engine/simple-prompt'
import { generateSlideFromPrompt } from '../../_lib/gemini'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 600

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const {
    title,
    slides: slideSpecs,
    brandId,
    primaryColor,
    secondaryColor,
    accentColor,
    styleId,
  } = body as {
    title: string
    slides: { headline: string; subheadline?: string; bodyPoints: string[]; stats?: { value: string; label: string }[]; slideType: 'cover' | 'content' | 'data' | 'quote' | 'closing' }[]
    brandId?: string
    primaryColor?: string
    secondaryColor?: string
    accentColor?: string
    styleId?: string
  }

  if (!slideSpecs?.length) {
    return NextResponse.json({ error: 'No slides provided' }, { status: 400 })
  }
  if (slideSpecs.length > 25) {
    return NextResponse.json({ error: 'Decks are limited to 25 slides.' }, { status: 400 })
  }

  // Credit check — deduction happens after successful generation
  const DECK_COST = CREDIT_COSTS.deck
  const admin = createAdminClient()
  const creditCheck = await checkCredits(user.id, DECK_COST)
  if (!creditCheck.allowed) {
    return NextResponse.json(
      { error: `Not enough credits. A deck costs ${DECK_COST} credits, you have ${creditCheck.remaining}.` },
      { status: 402 }
    )
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

    // Generate slide images with Gemini — all slides in parallel
    const stylePrompt = getStylePrompt(styleId || 'executive')
    let completed = 0

    const deckSlides: DeckSlide[] = await Promise.all(slideSpecs.map(async (spec, i) => {
      const isFirst = i === 0
      const isLast = i === slideSpecs.length - 1

      const input: SimpleSlideInput = {
        type: isFirst ? 'cover' : isLast ? 'closing' : 'content',
        stylePrompt,
        headline: spec.headline,
        subtitle: spec.subheadline,
        brandName: brand?.name,
        brandColors: { primary: colors.primary, secondary: colors.secondary },
        stats: spec.stats,
        bullets: spec.bodyPoints?.map((b: string) => ({ text: b })),
        contactInfo: isLast ? contactInfo : undefined,
        pageNumber: i + 1,
        totalPages: slideSpecs.length,
      }

      let backgroundImage: Buffer
      try {
        const buf = await generateSlideFromPrompt(buildSimpleSlidePrompt(input))
        if (!buf) throw new Error('No image returned')
        backgroundImage = buf
      } catch (err) {
        console.error(`[deck] Slide ${i + 1} failed:`, err)
        const sharpMod = await import('sharp')
        const sharp = sharpMod.default ?? sharpMod
        backgroundImage = await sharp({
          create: {
            width: 1920, height: 1080, channels: 4,
            background: { r: 240, g: 244, b: 248, alpha: 1 },
          },
        }).png().toBuffer()
      }

      completed++
      if (jobId) await updateJobProgress(admin, jobId, 10 + Math.round((completed / slideSpecs.length) * 70), 'running')
      console.log(`[deck] Slide ${completed}/${slideSpecs.length} done`)
      return { ...spec, backgroundImage }
    }))

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

    // Deduct credits (admin/beta bypass handled inside deductCredits)
    const deducted = await deductCredits(user.id, DECK_COST, 'deck_generation')
    if (!deducted) console.error(`[deck] Credit deduction failed for user ${user.id} after successful generation`)

    // Log creation
    await admin.from('creations').insert({
      user_id: user.id,
      type: 'deck',
      title: `Deck: ${title}`,
      file_url: urlData.publicUrl,
      credits_used: DECK_COST,
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
