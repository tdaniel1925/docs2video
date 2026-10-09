'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'

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
  created_at: string
}

const TYPE_ICONS: Record<string, string> = {
  video_complete: '🎬',
  video_failed: '❌',
  course_progress: '🎓',
  social_kit_ready: '📱',
  campaign_ready: '📅',
  credits_low: '⚠️',
  system: '💡',
}

/** `icon` lets the Docs2Video bar use its one icon set (lucide); Text2Art's
 *  frozen classic bar passes nothing and keeps the drawn bell. */
export default function NotificationBell({ icon }: { icon?: ReactNode } = {}) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [activeJobs, setActiveJobs] = useState<Job[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  // Poll for updates
  useEffect(() => {
    function load() {
      fetch('/api/notifications')
        .then(r => r.json())
        .then(data => {
          if (data.notifications) setNotifications(data.notifications)
          if (data.activeJobs) setActiveJobs(data.activeJobs)
          if (typeof data.unreadCount === 'number') setUnreadCount(data.unreadCount)
        })
        .catch(() => {})
    }

    load()
    const interval = setInterval(load, 10000) // Poll every 10s
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-all-read' }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-read', notificationId: id }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function deleteOne(id: string) {
    const wasUnread = notifications.find(n => n.id === id)?.read === false
    setNotifications(prev => prev.filter(n => n.id !== id)) // optimistic
    if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1))
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', notificationId: id }),
    }).catch(() => {})
  }

  async function clearAll() {
    setNotifications([]) // optimistic
    setUnreadCount(0)
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-all' }),
    }).catch(() => {})
  }

  async function dismissJob(id: string) {
    setActiveJobs(prev => prev.filter(j => j.id !== id)) // optimistic
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss-job', jobId: id }),
    }).catch(() => {})
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const hasActiveJobs = activeJobs.length > 0

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          position: 'relative', padding: 6, display: 'flex', alignItems: 'center',
        }}
        aria-label="Notifications"
      >
        {icon ?? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        )}
        {(unreadCount > 0 || hasActiveJobs) && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 16, height: 16, borderRadius: '50%',
            // The unread count sits on the stop red (white numbers 5.4:1). Text2Art
            // keeps its brighter red through --count-badge (see globals.css).
            background: hasActiveJobs ? 'var(--accent)' : 'var(--count-badge, var(--error))',
            color: hasActiveJobs ? 'var(--ink)' : 'var(--on-ink)',
            fontSize: 'var(--fs-caption)', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-card)',
          }}>
            {hasActiveJobs ? '⟳' : unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          width: 380, maxHeight: 480, overflowY: 'auto',
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
          zIndex: 300,
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)' }}>Notifications</div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 'var(--fs-caption)', color: 'var(--mint-darker)', fontWeight: 600,
                }}>
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 'var(--fs-caption)', color: 'var(--error-text)', fontWeight: 600,
                }}>
                  Clear all
                </button>
              )}
              <Link href="/activity" onClick={() => setOpen(false)} style={{
                fontSize: 'var(--fs-caption)', color: 'var(--ink-soft)', textDecoration: 'none', fontWeight: 600,
              }}>
                View all
              </Link>
            </div>
          </div>

          {/* Active Jobs */}
          {activeJobs.length > 0 && (
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-light)', background: 'rgba(168,240,212,0.06)' }}>
              <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)', marginBottom: 8 }}>
                In Progress
              </div>
              {activeJobs.map(job => (
                <div key={job.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--fs-small)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title ?? job.type}</span>
                    <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)' }}>{job.progress}%</span>
                    <button
                      onClick={() => dismissJob(job.id)}
                      title="Dismiss"
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-light)', fontSize: 'var(--fs-ui)', lineHeight: 1, padding: '0 2px' }}
                    >
                      &times;
                    </button>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 10,
                      background: 'var(--accent-ink)',
                      width: `${job.progress}%`,
                      transition: 'width 1s ease',
                    }} />
                  </div>
                  {job.result_url && (
                    <Link href={job.result_url} style={{ fontSize: 'var(--fs-caption)', color: 'var(--mint-darker)', fontWeight: 600, marginTop: 4, display: 'inline-block' }}>
                      View result →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Notifications list */}
          {notifications.length === 0 && activeJobs.length === 0 ? (
            <div style={{ padding: '40px 18px', textAlign: 'center', color: 'var(--ink-light)' }}>
              <div style={{ fontSize: 'var(--fs-h2)', marginBottom: 8 }}>🔔</div>
              <div style={{ fontSize: 'var(--fs-ui)', fontWeight: 600 }}>No notifications yet</div>
              <div style={{ fontSize: 'var(--fs-caption)', marginTop: 4 }}>You'll see updates here when your creations are ready.</div>
            </div>
          ) : (
            notifications.map(n => {
              const Wrapper = n.link ? Link : 'div'
              const wrapperProps = n.link ? { href: n.link, onClick: () => { markRead(n.id); setOpen(false) } } : {}
              return (
                <div key={n.id} style={{ position: 'relative', borderBottom: '1px solid var(--border-light)', background: n.read ? 'var(--bg-card)' : 'rgba(168,240,212,0.06)' }}>
                  <Wrapper
                    {...wrapperProps as any}
                    style={{
                      display: 'flex', gap: 'var(--space-3)', padding: '12px 40px 12px 18px',
                      textDecoration: 'none', color: 'var(--ink)',
                      cursor: n.link ? 'pointer' : 'default',
                    }}
                  >
                    <span style={{ fontSize: 'var(--fs-lead)', flexShrink: 0, marginTop: 2 }}>
                      {TYPE_ICONS[n.type] ?? '📋'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--fs-small)', fontWeight: n.read ? 500 : 700, lineHeight: 1.4 }}>
                        {n.title}
                      </div>
                      {n.message && (
                        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', marginTop: 2, lineHeight: 1.4 }}>
                          {n.message}
                        </div>
                      )}
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', marginTop: 4 }}>
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                    {!n.read && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-ink)', flexShrink: 0, marginTop: 6 }} />
                    )}
                  </Wrapper>
                  {/* Delete this notification (sits above the Link so it's clickable). */}
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteOne(n.id) }}
                    title="Delete"
                    aria-label="Delete notification"
                    style={{
                      position: 'absolute', top: 10, right: 12,
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: 'var(--ink-light)', fontSize: 'var(--fs-body)', lineHeight: 1, padding: 2,
                    }}
                  >
                    &times;
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
