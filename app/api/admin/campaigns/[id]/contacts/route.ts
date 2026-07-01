import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../../_lib/supabase/admin'
import { requireAdmin } from '../../../../../_lib/admin'
export const maxDuration = 300

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('campaign_contacts')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { contacts, name, email, company, industry, phone } = body as {
    contacts?: string // bulk text: name, email, company, industry per line
    name?: string
    email?: string
    company?: string
    industry?: string
    phone?: string
  }

  const admin = createAdminClient()

  // Verify campaign exists
  const { data: campaign } = await admin.from('campaigns').select('id').eq('id', id).single()
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const toInsert: { campaign_id: string; name: string; email: string; company?: string; industry?: string; phone?: string }[] = []

  if (contacts) {
    // Bulk parse: each line is "name, email, company, industry"
    const lines = contacts.split('\n').map(l => l.trim()).filter(Boolean)
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim())
      if (parts.length >= 2 && parts[0] && parts[1]) {
        toInsert.push({
          campaign_id: id,
          name: parts[0],
          email: parts[1],
          company: parts[2] || undefined,
          industry: parts[3] || undefined,
        })
      }
    }
  } else if (name && email) {
    toInsert.push({
      campaign_id: id,
      name: name.trim(),
      email: email.trim(),
      company: company?.trim() || undefined,
      industry: industry?.trim() || undefined,
      phone: phone?.trim() || undefined,
    })
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ error: 'No valid contacts provided' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('campaign_contacts')
    .upsert(toInsert, { onConflict: 'campaign_id,email' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ added: data?.length ?? 0, contacts: data ?? [] })
}
