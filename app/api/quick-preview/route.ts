import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { generateScript } from '../../_lib/script-generator'
import { generateSlide } from '../../_lib/gemini'
import type { ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Quick Preview API
 * Generates only a 3-scene script + 3 slides for fast preview.
 * Free — no credits deducted.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const {
    policyData,
    brandId,
    styleId,
    purpose,
    industry,
    detailLevel,
    narrationStyle,
    voiceId,
    customStylePrompt,
  } = body as {
    policyData: ExtractedPolicyData | ExtractedData
    brandId?: string | null
    styleId?: string
    purpose?: string
    industry?: string
    detailLevel?: 'quick' | 'standard' | 'detailed'
    narrationStyle?: 'solo' | 'podcast'
    voiceId?: string
    customStylePrompt?: string
  }

  if (!policyData) {
    return NextResponse.json({ error: 'Missing policyData' }, { status: 400 })
  }

  // Resolve brand info
  let brandName: string | null = null
  let brandTone: string | undefined
  let logoUrl: string | null = null
  let colors = { primary: '#1B365D', secondary: '#4A90D9', accent: '#FFB347', background: '#0a1628', text: '#FFFFFF' }

  if (brandId) {
    // Scope to owner (review S3): brands RLS may be off in prod — never fetch by bare id.
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).eq('user_id', user.id).single()
    if (brand) {
      brandName = brand.name
      brandTone = (brand as any).tone ?? undefined
      logoUrl = brand.logo_file_url ?? brand.logo_url ?? null
      colors = {
        primary: brand.primary_color,
        secondary: brand.secondary_color,
        accent: brand.accent_color,
        background: brand.background_color,
        text: brand.text_color,
      }
    }
  }

  try {
    // 1. Generate FULL script then slice to first 3 scenes
    const allScenes = await generateScript(
      policyData,
      brandName,
      colors,
      false, // not detailed — keep it quick
      0,
      voiceId,
      brandTone,
      undefined,
      purpose,
      undefined,
      industry,
      'quick', // always quick for preview
      narrationStyle,
    )

    const previewScenes = allScenes.slice(0, 3)

    // 2. Generate 3 slides in parallel
    const effectiveStyleId = (styleId || 'luxury') as any
    const slidePromises = previewScenes.map((scene, i) =>
      generateSlide(
        policyData,
        i,
        effectiveStyleId,
        brandName,
        logoUrl,
        colors,
        scene.slidePrompt,
        false,
        undefined,
        null,
        undefined,
        previewScenes.length,
        customStylePrompt,
      )
        .then(buf => `data:image/png;base64,${buf.toString('base64')}`)
        .catch(() => null)
    )

    const slides = await Promise.all(slidePromises)

    return NextResponse.json({
      scenes: previewScenes,
      slides, // base64 data URIs (or null for failures)
      totalScenes: allScenes.length,
      allScenes, // return full script so user can approve and skip re-generation
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Preview generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
