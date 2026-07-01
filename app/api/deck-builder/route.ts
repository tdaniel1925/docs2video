import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { sendNotification, createJob, updateJobProgress } from '../../_lib/notify'
import { analyzeTemplate } from '../../_lib/template-analyzer'
import { planDeck } from '../../_lib/deck-planner'
import { generateDeck } from '../../_lib/deck-generator'
import { checkCredits, deductCredits, costForUser } from '../../_lib/credits'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'
import { getStylePrompt } from '../../_lib/slide-engine/simple-prompt'

export const runtime = 'nodejs'
export const maxDuration = 600

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { action } = body as { action: string }
  const admin = createAdminClient()

  // ── ANALYZE TEMPLATE ─────────────────────────────────
  if (action === 'analyze-template') {
    const { templateFile } = body as { templateFile: string }
    if (!templateFile) return NextResponse.json({ error: 'No template file provided' }, { status: 400 })

    try {
      const buffer = Buffer.from(templateFile, 'base64')
      console.log(`[deck-builder] Analyzing template (${(buffer.length / 1024).toFixed(0)}KB)...`)
      const analysis = await analyzeTemplate(buffer)
      return NextResponse.json(analysis)
    } catch (err) {
      console.error('[deck-builder] Template analysis failed:', err)
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Template analysis failed' }, { status: 500 })
    }
  }

  // ── PLAN DECK ────────────────────────────────────────
  if (action === 'plan-deck') {
    const { sourceData, layouts, brandName } = body as {
      sourceData: any
      layouts: any[]
      brandName: string
    }

    if (!sourceData) return NextResponse.json({ error: 'No source data' }, { status: 400 })

    try {
      console.log(`[deck-builder] Planning deck for "${brandName}"...`)
      const plan = await planDeck(sourceData, layouts ?? [], brandName || 'Company')
      return NextResponse.json(plan)
    } catch (err) {
      console.error('[deck-builder] Deck planning failed:', err)
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Planning failed' }, { status: 500 })
    }
  }

  // ── GENERATE DECK ────────────────────────────────────
  if (action === 'generate-deck') {
    const { plan, brandId, primaryColor, secondaryColor, accentColor, templateImages, styleId } = body as {
      plan: { deckTitle: string; slides: any[] }
      brandId?: string
      primaryColor?: string
      secondaryColor?: string
      accentColor?: string
      templateImages?: string[] // base64 images
      styleId?: string
    }

    if (!plan?.slides?.length) return NextResponse.json({ error: 'No slides in plan' }, { status: 400 })
    if (plan.slides.length > 25) return NextResponse.json({ error: 'Decks are limited to 25 slides.' }, { status: 400 })

    const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
    }

    // Credit check — deduction after successful generation (admin/beta bypass
    // handled inside checkCredits/deductCredits)
    const DECK_COST = costForUser('deck', user.id) // honors grandfathered customers
    const creditCheck = await checkCredits(user.id, DECK_COST)
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: `Not enough credits. A deck costs ${DECK_COST} credits, you have ${creditCheck.remaining}.` },
        { status: 402 }
      )
    }

    // Load brand
    let brand: any = null
    if (brandId) {
      // Scope to owner (review S3): brands RLS may be off in prod — never fetch by bare id.
      const { data } = await supabase.from('brands').select('*').eq('id', brandId).eq('user_id', user.id).single()
      brand = data
    }

    const colors = {
      primary: primaryColor ?? brand?.primary_color ?? '#1B365D',
      secondary: secondaryColor ?? brand?.secondary_color ?? '#4A90D9',
      accent: accentColor ?? brand?.accent_color ?? '#FFB347',
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
    const contactInfo = { phone: guideData?.phone ?? '', website: guideData?.website ?? '' }

    // Parse template images
    const refImages = (templateImages ?? []).map(b64 => Buffer.from(b64, 'base64'))

    // Create job
    const jobId = await createJob(admin, user.id, {
      type: 'deck',
      title: `Deck: ${plan.deckTitle}`,
      metadata: { slideCount: plan.slides.length },
    })

    try {
      const pptxBuffer = await generateDeck(
        plan,
        {
          brandName: brand?.name ?? plan.deckTitle,
          primaryColor: colors.primary,
          secondaryColor: colors.secondary,
          accentColor: colors.accent,
          logoBuffer,
          contactInfo,
          templateImages: refImages.length > 0 ? refImages : undefined,
          stylePrompt: styleId ? getStylePrompt(styleId) : undefined,
        },
        async (pct) => {
          if (jobId) await updateJobProgress(admin, jobId, Math.round(pct * 0.9), 'running')
        },
      )

      // Upload PPTX
      const path = `${user.id}/decks/${Date.now()}.pptx`
      await admin.storage.from('videos').upload(path, pptxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        upsert: true,
      })
      const { data: urlData } = admin.storage.from('videos').getPublicUrl(path)

      // Deduct credits now that generation succeeded
      const deducted = await deductCredits(user.id, DECK_COST, 'deck_generation')
      if (!deducted) console.error(`[deck-builder] Credit deduction failed for user ${user.id} after successful generation`)

      // Log creation
      await admin.from('creations').insert({
        user_id: user.id,
        type: 'deck',
        title: `Deck: ${plan.deckTitle}`,
        file_url: urlData.publicUrl,
        credits_used: DECK_COST,
      })

      if (jobId) await updateJobProgress(admin, jobId, 100, 'completed', { result_url: urlData.publicUrl })
      await sendNotification(admin, user.id, {
        type: 'system',
        title: 'Deck ready!',
        message: `Your presentation "${plan.deckTitle}" is ready to download.`,
        link: urlData.publicUrl,
      })

      return NextResponse.json({ downloadUrl: urlData.publicUrl, slideCount: plan.slides.length })
    } catch (err) {
      console.error('[deck-builder] Generation failed:', err)
      if (jobId) await updateJobProgress(admin, jobId, 0, 'failed', { error_message: err instanceof Error ? err.message : 'Generation failed' })
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
