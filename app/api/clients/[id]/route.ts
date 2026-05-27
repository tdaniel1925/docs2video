import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const maxDuration = 30

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await context.params
  const admin = createAdminClient()

  const { data: client, error } = await admin
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Get last 10 activities
  const { data: activities } = await admin
    .from('client_activities')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Video count
  const { count: videoCount } = await admin
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', id)

  // Email count
  const emailCount = client.email
    ? (await admin
        .from('sent_emails')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('to_email', client.email)
      ).count ?? 0
    : 0

  return NextResponse.json({
    client,
    activities: activities ?? [],
    videoCount: videoCount ?? 0,
    emailCount,
  })
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await context.params
  const admin = createAdminClient()
  const body = await req.json()

  // Verify ownership
  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const allowed = ['name', 'email', 'company', 'phone', 'industry', 'tags', 'notes', 'status']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) {
      if (key === 'email' && body.email) {
        updates.email = body.email.toLowerCase().trim()
      } else if (key === 'name' && body.name) {
        updates.name = body.name.trim()
      } else {
        updates[key] = body[key]
      }
    }
  }

  const { data: client, error } = await admin
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[clients PATCH]', error)
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
  }

  return NextResponse.json({ client })
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await context.params
  const admin = createAdminClient()

  // Verify ownership
  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const { error } = await admin
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[clients DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
