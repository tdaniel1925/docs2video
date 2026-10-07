'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { Dialog } from './kit'
import { howToFor, boldParts } from '../_lib/how-to-use'

/*
 * The "How to use" pop-up: the numbered steps for the screen you're on, read
 * from app/_lib/how-to-use.ts by the current address. A short video sits on
 * top when one is recorded for the screen (none are yet — then nothing shows).
 * The Help Center link at the bottom goes deeper.
 */
export default function HowToUseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const guide = howToFor(pathname)

  // Moving to another screen closes it — its steps would be for the old one.
  useEffect(() => { onClose() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={<>How to use: {guide.title}</>}
      sub={guide.intro}
      footer={
        <>
          <Link href={guide.helpHref} onClick={onClose}>More in the Help Center →</Link>
          {guide.helpHref !== '/help' && <Link href="/help" onClick={onClose}>All help</Link>}
        </>
      }
    >
      {guide.video && (
        <video
          src={guide.video.src}
          title={guide.video.title}
          controls
          preload="none"
          className="kit-dialog-video"
        />
      )}
      <ol className="kit-steps">
        {guide.steps.map((step, i) => (
          <li key={i}>
            <span>
              {boldParts(step).map((p, j) => (p.bold ? <strong key={j}>{p.text}</strong> : <span key={j}>{p.text}</span>))}
            </span>
          </li>
        ))}
      </ol>
    </Dialog>
  )
}
