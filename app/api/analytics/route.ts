import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
export const maxDuration = 30

// Supabase returns at most 1,000 rows per request. Counting by fetching rows
// and taking .length therefore topped out at 1,000 — a busy account's "total
// views" silently froze. Totals now use count queries (no cap), and anything
// that needs the rows themselves is read in pages.
const PAGE = 1000
const MAX_PAGES = 50 // 50k rows — a safety stop, far above real usage

async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(i * PAGE, i * PAGE + PAGE - 1)
    if (error || !data) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

/** Split long id lists so the URL stays a sane length. */
function chunks<T>(arr: T[], size = 200): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch the user's videos (view counts are derived from video_views below —
  // the videos.view_count column was never incremented, so it always read 0).
  const videos = await readAll<{ id: string; title: string | null; thumbnail_url: string | null }>((from, to) =>
    admin.from('videos').select('id, title, thumbnail_url').eq('user_id', user.id).order('created_at', { ascending: true }).range(from, to))

  const videoIds = videos.map(v => v.id)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  let totalViews = 0
  let dailyViews: { date: string; count: number }[] = []
  const perVideo: Record<string, number> = {}

  if (videoIds.length > 0) {
    const grouped: Record<string, number> = {}
    for (const ids of chunks(videoIds)) {
      // Exact total — a count, not a row fetch, so no 1,000 cap.
      const { count } = await admin
        .from('video_views')
        .select('id', { count: 'exact', head: true })
        .in('video_id', ids)
      totalViews += count ?? 0

      // Per-video tallies need the rows; read them in pages.
      const rows = await readAll<{ video_id: string | null; opened_at: string | null }>((from, to) =>
        admin.from('video_views').select('video_id, opened_at').in('video_id', ids).order('opened_at', { ascending: true }).range(from, to))
      for (const v of rows) {
        if (v.video_id) perVideo[v.video_id] = (perVideo[v.video_id] ?? 0) + 1
        if (v.opened_at && new Date(v.opened_at) >= thirtyDaysAgo) {
          const date = v.opened_at.split('T')[0]
          grouped[date] = (grouped[date] ?? 0) + 1
        }
      }
    }
    dailyViews = Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  // Attach derived counts and rank for the "Top Videos" list
  const rankedVideos = videos
    .map(v => ({ ...v, view_count: perVideo[v.id] ?? 0 }))
    .sort((a, b) => b.view_count - a.view_count)

  // Quotes status breakdown — counts, not row fetches.
  const quoteCount = async (statuses?: string[]) => {
    let q = admin.from('quotes').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    if (statuses) q = q.in('status', statuses)
    const { count } = await q
    return count ?? 0
  }
  const [qTotal, qViewed, qAccepted] = await Promise.all([quoteCount(), quoteCount(['viewed']), quoteCount(['accepted', 'paid'])])
  const quoteStats = { total: qTotal, viewed: qViewed, accepted: qAccepted }

  // Sent emails with open tracking — the tracking pixel sets opened_at
  const [{ count: emailTotal }, { count: openedCount }] = await Promise.all([
    admin.from('sent_emails').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    admin.from('sent_emails').select('id', { count: 'exact', head: true }).eq('user_id', user.id).not('opened_at', 'is', null),
  ])
  const emailStats = {
    total: emailTotal ?? 0,
    opened: openedCount ?? 0,
    openRate: emailTotal ? Math.round(((openedCount ?? 0) / emailTotal) * 100) : 0,
  }

  return NextResponse.json({
    totalViews,
    topVideos: rankedVideos.slice(0, 10),
    dailyViews,
    quoteStats,
    emailStats,
  })
}
