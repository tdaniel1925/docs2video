'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '../../../../_components/kit'

type Posts = { linkedin: string; twitter: string; facebook: string }
type Network = keyof Posts

/**
 * "Social posts" — writes a LinkedIn, X and Facebook post about this project
 * (the same /api/generate-social-post the old button used). It writes when opened.
 *
 * Each post has a SHARE button (2026-11-15, owner: "share buttons instead of copy"): it opens that site's own
 * share window in a new tab with the post filled in. Nothing is posted for them: they press Post there.
 *  - LinkedIn and X take the post's words in the link, so the post arrives written.
 *  - Facebook's share window takes only a link, never words (Facebook's rule), so the button copies the words
 *    first and says so: they paste them in.
 * Whether they are signed in to the site can't be seen from here (no site lets another read that), so the
 * pop-up says what happens when they aren't: the site asks them to sign in first, then shows the post.
 */
const NETWORKS: { key: Network; label: string; button: string }[] = [
  { key: 'linkedin', label: 'LinkedIn', button: 'Share on LinkedIn' },
  { key: 'twitter', label: 'X / Twitter', button: 'Post on X' },
  { key: 'facebook', label: 'Facebook', button: 'Share on Facebook' },
]

/** The watch-page link in a post (the posts end with it), else the project's own watch page. */
function linkIn(text: string, videoId: string): string {
  const m = text.match(/https?:\/\/\S+/)
  return m ? m[0].replace(/[).,]+$/, '') : `${window.location.origin}/watch/${videoId}`
}

function shareUrl(net: Network, text: string, videoId: string): string {
  const e = encodeURIComponent
  if (net === 'linkedin') return `https://www.linkedin.com/feed/?shareActive=true&text=${e(text)}`
  if (net === 'twitter') return `https://twitter.com/intent/tweet?text=${e(text)}`
  return `https://www.facebook.com/sharer/sharer.php?u=${e(linkIn(text, videoId))}`
}

export default function SocialPostsDialog({ videoId, open, onClose }: { videoId: string; open: boolean; onClose: () => void }) {
  const [posts, setPosts] = useState<Posts | null>(null)
  const [loading, setLoading] = useState(false)
  const [opened, setOpened] = useState<Network | null>(null)
  const [fbCopied, setFbCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setPosts(null); setLoading(true); setOpened(null); setFbCopied(false)
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

  function share(net: Network) {
    if (!posts) return
    const text = posts[net] || ''
    // Facebook can't be handed the words: copy them now, inside the click, so they are ready to paste.
    if (net === 'facebook') navigator.clipboard.writeText(text).then(() => setFbCopied(true), () => setFbCopied(false))
    window.open(shareUrl(net, text, videoId), '_blank', 'noopener,noreferrer')
    setOpened(net)
  }

  return (
    <Dialog open={open} onClose={onClose} title="Social posts"
      sub="Each button opens that site in a new tab with your post ready. Nothing is posted until you press Post there.">
      {loading && <div className="res-center"><span className="spinner" /> Writing your posts…</div>}
      {!loading && !posts && <p className="res-hint">The posts could not be written. Close this and try again.</p>}
      {posts && (
        <div className="res-stack">
          <p className="res-hint" style={{ margin: 0 }}>
            Not signed in to LinkedIn, X or Facebook in this browser? The site asks you to sign in first, then shows your post.
          </p>
          {NETWORKS.map(({ key, label, button }) => (
            <div key={key} className="res-post">
              <div className="res-post-head">
                <strong>{label}</strong>
                <button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" onClick={() => share(key)}>
                  {button} ↗
                </button>
              </div>
              <div className="res-post-body">{posts[key]}</div>
              {opened === key ? (
                <p className="res-hint" role="status" style={{ margin: '8px 0 0' }}>
                  {key === 'facebook'
                    ? (fbCopied
                      ? <>Facebook opened in a new tab with your video’s link. Your post is copied: click in the box there and paste it (Ctrl+V, or ⌘V on a Mac).</>
                      : <>Facebook opened in a new tab with your video’s link. Facebook doesn’t let us fill in the words, so copy the post above and paste it there.</>)
                    : <>{label === 'LinkedIn' ? 'LinkedIn' : 'X'} opened in a new tab with your post filled in. Didn’t open? Your browser may have blocked the new tab: allow pop-ups for this site and press the button again.</>}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Dialog>
  )
}
