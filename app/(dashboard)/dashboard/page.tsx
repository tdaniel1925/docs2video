import React from 'react'
import Link from 'next/link'
import { createClient } from '../../_lib/supabase/server'
import { getBalance } from '../../_lib/credits'
import { displayProgress } from '../../_lib/video-progress'

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  video: { label: 'Video', color: 'mint' },
  flyer: { label: 'Flyer', color: 'peach' },
  'business-card': { label: 'Card', color: 'lilac' },
  infographic: { label: 'Infographic', color: 'sky' },
  ad: { label: 'Ad', color: 'sun' },
  'brand-deck': { label: 'Deck', color: 'rose' },
  deck: { label: 'Deck', color: 'rose' },
  logo: { label: 'Logo', color: 'sun' },
  remix: { label: 'Remix', color: 'rose' },
  'social-kit': { label: 'Social Kit', color: 'mint' },
  template: { label: 'Template', color: 'peach' },
}

// Loom walkthrough video URL — set NEXT_PUBLIC_GETTING_STARTED_VIDEO to a real
// Loom embed URL to show the onboarding card. Left unset → card is hidden
// (avoids a dead YOUR_LOOM_ID 404 link for every new user).
const GETTING_STARTED_VIDEO = process.env.NEXT_PUBLIC_GETTING_STARTED_VIDEO || ''
const HAS_GETTING_STARTED_VIDEO = GETTING_STARTED_VIDEO.includes('loom.com/embed/') && !GETTING_STARTED_VIDEO.includes('YOUR_LOOM_ID')

const OUTPUT_ICONS: Record<string, React.ReactNode> = {
  video: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  pptx: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  pdf: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
}

function getDraftUrl(videoId: string, step: number): string {
  switch (step) {
    case 2: return `/create/brand?id=${videoId}`
    case 3: return `/create/voice?id=${videoId}`
    case 4: return `/create/script?id=${videoId}`
    case 5: return `/create/script?id=${videoId}`
    default: return '/create'
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function DraftsSection({ drafts }: { drafts: any[] }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--ink)' }}>
        Continue where you left off
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {drafts.map((draft: any) => {
          const draftData = draft.draft_data || {}
          const outputType = draft.output_type || draftData.outputType || 'video'
          const purpose = draftData.purpose || 'Untitled draft'
          const truncatedPurpose = purpose.length > 60 ? purpose.slice(0, 57) + '...' : purpose
          const step = draftData.step || 1
          const url = getDraftUrl(draft.id, step)

          return (
            <div
              key={draft.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                background: '#F4F1EC',
                border: '1px solid var(--border-light)',
                borderRadius: 10,
              }}
            >
              {/* Output type icon */}
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ink-soft)',
              }}>
                {OUTPUT_ICONS[outputType] || OUTPUT_ICONS.video}
              </div>

              {/* Purpose + time */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {truncatedPurpose}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>
                  Started {timeAgo(draft.updated_at)}
                </div>
              </div>

              {/* Continue button */}
              <Link
                href={url}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'var(--mint)', color: 'white', textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Continue
              </Link>

              {/* Discard button */}
              <DiscardDraftButton videoId={draft.id} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DiscardDraftButton({ videoId }: { videoId: string }) {
  return (
    <form action={async () => {
      'use server'
      const { createAdminClient: createAdmin } = await import('../../_lib/supabase/admin')
      const { createClient: createServerClient } = await import('../../_lib/supabase/server')
      const { revalidatePath } = await import('next/cache')
      const supabase = await createServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const admin = createAdmin()
      await admin.from('videos').delete().eq('id', videoId).eq('user_id', user.id).eq('status', 'draft')
      revalidatePath('/dashboard')
    }}>
      <button
        type="submit"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12, color: 'var(--ink-light)', textDecoration: 'underline',
          padding: '4px 8px', flexShrink: 0,
        }}
      >
        Discard
      </button>
    </form>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, credits_remaining, subscription_status, referred_by, card_on_file, free_videos_remaining')
    .eq('id', user!.id)
    .single()

  // Real spendable credit balance (credit_balances), not the legacy column.
  const creditBalance = await getBalance(user!.id)

  // Fetch drafts for "Continue where you left off" section
  const { data: drafts } = await supabase
    .from('videos')
    .select('id, output_type, draft_data, updated_at')
    .eq('user_id', user!.id)
    .eq('status', 'draft')
    .order('updated_at', { ascending: false })
    .limit(5)

  // Fetch from BOTH videos and creations tables, merge for accurate counts
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [{ data: videos }, { data: otherCreations }, { count: videoCount }, { count: videoMonthCount }] = await Promise.all([
    supabase.from('videos').select('id, title, thumbnail_url, video_url, status, progress_pct, progress_detail, created_at, deducted_cost')
      .eq('user_id', user!.id).order('created_at', { ascending: false }).limit(8),
    // Focused product: only decks shown alongside videos (peripheral types unlinked)
    supabase.from('creations').select('*')
      .eq('user_id', user!.id).in('type', ['deck', 'brand-deck']).order('created_at', { ascending: false }).limit(8),
    supabase.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
    supabase.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).gte('created_at', monthStart),
  ])

  const [{ count: creationCount }, { count: creationMonthCount }, { count: nonFailedVideoCount }] = await Promise.all([
    supabase.from('creations').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).in('type', ['deck', 'brand-deck']),
    supabase.from('creations').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).in('type', ['deck', 'brand-deck']).gte('created_at', monthStart),
    supabase.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).neq('status', 'failed'),
  ])

  // Merge and sort by date
  const allItems = [
    ...(videos ?? []).map((v: any) => ({
      id: v.id, type: 'video', title: v.title, thumbnail_url: v.thumbnail_url,
      file_url: v.video_url, credits_used: v.deducted_cost ?? null, created_at: v.created_at, _videoId: v.id,
      _status: v.status, _progressPct: v.progress_pct, _progressDetail: v.progress_detail,
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
  const isPro = profile?.subscription_status && ['starter', 'pro', 'professional', 'active', 'business', 'enterprise'].includes((profile.subscription_status ?? '').toLowerCase())
  const planName = profile?.subscription_status
    ? profile.subscription_status.charAt(0).toUpperCase() + profile.subscription_status.slice(1)
    : 'Free'
  const isFirstTime = totalCount === 0

  // Free trial status
  const hasReferral = !!profile?.referred_by
  const isTrialUser = !isPro && !hasReferral

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
          background: creditBalance.total <= 0
            ? 'linear-gradient(135deg, #fef2f2, #fff1f2)'
            : 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
          border: `1px solid ${creditBalance.total <= 0 ? '#fecaca' : '#bbf7d0'}`,
          fontSize: 13,
        }}>
          <div style={{ flex: 1 }}>
            {creditBalance.total <= 0 ? (
              <>
                <strong style={{ color: '#991b1b' }}>Out of credits</strong>
                <span style={{ color: '#b91c1c', marginLeft: 8 }}>
                  Top up or subscribe to keep creating.
                </span>
              </>
            ) : (
              <>
                <strong style={{ color: '#166534' }}>Free credits</strong>
                <span style={{ color: '#15803d', marginLeft: 8 }}>
                  {creditBalance.total.toLocaleString()} credits remaining
                </span>
              </>
            )}
          </div>
          <Link
            href="/pricing"
            className="btn btn-sm"
            style={{
              background: creditBalance.total <= 0 ? '#dc2626' : 'var(--mint)',
              color: 'white', fontWeight: 600, fontSize: 12, padding: '6px 14px', borderRadius: 8,
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            {creditBalance.total <= 0 ? 'Choose a plan' : 'Upgrade'}
          </Link>
        </div>
      )}

      {/* First-run guidance — only before any creation exists */}
      {isFirstTime && (
        <div style={{
          padding: '24px 28px', marginBottom: 24, borderRadius: 10,
          background: 'linear-gradient(135deg, #F4F1EC, #ecfdf5)',
          border: '1px solid var(--border-light)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', margin: '0 0 6px' }}>
            Make your first video
          </h2>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 16px', lineHeight: 1.6 }}>
            Three steps, about five minutes — your first one is free.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[
              ['1', 'Pick who it’s for', 'Choose a client to personalize it, or skip for a general video'],
              ['2', 'Add your content', 'Paste a website URL, upload a document, or just describe it'],
              ['3', 'Generate', 'We write the script, design the slides, and narrate it for you'],
            ].map(([n, title, desc]) => (
              <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{
                  flexShrink: 0, width: 24, height: 24, borderRadius: 10, background: 'var(--ink)',
                  color: 'white', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{n}</span>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{title}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-soft)', marginLeft: 8 }}>{desc}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/create/start" style={{
              display: 'inline-block', padding: '12px 28px', borderRadius: 10,
              background: 'var(--mint)', color: 'white', fontSize: 14, fontWeight: 700, textDecoration: 'none',
            }}>
              Create your first video
            </Link>
            <Link href="/help/getting-started" style={{ fontSize: 13, color: 'var(--ink-soft)', textDecoration: 'underline' }}>
              Read the getting-started guide
            </Link>
          </div>
        </div>
      )}

      {/* Continue where you left off — drafts (video/deck outputs only) */}
      {(() => {
        const coreDrafts = (drafts ?? []).filter((d: any) => !d.output_type || ['video', 'pptx', 'pdf'].includes(d.output_type))
        return coreDrafts.length > 0 ? <DraftsSection drafts={coreDrafts} /> : null
      })()}

      {isFirstTime ? (
        /* ── First-time user: getting started ── */
        <div style={{ marginTop: 8 }}>
          {/* Getting started video — only when a real Loom URL is configured */}
          {HAS_GETTING_STARTED_VIDEO && (
          <Link
            href={GETTING_STARTED_VIDEO.replace('/embed/', '/share/')}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginBottom: 24, textDecoration: 'none' }}
          >
            <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <div style={{ textAlign: 'center', color: 'white' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(199,232,168,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#C7E8A8"><polygon points="8 4 20 12 8 20" /></svg>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>See how Docs2Video works</div>
                <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>2 minute walkthrough</div>
              </div>
            </div>
          </Link>
          )}

          {/* Main CTA */}
          <Link
            href="/create/start"
            style={{
              display: 'block', textDecoration: 'none', color: 'var(--ink)',
              background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
              padding: '28px 24px', marginBottom: 20, textAlign: 'center',
              transition: 'box-shadow 0.15s ease',
            }}
            className="activity-row"
          >
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Create Something New</div>
            <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 20, lineHeight: 1.6 }}>
              Make a narrated video explainer or a slide presentation. Upload any document, paste text, or describe an idea — ready in minutes.
            </div>
            <span className="btn btn-primary btn-lg" style={{ fontSize: 16 }}>
              + Create &rarr;
            </span>
          </Link>

          {/* Quick start options */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <Link href="/create/start" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, textDecoration: 'none', color: 'var(--ink)', fontSize: 13, fontWeight: 600, transition: 'border-color 0.15s' }} className="activity-row">
              <span style={{ fontSize: 20 }}>&#128196;</span> Upload a PDF
            </Link>
            <Link href="/create?tab=text" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, textDecoration: 'none', color: 'var(--ink)', fontSize: 13, fontWeight: 600, transition: 'border-color 0.15s' }} className="activity-row">
              <span style={{ fontSize: 20 }}>&#9997;&#65039;</span> Type or paste
            </Link>
            <Link href="/create?tab=idea" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, textDecoration: 'none', color: 'var(--ink)', fontSize: 13, fontWeight: 600, transition: 'border-color 0.15s' }} className="activity-row">
              <span style={{ fontSize: 20 }}>&#128161;</span> Start from idea
            </Link>
          </div>
        </div>
      ) : (
        /* ── Returning user ── */
        <div>
          {/* Big Create button */}
          <div style={{ marginBottom: 32 }}>
            <Link
              href="/create/start"
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 18,
                fontWeight: 700,
                padding: '16px 36px',
                borderRadius: 10,
              }}
            >
              + Create
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

                  {/* Status badge */}
                  {item._status && item._status !== 'completed' ? (
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 120 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        background: item._status === 'failed' ? '#fef2f2' : 'rgba(168,240,212,0.2)',
                        color: item._status === 'failed' ? '#991b1b' : 'var(--ink)',
                        border: item._status === 'failed' ? '1px solid #fca5a5' : '1px solid var(--mint)',
                      }}>
                        {item._status === 'failed' ? 'Failed' : (
                          <>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mint)', animation: 'pulseGlow 2s ease infinite' }} />
                            {item._progressPct != null ? `${displayProgress(item._progressPct)}%` : 'Processing'}
                          </>
                        )}
                      </span>
                      {item._progressDetail && item._status !== 'failed' && (
                        <span style={{ fontSize: 11, color: 'var(--ink-light)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item._progressDetail}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className={`tag ${badge.color}`} style={{ flexShrink: 0 }}>
                      {badge.label}
                    </span>
                  )}

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
