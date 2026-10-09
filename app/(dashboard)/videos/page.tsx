import Link from 'next/link'
import { createClient } from '../../_lib/supabase/server'
import { NAMES, KIND_NAMES, kindOfOutput, type LibraryKind } from '../../_lib/names'
import { madeLabel } from '../dashboard/_home/derive'
import Library from './Library'
import { isPicture, type LibraryItem } from './library-items'
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

// The tabs, in order. `key` is the ?type= value in the address, so a refresh
// (or a shared link) keeps the tab. Custom Graphics keeps its old ?type=flyer
// so links already out there still land on it.
const FILTER_TABS: { key: string; kind: LibraryKind | null; label: string }[] = [
  { key: '', kind: null, label: 'All' },
  { key: 'video', kind: 'video', label: KIND_NAMES.video.many },
  { key: 'presentation', kind: 'presentation', label: KIND_NAMES.presentation.many },
  { key: 'deck', kind: 'deck', label: KIND_NAMES.deck.many },
  { key: 'flyer', kind: 'graphic', label: KIND_NAMES.graphic.many },
]

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type: typeFilter } = await searchParams
  const activeTab = FILTER_TABS.find(t => t.key && t.key === typeFilter) ?? null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
    ? allItems.filter(item => item._kind === activeTab.kind)
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

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{activeTab ? `Your ${activeTab.label}` : `Your ${NAMES.library}`}</h1>
          <p>{activeTab
            ? `Showing ${activeTab.label.toLowerCase()} only.`
            : typeFilter ? 'Showing some of what you’ve made.' : 'Everything you’ve made.'}</p>
        </div>
        <Link href="/create/start" className="btn btn-primary btn-lg">{NAMES.newButton}</Link>
      </div>

      <nav className="kit-tabs" aria-label="Show one kind" style={{ marginBottom: 16 }}>
        {FILTER_TABS.map(tab => (
          <Link
            key={tab.key}
            href={tab.key ? `/videos?type=${tab.key}` : '/videos'}
            className="kit-tab"
            aria-current={(tab.key ? activeTab?.key === tab.key : isAll) ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <Library items={libraryItems} emptyLabel={activeTab?.label.toLowerCase() ?? null} />
    </div>
  )
}
