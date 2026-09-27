import { createAdminClient } from '../../../_lib/supabase/admin'
import {
  TRACKED_EVENTS, BOOKING_EVENTS, buildActionCards, peopleCount, projectStatus, recipientName,
  madeLabel, resumeUrl,
  type VideoRow, type SendRow, type EventRow, type QuoteRow, type ClientRow, type ActionCard, type Tone,
} from './derive'

/*
 * Everything the Home screen shows, read on the server.
 *
 * DRIFT RULE: every .select() below names only columns that (a) are in
 * supabase/migrations or the legacy table definitions AND (b) are already read
 * successfully by live code elsewhere — one unknown column fails the whole
 * query. Where each list was copied from:
 *   videos         id,title,status,output_type,draft_data,created_at,updated_at,
 *                  client_id,progress_pct  (old dashboard, library, track-view)
 *   sent_emails    video_id,to_email,opened_at,created_at  (/api/sent-emails,
 *                  client-intelligence). NOT email_type — may be missing in prod.
 *   quotes         video_id,client_email,client_name,created_at  (client-intelligence)
 *   video_analytics video_id,event_type,created_at  (weekly-report cron).
 *                  video_views is NOT used: its time column is opened_at and it
 *                  only holds 'view' rows; video_analytics has every event.
 *   clients        '*' (same as /api/clients) — we read name/phone if present.
 *   creations      '*' (same as the old dashboard) for old-builder decks.
 * A failed query is logged and treated as "unknown" (shown as —), never as 0.
 */

export type ProjectRow = {
  key: string
  name: string
  client: string | null
  made: string
  status: { label: string; tone: Tone }
  href: string
  external: boolean
  /** Set for drafts only — shows a Discard button. */
  draftId: string | null
}

export type HomeData = {
  hasAnyProject: boolean
  totalProjects: number
  projects: ProjectRow[]
  cards: ActionCard[]
  peopleNeedingYou: number
  month: {
    sent: number | null
    watched: number | null
    bookingClicks: number | null
  }
}

const RECENT_DAYS = 30
const TABLE_ROWS = 8
const CORE_OUTPUTS = ['video', 'pptx', 'pdf', 'interactive', 'deck']

type Admin = ReturnType<typeof createAdminClient>

function logErr(what: string, error: { message?: string } | null) {
  if (error) console.error(`[home] ${what} failed:`, error.message ?? error)
}

async function readEvents(admin: Admin, ids: string[], since: string | null): Promise<EventRow[] | null> {
  const out: EventRow[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    for (let page = 0; page < 10; page++) {
      let q = admin.from('video_analytics')
        .select('video_id, event_type, created_at')
        .in('video_id', chunk)
        .in('event_type', TRACKED_EVENTS)
      if (since) q = q.gte('created_at', since)
      const { data, error } = await q
        .order('created_at', { ascending: false })
        .range(page * 1000, page * 1000 + 999)
      if (error) { logErr('video_analytics', error); return null }
      out.push(...((data ?? []) as EventRow[]))
      if (!data || data.length < 1000) break
    }
  }
  return out
}

export async function loadHomeData(userId: string): Promise<HomeData> {
  const admin = createAdminClient()
  const now = Date.now()
  const d = new Date(now)
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
  const recentSince = new Date(now - RECENT_DAYS * 86_400_000).toISOString()
  const windowStart = monthStart < recentSince ? monthStart : recentSince

  const [allIdsRes, recentRes, decksRes, deckCountRes, monthSentRes] = await Promise.all([
    admin.from('videos').select('id').eq('user_id', userId),
    admin.from('videos')
      .select('id, title, status, output_type, draft_data, created_at, updated_at, client_id, progress_pct')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(TABLE_ROWS * 2),
    admin.from('creations').select('*')
      .eq('user_id', userId).in('type', ['deck', 'brand-deck'])
      .order('created_at', { ascending: false }).limit(TABLE_ROWS),
    admin.from('creations').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).in('type', ['deck', 'brand-deck']),
    admin.from('sent_emails').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', monthStart),
  ])
  logErr('videos ids', allIdsRes.error)
  logErr('videos recent', recentRes.error)
  logErr('creations', decksRes.error)
  logErr('sent_emails month', monthSentRes.error)

  const allIds = ((allIdsRes.data ?? []) as { id: string }[]).map(r => r.id)
  const recentVideos = ((recentRes.data ?? []) as VideoRow[])
    // Drafts of the parked tools (graphics etc.) never belonged on this list.
    .filter(v => v.status !== 'draft' || !v.output_type || CORE_OUTPUTS.includes(v.output_type))
  const decks = (decksRes.data ?? []) as { id: string; title: string | null; file_url: string | null; created_at: string }[]
  const totalProjects = allIds.length + (deckCountRes.count ?? 0)

  // Sends: the last 30 days for the cards, plus any age for the table's rows.
  const tableVideoIds = recentVideos.slice(0, TABLE_ROWS).map(v => v.id)
  const [recentSendsRes, tableSendsRes, windowEvents, tableEvents] = await Promise.all([
    admin.from('sent_emails').select('video_id, to_email, opened_at, created_at')
      .eq('user_id', userId).gte('created_at', recentSince)
      .order('created_at', { ascending: false }).limit(500),
    tableVideoIds.length
      ? admin.from('sent_emails').select('video_id, to_email, opened_at, created_at')
          .eq('user_id', userId).in('video_id', tableVideoIds)
          .order('created_at', { ascending: false }).limit(500)
      : Promise.resolve({ data: [], error: null }),
    allIds.length ? readEvents(admin, allIds, windowStart) : Promise.resolve([] as EventRow[]),
    tableVideoIds.length ? readEvents(admin, tableVideoIds, null) : Promise.resolve([] as EventRow[]),
  ])
  logErr('sent_emails recent', recentSendsRes.error)
  logErr('sent_emails table', tableSendsRes.error)

  const recentSends = (recentSendsRes.data ?? []) as SendRow[]
  const tableSends = (tableSendsRes.data ?? []) as SendRow[]

  // Videos the cards may talk about: anything sent or watched lately.
  const cardVideoIds = new Set<string>()
  for (const s of recentSends) if (s.video_id) cardVideoIds.add(s.video_id)
  for (const e of windowEvents ?? []) if (e.created_at >= recentSince) cardVideoIds.add(e.video_id)
  const videoMap = new Map<string, VideoRow>(recentVideos.map(v => [v.id, v]))
  const missing = [...cardVideoIds].filter(id => !videoMap.has(id)).slice(0, 100)
  if (missing.length) {
    const { data, error } = await admin.from('videos')
      .select('id, title, status, output_type, draft_data, created_at, updated_at, client_id, progress_pct')
      .eq('user_id', userId).in('id', missing)
    logErr('videos for cards', error)
    for (const v of (data ?? []) as VideoRow[]) videoMap.set(v.id, v)
  }

  // Names: quotes and client records for the videos in play.
  const nameVideoIds = [...new Set([...cardVideoIds, ...tableVideoIds])]
  const clientIds = [...new Set([...videoMap.values()].map(v => v.client_id).filter((x): x is string => !!x))]
  const [quotesRes, clientsRes] = await Promise.all([
    nameVideoIds.length
      ? admin.from('quotes').select('video_id, client_email, client_name, created_at')
          .eq('user_id', userId).in('video_id', nameVideoIds).limit(500)
      : Promise.resolve({ data: [], error: null }),
    clientIds.length
      ? admin.from('clients').select('*').eq('user_id', userId).in('id', clientIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  logErr('quotes', quotesRes.error)
  logErr('clients', clientsRes.error)
  const clients = new Map<string, ClientRow>()
  for (const c of (clientsRes.data ?? []) as Record<string, unknown>[]) {
    clients.set(String(c.id), {
      id: String(c.id),
      name: typeof c.name === 'string' ? c.name : null,
      phone: typeof c.phone === 'string' && c.phone.trim() ? c.phone.trim() : null,
    })
  }
  const names = { quotes: (quotesRes.data ?? []) as QuoteRow[], clients }

  // ── Cards ──
  const cardVideos = new Map([...videoMap].filter(([id]) => cardVideoIds.has(id)))
  const cards = buildActionCards({
    videos: cardVideos,
    sends: recentSends,
    events: (windowEvents ?? []).filter(e => e.created_at >= recentSince),
    names,
    now,
  })

  // ── Projects table ──
  const videoRows: (ProjectRow & { at: string })[] = recentVideos.slice(0, TABLE_ROWS).map(v => {
    const isDraft = v.status === 'draft'
    const typedTitle = typeof v.draft_data?.purpose === 'string' ? (v.draft_data.purpose as string) : null
    const name = v.title?.trim() || typedTitle?.trim() || 'Untitled'
    const sendsForV = tableSends.filter(s => s.video_id === v.id)
    return {
      key: v.id,
      name: name.length > 70 ? name.slice(0, 67) + '…' : name,
      client: recipientName(v, latestEmail(sendsForV), names),
      made: madeLabel(v.output_type),
      status: projectStatus(v, sendsForV, tableEvents ?? [], now),
      href: isDraft ? resumeUrl(v.id, v.draft_data?.step) : `/videos/${v.id}`,
      external: false,
      draftId: isDraft ? v.id : null,
      at: v.updated_at ?? v.created_at,
    }
  })
  const deckRows: (ProjectRow & { at: string })[] = decks.map(c => ({
    key: `deck-${c.id}`,
    name: c.title?.trim() || 'Untitled deck',
    client: null,
    made: 'Slide deck',
    status: { label: 'Ready', tone: 'ready' as const },
    href: c.file_url ?? '/videos',
    external: !!c.file_url,
    draftId: null,
    at: c.created_at,
  }))
  const projects = [...videoRows, ...deckRows]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, TABLE_ROWS)
    .map(({ at: _at, ...row }) => row)

  // ── This month ── (null = couldn't read it; the page shows —)
  const monthEvents = windowEvents?.filter(e => e.created_at >= monthStart) ?? null
  return {
    hasAnyProject: totalProjects > 0 || projects.length > 0,
    totalProjects,
    projects,
    cards,
    peopleNeedingYou: peopleCount(cards),
    month: {
      sent: monthSentRes.error ? null : (monthSentRes.count ?? 0),
      watched: monthEvents ? new Set(monthEvents.filter(e => e.event_type === 'view').map(e => e.video_id)).size : null,
      bookingClicks: monthEvents ? monthEvents.filter(e => BOOKING_EVENTS.includes(e.event_type)).length : null,
    },
  }
}

function latestEmail(sends: SendRow[]): string | null {
  let best: SendRow | null = null
  for (const s of sends) if (!best || s.created_at > best.created_at) best = s
  return best?.to_email ?? null
}
