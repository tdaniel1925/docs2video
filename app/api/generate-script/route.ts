import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300

const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL || 'http://5.161.215.156:4000'
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const { policyData, brandId, detailed, detailLevel, narrationStyle, voiceId, contactInfo, purpose, uploadMode, industry } = body as {
    policyData: any
    brandId: string | null
    detailed?: boolean
    detailLevel?: 'quick' | 'standard' | 'detailed'
    narrationStyle?: 'solo' | 'podcast'
    voiceId?: string
    contactInfo?: { phone?: string; email?: string; calendly?: string; website?: string }
    purpose?: string
    uploadMode?: string
    industry?: string
  }

  // Brand lookup (needs Supabase — stays on Vercel)
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
    // Proxy to VPS — no timeout constraints there
    const vpsRes = await fetch(`${VIDEO_ASSEMBLY_URL}/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
      body: JSON.stringify({
        policyData,
        brandName,
        brandTone,
        colors,
        detailed: detailed ?? false,
        voiceId,
        contactInfo,
        purpose,
        uploadMode,
        industry,
        detailLevel: detailLevel || 'standard',
        narrationStyle: narrationStyle || 'solo',
      }),
      signal: AbortSignal.timeout(280000),
    })

    const data = await vpsRes.json()
    if (!vpsRes.ok) {
      return NextResponse.json({ error: data.error || 'Script generation failed' }, { status: vpsRes.status })
    }
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Script generation failed'
    if (message.includes('TimeoutError') || message.includes('aborted')) {
      return NextResponse.json({ error: 'Script generation is taking longer than expected. Please try again.' }, { status: 504 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
