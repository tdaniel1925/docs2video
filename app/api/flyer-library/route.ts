import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

// =============================================================================
// My Library — a paginated view of every saved Text2Art job, grouped by PROJECT.
//
// The /flyer history API returns ONE project's timeline for the builder. This one
// powers a standalone browse page: a page of PROJECTS (chats), each with its recent
// designs, newest project first. Paginated so a heavy user never gets an endless
// page. Images live in a PRIVATE bucket → short-lived signed URLs, never public.
//
// Query: ?page=0&pageSize=8  → returns that page of projects + hasMore.
// =============================================================================

export const runtime = 'nodejs'

const LINK_TTL_SECONDS = 60 * 60
const DESIGNS_PER_PROJECT = 12   // preview cap per project card (deep-dive opens /flyer)

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const params = new URL(req.url).searchParams
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0)
  const pageSize = Math.min(Number(params.get('pageSize') ?? 8) || 8, 24)
  const admin = createAdminClient()

  // Projects (chats), pinned first then most-recent — one page at a time. We fetch
  // one extra to know whether a "load more" exists without a second count query.
  const from = page * pageSize
  const { data: chatRows, error: chatErr } = await admin
    .from('flyer_chats')
    .select('id, title, updated_at, pinned')
    .eq('user_id', user.id)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .range(from, from + pageSize)   // inclusive → pageSize+1 rows

  // Table missing (migration not run) must leave the page empty + usable, not 500.
  if (chatErr) {
    console.error('[flyer-library] chats load failed:', chatErr.message)
    return NextResponse.json({ projects: [], page, hasMore: false, unavailable: true })
  }
  const rows = chatRows ?? []
  const hasMore = rows.length > pageSize
  const projects = rows.slice(0, pageSize)
  if (!projects.length) return NextResponse.json({ projects: [], page, hasMore: false })

  // For this page of projects, pull their rounds (to map designs → project) and a
  // capped set of recent designs each. One query per table, not per project.
  const chatIds = projects.map((c) => c.id)
  const { data: rounds } = await admin
    .from('flyer_rounds')
    .select('id, chat_id, created_at')
    .eq('user_id', user.id)
    .in('chat_id', chatIds)
  const roundIds = (rounds ?? []).map((r) => r.id)
  const roundToChat = new Map((rounds ?? []).map((r) => [r.id, r.chat_id]))

  let designs: any[] = []
  if (roundIds.length) {
    const { data: d } = await admin
      .from('flyer_designs')
      .select('id, round_id, size_id, label, width, height, image_path, created_at')
      .in('round_id', roundIds)
      .order('created_at', { ascending: false })
    designs = d ?? []
  }

  // Sign only the designs we'll actually show (cap per project), in parallel.
  const byChat = new Map<string, any[]>()
  for (const d of designs) {
    const chatId = roundToChat.get(d.round_id)
    if (!chatId) continue
    const arr = byChat.get(chatId) ?? []
    if (arr.length < DESIGNS_PER_PROJECT) { arr.push(d); byChat.set(chatId, arr) }
  }
  const toSign = [...byChat.values()].flat()
  const signed = new Map<string, string>()
  await Promise.all(toSign.map(async (d) => {
    const { data } = await admin.storage.from('creation-assets').createSignedUrl(d.image_path, LINK_TTL_SECONDS)
    if (data?.signedUrl) signed.set(d.id, data.signedUrl)
  }))

  // total design count per project (for the "12 of 40" affordance) — cheap head count.
  const totalByChat = new Map<string, number>()
  for (const d of designs) {
    const chatId = roundToChat.get(d.round_id)
    if (chatId) totalByChat.set(chatId, (totalByChat.get(chatId) ?? 0) + 1)
  }

  return NextResponse.json({
    page,
    hasMore,
    projects: projects.map((c) => ({
      id: c.id,
      title: c.title || 'Untitled project',
      pinned: !!c.pinned,
      updatedAt: c.updated_at,
      totalDesigns: totalByChat.get(c.id) ?? 0,
      designs: (byChat.get(c.id) ?? [])
        .filter((d) => signed.has(d.id))
        .map((d) => ({
          id: d.id, sizeId: d.size_id, label: d.label,
          w: d.width, h: d.height, url: signed.get(d.id)!, createdAt: d.created_at,
        })),
    })),
  })
}
