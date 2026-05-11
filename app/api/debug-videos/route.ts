import { NextResponse } from 'next/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export async function GET() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('videos')
    .select('id, status, error_message, created_at, title')
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json(data)
}
