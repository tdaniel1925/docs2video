'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Dialog from '../../../_components/kit/Dialog'
import { createClient } from '../../../_lib/supabase/client'
import { kitButtonClass } from '../../../_components/kit/button-class'
import s from './home.module.css'

/*
 * "MAKE YOUR FIRST VIDEO" — the how-to film, in a pop-up.
 *
 * It opens by itself the first time a new account lands on Home (no project
 * yet, and the film not seen before). Closing it in any way marks it seen on
 * the account (Supabase user metadata `welcome_video_seen`, no table needed),
 * so it never opens by itself again — on any device. The link in Home's
 * welcome line opens it again whenever they like.
 *
 * The film: public/help/make-your-first-video.mp4, made from real captures of
 * the live app (remotion/src/showcase/D2vHowTo.tsx).
 */
export const FIRST_VIDEO_FILM = { src: '/help/make-your-first-video.mp4', poster: '/help/make-your-first-video.jpg', length: '1:25' }

export default function FirstVideoWelcome({ autoOpen }: { autoOpen: boolean }) {
  const [open, setOpen] = useState(false)
  const marked = useRef(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => { if (autoOpen) setOpen(true) }, [autoOpen])

  // Try to start with sound; a browser that blocks it just shows the play button.
  useEffect(() => {
    if (!open) return
    const v = videoRef.current
    v?.play().catch(() => {})
  }, [open])

  async function close() {
    setOpen(false)
    if (marked.current) return
    marked.current = true
    try { await createClient().auth.updateUser({ data: { welcome_video_seen: true } }) } catch { /* shown again next time: harmless */ }
  }

  return (
    <>
      <button type="button" className={s.filmLink} onClick={() => setOpen(true)}>Watch how ({FIRST_VIDEO_FILM.length})</button>
      <Dialog
        open={open}
        onClose={close}
        wide
        title="Make your first video"
        sub="A quick tour of the eight steps, on the real screens."
        closeLabel="Close the video"
        footer={(
          <>
            <button type="button" className={kitButtonClass('secondary')} onClick={close}>Watch later</button>
            <Link href="/create?source=upload" className={kitButtonClass('primary')} onClick={() => { void close() }}>Start my first video</Link>
          </>
        )}
      >
        <video
          ref={videoRef}
          src={FIRST_VIDEO_FILM.src}
          poster={FIRST_VIDEO_FILM.poster}
          controls
          playsInline
          preload="metadata"
          className={s.filmVideo}
        />
      </Dialog>
    </>
  )
}
