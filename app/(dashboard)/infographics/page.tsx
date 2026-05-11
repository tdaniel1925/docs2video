import Link from 'next/link'
import { createClient } from '../../_lib/supabase/server'
import type { Infographic } from '../../_lib/types'

export default async function InfographicsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: infographics } = await supabase
    .from('infographics')
    .select('*, brand:brands(*)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Your gallery</h1>
          <p>All your generated infographics, in one place.</p>
        </div>
        <Link href="/create" className="btn btn-primary btn-lg">
          + New Presentation
        </Link>
      </div>

      {!infographics?.length ? (
        <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: '64px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No infographics yet</p>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 18 }}>Upload a document or type an idea to get started</p>
          <Link href="/create" className="btn btn-primary">Create your first &rarr;</Link>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
          {(infographics as Infographic[]).map((ig, i) => (
            <Link
              key={ig.id}
              href={`/infographics/${ig.id}`}
              className="activity-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 24px',
                textDecoration: 'none',
                color: 'var(--ink)',
                borderBottom: i < (infographics as Infographic[]).length - 1 ? '1px solid var(--border-light)' : 'none',
                transition: 'background 0.1s ease',
              }}
            >
              {/* Thumbnail */}
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: ig.image_url ? 'var(--bg)' : ['var(--mint)', 'var(--peach)', 'var(--lilac)', 'var(--sky)', 'var(--sun)', 'var(--rose)'][i % 6],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {ig.image_url ? (
                  <img src={ig.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                )}
              </div>

              {/* Title + source */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ig.title ?? ig.source_pdf_name ?? 'Untitled'}
                </div>
                {ig.source_pdf_name && ig.title && (
                  <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>From {ig.source_pdf_name}</div>
                )}
              </div>

              {/* Status */}
              <span className={`tag ${ig.status === 'completed' ? 'mint' : ig.status === 'failed' ? 'rose' : 'peach'}`} style={{ flexShrink: 0 }}>
                {ig.status === 'completed' ? 'Done' : ig.status === 'failed' ? 'Failed' : 'Processing'}
              </span>

              {/* Date */}
              <div style={{ fontSize: 13, color: 'var(--ink-light)', flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
                {new Date(ig.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
