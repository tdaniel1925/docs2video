import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/public/campaign-view/{contactId}
 * Public, unauthenticated — serves a single campaign contact's video page via
 * the service-role client (campaign_contacts/campaigns are no longer readable
 * by the anon key after the RLS security fix). Returns ONLY the fields the
 * public /m/[id] page needs, scoped to the one contact id, and records the view.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()

  const { data: contact } = await admin
    .from('campaign_contacts')
    .select('id, name, email, campaign_id, video_id, video_watched_at')
    .eq('id', id)
    .single()
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: campaign }, videoRes] = await Promise.all([
    admin.from('campaigns').select('user_id, discount_code, discount_pct, discount_months').eq('id', contact.campaign_id).single(),
    contact.video_id
      ? admin.from('videos').select('id, video_url, thumbnail_url, slide_urls, music_url, title').eq('id', contact.video_id).eq('status', 'completed').single()
      : Promise.resolve({ data: null }),
  ])

  // Look up the owning agent's profile so the page can brand to them (not us).
  let agent: { full_name: string | null; company_name: string | null; photo_url: string | null; email: string | null } | null = null
  if (campaign?.user_id) {
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, company_name, photo_url, email')
      .eq('id', campaign.user_id)
      .single()
    if (profile) agent = profile
  }

  // Record the view once (server-side write — anon can no longer update).
  if (!contact.video_watched_at) {
    await admin.from('campaign_contacts').update({ video_watched_at: new Date().toISOString() }).eq('id', id)
  }

  return NextResponse.json({
    contact: { id: contact.id, name: contact.name, email: contact.email, video_id: contact.video_id },
    campaign: campaign ? { discount_code: campaign.discount_code, discount_pct: campaign.discount_pct, discount_months: campaign.discount_months } : null,
    agent,
    video: videoRes.data ?? null,
  })
}
