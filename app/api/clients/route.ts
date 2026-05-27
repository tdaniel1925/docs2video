import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const url = new URL(req.url)
  const search = url.searchParams.get('search') ?? ''
  const status = url.searchParams.get('status') ?? ''
  const sort = url.searchParams.get('sort') ?? 'last_activity_at'
  const order = url.searchParams.get('order') ?? 'desc'

  let query = admin
    .from('clients')
    .select('*')
    .eq('user_id', user.id)

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const sortCol = ['name', 'last_activity_at', 'created_at', 'total_videos_sent', 'total_views'].includes(sort)
    ? sort
    : 'last_activity_at'

  query = query.order(sortCol, { ascending: order === 'asc', nullsFirst: false })

  const { data: clients, error } = await query

  if (error) {
    console.error('[clients GET]', error)
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 })
  }

  // Get recent activity counts (last 7 days) for each client
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const clientIds = (clients ?? []).map(c => c.id)

  let activityCounts: Record<string, number> = {}
  if (clientIds.length > 0) {
    const { data: activities } = await admin
      .from('client_activities')
      .select('client_id')
      .in('client_id', clientIds)
      .gte('created_at', sevenDaysAgo)

    if (activities) {
      for (const a of activities) {
        activityCounts[a.client_id] = (activityCounts[a.client_id] ?? 0) + 1
      }
    }
  }

  const enriched = (clients ?? []).map(c => ({
    ...c,
    recent_activity_count: activityCounts[c.id] ?? 0,
  }))

  return NextResponse.json({ clients: enriched })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const body = await req.json()
  const { name, email, company, phone, industry, tags, notes } = body

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // Check duplicate by email
  if (email) {
    const { data: existing } = await admin
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('email', email.toLowerCase().trim())
      .single()

    if (existing) {
      return NextResponse.json({ error: 'A client with this email already exists', existingId: existing.id }, { status: 409 })
    }
  }

  const now = new Date().toISOString()
  const { data: client, error } = await admin
    .from('clients')
    .insert({
      user_id: user.id,
      name: name.trim(),
      email: email?.toLowerCase().trim() || null,
      company: company?.trim() || null,
      phone: phone?.trim() || null,
      industry: industry?.trim() || null,
      tags: tags ?? [],
      notes: notes?.trim() || null,
      source: 'manual',
      status: 'lead',
      first_contact_at: now,
      last_activity_at: now,
    })
    .select()
    .single()

  if (error) {
    console.error('[clients POST]', error)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }

  // Log client_created activity
  await admin.from('client_activities').insert({
    client_id: client.id,
    user_id: user.id,
    type: 'client_created',
    title: 'Client created',
    description: `${client.name} was added as a new client`,
    metadata: { source: 'manual' },
  })

  return NextResponse.json({ client }, { status: 201 })
}
