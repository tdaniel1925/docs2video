import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')
  const clientEmail = searchParams.get('clientEmail')

  let query = supabase
    .from('quotes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (videoId) {
    query = query.eq('video_id', videoId)
  }
  // Clients page Payments tab filters quotes by client (audit fix).
  if (clientEmail) {
    query = query.eq('client_email', clientEmail)
  }

  const { data: quotes, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ quotes })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = (await request.json()) as {
    videoId?: string
    clientName?: string
    clientEmail?: string
    lineItems: { description: string; amount: number }[]
    notes?: string
    tax?: number
    dueDate?: string
  }

  if (!body.lineItems || body.lineItems.length === 0) {
    return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 })
  }

  const subtotal = body.lineItems.reduce((sum, item) => sum + item.amount, 0)
  const tax = body.tax ?? 0
  const total = subtotal + tax

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      user_id: user.id,
      video_id: body.videoId ?? null,
      client_name: body.clientName ?? null,
      client_email: body.clientEmail ?? null,
      line_items: body.lineItems,
      subtotal,
      tax,
      total,
      notes: body.notes ?? null,
      due_date: body.dueDate ?? null,
      status: 'sent',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ quote })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = (await request.json()) as {
    quoteId: string
    clientName?: string
    clientEmail?: string
    lineItems?: { description: string; amount: number }[]
    notes?: string
    tax?: number
    status?: string
  }

  if (!body.quoteId) {
    return NextResponse.json({ error: 'Missing quoteId' }, { status: 400 })
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from('quotes')
    .select('id')
    .eq('id', body.quoteId)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (body.clientName !== undefined) updates.client_name = body.clientName
  if (body.clientEmail !== undefined) updates.client_email = body.clientEmail
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.status !== undefined) updates.status = body.status
  if (body.lineItems) {
    updates.line_items = body.lineItems
    const subtotal = body.lineItems.reduce((sum, item) => sum + item.amount, 0)
    const tax = body.tax ?? 0
    updates.subtotal = subtotal
    updates.tax = tax
    updates.total = subtotal + tax
  }

  const { data: quote, error } = await supabase
    .from('quotes')
    .update(updates)
    .eq('id', body.quoteId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ quote })
}
