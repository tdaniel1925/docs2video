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
  try {
    await createAdminClient().from('campaign_contacts').update({ unsubscribed: true }).eq('id', id)
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
