'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/*
 * THE HOMEPAGE FILM (owner, 2026-10-18): a 71-second tour of the real app —
 * real screens, real renders, captions burned in. Opens in a dialog with sound
 * from any button that wraps it; loads only when opened (nothing downloads
 * until then). Esc, the backdrop and Close shut it; focus goes back.
 */
export const HOME_FILM = { src: '/home/film/docs2video-tour.mp4', poster: '/home/film/docs2video-tour.jpg', length: '1:11' }

export function HomeFilm({ className, label, children }: { className?: string; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)
  const close = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    close.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    const back = opener.current
    return () => { window.removeEventListener('keydown', onKey); back?.focus() }
  }, [open])

  return (
    <>
      <button ref={opener} type="button" className={className} aria-label={label} onClick={() => setOpen(true)} data-action="play-home-film">{children}</button>
      {open ? (
        <div className="hp-film" role="dialog" aria-modal="true" aria-label="Docs2Video in 71 seconds" onClick={() => setOpen(false)}>
          <div className="hp-film-box" onClick={(e) => e.stopPropagation()}>
            <button ref={close} type="button" className="hp-film-close" onClick={() => setOpen(false)} aria-label="Close the film">✕</button>
            <video className="hp-film-video" src={HOME_FILM.src} poster={HOME_FILM.poster} controls autoPlay playsInline preload="auto" />
          </div>
        </div>
      ) : null}
    </>
  )
}
