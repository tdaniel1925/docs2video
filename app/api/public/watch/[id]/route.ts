import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/public/watch/{videoId}
 * Public, unauthenticated — serves the branded share page's data via the
 * service-role client so it works for logged-out recipients (the normal share
 * case) and after the quotes RLS fix. Returns the completed video (+ brand +
 * infographic), the agent's SAFE public profile fields, and the latest sent
 * quote for this video. Scoped to the one video id; returns 404 if not a
 * completed video.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()

  // Presentation-safe allowlist ONLY (audit H3). select('*') leaked draft_data
  // (recipient PII, apiWebhookUrl), script/_pipeline_input (raw source docs),
  // error_message, and the full private brand row to anyone with the UUID.
  const VIDEO_COLS = 'id, user_id, title, status, video_url, thumbnail_url, music_url, script, scene_count, preview_thumbs, created_at, updated_at'
  const BRAND_COLS = 'id, name, logo_url, logo_light_url, logo_dark_url, logo_chip, primary_color, secondary_color, accent_color, background_color, text_color, tagline, fonts, profile_type, person_role, photo_url, intro_line, show_logo, show_name_on_slides, photo_placement, brand_guide_data'
  const { data: video } = await admin
    .from('videos')
    .select(`${VIDEO_COLS}, brand:brands(${BRAND_COLS}), infographic:infographics(policy_data, source_pdf_url)`)
    .eq('id', id)
    .eq('status', 'completed')
    .single()
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Sanitize the script's _pipeline_input: the share page needs only the
  // disclaimer/industry/insurance flags from policyData, NOT the raw source
  // document text that the generator stashed there (audit H3).
  const script = (video as any).script
  if (script && typeof script === 'object' && script._pipeline_input) {
    const pd = script._pipeline_input.policyData || {}
    script._pipeline_input = {
      policyData: {
        deathBenefit: pd.deathBenefit,
        industry: pd.industry,
        disclaimers: pd.disclaimers,
      },
    }
  }

  const [{ data: agent }, { data: quote }] = await Promise.all([
    // Only SAFE, intentionally-public profile columns — never the whole row.
    admin.from('profiles')
      .select('id, full_name, company_name, photo_url, email, phone, calendly_url, payment_link_url, stripe_user_id, subscription_status')
      .eq('id', video.user_id)
      .single(),
    admin.from('quotes')
      .select('id, video_id, client_name, line_items, subtotal, tax, total, currency, status, stripe_payment_intent_id')
      .eq('video_id', id)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return NextResponse.json({ video, agent: agent ?? null, quote: quote ?? null })
}
