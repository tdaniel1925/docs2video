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

const QUICK_CREATE = [
  { href: '/create', icon: '\uD83D\uDCF9', label: 'Explainer', color: 'mint', credits: 3 },
  { href: '/infographic-creator', icon: '\uD83D\uDCCA', label: 'Infographic', color: 'sky', credits: 1 },
  { href: '/flyers', icon: '\uD83D\uDCCB', label: 'Flyer', color: 'peach', credits: 1 },
  { href: '/business-cards', icon: '\uD83D\uDCB3', label: 'Card', color: 'lilac', credits: 1 },
  { href: '/logo-creator', icon: '\uD83C\uDFA8', label: 'Logo', color: 'sun', credits: 2 },
  { href: '/templates', icon: '\uD83C\uDFAF', label: 'Template', color: 'rose', credits: 2 },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, credits_remaining, subscription_status')
    .eq('id', user!.id)
    .single()

  // Fetch recent creations from the unified creations table
  const { data: creations } = await supabase
    .from('creations')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(8)

  const recentItems = (creations ?? []) as any[]

  const { count: totalCount } = await supabase
    .from('creations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  // Count creations this month
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { count: monthCount } = await supabase
    .from('creations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .gte('created_at', monthStart)

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
  const creditsRemaining = profile?.credits_remaining ?? 0

  // Derive plan monthly allocation from subscription status
  const PLAN_CREDITS: Record<string, number> = {
    free: 5, trial: 5, demo: 5,
    starter: 50,
    professional: 150, active: 150,
    agency: 500,
  }
  const planKey = (profile?.subscription_status ?? 'free').toLowerCase()
  const monthlyAllocation = PLAN_CREDITS[planKey] ?? 5
  const creditPercent = monthlyAllocation > 0 ? Math.min(100, Math.round((creditsRemaining / monthlyAllocation) * 100)) : 0

  const planName = profile?.subscription_status
    ? profile.subscription_status.charAt(0).toUpperCase() + profile.subscription_status.slice(1)
    : 'Free'

  return (
    <div>
      {/* Header Section */}
      <div className="page-head">
        <div>
          <h1>Welcome back, {firstName}</h1>
          <p>Here&apos;s what&apos;s happening</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card mint">
          <div className="stat-label">Credits Remaining</div>
          <div className="stat-value">{creditsRemaining} <span style={{ fontSize: 20, fontWeight: 500, color: 'var(--ink-soft)' }}>/ {monthlyAllocation} mo</span></div>
          <div className="credit-progress">
            <div className="credit-progress-fill" style={{ width: `${creditPercent}%` }} />
          </div>
          <div className="stat-foot">
            <Link href="/settings" style={{ color: 'inherit', textDecoration: 'underline' }}>
              Manage plan
            </Link>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Creations</div>
          <div className="stat-value">{totalCount ?? 0}</div>
          <div className="stat-foot">
            {monthCount ?? 0} this month
          </div>
        </div>
        <div className="stat-card peach">
          <div className="stat-label">Plan</div>
          <div className="stat-value" style={{ fontSize: 32 }}>{planName}</div>
          <div className="stat-foot">
            <Link href="/settings" style={{ color: 'inherit', textDecoration: 'underline' }}>
              Upgrade
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Create */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Quick Create</h2>
      </div>
      <div className="quick-create-grid">
        {QUICK_CREATE.map((item) => (
          <Link key={item.href} href={item.href} className="quick-create-card">
            <div className={`quick-create-icon ${item.color}`}>{item.icon}</div>
            <div className="quick-create-label">{item.label}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>{item.credits} credit{item.credits > 1 ? 's' : ''}</div>
          </Link>
        ))}
      </div>

      {/* Recent Creations */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Recent Creations</h2>
        {(totalCount ?? 0) > 0 && (
          <Link href="/videos" className="btn btn-soft btn-sm">
            View all {totalCount! > 8 ? `${totalCount} creations` : 'creations'} &rarr;
          </Link>
        )}
      </div>

      {!recentItems.length ? (
        <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: '64px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Nothing created yet</p>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 18 }}>Create an explainer video, flyer, or business card to get started</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Link href="/create" className="btn btn-primary">+ Explainer Video</Link>
            <Link href="/flyers" className="btn btn-soft">+ Flyer or Card</Link>
          </div>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
          {recentItems.map((item: any, i: number) => {
            const isVideo = item.type === 'video'
            // For videos, extract video ID from file_url pattern: .../userId/videoId.mp4
            let videoHref = item.file_url ?? '#'
            if (isVideo && item.file_url) {
              const match = item.file_url.match(/\/([0-9a-f-]{36})\.mp4/)
              if (match) videoHref = `/videos/${match[1]}`
            }
            const href = isVideo ? videoHref : (item.file_url ?? '#')
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
                  borderBottom: i < recentItems.length - 1 && !((totalCount ?? 0) > 8 && i === recentItems.length - 1) ? '1px solid var(--border-light)' : 'none',
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
                    {item.credits_used ? ` \u00B7 ${item.credits_used} credit${item.credits_used > 1 ? 's' : ''}` : ''}
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
      )}

      {/* Pending Follow-Ups */}
      {profile?.subscription_status && ['professional', 'active', 'agency'].includes(profile.subscription_status.toLowerCase()) && pendingCount > 0 && (
        <div style={{ marginTop: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>
              Pending Follow-Ups
              <span className="tag peach" style={{ marginLeft: 10, fontSize: 12, verticalAlign: 'middle' }}>
                {pendingCount}
              </span>
            </h2>
          </div>
          <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
            {(pendingFollowUps ?? []).map((fu: any, i: number) => {
              const clientName = fu.plan?.client_name ?? 'Client'
              const videoTitle = fu.plan?.video?.title ?? 'Untitled'
              const videoId = fu.plan?.video_id
              return (
                <Link
                  key={fu.id}
                  href={videoId ? `/videos/${videoId}` : '#'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '14px 24px',
                    textDecoration: 'none',
                    color: 'var(--ink)',
                    borderBottom: i < (pendingFollowUps?.length ?? 0) - 1 ? '1px solid var(--border-light)' : 'none',
                  }}
                  className="activity-row"
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: 'var(--peach)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                  }}>
                    D{fu.day_offset}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fu.subject}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>
                      {clientName} &middot; {videoTitle}
                    </div>
                  </div>
                  {fu.scheduled_date && (
                    <div style={{ fontSize: 12, color: 'var(--ink-light)', flexShrink: 0 }}>
                      {new Date(fu.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
