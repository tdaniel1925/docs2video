'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { KitPlan } from '../../../../../remotion/src/kit/spec'

/*
 * STEP 7 — THE OPENING AND THE CLOSING as pictures (2026-11-15, owner: "a visual of what the opener and closer will
 * look like, with the elements, edited in a pop-up like the storyboard"). The server builds each one the way the
 * video will (api/storyboard/bookends); the picture is drawn in the browser (StoryboardStill), so it redraws as
 * the choices change, for $0. A still only, like the storyboard.
 */
export type BookendView = { plan: KitPlan | null; elements: string[] }
export type Bookends = { cover: BookendView; closing: BookendView }

const Still = dynamic(() => import('./StoryboardStill'), { ssr: false, loading: () => <Wait text="Drawing…" /> })
const Wait = ({ text }: { text: string }) => (
  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 12, color: 'var(--ink-light)', fontSize: 'var(--fs-caption)' }}>{text}</div>
)

/** The opening and closing for the choices on screen (saved or still being tried), fetched again as they change. */
export function useBookends(videoId: string | null, choices: { photoPlacement?: string; showContactClosing?: boolean }, enabled: boolean) {
  const [data, setData] = useState<Bookends | null>(null)
  const [failed, setFailed] = useState(false)
  const key = JSON.stringify(choices)
  const seq = useRef(0)
  useEffect(() => {
    if (!enabled || !videoId) return
    const n = ++seq.current
    const t = setTimeout(() => {
      fetch('/api/storyboard/bookends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId, choices: JSON.parse(key) }) })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j: Bookends) => { if (n === seq.current) { setData(j); setFailed(false) } })
        .catch(() => { if (n === seq.current) setFailed(true) })
    }, 250)
    return () => clearTimeout(t)
  }, [videoId, key, enabled])
  return { data, failed }
}

/** The picture of one bookend (16:9): drawn from its plan, or a plain box listing what is on it. */
export function BookendPicture({ view, label, failed }: { view: BookendView | undefined; label: string; failed?: boolean }) {
  return (
    <div style={{ position: 'relative', aspectRatio: '16 / 9', maxWidth: '100%', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
      {view?.plan
        ? <Still plan={view.plan} label={label} fallback={<Wait text="We couldn’t draw this picture." />} />
        : <Wait text={failed ? 'We couldn’t load this just now.' : view ? 'The picture is drawn when your video is made.' : 'Drawing…'} />}
    </div>
  )
}

/** One of the two big cards: the picture, what is on it, and Change. */
export function BookendCard({ title, view, failed, onChange, note }: { title: string; view: BookendView | undefined; failed: boolean; onChange: () => void; note?: ReactNode }) {
  return (
    <section className="cf-card" aria-label={title} style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <h2 className="cf-h2" style={{ margin: 0 }}>{title}</h2>
        <button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" onClick={onChange} aria-label={`Change ${title.toLowerCase()}`}>Change</button>
      </div>
      <BookendPicture view={view} label={title} failed={failed} />
      {view ? (
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--ink-soft)', fontSize: 'var(--fs-small)' }}>
          {view.elements.map((e, i) => <li key={i} style={{ overflowWrap: 'anywhere' }}>{e}</li>)}
        </ul>
      ) : null}
      {note}
    </section>
  )
}
