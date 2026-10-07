'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '../../../../_components/kit'

type Posts = { linkedin: string; twitter: string; facebook: string }

/**
 * "Social posts" — writes a LinkedIn, X and Facebook post about this project
 * (the same /api/generate-social-post the old button used), each with Copy.
 * It writes when opened, as the old window did.
 */
export default function SocialPostsDialog({ videoId, open, onClose }: { videoId: string; open: boolean; onClose: () => void }) {
  const [posts, setPosts] = useState<Posts | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setPosts(null); setLoading(true); setCopied(null)
    fetch('/api/generate-social-post', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setPosts(d) })
      .catch(() => { if (!cancelled) setPosts(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, videoId])

  return (
    <Dialog open={open} onClose={onClose} title="Social posts" sub="Ready to paste into LinkedIn, X and Facebook. Nothing is posted for you.">
      {loading && <div className="res-center"><span className="spinner" /> Writing your posts…</div>}
      {!loading && !posts && <p className="res-hint">The posts could not be written. Close this and try again.</p>}
      {posts && (
        <div className="res-stack">
          {([['linkedin', 'LinkedIn'], ['twitter', 'X / Twitter'], ['facebook', 'Facebook']] as const).map(([key, label]) => (
            <div key={key} className="res-post">
              <div className="res-post-head">
                <strong>{label}</strong>
                <button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" onClick={() => {
                  navigator.clipboard.writeText(posts[key] || '').catch(() => {})
                  setCopied(key)
                  setTimeout(() => setCopied(null), 2000)
                }}>{copied === key ? '✓ Copied' : 'Copy'}</button>
              </div>
              <div className="res-post-body">{posts[key]}</div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  )
}
