import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// The statuses the quotes table allows (its CHECK constraint).
const QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'paid', 'declined'] as const
type QuoteStatus = typeof QUOTE_STATUSES[number]

type LineItem = { description: string; amount: number }

function cleanLineItems(items: unknown): LineItem[] | null {
  if (!Array.isArray(items)) return null
  const out: LineItem[] = []
  for (const i of items) {
    const description = String((i as LineItem)?.description ?? '').trim().slice(0, 300)
    const amount = Math.round(Number((i as LineItem)?.amount))
    if (!description || !Number.isFinite(amount) || amount < 0) continue
    out.push({ description, amount })
  }
  return out
}

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
  // Case-insensitive: older quotes kept whatever capitalization was typed.
  if (clientEmail) {
    query = query.ilike('client_email', clientEmail.replace(/[\\%_]/g, m => `\\${m}`))
  }

  const { data: quotes, error } = await query

  if (error) {
    { console.error('[quotes] db error:', error); return NextResponse.json({ error: 'Request failed.' }, { status: 500 }) }
  }

  return NextResponse.json({ quotes })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    videoId?: string
    clientName?: string
    clientEmail?: string
    lineItems: LineItem[]
    notes?: string
    tax?: number
    dueDate?: string
  }

  const lineItems = cleanLineItems(body.lineItems)
  if (!lineItems || lineItems.length === 0) {
    return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 })
  }

  if (body.videoId) {
    // Only attach a quote to one of YOUR videos.
    const { data: v } = await supabase.from('videos').select('id').eq('id', body.videoId).eq('user_id', user.id).maybeSingle()
    if (!v) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
  const tax = Math.max(0, Math.round(Number(body.tax ?? 0)) || 0)
  const total = subtotal + tax

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      user_id: user.id,
      video_id: body.videoId ?? null,
      client_name: body.clientName?.trim() || null,
      client_email: body.clientEmail?.trim().toLowerCase() || null,
      line_items: lineItems,
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
    { console.error('[quotes] db error:', error); return NextResponse.json({ error: 'The quote could not be saved. Please try again.' }, { status: 500 }) }
  }

  return NextResponse.json({ quote })
}

/**
 * Update a quote. Used for edits AND for the agent marking the deal:
 * "Mark as paid / accepted / declined" and the automatic follow-ups switch.
 *
 * Editing the line items never touches the status — it used to reset a PAID
 * quote to "sent", which put the client straight back on the follow-up list.
 */
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    quoteId: string
    clientName?: string
    clientEmail?: string
    lineItems?: LineItem[]
    notes?: string
    tax?: number
    status?: string
    autoFollowUp?: boolean
  }

  if (!body.quoteId) {
    return NextResponse.json({ error: 'Missing quoteId' }, { status: 400 })
  }
  if (body.status !== undefined && !QUOTE_STATUSES.includes(body.status as QuoteStatus)) {
    return NextResponse.json({ error: 'Unknown quote status' }, { status: 400 })
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from('quotes')
    .select('id, status, paid_at, client_email, tax')
    .eq('id', body.quoteId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (body.clientName !== undefined) updates.client_name = body.clientName.trim() || null
  if (body.clientEmail !== undefined) updates.client_email = body.clientEmail.trim().toLowerCase() || null
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.status !== undefined && body.status !== existing.status) {
    updates.status = body.status
    // Stamp when it was paid; clear it if the agent un-marks it.
    if (body.status === 'paid') updates.paid_at = existing.paid_at ?? new Date().toISOString()
    else if (existing.status === 'paid') updates.paid_at = null
  }
  if (body.lineItems) {
    const items = cleanLineItems(body.lineItems)
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 })
    }
    updates.line_items = items
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
    // Keep the existing tax unless a new one was sent (it used to be reset to 0).
    const tax = body.tax !== undefined ? Math.max(0, Math.round(Number(body.tax)) || 0) : (existing.tax ?? 0)
    updates.subtotal = subtotal
    updates.tax = tax
    updates.total = subtotal + tax
  }

  // Columns added by migration 20260926. Asked for separately so a missing
  // column gives a clear message instead of failing the whole save.
  const extras: Record<string, unknown> = {}
  if (typeof body.autoFollowUp === 'boolean') extras.auto_follow_up = body.autoFollowUp
  if (updates.status === 'accepted') extras.accepted_at = new Date().toISOString()

  let quote: Record<string, unknown> | null = null
  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabase
      .from('quotes')
      .update(updates)
      .eq('id', body.quoteId)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error || !data) {
      console.error('[quotes] db error:', error)
      return NextResponse.json({ error: 'The quote could not be saved. Please try again.' }, { status: 500 })
    }
    quote = data
  }

  if (Object.keys(extras).length > 0) {
    const { data, error } = await supabase
      .from('quotes')
      .update(extras)
      .eq('id', body.quoteId)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error || !data) {
      console.error('[quotes] extra columns not saved:', error?.message)
      if (typeof body.autoFollowUp === 'boolean') {
        return NextResponse.json({
          error: 'Automatic follow-ups can’t be switched on yet — the database needs an update. Nothing will be sent automatically.',
          quote,
        }, { status: 503 })
      }
      // accepted_at is a nice-to-have — the status itself saved above.
    } else {
      quote = data
    }
  }

  // A paid or accepted quote means the deal is won: mark the client converted,
  // which also keeps every automatic reminder away from them.
  const finalStatus = (updates.status as string | undefined) ?? null
  const clientEmail = String((quote?.client_email as string | undefined) ?? existing.client_email ?? '').toLowerCase().trim()
  if ((finalStatus === 'paid' || finalStatus === 'accepted') && clientEmail) {
    const { error: convErr } = await supabase
      .from('clients')
      .update({ status: 'converted', last_activity_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('email', clientEmail)
    if (convErr) console.error('[quotes] could not mark client converted:', convErr.message)
  }

  if (!quote) {
    const { data } = await supabase.from('quotes').select('*').eq('id', body.quoteId).eq('user_id', user.id).maybeSingle()
    quote = data
  }
  return NextResponse.json({ quote })
}

/** Remove a quote (owner only). Says so when nothing was removed. */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const quoteId = new URL(request.url).searchParams.get('quoteId')
  if (!quoteId) return NextResponse.json({ error: 'Missing quoteId' }, { status: 400 })

  const { data, error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', quoteId)
    .eq('user_id', user.id)
    .select('id')
  if (error) return NextResponse.json({ error: 'The quote could not be removed. Please try again.' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
