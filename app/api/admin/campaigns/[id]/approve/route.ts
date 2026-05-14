import { NextResponse } from 'next/server'
import { createClient } from '../../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../../_lib/supabase/admin'
import { isAdmin } from '../../../../../_lib/admin'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) return null
  return user
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { contactId, action } = body as { contactId: string; action: 'approve' | 'skip' | 'regenerate' }

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
  } else if (action === 'regenerate') {
    // Reset to pending so it can be regenerated
    await admin.from('campaign_contacts').update({ video_status: 'pending', video_id: null }).eq('id', contactId)
  }

  return NextResponse.json({ ok: true, status: action === 'regenerate' ? 'pending' : action === 'approve' ? 'approved' : 'skipped' })
}
