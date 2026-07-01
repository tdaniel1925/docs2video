import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../../_lib/supabase/admin'
import { requireAdmin } from '../../../../../_lib/admin'
export const maxDuration = 300

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { contactId, action } = body as { contactId: string; action: 'approve' | 'skip' | 'regenerate' | 'retry' }

  if (!contactId || !action) {
    return NextResponse.json({ error: 'contactId and action are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify contact belongs to campaign
  const { data: contact } = await admin
    .from('campaign_contacts')
    .select('*')
    .eq('id', contactId)
    .eq('campaign_id', id)
    .single()

  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  if (action === 'approve') {
    await admin.from('campaign_contacts').update({ video_status: 'approved' }).eq('id', contactId)
  } else if (action === 'skip') {
    await admin.from('campaign_contacts').update({ video_status: 'skipped' }).eq('id', contactId)
  } else if (action === 'regenerate' || action === 'retry') {
    // Reset to pending so it can be regenerated (retry == same path for a failed one).
    await admin.from('campaign_contacts').update({ video_status: 'pending', video_id: null }).eq('id', contactId)
  }

  return NextResponse.json({ ok: true, status: (action === 'regenerate' || action === 'retry') ? 'pending' : action === 'approve' ? 'approved' : 'skipped' })
}
