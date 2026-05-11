import Link from 'next/link'
import { createClient } from '../../_lib/supabase/server'

// Feature flags — now driven by user's subscription plan

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_remaining, pack_credits, subscription_status')
    .eq('id', user!.id)
    .single()

  const { data: infographics } = await supabase
    .from('infographics')
    .select('*, brand:brands(*)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(6)

  const { data: videos } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(6)

  // Only show videos (explainers) in the recent list
  const recentItems = [
    ...(videos ?? []).map((v: any) => ({ ...v, _type: 'video' as const })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6)

  const { count: infographicCount } = await supabase
    .from('infographics')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const { count: videoCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const totalCount = (infographicCount ?? 0) + (videoCount ?? 0)

  // Pending follow-ups
  const { data: pendingFollowUps } = await supabase
    .from('follow_up_emails')
    .select('*, plan:follow_up_plans(client_name, video_id, video:videos(title))')
    .eq('user_id', user!.id)
    .eq('status', 'pending')
    .order('scheduled_date', { ascending: true })
    .limit(5)

  const pendingCount = pendingFollowUps?.length ?? 0

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back. Here's your overview.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/create" className="btn btn-primary">+ Explainer</Link>
          <Link href="/flyers" className="btn btn-soft">+ Flyer</Link>
          <Link href="/business-cards" className="btn btn-soft">+ Business Card</Link>
          <Link href="/infographic-creator" className="btn btn-soft">+ Infographic</Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card mint">
          <div className="stat-label">Credits Remaining</div>
          <div className="stat-value">{profile?.credits_remaining ?? 0}</div>
          <div className="stat-foot">
            <Link href="/settings" style={{ color: 'inherit', textDecoration: 'underline' }}>
              Manage plan
            </Link>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Explainers</div>
          <div className="stat-value">{videoCount ?? 0}</div>
          <div className="stat-foot">
            <Link href="/videos" style={{ color: 'inherit', textDecoration: 'underline' }}>
              View all
            </Link>
          </div>
        </div>
        <div className="stat-card peach">
          <div className="stat-label">Pack Credits</div>
          <div className="stat-value">{(profile as any)?.pack_credits ?? 0}</div>
          <div className="stat-foot">
            <Link href="/settings" style={{ color: 'inherit', textDecoration: 'underline' }}>
              Buy more
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Recent creations</h2>
        {totalCount > 6 && (
          <Link href="/videos" className="btn btn-soft btn-sm">View all &rarr;</Link>
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
            const isVideo = item._type === 'video'
            const href = isVideo ? `/videos/${item.id}` : `/infographics/${item.id}`
            return (
              <Link
                key={item.id}
                href={href}
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
                {/* Icon */}
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: item.image_url || item.thumbnail_url ? 'var(--bg)' : ['var(--mint)', 'var(--peach)', 'var(--lilac)', 'var(--sky)', 'var(--sun)', 'var(--rose)'][i % 6],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  {item.image_url || item.thumbnail_url ? (
                    <img src={item.image_url ?? item.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : isVideo ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  )}
                </div>

                {/* Title + type */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title ?? item.source_pdf_name ?? 'Untitled'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>
                    {isVideo ? 'Video' : 'Infographic'}
                    {item.source_pdf_name && item.title ? ` \u00B7 From ${item.source_pdf_name}` : ''}
                  </div>
                </div>

                {/* Status */}
                <span className={`tag ${item.status === 'completed' ? 'mint' : item.status === 'failed' ? 'rose' : 'peach'}`} style={{ flexShrink: 0 }}>
                  {item.status === 'completed' ? 'Done' : item.status === 'failed' ? 'Failed' : 'Processing'}
                </span>

                {/* Date */}
                <div style={{ fontSize: 13, color: 'var(--ink-light)', flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
                  {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>

                {/* Arrow */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            )
          })}
        </div>
      )}
      {/* Pending Follow-Ups — hidden for explainers-only mode */}
      {profile?.subscription_status && ['professional', 'active', 'agency'].includes(profile.subscription_status.toLowerCase()) && pendingCount > 0 && (
        <div style={{ marginTop: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700 }}>
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
