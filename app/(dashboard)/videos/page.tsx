import Link from 'next/link'
import { createClient } from '../../_lib/supabase/server'
import LibraryTable, { type LibraryItem } from './LibraryTable'

type Creation = {
  id: string
  user_id: string
  type: string
  title: string | null
  thumbnail_url: string | null
  file_url: string | null
  credits_used: number | null
  created_at: string
  _videoId?: string | null
  _status?: string | null
  _progressPct?: number | null
}

// All creation types the library understands (used for filtering / "other").
const ALL_TYPES = ['video', 'deck', 'logo', 'business-card', 'flyer', 'infographic', 'social-kit', 'other'] as const

// Only these tabs are SHOWN in the focused product (video + deck). Other types
// still load/filter correctly; their tabs are just hidden.
const FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'video', label: 'Videos' },
  { key: 'deck', label: 'Decks' },
] as const

const KNOWN_TYPES = new Set<string>(ALL_TYPES)

const FILTER_TITLES: Record<string, string> = {
  video: 'Your Videos',
  deck: 'Your Decks',
}

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type: typeFilter } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Query BOTH tables and merge — videos table is authoritative for videos,
  // creations table has everything else (decks, flyers, logos, etc.)
  const [{ data: videos }, { data: otherCreations }] = await Promise.all([
    supabase
      .from('videos')
      .select('id, user_id, title, thumbnail_url, video_url, status, progress_pct, progress_detail, created_at, deducted_cost, draft_data')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('creations')
      .select('*')
      .eq('user_id', user!.id)
      .neq('type', 'video')
      .order('created_at', { ascending: false }),
  ])

  const videoRows = videos ?? []

  const allItems: Creation[] = [
    ...videoRows.map(v => ({
      id: v.id,
      user_id: v.user_id,
      type: 'video' as string,
      title: v.title,
      thumbnail_url: v.thumbnail_url,
      file_url: v.video_url,
      credits_used: (v as { deducted_cost?: number | null }).deducted_cost ?? null,
      created_at: v.created_at,
      _videoId: v.id,
      _status: v.status,
      _progressPct: v.progress_pct,
    })),
    ...(otherCreations ?? []).map(c => ({ ...c, _videoId: null as string | null, _status: null as string | null })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Apply type filter
  const filteredItems = typeFilter
    ? typeFilter === 'other'
      ? allItems.filter(item => !KNOWN_TYPES.has(item.type))
      : allItems.filter(item => item.type === typeFilter)
    : allItems

  // Shape for the client table (which handles its own 25/50/100 pagination,
  // delete, and columns). Recipient is read from the video's draft_data.
  const draftById = new Map(videoRows.map(v => [v.id, (v as any).draft_data as any]))
  const libraryItems: LibraryItem[] = filteredItems.map((item) => {
    const draft = item._videoId ? draftById.get(item._videoId) : null
    return {
      id: item.id,
      videoId: item._videoId ?? null,
      type: item.type,
      title: item.title ?? null,
      recipient: draft?.recipientName ?? null,
      fileUrl: item.file_url ?? null,
      status: item._status ?? null,
      progressPct: item._progressPct ?? null,
      creditsUsed: item.credits_used ?? null,
      createdAt: item.created_at,
    }
  })

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{typeFilter ? (FILTER_TITLES[typeFilter] ?? 'Your Library') : 'Your Library'}</h1>
          <p>{typeFilter ? `Filtered by ${FILTER_TABS.find(t => t.key === typeFilter)?.label?.toLowerCase() ?? typeFilter}.` : 'All your creations.'}</p>
        </div>
        <Link href="/create/start" className="btn btn-primary btn-lg">+ New Creation</Link>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(tab => (
          <Link
            key={tab.key}
            href={tab.key ? `/videos?type=${tab.key}` : '/videos'}
            className={`btn btn-sm ${typeFilter === tab.key || (!typeFilter && !tab.key) ? 'btn-primary' : 'btn-soft'}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <LibraryTable items={libraryItems} />
    </div>
  )
}
