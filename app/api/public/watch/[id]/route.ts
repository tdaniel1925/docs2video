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

  const { data: video } = await admin
    .from('videos')
    .select('*, brand:brands(*), infographic:infographics(policy_data, source_pdf_url)')
    .eq('id', id)
    .eq('status', 'completed')
    .single()
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: agent }, { data: quote }] = await Promise.all([
    // Only SAFE, intentionally-public profile columns — never the whole row.
    admin.from('profiles')
      .select('id, full_name, company_name, photo_url, email, phone, calendly_url, stripe_user_id, subscription_status')
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
