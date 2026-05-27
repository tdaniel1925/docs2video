import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'

export const maxDuration = 30

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await context.params
  const admin = createAdminClient()

  // Verify ownership
  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const { data: activities, error } = await admin
    .from('client_activities')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[activities GET]', error)
    return NextResponse.json({ error: 'Failed to load activities' }, { status: 500 })
  }

  return NextResponse.json({ activities: activities ?? [] })
}

export async function POST(req: NextRequest, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await context.params
  const admin = createAdminClient()

  // Verify ownership
  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const body = await req.json()
  const { title, description } = body

  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data: activity, error } = await admin
    .from('client_activities')
    .insert({
      client_id: id,
      user_id: user.id,
      type: 'note_added',
      title: title.trim(),
      description: description?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[activities POST]', error)
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 })
  }

  // Update last_activity_at on client
  await admin
    .from('clients')
    .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ activity }, { status: 201 })
}
