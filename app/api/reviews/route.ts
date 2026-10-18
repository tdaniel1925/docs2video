import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { CLIENT_DATE_COLS, loadReviews, REVIEW_COLS, type ClientWithDates } from '../../_lib/annual-review-db'
import { inferIssueDate, reviewDue } from '../../_lib/annual-review'
import { alertMissingSchema, isMissingSchema } from '../../_lib/feature-tables'

export const runtime = 'nodejs'

/**
 * GET /api/reviews — the signed-in agent's annual reviews.
 *   (no params)   { available, summary, items }  — the Reviews box + Clients chips
 *   ?clientId=…   { available, client, current, reviews, documents, suggestedDate }
 *                 — the Prepare review page for one client
 * { available: false } until the migration has run.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const admin = createAdminClient()
  const clientId = new URL(req.url).searchParams.get('clientId')

  if (!clientId) {
    const r = await loadReviews(admin, user.id)
    if (!r.available) return NextResponse.json({ available: false })
    return NextResponse.json({ available: true, summary: r.summary, items: r.items })
  }

  const { data: client, error } = await admin.from('clients').select(CLIENT_DATE_COLS).eq('id', clientId).eq('user_id', user.id).maybeSingle()
  if (error) {
    if (isMissingSchema(error)) { await alertMissingSchema('reviews', error.message); return NextResponse.json({ available: false }) }
    return NextResponse.json({ error: 'Could not load the client.' }, { status: 500 })
  }
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  const c = client as ClientWithDates

  const [{ data: reviews, error: rErr }, { data: vids }] = await Promise.all([
    admin.from('client_reviews').select(REVIEW_COLS).eq('client_id', c.id).eq('user_id', user.id).order('cycle_date', { ascending: false }).limit(10),
    admin.from('videos').select('id, title, status, created_at, draft_data, video_url')
      .eq('user_id', user.id).eq('client_id', c.id).neq('status', 'draft').order('created_at', { ascending: false }).limit(20),
  ])
  if (rErr && isMissingSchema(rErr)) { await alertMissingSchema('reviews', rErr.message); return NextResponse.json({ available: false }) }

  // Earlier projects for this client that still have their document — "use
  // last year's document" picks from these.
  const documents = ((vids ?? []) as { id: string; title: string | null; status: string; created_at: string; draft_data: Record<string, unknown> | null }[])
    .filter((v) => v.draft_data && typeof v.draft_data === 'object' && v.draft_data.extractedData)
    .map((v) => ({ videoId: v.id, title: v.title || String((v.draft_data?.extractedData as { title?: string })?.title || 'Untitled'), madeAt: v.created_at, status: v.status }))
  const latestDoc = ((vids ?? []) as { draft_data: Record<string, unknown> | null }[]).find((v) => v.draft_data?.extractedData)
  const suggestedDate = !c.anniversary_date && latestDoc ? inferIssueDate(latestDoc.draft_data?.extractedData) : null

  const due = c.anniversary_date ? reviewDue(c.anniversary_date, c.anniversary_tz) : null
  const rows = (reviews ?? []) as { cycle_date: string; video_id: string | null; status: string }[]
  const current = due ? rows.find((r) => r.cycle_date === due.cycleDate) ?? null : null
  // The review video's own state (Made yet? Watched?).
  let currentVideo: { id: string; title: string | null; status: string } | null = null
  if (current?.video_id) {
    const { data: v } = await admin.from('videos').select('id, title, status').eq('id', current.video_id).eq('user_id', user.id).maybeSingle()
    currentVideo = (v as typeof currentVideo) ?? null
  }
  return NextResponse.json({
    available: true,
    client: c,
    due,
    current,
    currentVideo,
    reviews: rows,
    documents,
    suggestedDate,
  })
}

/**
 * POST /api/reviews — link a prepared draft to this year's review.
 * { clientId, cycleDate, videoId, priorVideoId? } → the review row.
 * Called by the Prepare review page once the draft exists. Owner-checked.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { clientId?: string; cycleDate?: string; videoId?: string; priorVideoId?: string | null }
  if (!body.clientId || !body.cycleDate || !body.videoId) return NextResponse.json({ error: 'clientId, cycleDate and videoId are required' }, { status: 400 })
  const admin = createAdminClient()
  const [{ data: client }, { data: video }] = await Promise.all([
    admin.from('clients').select('id').eq('id', body.clientId).eq('user_id', user.id).maybeSingle(),
    admin.from('videos').select('id').eq('id', body.videoId).eq('user_id', user.id).maybeSingle(),
  ])
  if (!client || !video) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  let prior: string | null = null
  if (body.priorVideoId) {
    const { data: pv } = await admin.from('videos').select('id').eq('id', body.priorVideoId).eq('user_id', user.id).maybeSingle()
    prior = pv?.id ?? null
  }
  const { data, error } = await admin.from('client_reviews').upsert({
    user_id: user.id, client_id: body.clientId, cycle_date: String(body.cycleDate).slice(0, 10),
    status: 'prepared', video_id: body.videoId, prior_video_id: prior, updated_at: new Date().toISOString(),
  }, { onConflict: 'client_id,cycle_date' }).select(REVIEW_COLS).single()
  if (error) {
    if (isMissingSchema(error)) { await alertMissingSchema('reviews', error.message); return NextResponse.json({ available: false, error: 'Annual reviews aren’t switched on yet.' }, { status: 503 }) }
    console.error('[reviews] prepare failed:', error.message)
    return NextResponse.json({ error: 'Could not save the review.' }, { status: 500 })
  }
  return NextResponse.json({ review: data })
}
