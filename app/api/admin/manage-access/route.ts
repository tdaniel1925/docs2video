import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin } from '../../../_lib/admin'
import { logAdminAction } from '../../../_lib/audit'
export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { userId, field, value } = await request.json() as {
    userId: string
    field: 'is_admin' | 'is_beta'
    value: boolean
  }

  if (!userId || !field || !['is_admin', 'is_beta'].includes(field)) {
    return NextResponse.json({ error: 'userId, field (is_admin|is_beta), and value are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    const { error } = await admin
      .from('profiles')
      .update({ [field]: value })
      .eq('id', userId)

    if (error) throw error

    await logAdminAction(user.id, `set_${field}`, userId, { field, value })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/manage-access] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
