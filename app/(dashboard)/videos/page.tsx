import Link from 'next/link'
import { createClient } from '../../_lib/supabase/server'
import { NAMES, KIND_NAMES, kindOfOutput, type LibraryKind } from '../../_lib/names'
import { isOlderKind, isServerPagedTab, libraryTabs, searchPattern, tabFor, videosFilterFor, OLDER_OUTPUT_TYPES, type PagedTabKey } from './library-tabs'
import { madeLabel } from '../dashboard/_home/derive'
import Library from './Library'
import { isPicture, PAGE_SIZES, SORTS, type LibraryItem, type SortId } from './library-items'
import { flyerFileId, signFlyerPictures } from './library-pictures'

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
  /** A picture for the card (thumbnail, else the first slide picture). */
  _picture: string | null
  _duration: number | null
  /** Which tab this row belongs on (null = only under All). */
  _kind: LibraryKind | null
  /** What the Type column says. */
  _label: string
}

// All creation types the library understands (used for filtering / "other").
const ALL_TYPES = ['video', 'deck', 'brand-deck', 'logo', 'business-card', 'flyer', 'infographic', 'social-kit', 'other'] as const
const KNOWN_TYPES = new Set<string>(ALL_TYPES)

// What the Type column calls a row from the creations table. The stored type
// stays `flyer` — it is in the database, the credit ledger and the API — but
// the tool makes posters, social posts, banners and business cards, so calling
// all of it "Flyer" was wrong on most rows.
const CREATION_LABELS: Record<string, string> = {
  deck: KIND_NAMES.deck.one, 'brand-deck': KIND_NAMES.deck.one,
  flyer: KIND_NAMES.graphic.one,
  logo: 'Logo', 'business-card': 'Card', infographic: 'Infographic', 'social-kit': 'Social', other: 'Other',
}

/** Which tab a creations row belongs on. The retired tools' rows (logos,
 *  cards…) have no tab of their own; they still show under All. */
function kindOfCreation(type: string): LibraryKind | null {
  if (type === 'deck' || type === 'brand-deck') return 'deck'
  if (type === 'flyer') return 'graphic'
  return null
}

// The tabs live in library-tabs.ts: All · Videos · Presentations, plus
// "Older items" (slide decks and graphics made before Docs2Video became
// videos-only) when the account has any. Old ?type=deck / ?type=flyer
// addresses still land on just those.

type Search = { type?: string; q?: string; sort?: string; page?: string; per?: string }

export default async function VideosPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const typeFilter = sp.type
  const activeTab = tabFor(typeFilter)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // All · Videos · Presentations come only from the videos table, so they are
  // paged, searched and sorted IN THE DATABASE: one page of rows, not every
  // row the account ever made (audit 2026-10-09 — a slow phone downloaded and
  // drew hundreds of rows before showing anything).
  const pagedKey: PagedTabKey | null = !typeFilter ? '' : activeTab && isServerPagedTab(activeTab.key) ? activeTab.key : null
  if (pagedKey !== null) return PagedLibrary({ sp, pagedKey, userId: user!.id, supabase })

  // Query BOTH tables and merge — videos table is authoritative for videos,
  // presentations and slide decks; creations has everything else (deck-builder
  // decks, graphics, logos, etc.)
  //
  // The cards' pictures come from the SAME query: the thumbnail, else just the
  // first slide picture (slide_urls->>0, one short string per row — not the
  // whole list, and no extra query per card). If a column is missing in this
  // database the whole select would fail and empty the Library, so it falls
  // back to the plain columns and shows placeholders instead.
  const BASE = 'id, user_id, title, thumbnail_url, video_url, status, progress_pct, progress_detail, created_at, deducted_cost, draft_data, output_type'
  const readVideos = async () => {
    const rich = await supabase.from('videos').select(`${BASE}, duration, first_slide:slide_urls->>0`).eq('user_id', user!.id).order('created_at', { ascending: false })
    if (!rich.error) return rich
    return supabase.from('videos').select(BASE).eq('user_id', user!.id).order('created_at', { ascending: false })
  }
  const [{ data: videos }, { data: otherCreations }] = await Promise.all([
    readVideos(),
    supabase
      .from('creations')
      .select('*')
      .eq('user_id', user!.id)
      .neq('type', 'video')
      .order('created_at', { ascending: false }),
  ])

  const videoRows = videos ?? []

  const allItems: Creation[] = [
    ...videoRows.map(v => {
      const outputType = (v as { output_type?: string | null }).output_type ?? null
      const extra = v as { duration?: number | null; first_slide?: string | null }
      return {
        id: v.id,
        user_id: v.user_id,
        // Every videos row stays type 'video' for the table: it opens on the
        // result page and can be deleted there, whatever it was made as.
        type: 'video' as string,
        title: v.title,
        thumbnail_url: v.thumbnail_url,
        file_url: v.video_url,
        credits_used: (v as { deducted_cost?: number | null }).deducted_cost ?? null,
        created_at: v.created_at,
        _videoId: v.id,
        _status: v.status,
        _progressPct: v.progress_pct,
        _picture: v.thumbnail_url || (isPicture(extra.first_slide) ? extra.first_slide! : null),
        _duration: typeof extra.duration === 'number' ? extra.duration : null,
        _kind: kindOfOutput(outputType),
        _label: madeLabel(outputType),
      }
    }),
    ...(otherCreations ?? []).map(c => ({
      ...c,
      _videoId: null as string | null,
      _status: null as string | null,
      // Custom Graphics: the file IS the picture.
      _picture: (c.thumbnail_url as string | null) || (isPicture(c.file_url) ? c.file_url as string : null),
      _duration: null as number | null,
      _kind: kindOfCreation(c.type),
      _label: CREATION_LABELS[c.type] ?? c.type,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Apply the tab. Older addresses still work: ?type=other lists types the
  // library doesn't know, and any other ?type= (e.g. logo) filters by that type.
  const filteredItems = activeTab
    ? allItems.filter(item => activeTab.shows(item._kind))
    : typeFilter === 'other'
      ? allItems.filter(item => !KNOWN_TYPES.has(item.type))
      : typeFilter
        ? allItems.filter(item => item.type === typeFilter)
        : allItems

  // Shape for the client Library (cards or list, search, sort, paging and
  // delete live there). Recipient is read from the video's draft_data.
  // Custom Graphics: sign all their pictures in one go (library-pictures.ts).
  const signed = await signFlyerPictures(user!.id, filteredItems.map(i => i._picture))
  const pictureOf = (url: string | null) => { const id = flyerFileId(url); return (id && signed.get(id)) || url }
  const draftById = new Map(videoRows.map(v => [v.id, (v as any).draft_data as any]))
  const libraryItems: LibraryItem[] = filteredItems.map((item) => {
    const draft = item._videoId ? draftById.get(item._videoId) : null
    return {
      id: item.id,
      videoId: item._videoId ?? null,
      type: item.type,
      kind: item._kind,
      label: item._label,
      title: item.title ?? null,
      recipient: draft?.recipientName ?? null,
      fileUrl: item.file_url ?? null,
      picture: pictureOf(item._picture ?? null),
      duration: item._duration ?? null,
      status: item._status ?? null,
      progressPct: item._progressPct ?? null,
      draftStep: draft?.step,
      creditsUsed: item.credits_used ?? null,
      createdAt: item.created_at,
    }
  })

  const isAll = !activeTab && !typeFilter
  const hasOlder = allItems.some(item => isOlderKind(item._kind))
  const tabs = libraryTabs(hasOlder || activeTab?.key === 'older')

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{activeTab ? activeTab.label : NAMES.library}</h1>
          <p>{activeTab
            ? activeTab.key === 'older' || !tabs.includes(activeTab)
              ? 'Slide decks and graphics made before Docs2Video became videos-only. They still open, download and share; new ones can’t be made.'
              : `Showing ${activeTab.label.toLowerCase()} only.`
            : typeFilter ? 'Showing some of what you’ve made.' : 'Everything you’ve made.'}</p>
        </div>
        <Link href="/create/start" className="btn btn-primary btn-lg">{NAMES.newButton}</Link>
      </div>

      <nav className="kit-tabs" aria-label="Show one kind" style={{ marginBottom: 16 }}>
        {tabs.map(tab => (
          <Link
            key={tab.key}
            href={tab.key ? `/videos?type=${tab.key}` : '/videos'}
            className="kit-tab"
            aria-current={(tab.key ? activeTab?.key === tab.key || (tab.key === 'older' && !!activeTab && !tabs.includes(activeTab)) : isAll) ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <Library items={libraryItems} emptyLabel={activeTab?.label.toLowerCase() ?? null} />
    </div>
  )
}

// =============================================================================
// THE PAGED LIBRARY (All · Videos · Presentations).
// =============================================================================
async function PagedLibrary({ sp, pagedKey, userId, supabase }: {
  sp: Search
  pagedKey: PagedTabKey
  userId: string
  supabase: Awaited<ReturnType<typeof createClient>>
}) {
  const activeTab = tabFor(pagedKey || null)
  const sort: SortId = (SORTS.find((o) => o.id === sp.sort)?.id) ?? 'newest'
  const perNum = Number(sp.per)
  const per: number = (PAGE_SIZES as readonly number[]).includes(perNum) ? perNum : PAGE_SIZES[0]
  const askedPage = Math.max(1, Math.floor(Number(sp.page) || 1))
  const q = (sp.q ?? '').slice(0, 80)
  const pattern = searchPattern(q)

  // Only what a card needs: the who-it's-for name and the draft step come out
  // of draft_data as two short values, never the whole draft.
  const BASE = 'id, user_id, title, thumbnail_url, video_url, status, progress_pct, created_at, deducted_cost, output_type, recipient:draft_data->>recipientName, draft_step:draft_data->step'
  const read = (cols: string, page: number) => {
    let query = supabase.from('videos').select(cols, { count: 'exact' }).eq('user_id', userId)
    const f = videosFilterFor(pagedKey)
    if (f.or) query = query.or(f.or)
    if (f.eq) query = query.eq(f.eq[0], f.eq[1])
    if (pattern) query = query.or(`title.ilike.${pattern},draft_data->>recipientName.ilike.${pattern}`)
    query = sort === 'name'
      ? query.order('title', { ascending: true, nullsFirst: false })
      : query.order('created_at', { ascending: sort === 'oldest' })
    const from = (page - 1) * per
    return query.order('id', { ascending: true }).range(from, from + per - 1)
  }
  const readPage = async (page: number) => {
    const rich = await read(`${BASE}, duration, first_slide:slide_urls->>0`, page)
    if (!rich.error) return rich
    // A column missing in this database: plain columns, placeholder pictures.
    return read(BASE, page)
  }

  // "Older items" shows only when there is something in it: two counts, no rows.
  const [first, olderCreations, olderVideos] = await Promise.all([
    readPage(askedPage),
    supabase.from('creations').select('id', { count: 'exact', head: true }).eq('user_id', userId).neq('type', 'video'),
    supabase.from('videos').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('output_type', [...OLDER_OUTPUT_TYPES]),
  ])
  let res = first
  const total = res.count ?? 0
  const lastPage = Math.max(1, Math.ceil(total / per))
  let page = askedPage
  if (page > lastPage) { page = lastPage; res = await readPage(page) }

  type Row = {
    id: string; user_id: string; title: string | null; thumbnail_url: string | null; video_url: string | null
    status: string | null; progress_pct: number | null; created_at: string; deducted_cost: number | null
    output_type: string | null; recipient: string | null; draft_step: unknown; duration?: number | null; first_slide?: string | null
  }
  const rows = ((res.data ?? []) as unknown as Row[])
  const items: LibraryItem[] = rows.map((v) => ({
    id: v.id,
    videoId: v.id,
    type: 'video',
    kind: kindOfOutput(v.output_type),
    label: madeLabel(v.output_type),
    title: v.title ?? null,
    recipient: typeof v.recipient === 'string' && v.recipient.trim() ? v.recipient : null,
    fileUrl: v.video_url ?? null,
    picture: v.thumbnail_url || (isPicture(v.first_slide) ? v.first_slide! : null),
    duration: typeof v.duration === 'number' ? v.duration : null,
    status: v.status ?? null,
    progressPct: v.progress_pct ?? null,
    draftStep: v.draft_step,
    creditsUsed: v.deducted_cost ?? null,
    createdAt: v.created_at,
  }))

  const hasOlder = (olderCreations.count ?? 0) > 0 || (olderVideos.count ?? 0) > 0
  const tabs = libraryTabs(hasOlder)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{activeTab ? activeTab.label : NAMES.library}</h1>
          <p>{activeTab
            ? `Showing ${activeTab.label.toLowerCase()} only.`
            : hasOlder
              ? 'Your videos and presentations. Older slide decks and graphics are under Older items.'
              : 'Your videos and presentations.'}</p>
        </div>
        <Link href="/create/start" className="btn btn-primary btn-lg">{NAMES.newButton}</Link>
      </div>

      <nav className="kit-tabs" aria-label="Show one kind" style={{ marginBottom: 16 }}>
        {tabs.map(tab => (
          <Link
            key={tab.key}
            href={tab.key ? `/videos?type=${tab.key}` : '/videos'}
            className="kit-tab"
            aria-current={(tab.key || '') === pagedKey ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <Library
        items={items}
        emptyLabel={activeTab?.label.toLowerCase() ?? null}
        paging={{ type: pagedKey, page, per, total, q, sort }}
      />
    </div>
  )
}
