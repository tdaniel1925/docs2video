import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { generateScript } from '../../_lib/script-generator'
import type { ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const { policyData, brandId, detailed, detailLevel, voiceId, contactInfo, purpose, uploadMode, industry } = body as {
    policyData: ExtractedPolicyData | ExtractedData
    brandId: string | null
    detailed?: boolean
    detailLevel?: 'quick' | 'standard' | 'detailed'
    voiceId?: string
    contactInfo?: { phone?: string; email?: string; calendly?: string }
    purpose?: string
    uploadMode?: string
    industry?: string
  }

  let brandName: string | null = null
  let brandTone: string | undefined
  let colors = { primary: '#1B365D', secondary: '#4A90D9', accent: '#FFB347', background: '#0a1628', text: '#FFFFFF' }

  if (brandId) {
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()
    if (brand) {
      brandName = brand.name
      brandTone = (brand as any).tone ?? undefined
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
    const scenes = await generateScript(policyData, brandName, colors, detailed ?? false, 0, voiceId, brandTone, contactInfo, purpose, uploadMode, industry, detailLevel)
    return NextResponse.json({ scenes })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Script generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
