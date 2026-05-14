import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { isAdmin } from '../../_lib/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('videos')
    .select('id, status, error_message, created_at, title')
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json(data)
}
