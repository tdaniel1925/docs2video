'use client'

import { useState, useEffect, useRef } from 'react'
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

export default function NotificationBell() {
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {(unreadCount > 0 || hasActiveJobs) && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 16, height: 16, borderRadius: '50%',
            background: hasActiveJobs ? 'var(--mint)' : '#ef4444',
            color: hasActiveJobs ? 'var(--ink)' : 'white',
            fontSize: 9, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid white',
          }}>
            {hasActiveJobs ? '⟳' : unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          width: 380, maxHeight: 480, overflowY: 'auto',
          background: 'white', border: '1px solid var(--border-light)',
          borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
          zIndex: 300,
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Notifications</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'var(--mint-darker, #2d7a4f)', fontWeight: 600,
                }}>
                  Mark all read
                </button>
              )}
              <Link href="/activity" onClick={() => setOpen(false)} style={{
                fontSize: 12, color: 'var(--ink-soft)', textDecoration: 'none', fontWeight: 600,
              }}>
                View all
              </Link>
            </div>
          </div>

          {/* Active Jobs */}
          {activeJobs.length > 0 && (
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-light)', background: 'rgba(168,240,212,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-light)', marginBottom: 8 }}>
                In Progress
              </div>
              {activeJobs.map(job => (
                <div key={job.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{job.title ?? job.type}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>{job.progress}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 10,
                      background: 'linear-gradient(90deg, var(--mint), #34d399)',
                      width: `${job.progress}%`,
                      transition: 'width 1s ease',
                    }} />
                  </div>
                  {job.result_url && (
                    <Link href={job.result_url} style={{ fontSize: 11, color: 'var(--mint-darker)', fontWeight: 600, marginTop: 4, display: 'inline-block' }}>
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
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>No notifications yet</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>You'll see updates here when your creations are ready.</div>
            </div>
          ) : (
            notifications.map(n => {
              const Wrapper = n.link ? Link : 'div'
              const wrapperProps = n.link ? { href: n.link, onClick: () => { markRead(n.id); setOpen(false) } } : {}
              return (
                <Wrapper
                  key={n.id}
                  {...wrapperProps as any}
                  style={{
                    display: 'flex', gap: 12, padding: '12px 18px',
                    borderBottom: '1px solid var(--border-light)',
                    background: n.read ? 'white' : 'rgba(168,240,212,0.06)',
                    textDecoration: 'none', color: 'var(--ink)',
                    cursor: n.link ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                    {TYPE_ICONS[n.type] ?? '📋'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, lineHeight: 1.4 }}>
                      {n.title}
                    </div>
                    {n.message && (
                      <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2, lineHeight: 1.4 }}>
                        {n.message}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 4 }}>
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                  {!n.read && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mint)', flexShrink: 0, marginTop: 6 }} />
                  )}
                </Wrapper>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
