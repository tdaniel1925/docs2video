import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()

  const { data: clients, error } = await admin
    .from('clients')
    .select('name, email, company, phone, industry, status, tags, total_videos_sent, total_views, created_at')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }

  const header = 'Name,Email,Company,Phone,Industry,Status,Tags,Videos Sent,Total Views,Created'
  const rows = (clients ?? []).map(c => {
    const tags = (c.tags ?? []).join('; ')
    return [
      csvEscape(c.name),
      csvEscape(c.email ?? ''),
      csvEscape(c.company ?? ''),
      csvEscape(c.phone ?? ''),
      csvEscape(c.industry ?? ''),
      csvEscape(c.status ?? ''),
      csvEscape(tags),
      c.total_videos_sent ?? 0,
      c.total_views ?? 0,
      c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : '',
    ].join(',')
  })

  const csv = [header, ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="clients-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}
