import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { safeHttpsUrl } from '../../../../_lib/client-email'

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
  // NOTE: do NOT add columns that may not exist in every environment — a single
  // missing column 400s the whole query and 404s EVERY share link. 'scene_count'
  // was removed for exactly this reason (column absent in prod → all links dead).
  // NOTE: allow_source_download / source_pdf_* / agent_note / recipient_name were
  // added by migration 20260716_share_page_options.sql — that MUST be applied in
  // prod before this line ships, or the whole select 400s and 404s every link.
  //
  // REVIEWED AGAIN (audit 2026-09-26): the share page reads none of the brand
  // row and none of the infographic row, yet both were joined in — including
  // the extracted policy_data (the client's policy details) and the full brand
  // guide. Both joins are gone. user_id is needed here to find the agent, but
  // is removed before the response goes out.
  const VIDEO_COLS = 'id, user_id, title, status, video_url, thumbnail_url, music_url, script, preview_thumbs, created_at, updated_at, allow_source_download, source_pdf_name, agent_note, recipient_name, output_type'
  const { data: video, error: videoErr } = await admin
    .from('videos')
    .select(VIDEO_COLS)
    .eq('id', id)
    .maybeSingle()
  if (videoErr) {
    console.error('[public/watch] query error:', videoErr.message)
  }
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // MP4 export URL — read defensively in its OWN query: if migration
  // 20260724_export_video_url hasn't run, this fails silently and the share
  // page simply shows no video-download button (never a 404).
  try {
    const { data: ex } = await admin.from('videos').select('export_video_url').eq('id', id).maybeSingle()
    if (ex?.export_video_url) (video as any).export_video_url = ex.export_video_url
  } catch { /* column not migrated yet */ }

  // A share link is "available" once the video has actually rendered (has a
  // playable URL). Don't hard-require status === 'completed' — videos that the
  // owner already shared can sit in completed/complete/review_required/ready
  // while still being fully watchable. Only block clearly-unfinished states.
  const status = String((video as any).status || '')
  const hasPlayable = !!(video as any).video_url
  const BLOCKED_STATES = ['pending', 'queued', 'scraping', 'scripting', 'generating_slides', 'generating_audio', 'assembling', 'processing', 'generating', 'draft', 'failed']
  if (!hasPlayable && BLOCKED_STATES.includes(status)) {
    return NextResponse.json({ error: 'Not ready' }, { status: 404 })
  }

  // Sanitize the script's _pipeline_input: the share page needs only the
  // disclaimer/industry/insurance flags from policyData, NOT the raw source
  // document text that the generator stashed there (audit H3).
  const script = (video as any).script
  if (script && typeof script === 'object' && script._pipeline_input) {
    const pi = script._pipeline_input
    const pd = pi.policyData || {}
    // The per-video booking / payment links ARE shown on the share page, so
    // they pass through — but only when they are real https links. The agent
    // types them, and a "javascript:" link in a button would run code in the
    // client's browser. The page checks again before drawing any button.
    const bookingUrl = safeHttpsUrl(pi.bookingUrl)
    const paymentLink = safeHttpsUrl(pi.paymentLink)
    script._pipeline_input = {
      policyData: {
        deathBenefit: pd.deathBenefit,
        industry: pd.industry,
        disclaimers: pd.disclaimers,
      },
      ...(bookingUrl ? { bookingUrl } : {}),
      ...(paymentLink ? { paymentLink } : {}),
    }
  }

  const ownerId = (video as { user_id: string }).user_id
  const [{ data: profile }, { data: quote }] = await Promise.all([
    // Only SAFE, intentionally-public profile columns — never the whole row.
    // subscription_status is read to decide branding but NOT sent out: which
    // plan an agent pays for is their business, not their client's.
    admin.from('profiles')
      .select('full_name, company_name, photo_url, email, phone, calendly_url, payment_link_url, subscription_status')
      .eq('id', ownerId)
      .single(),
    // No stripe_payment_intent_id — a payment reference has no place on a
    // public page.
    admin.from('quotes')
      .select('id, video_id, client_name, line_items, subtotal, tax, total, currency, status, paid_at, created_at')
      .eq('video_id', id)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const plan = String(profile?.subscription_status ?? '').toLowerCase()
  const agent = profile ? {
    full_name: profile.full_name,
    company_name: profile.company_name,
    photo_url: profile.photo_url,
    email: profile.email,
    phone: profile.phone,
    // Same rule for the agent's saved links: https only, or nothing.
    calendly_url: safeHttpsUrl(profile.calendly_url) || null,
    payment_link_url: safeHttpsUrl(profile.payment_link_url) || null,
    white_label: WHITELABEL_PLANS.includes(plan),
    free_tier: !PAID_PLANS.includes(plan),
  } : null

  const { user_id: _omit, ...publicVideo } = video as Record<string, unknown>
  void _omit
  return NextResponse.json({ video: publicVideo, agent, quote: quote ?? null })
}

// Same lists the share page used when it received the raw plan.
const WHITELABEL_PLANS = ['enterprise', 'business']
const PAID_PLANS = ['active', 'professional', 'pro', 'business', 'enterprise', 'starter']
