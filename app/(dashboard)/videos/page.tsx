import Link from 'next/link'
import { createClient } from '../../_lib/supabase/server'

const PAGE_SIZE = 20

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
}

const TYPE_LABELS: Record<string, string> = {
  video: 'Video',
  flyer: 'Flyer',
  logo: 'Logo',
  'business-card': 'Business Card',
  card: 'Card',
  infographic: 'Infographic',
  remix: 'Remix',
  'social-kit': 'Social Kit',
  template: 'Template',
}

const TYPE_COLORS: Record<string, string> = {
  video: 'mint',
  flyer: 'peach',
  logo: 'lilac',
  'business-card': 'sky',
  card: 'sky',
  infographic: 'mint',
  remix: 'rose',
  'social-kit': 'sun',
  template: 'peach',
}

const FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'video', label: 'Videos' },
  { key: 'deck', label: 'Decks' },
  { key: 'logo', label: 'Logos' },
  { key: 'business-card', label: 'Cards' },
  { key: 'flyer', label: 'Flyers' },
  { key: 'infographic', label: 'Infographics' },
  { key: 'social-kit', label: 'Social' },
  { key: 'other', label: 'Other' },
] as const

const KNOWN_TYPES = new Set<string>(FILTER_TABS.map(t => t.key).filter(Boolean))

const FILTER_TITLES: Record<string, string> = {
  video: 'Your Videos',
  deck: 'Your Decks',
  logo: 'Your Logos',
  'business-card': 'Your Cards',
  flyer: 'Your Flyers',
  infographic: 'Your Infographics',
  'social-kit': 'Your Social Kits',
  other: 'Your Other Creations',
}

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ page?: string; type?: string }> }) {
  const { page: pageParam, type: typeFilter } = await searchParams
  const currentPage = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const from = (currentPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Query BOTH tables and merge — videos table is authoritative for videos,
  // creations table has everything else (flyers, logos, cards, etc.)
  const [{ data: videos }, { data: otherCreations }] = await Promise.all([
    supabase
      .from('videos')
      .select('id, user_id, title, thumbnail_url, video_url, status, created_at')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('creations')
      .select('*')
      .eq('user_id', user!.id)
      .neq('type', 'video') // Exclude videos since we get them from videos table
      .order('created_at', { ascending: false }),
  ])

  // Merge and sort by date
  const allItems: Creation[] = [
    ...(videos ?? []).map(v => ({
      id: v.id,
      user_id: v.user_id,
      type: 'video' as string,
      title: v.title,
      thumbnail_url: v.thumbnail_url,
      file_url: v.video_url,
      credits_used: 3,
      created_at: v.created_at,
      _videoId: v.id, // Keep the real video ID
      _status: v.status,
    })),
    ...(otherCreations ?? []).map(c => ({
      ...c,
      _videoId: null as string | null,
      _status: null as string | null,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Apply type filter
  const filteredItems = typeFilter
    ? typeFilter === 'other'
      ? allItems.filter(item => !KNOWN_TYPES.has(item.type))
      : allItems.filter(item => item.type === typeFilter)
    : allItems

  const total = filteredItems.length
  const creations = filteredItems.slice(from, to + 1)
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const showingFrom = total === 0 ? 0 : from + 1
  const showingTo = Math.min(to + 1, total)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{typeFilter ? (FILTER_TITLES[typeFilter] ?? 'Your Library') : 'Your Library'}</h1>
          <p>{typeFilter ? `Filtered by ${FILTER_TABS.find(t => t.key === typeFilter)?.label?.toLowerCase() ?? typeFilter}.` : 'All your creations.'}</p>
        </div>
        <Link href="/create" className="btn btn-primary btn-lg">
          + New Creation
        </Link>
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

      {!creations?.length ? (
        <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: '64px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No creations yet</p>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 18 }}>Create content first -- videos, flyers, logos, and more</p>
          <Link href="/create" className="btn btn-primary">Create content &rarr;</Link>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
          {(creations as Creation[]).map((item, i) => {
            const isVideo = item.type === 'video'
            let href = item.file_url ?? '#'
            let linkProps: { target?: '_blank'; rel?: string } = { target: '_blank', rel: 'noopener noreferrer' }
            if (isVideo) {
              // Use the real video ID from the videos table
              href = `/videos/${item._videoId ?? item.id}`
              linkProps = {}
            }

            return (
              <Link
                key={item.id}
                href={href}
                {...linkProps}
                className="activity-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 24px',
                  textDecoration: 'none',
                  color: 'var(--ink)',
                  borderBottom: i < (creations as Creation[]).length - 1 ? '1px solid var(--border-light)' : 'none',
                  transition: 'background 0.1s ease',
                }}
              >
                {/* Thumbnail / icon */}
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: item.thumbnail_url ? 'var(--bg)' : ['var(--mint)', 'var(--peach)', 'var(--lilac)', 'var(--sky)'][i % 4],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', position: 'relative',
                }}>
                  {item.thumbnail_url ? (
                    <>
                      <img src={item.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {isVideo && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="8 4 20 12 8 20" /></svg>
                        </div>
                      )}
                    </>
                  ) : isVideo ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                  )}
                </div>

                {/* Title */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title ?? 'Untitled'}
                  </div>
                  {item.credits_used != null && (
                    <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>
                      {item.credits_used} credit{item.credits_used !== 1 ? 's' : ''} used
                    </div>
                  )}
                </div>

                {/* Type badge */}
                <span className={`tag ${TYPE_COLORS[item.type] ?? 'peach'}`} style={{ flexShrink: 0 }}>
                  {TYPE_LABELS[item.type] ?? item.type}
                </span>
                {/* Language badge — show if title has a language suffix like (Spanish) */}
                {(() => {
                  const langMatch = (item.title ?? '').match(/\((Spanish|French|Portuguese|German|Korean|Japanese|Chinese \(Simplified\)|Arabic|Hindi|Italian)\)\s*$/)
                  return langMatch ? (
                    <span className="tag lilac" style={{ flexShrink: 0, fontSize: 11 }}>
                      {langMatch[1]}
                    </span>
                  ) : null
                })()}
                {/* Video status badge */}
                {isVideo && item._status && item._status !== 'completed' && (
                  <span className={`tag ${item._status === 'failed' ? 'rose' : 'peach'}`} style={{ flexShrink: 0, fontSize: 11 }}>
                    {item._status === 'failed' ? 'Failed' : 'Processing'}
                  </span>
                )}

                {/* Date */}
                <div style={{ fontSize: 13, color: 'var(--ink-light)', flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
                  {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>

                {/* Arrow */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
              </Link>
            )
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {total > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 24,
          padding: '16px 24px',
          background: 'white',
          border: '1px solid var(--border-light)',
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
            Showing {showingFrom}&ndash;{showingTo} of {total}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {currentPage > 1 ? (
              <Link
                href={`/videos?page=${currentPage - 1}${typeFilter ? `&type=${typeFilter}` : ''}`}
                className="btn btn-soft btn-sm"
              >
                &larr; Previous
              </Link>
            ) : (
              <span
                className="btn btn-soft btn-sm"
                style={{ opacity: 0.4, pointerEvents: 'none' }}
              >
                &larr; Previous
              </span>
            )}
            {currentPage < totalPages ? (
              <Link
                href={`/videos?page=${currentPage + 1}${typeFilter ? `&type=${typeFilter}` : ''}`}
                className="btn btn-soft btn-sm"
              >
                Next &rarr;
              </Link>
            ) : (
              <span
                className="btn btn-soft btn-sm"
                style={{ opacity: 0.4, pointerEvents: 'none' }}
              >
                Next &rarr;
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
