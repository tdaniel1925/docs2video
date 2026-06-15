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
    admin.from('campaigns').select('discount_code, discount_pct, discount_months').eq('id', contact.campaign_id).single(),
    contact.video_id
      ? admin.from('videos').select('id, video_url, thumbnail_url, slide_urls, music_url, title').eq('id', contact.video_id).eq('status', 'completed').single()
      : Promise.resolve({ data: null }),
  ])

  // Record the view once (server-side write — anon can no longer update).
  if (!contact.video_watched_at) {
    await admin.from('campaign_contacts').update({ video_watched_at: new Date().toISOString() }).eq('id', id)
  }

  return NextResponse.json({
    contact: { id: contact.id, name: contact.name, email: contact.email, video_id: contact.video_id },
    campaign: campaign ?? null,
    video: videoRes.data ?? null,
  })
}
