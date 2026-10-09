'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import ViewAlertsSetting from './ViewAlertsSetting'
import { tidyNotice } from '../../_lib/bell'

interface Notification {
  id: string
  type: string
  title: string
  message: string | null
  link: string | null
  read: boolean
  created_at: string
}

interface Job {
  id: string
  type: string
  title: string | null
  status: string
  progress: number
  metadata: Record<string, unknown>
  result_url: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

const TYPE_ICONS: Record<string, string> = {
  video: '🎬', course: '🎓', 'social-kit': '📱', campaign: '📅',
  logo: '🎨', infographic: '📊', flyer: '📋', 'business-card': '💳',
  remix: '✨',
}

const NOTIF_ICONS: Record<string, string> = {
  video_complete: '🎬', video_failed: '❌', course_progress: '🎓',
  social_kit_ready: '📱', campaign_ready: '📅', credits_low: '⚠️', system: '💡',
}

export default function ActivityPage() {
  // The "Change your view alerts" link in alert emails lands on #view-alerts —
  // open the tab that holds that setting. (Read once at start; the first
  // render is a spinner either way, so server and browser markup still match.)
  const [tab, setTab] = useState<'jobs' | 'notifications'>(() =>
    typeof window !== 'undefined' && window.location.hash === '#view-alerts' ? 'notifications' : 'jobs')
  const [jobs, setJobs] = useState<Job[]>([])
  const [allJobs, setAllJobs] = useState<Job[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/notifications')
        const data = await res.json()
        setNotifications(data.notifications ?? [])

        // Also load all jobs (including completed)
        const jobsRes = await fetch('/api/activity/jobs')
        const jobsData = await jobsRes.json()
        setAllJobs(jobsData.jobs ?? [])
        setJobs(data.activeJobs ?? [])
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  const activeJobs = allJobs.filter(j => j.status === 'queued' || j.status === 'running')
  const completedJobs = allJobs.filter(j => j.status === 'completed')
  const failedJobs = allJobs.filter(j => j.status === 'failed')

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  if (loading) {
    return (
      <div style={{ padding: 64, textAlign: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p>Track your jobs and notifications.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 24 }}>
        <button onClick={() => setTab('jobs')} className={`btn btn-sm ${tab === 'jobs' ? 'btn-primary' : 'btn-soft'}`}>
          Jobs {activeJobs.length > 0 && <span style={{ marginLeft: 4, background: 'var(--accent)', color: 'var(--ink)', borderRadius: 10, padding: '1px 6px', fontSize: 'var(--fs-caption)', fontWeight: 800 }}>{activeJobs.length}</span>}
        </button>
        <button onClick={() => setTab('notifications')} className={`btn btn-sm ${tab === 'notifications' ? 'btn-primary' : 'btn-soft'}`}>
          Notifications
        </button>
      </div>

      {/* Jobs Tab */}
      {tab === 'jobs' && (
        <div>
          {/* Active jobs */}
          {activeJobs.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)', marginBottom: 12 }}>
                In Progress
              </div>
              {activeJobs.map(job => (
                <div key={job.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                  borderRadius: 10, padding: '18px 22px', marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 10 }}>
                    <span style={{ fontSize: 'var(--fs-h3)' }}>{TYPE_ICONS[job.type] ?? '📋'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)' }}>{job.title ?? job.type}</div>
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)' }}>Started {timeAgo(job.created_at)}</div>
                    </div>
                    <div style={{ fontSize: 'var(--fs-lead)', fontWeight: 800, color: 'var(--mint-darker)' }}>{job.progress}%</div>
                  </div>
                  <div style={{ height: 8, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 10,
                      background: 'linear-gradient(90deg, var(--accent-ink), color-mix(in srgb, var(--accent-ink) 55%, var(--accent)), var(--accent-ink))',
                      backgroundSize: '200% 100%',
                      animation: 'progressShimmer 2s linear infinite',
                      width: `${job.progress}%`,
                      transition: 'width 1s ease',
                    }} />
                  </div>
                  <style>{`@keyframes progressShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }`}</style>
                  {/* Metadata details */}
                  {job.metadata && Object.keys(job.metadata).length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 'var(--fs-caption)', color: 'var(--ink-light)' }}>
                      {(job.metadata as any).episodeCount && `${(job.metadata as any).completedEpisodes ?? 0} of ${(job.metadata as any).episodeCount} episodes`}
                      {(job.metadata as any).totalPosts && `${(job.metadata as any).completedPosts ?? 0} of ${(job.metadata as any).totalPosts} posts`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Completed jobs */}
          {completedJobs.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)', marginBottom: 12 }}>
                Completed
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
                {completedJobs.map((job, i) => (
                  <div key={job.id} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: '14px 18px',
                    borderBottom: i < completedJobs.length - 1 ? '1px solid var(--border-light)' : 'none',
                  }}>
                    <span style={{ fontSize: 'var(--fs-lead)' }}>{TYPE_ICONS[job.type] ?? '📋'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--fs-ui)' }}>{job.title ?? job.type}</div>
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)' }}>Completed {timeAgo(job.completed_at ?? job.created_at)}</div>
                    </div>
                    <span className="tag mint" style={{ fontSize: 'var(--fs-caption)' }}>Done</span>
                    {job.result_url && (
                      <Link href={job.result_url} className="btn btn-soft btn-sm" style={{ fontSize: 'var(--fs-caption)' }}>View</Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed jobs */}
          {failedJobs.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--error)', marginBottom: 12 }}>
                Failed
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
                {failedJobs.map((job, i) => (
                  <div key={job.id} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: '14px 18px',
                    borderBottom: i < failedJobs.length - 1 ? '1px solid var(--border-light)' : 'none',
                  }}>
                    <span style={{ fontSize: 'var(--fs-lead)' }}>❌</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--fs-ui)' }}>{job.title ?? job.type}</div>
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--error)' }}>{job.error_message ?? 'Generation failed'}</div>
                    </div>
                    <span className="tag rose" style={{ fontSize: 'var(--fs-caption)' }}>Failed</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allJobs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-light)' }}>
              <div style={{ fontSize: 'var(--fs-h2)', marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>No jobs yet</div>
              <div style={{ fontSize: 'var(--fs-small)', marginTop: 4 }}>When you create videos, courses, or social media content, progress will appear here.</div>
            </div>
          )}
        </div>
      )}

      {/* Notifications Tab */}
      {tab === 'notifications' && (
        <div>
          <ViewAlertsSetting />
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-light)' }}>
              <div style={{ fontSize: 'var(--fs-h2)', marginBottom: 8 }}>🔔</div>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>No notifications yet</div>
              <div style={{ fontSize: 'var(--fs-small)', marginTop: 4 }}>You'll see updates here when your creations are ready.</div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Same words as the bell ("Didn't finish", linked to the result
                  page) — Activity keeps every notice, the bell only recent ones. */}
              {notifications.map(tidyNotice).map((n, i) => (
                <Link
                  key={n.id}
                  href={n.link ?? '#'}
                  style={{
                    display: 'flex', gap: 'var(--space-3)', padding: '14px 18px',
                    borderBottom: i < notifications.length - 1 ? '1px solid var(--border-light)' : 'none',
                    background: n.read ? 'var(--bg-card)' : 'var(--accent-soft)',
                    textDecoration: 'none', color: 'var(--ink)',
                  }}
                >
                  <span style={{ fontSize: 'var(--fs-lead)', flexShrink: 0 }}>{n.failed ? '⚠️' : (NOTIF_ICONS[n.type] ?? '📋')}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: n.read ? 500 : 700, fontSize: 'var(--fs-ui)' }}>{n.title}</div>
                    {n.message && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', marginTop: 2 }}>{n.message}</div>}
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-ink)', flexShrink: 0, marginTop: 6 }} />}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
