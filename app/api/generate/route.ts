import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { INFOGRAPHIC_WIDTH, INFOGRAPHIC_HEIGHT } from '../../_lib/constants'
import { generateInfographicImage } from '../../_lib/gemini'
import type { Brand, ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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
    const { data } = await supabase.from('brands').select('*').eq('id', brandId).single()
    brand = data as Brand | null
  }

  const colors = {
    primary: brand?.primary_color ?? '#1B365D',
    secondary: brand?.secondary_color ?? '#4A90D9',
    accent: brand?.accent_color ?? '#FFB347',
    background: brand?.background_color ?? '#0a1628',
    text: brand?.text_color ?? '#FFFFFF',
  }

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
      status: 'processing',
      image_size: `${INFOGRAPHIC_WIDTH}x${INFOGRAPHIC_HEIGHT}`,
      policy_data: policyData,
    })
    .select()
    .single()

  if (insertError || !infographic) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to create record' }, { status: 500 })
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

    // Decrement credits
    const { data: currentProfile } = await admin
      .from('profiles')
      .select('credits_remaining')
      .eq('id', user.id)
      .single()

    if (currentProfile) {
      await admin
        .from('profiles')
        .update({ credits_remaining: Math.max(0, currentProfile.credits_remaining - 1) })
        .eq('id', user.id)
    }

    return NextResponse.json({ id: infographic.id, image_url: publicUrl.publicUrl })
  } catch (err) {
    console.error('[generate] Error:', err)
    const admin = createAdminClient()
    const message = err instanceof Error ? err.message : 'Generation failed'
    await admin
      .from('infographics')
      .update({ status: 'failed', error_message: message })
      .eq('id', infographic.id)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
