import { NextResponse } from 'next/server'
import { VIDEO_WORKING } from '../../_lib/video-status'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { INFOGRAPHIC_WIDTH, INFOGRAPHIC_HEIGHT } from '../../_lib/constants'
import { generateInfographicImage } from '../../_lib/gemini'
import type { Brand, ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'
import { CREDIT_COSTS } from '../../_lib/credits'
import { runCharged } from '../../_lib/credit-charge'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const { policyData, brandId, pdfName, pageSize } = body as {
    policyData: ExtractedPolicyData | ExtractedData
    brandId: string | null
    pdfName: string
    pageSize: 'portrait' | 'landscape'
  }

  // Fetch brand if provided
  let brand: Brand | null = null
  if (brandId) {
    // Scope to owner (review S3): brands RLS may be off in prod — never fetch by bare id.
    const { data } = await supabase.from('brands').select('*').eq('id', brandId).eq('user_id', user.id).single()
    brand = data as Brand | null
  }

  const colors = {
    primary: brand?.primary_color ?? '#1B365D',
    secondary: brand?.secondary_color ?? '#4A90D9',
    accent: brand?.accent_color ?? '#FFB347',
    background: brand?.background_color ?? '#0a1628',
    text: brand?.text_color ?? '#FFFFFF',
  }

  // Charge BEFORE generating (this used to deduct AFTER the image was made
  // and ignore a failed deduction — a free infographic) and refund on any
  // failure (audit H5).
  return runCharged({ userId: user.id, amount: CREDIT_COSTS.infographic, action: 'infographic' }, async () => {
  // Create infographic record
  const { data: infographic, error: insertError } = await supabase
    .from('infographics')
    .insert({
      user_id: user.id,
      brand_id: brandId,
      title: 'deathBenefit' in policyData
        ? `${(policyData as ExtractedPolicyData).carrier} - ${(policyData as ExtractedPolicyData).policyType}`
        : (policyData as ExtractedData).title,
      source_pdf_name: pdfName,
      status: VIDEO_WORKING,
      image_size: `${INFOGRAPHIC_WIDTH}x${INFOGRAPHIC_HEIGHT}`,
      policy_data: policyData,
    })
    .select()
    .single()

  if (insertError || !infographic) {
    console.error('[generate] Could not create infographic record:', insertError?.message)
    return NextResponse.json({ error: 'Could not start the infographic. Please try again.' }, { status: 500 })
  }

  try {
    // Generate infographic image using Gemini 3 native image generation
    const pngBuffer = await generateInfographicImage(policyData, brand?.name ?? null, colors, pageSize ?? 'portrait')

    // Upload to Supabase Storage
    const admin = createAdminClient()
    const storagePath = `${user.id}/${infographic.id}.png`
    const { error: uploadError } = await admin.storage
      .from('infographics')
      .upload(storagePath, pngBuffer, { contentType: 'image/png', upsert: true })

    if (uploadError) throw uploadError

    const { data: publicUrl } = admin.storage.from('infographics').getPublicUrl(storagePath)

    // Update record
    await admin
      .from('infographics')
      .update({ image_url: publicUrl.publicUrl, status: 'completed' })
      .eq('id', infographic.id)

    return NextResponse.json({ id: infographic.id, image_url: publicUrl.publicUrl })
  } catch (err) {
    console.error('[generate] Error:', err)
    const admin = createAdminClient()
    const message = err instanceof Error ? err.message : 'Generation failed'
    await admin
      .from('infographics')
      .update({ status: 'failed', error_message: message })
      .eq('id', infographic.id)

    return NextResponse.json({ error: 'Generation failed. Your credits were returned — please try again.' }, { status: 500 })
  }
  })
}
