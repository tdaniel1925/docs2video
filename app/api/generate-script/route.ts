import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { generateScript } from '../../_lib/script-generator'
import type { ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
// Script generation makes chained Claude calls that can run for minutes — longer
// than Vercel's ~60s synchronous-RESPONSE gateway limit (which 504s the browser
// even though the function itself keeps running). So for the wizard path we run
// it in the BACKGROUND via waitUntil, return immediately, write the scenes to
// the draft on completion, and the page polls the draft. maxDuration covers the
// background work, not the response.
export const maxDuration = 800

interface ScriptBody {
  videoId?: string
  policyData: ExtractedPolicyData | ExtractedData
  brandId: string | null
  detailed?: boolean
  detailLevel?: 'quick' | 'standard' | 'detailed'
  narrationStyle?: 'solo' | 'podcast'
  voiceId?: string
  contactInfo?: { phone?: string; email?: string; calendly?: string }
  purpose?: string
  uploadMode?: string
  industry?: string
  classification?: any
}

// Resolve brand details (shared by both paths).
async function resolveBrand(supabase: any, brandId: string | null) {
  let brandName: string | null = null
  let brandTone: string | undefined
  let colors = { primary: '#1B365D', secondary: '#4A90D9', accent: '#FFB347', background: '#0a1628', text: '#FFFFFF' }
  if (brandId) {
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()
    if (brand) {
      brandName = brand.name
      brandTone = (brand as any).tone ?? undefined
      colors = {
        primary: brand.primary_color, secondary: brand.secondary_color, accent: brand.accent_color,
        background: brand.background_color, text: brand.text_color,
      }
    }
  }
  return { brandName, brandTone, colors }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json() as ScriptBody
  const { videoId, policyData, brandId, detailed, detailLevel, narrationStyle, voiceId, contactInfo, purpose, uploadMode, industry, classification } = body
  const { brandName, brandTone, colors } = await resolveBrand(supabase, brandId)
  const classificationData = classification ?? (policyData as any)?.classification ?? null

  // ── BACKGROUND path (wizard: we have a draft row to write results to) ──
  // Returns immediately so the browser never hits the ~60s response timeout;
  // the script page polls the draft for draft_data.scriptStatus + scenes.
  if (videoId) {
    const admin = createAdminClient()
    // Mark generating so the page shows progress and we can detect failure.
    const { data: row } = await admin.from('videos').select('draft_data').eq('id', videoId).eq('user_id', user.id).single()
    if (!row) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    // The user-approved brief (from the Review step) steers what the script covers.
    const approvedBrief = (row.draft_data as any)?.brief || null
    await admin.from('videos').update({
      draft_data: { ...(row.draft_data || {}), scriptStatus: 'generating', scriptError: null },
    }).eq('id', videoId)

    waitUntil((async () => {
      try {
        console.log(`[generate-script:bg ${videoId}] Starting: industry=${industry}, detailLevel=${detailLevel}`)
        // Race against a timeout so a long/hung Claude chain fails INSIDE this
        // function (so the catch writes scriptStatus:'failed') instead of the
        // Vercel function being killed and the draft stuck on 'generating' forever.
        const scenes = await Promise.race([
          generateScript(policyData, brandName, colors, detailed ?? false, 0, voiceId, brandTone, contactInfo, purpose, uploadMode, industry, detailLevel, narrationStyle, classificationData, approvedBrief),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Script generation timed out. Please try again.')), 240000)),
        ])
        console.log(`[generate-script:bg ${videoId}] Done: ${scenes.length} scenes`)
        const { data: cur } = await admin.from('videos').select('draft_data').eq('id', videoId).single()
        await admin.from('videos').update({
          draft_data: { ...(cur?.draft_data || {}), scenes, detailLevel, narrationStyle, scriptStatus: 'ready', scriptError: null },
        }).eq('id', videoId)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Script generation failed'
        console.error(`[generate-script:bg ${videoId}] CRASH: ${message}`)
        const { data: cur } = await admin.from('videos').select('draft_data').eq('id', videoId).single()
        await admin.from('videos').update({
          draft_data: { ...(cur?.draft_data || {}), scriptStatus: 'failed', scriptError: message },
        }).eq('id', videoId)
      }
    })())

    return NextResponse.json({ status: 'generating' }, { status: 202 })
  }

  // ── SYNCHRONOUS path (legacy non-wizard / localStorage flow) ──
  // No videoId here, so there is no draft row and no approved brief to honor —
  // this flow predates the Review step. Brief steering happens on the wizard
  // (background) path above and in generate-video.
  try {
    const scenes = await generateScript(policyData, brandName, colors, detailed ?? false, 0, voiceId, brandTone, contactInfo, purpose, uploadMode, industry, detailLevel, narrationStyle, classificationData)
    return NextResponse.json({ scenes })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Script generation failed'
    console.error(`[generate-script] CRASH: ${message}`)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
