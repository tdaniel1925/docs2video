import Link from 'next/link'
import { createClient } from '../../_lib/supabase/server'

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  video: { label: 'Video', color: 'mint' },
  flyer: { label: 'Flyer', color: 'peach' },
  'business-card': { label: 'Card', color: 'lilac' },
  infographic: { label: 'Infographic', color: 'sky' },
  ad: { label: 'Ad', color: 'sun' },
  'brand-deck': { label: 'Deck', color: 'rose' },
  logo: { label: 'Logo', color: 'sun' },
  remix: { label: 'Remix', color: 'rose' },
  'social-kit': { label: 'Social Kit', color: 'mint' },
  template: { label: 'Template', color: 'peach' },
}

const HERO_PRODUCTS = [
  { href: '/create', icon: '\uD83C\uDFAC', label: 'Video Explainer', desc: 'Turn any document into a narrated video', price: '$29', cta: 'Create' },
  { href: '/brand-kit', icon: '\uD83C\uDFAF', label: 'Brand Kit', desc: 'Logo, cards, social media \u2014 everything', price: '$149', cta: 'Build' },
  { href: '/logo-creator', icon: '\uD83C\uDFA8', label: 'Logo Design', desc: '4 AI-designed logo concepts', price: '$49', cta: 'Design' },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, credits_remaining, subscription_status, referred_by, card_on_file, free_videos_remaining')
    .eq('id', user!.id)
    .single()

  // Fetch from BOTH videos and creations tables, merge for accurate counts
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [{ data: videos }, { data: otherCreations }, { count: videoCount }, { count: videoMonthCount }] = await Promise.all([
    supabase.from('videos').select('id, title, thumbnail_url, video_url, status, created_at')
      .eq('user_id', user!.id).order('created_at', { ascending: false }).limit(8),
    supabase.from('creations').select('*')
      .eq('user_id', user!.id).neq('type', 'video').order('created_at', { ascending: false }).limit(8),
    supabase.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
    supabase.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).gte('created_at', monthStart),
  ])

  const [{ count: creationCount }, { count: creationMonthCount }, { count: nonFailedVideoCount }] = await Promise.all([
    supabase.from('creations').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).neq('type', 'video'),
    supabase.from('creations').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).neq('type', 'video').gte('created_at', monthStart),
    supabase.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).neq('status', 'failed'),
  ])

  // Merge and sort by date
  const allItems = [
    ...(videos ?? []).map((v: any) => ({
      id: v.id, type: 'video', title: v.title, thumbnail_url: v.thumbnail_url,
      file_url: v.video_url, credits_used: 3, created_at: v.created_at, _videoId: v.id,
    })),
    ...(otherCreations ?? []).map((c: any) => ({ ...c, _videoId: null })),
  ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const recentItems = allItems.slice(0, 8)
  const totalCount = (videoCount ?? 0) + (creationCount ?? 0)
  const monthCount = (videoMonthCount ?? 0) + (creationMonthCount ?? 0)

  // Pending follow-ups
  const { data: pendingFollowUps } = await supabase
    .from('follow_up_emails')
    .select('*, plan:follow_up_plans(client_name, video_id, video:videos(title))')
    .eq('user_id', user!.id)
    .eq('status', 'pending')
    .order('scheduled_date', { ascending: true })
    .limit(5)

  const pendingCount = pendingFollowUps?.length ?? 0

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const isPro = profile?.subscription_status && ['professional', 'active', 'agency', 'starter', 'pro', 'business'].includes((profile.subscription_status ?? '').toLowerCase())
  const planName = profile?.subscription_status
    ? profile.subscription_status.charAt(0).toUpperCase() + profile.subscription_status.slice(1)
    : 'Free'
  const isFirstTime = totalCount === 0

  // Free trial status
  const hasReferral = !!profile?.referred_by
  const cardOnFile = profile?.card_on_file ?? false
  const freeVideosRemaining = profile?.free_videos_remaining ?? 0
  const isTrialUser = !isPro && !hasReferral
  const trialVideosUsed = 5 - freeVideosRemaining
  const trialVideosRemaining = freeVideosRemaining
  const trialExhausted = isTrialUser && freeVideosRemaining <= 0 && !cardOnFile

  return (
    <div>
      {/* Header */}
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1>Welcome back, {firstName}</h1>
        </div>
        {isPro && (
          <span className="tag mint" style={{ fontSize: 13, fontWeight: 700, padding: '6px 14px' }}>
            Pro
          </span>
        )}
      </div>

      {/* Free trial banner */}
      {isTrialUser && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 18px', marginBottom: 20, borderRadius: 10,
          background: trialExhausted
            ? 'linear-gradient(135deg, #fef2f2, #fff1f2)'
            : 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
          border: `1px solid ${trialExhausted ? '#fecaca' : '#bbf7d0'}`,
          fontSize: 13,
        }}>
          <div style={{ flex: 1 }}>
            {trialExhausted ? (
              <>
                <strong style={{ color: '#991b1b' }}>Free videos used</strong>
                <span style={{ color: '#b91c1c', marginLeft: 8 }}>
                  Add a payment method or subscribe to keep creating.
                </span>
              </>
            ) : freeVideosRemaining > 0 ? (
              <>
                <strong style={{ color: '#166534' }}>Free videos</strong>
                <span style={{ color: '#15803d', marginLeft: 8 }}>
                  {freeVideosRemaining} of 5 free videos remaining
                </span>
              </>
            ) : cardOnFile ? (
              <>
                <strong style={{ color: '#166534' }}>Pay per video</strong>
                <span style={{ color: '#15803d', marginLeft: 8 }}>
                  $10 per video — charged to your card on file
                </span>
              </>
            ) : (
              <>
                <strong style={{ color: '#166534' }}>Free videos</strong>
                <span style={{ color: '#15803d', marginLeft: 8 }}>
                  {freeVideosRemaining} of 5 free videos remaining
                </span>
              </>
            )}
          </div>
          <Link
            href="/settings"
            className="btn btn-sm"
            style={{
              background: trialExhausted ? '#dc2626' : 'var(--mint)',
              color: 'white', fontWeight: 600, fontSize: 12, padding: '6px 14px', borderRadius: 8,
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            {trialExhausted ? 'Choose a plan' : 'Upgrade'}
          </Link>
        </div>
      )}

      {isFirstTime ? (
        /* ── First-time user: welcome hero ── */
        <div style={{ marginTop: 8 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, textAlign: 'center' }}>
            What would you like to create?
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
            {HERO_PRODUCTS.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  background: 'white',
                  border: '1px solid var(--border-light)',
                  borderRadius: 16,
                  padding: '40px 24px 32px',
                  textDecoration: 'none',
                  color: 'var(--ink)',
                  transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                }}
                className="activity-row"
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>{p.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{p.label}</div>
                <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 20, lineHeight: 1.5 }}>
                  {p.desc}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 16, color: 'var(--ink)' }}>
                  {p.price}
                </div>
                <span className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  {p.cta} &rarr;
                </span>
              </Link>
            ))}
          </div>

          <div style={{ textAlign: 'center' }}>
            <Link href="/create" style={{ fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'underline' }}>
              Or explore all products &rarr;
            </Link>
          </div>
        </div>
      ) : (
        /* ── Returning user ── */
        <div>
          {/* Big Create button */}
          <div style={{ marginBottom: 32 }}>
            <Link
              href="/create"
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 18,
                fontWeight: 700,
                padding: '16px 36px',
                borderRadius: 12,
              }}
            >
              + Create
              <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}>&mdash; $10 per video</span>
            </Link>
          </div>

          {/* Stats bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: 'var(--ink-soft)',
            marginBottom: 28,
          }}>
            <span>{totalCount} project{totalCount !== 1 ? 's' : ''} created</span>
            <span>&middot;</span>
            <span>{planName} member</span>
          </div>

          {/* Recent Creations */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Recent Creations</h2>
            <Link href="/videos" className="btn btn-soft btn-sm">
              View all &rarr;
            </Link>
          </div>

          <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
            {recentItems.map((item: any, i: number) => {
              const isVideo = item.type === 'video'
              const href = isVideo ? `/videos/${item._videoId ?? item.id}` : (item.file_url ?? '#')
              const badge = TYPE_BADGE[item.type] ?? { label: item.type, color: 'sky' }
              const TagEl = isVideo ? Link : 'a'
              const linkProps = isVideo
                ? { href }
                : { href, target: '_blank' as const, rel: 'noopener noreferrer' }
              return (
                <TagEl
                  key={item.id}
                  {...linkProps}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '16px 24px',
                    textDecoration: 'none',
                    color: 'var(--ink)',
                    borderBottom: i < recentItems.length - 1 ? '1px solid var(--border-light)' : 'none',
                    transition: 'background 0.1s ease',
                  }}
                  className="activity-row"
                >
                  {/* Thumbnail */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: item.thumbnail_url ? 'var(--bg)' : `var(--${badge.color})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : isVideo ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    )}
                  </div>

                  {/* Title + type */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title ?? 'Untitled'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>
                      {badge.label}
                    </div>
                  </div>

                  {/* Type badge */}
                  <span className={`tag ${badge.color}`} style={{ flexShrink: 0 }}>
                    {badge.label}
                  </span>

                  {/* Date */}
                  <div style={{ fontSize: 13, color: 'var(--ink-light)', flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
                    {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>

                  {/* Arrow */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                </TagEl>
              )
            })}
            {(totalCount ?? 0) > 8 && (
              <Link
                href="/videos"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '14px 24px',
                  textDecoration: 'none',
                  color: 'var(--ink-soft)',
                  fontSize: 14,
                  fontWeight: 600,
                  borderTop: '1px solid var(--border-light)',
                  transition: 'background 0.1s ease',
                }}
                className="activity-row"
              >
                View all {totalCount} creations &rarr;
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
