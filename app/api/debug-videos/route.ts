import { NextResponse } from 'next/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { requireAdmin } from '../../_lib/admin'
export const maxDuration = 30

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('videos')
    .select('id, status, error_message, created_at, title')
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json(data)
}
