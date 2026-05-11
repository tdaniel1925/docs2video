import Link from 'next/link'
import { createClient } from '../../_lib/supabase/server'
import type { Video } from '../../_lib/types'

export default async function VideosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: videos } = await supabase
    .from('videos')
    .select('*, brand:brands(*)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Your explainers</h1>
          <p>All your generated explainers.</p>
        </div>
        <Link href="/create" className="btn btn-primary btn-lg">
          + New Explainer
        </Link>
      </div>

      {!videos?.length ? (
        <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: '64px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No videos yet</p>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 18 }}>Create content first, then generate a video explainer from it</p>
          <Link href="/create" className="btn btn-primary">Create content &rarr;</Link>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
          {(videos as Video[]).map((vid, i) => (
            <Link
              key={vid.id}
              href={`/videos/${vid.id}`}
              className="activity-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 24px',
                textDecoration: 'none',
                color: 'var(--ink)',
                borderBottom: i < (videos as Video[]).length - 1 ? '1px solid var(--border-light)' : 'none',
                transition: 'background 0.1s ease',
              }}
            >
              {/* Video icon */}
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: vid.thumbnail_url ? 'var(--bg)' : ['var(--mint)', 'var(--peach)', 'var(--lilac)', 'var(--sky)'][i % 4],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', position: 'relative',
              }}>
                {vid.thumbnail_url ? (
                  <>
                    <img src={vid.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="8 4 20 12 8 20" /></svg>
                    </div>
                  </>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                )}
              </div>

              {/* Title */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {vid.title ?? 'Untitled'}
                </div>
                {vid.duration && (
                  <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>
                    {Math.floor(vid.duration / 60)}:{(vid.duration % 60).toString().padStart(2, '0')} duration
                  </div>
                )}
              </div>

              {/* Status */}
              <span className={`tag ${
                vid.status === 'completed' ? 'mint' :
                vid.status === 'failed' ? 'rose' :
                'peach'
              }`} style={{ flexShrink: 0 }}>
                {vid.status === 'completed' ? 'Done' :
                 vid.status === 'failed' ? 'Failed' :
                 vid.status.replace(/_/g, ' ')}
              </span>

              {/* Date */}
              <div style={{ fontSize: 13, color: 'var(--ink-light)', flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
                {new Date(vid.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>

              {/* Arrow */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
