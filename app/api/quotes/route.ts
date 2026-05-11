import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

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
