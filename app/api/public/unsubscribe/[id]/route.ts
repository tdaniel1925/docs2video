import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * POST /api/public/unsubscribe/{contactId}
 * Public unsubscribe — sets campaign_contacts.unsubscribed via the service role
 * (anon can no longer write this table after the RLS fix). Scoped to the one id;
 * returns ok even if not found to avoid leaking which ids exist.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return NextResponse.json({ ok: true })
  const admin = createAdminClient()

  // Look up the owning agent so the page can brand to them (not us).
  let brand: { name: string | null } | null = null
  try {
    const { data: contact } = await admin
      .from('campaign_contacts')
      .select('campaign_id')
      .eq('id', id)
      .single()
    if (contact?.campaign_id) {
      const { data: campaign } = await admin
        .from('campaigns')
        .select('user_id')
        .eq('id', contact.campaign_id)
        .single()
      if (campaign?.user_id) {
        const { data: profile } = await admin
          .from('profiles')
          .select('full_name, company_name')
          .eq('id', campaign.user_id)
          .single()
        if (profile) brand = { name: profile.company_name || profile.full_name || null }
      }
    }
  } catch {
    // Non-fatal — fall back to a neutral, unbranded page.
  }

  try {
    await admin.from('campaign_contacts').update({ unsubscribed: true }).eq('id', id)
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  return NextResponse.json({ ok: true, brand })
}
