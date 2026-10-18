'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Play, Square } from 'lucide-react'
import { formatCredits } from './usePriceQuote'
import type { LookCard, LookSample } from './looks'
import { VOICE_OPTIONS } from '../../../../_lib/types'
import type { MakeOutput, OutputQuote } from '../../../../_lib/price-quote'

// ── The look ────────────────────────────────────────────────────────────────

/**
 * The look cards, three across (two on a phone): a big picture, the name,
 * BEST on the recommended one. Drawn from lookCards() in looks.ts, so a new
 * look is one more entry there. The picked look's one-line description and
 * sample pictures sit under the cards.
 */
export function LookPicker({ cards, value, onChange, onZoom, note, children }: {
  cards: LookCard[]
  value: string
  onChange: (id: string) => void
  onZoom: (url: string) => void
  /** Extra words after the picked look's description (how long it takes). */
  note?: string | null
  /** Choices that belong to the picked look (e.g. Drawn slides' drawing style). */
  children?: ReactNode
}) {
  const sel = cards.find((l) => l.id === value) ?? cards[0]
  /* The sample being watched, and the card's button to give focus back to. */
  const [watching, setWatching] = useState<{ name: string; sample: LookSample; from: HTMLElement | null } | null>(null)
  return (
    <>
      <div className="cf-looks" role="radiogroup" aria-label="The look">
        {cards.map((l) => (
          <div key={l.id} className="cf-look-wrap">
          <button
            type="button"
            role="radio"
            aria-checked={value === l.id}
            className="cf-look"
            onClick={() => onChange(l.id)}
          >
            {l.recommended ? <span className="cf-look-best">BEST</span> : null}
            {l.thumb.kind === 'img'
              // eslint-disable-next-line @next/next/no-img-element -- a sample picture, shown as is
              ? <img className="cf-look-thumb" src={l.thumb.src} alt="" loading="lazy" />
              : <Swatch swatch={l.thumb.swatch} title={l.thumb.title} />}
            <span className="cf-look-cap">
              <span className="cf-look-name">
                {l.name}
                {l.tag ? <small>{l.tag}</small> : null}
              </span>
              <span className="cf-look-short">{l.short}</span>
            </span>
          </button>
          {l.sample ? (
            <button type="button" className="cf-look-watch" onClick={(e) => setWatching({ name: l.name, sample: l.sample!, from: e.currentTarget })} aria-label={`Watch a ${l.sample.seconds}-second sample of ${l.name}`} data-look-sample={l.id}>
              <Play size={12} aria-hidden="true" /> Watch a sample
            </button>
          ) : null}
          </div>
        ))}
      </div>
      {watching ? <SampleVideoDialog name={watching.name} sample={watching.sample} onClose={() => { const from = watching.from; setWatching(null); from?.focus() }} /> : null}
      {sel ? (
        <div className="cf-look-detail">
          <p className="cf-hint"><strong style={{ color: 'var(--ink)' }}>{sel.name}.</strong> {sel.tagline}{note ? ` ${note}` : ''}</p>
          {children}
          {sel.samples?.length ? (
            <details className="cf-examples">
            <summary>See examples of {sel.name}</summary>
            <div className="cf-samples">
              {sel.samples.map((url) => {
                const kind = url.replace(/^.*-(\w+)\.png$/, '$1')
                return (
                  <button key={url} type="button" className="cf-sample" onClick={() => onZoom(url)} aria-label={`Enlarge ${sel.name} ${kind} sample`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a sample picture */}
                    <img src={url} alt={`${sel.name} ${kind} sample`} loading="lazy" />
                  </button>
                )
              })}
            </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

/**
 * A LOOK'S SAMPLE VIDEO, in a dialog: focus goes to Close, Tab stays inside,
 * Escape or the backdrop closes it and focus goes back to the card. The video
 * plays with its sound (the click that opened it is the gesture browsers ask
 * for) and its own controls.
 */
export function SampleVideoDialog({ name, sample, onClose }: { name: string; sample: LookSample; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Tab' && boxRef.current) {
        const f = [...boxRef.current.querySelectorAll<HTMLElement>('button, video, a[href]')]
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="cf-sample-dialog" onClick={onClose} data-sample-dialog>
      <div ref={boxRef} className="cf-sample-box" role="dialog" aria-modal="true" aria-label={`${name}: a sample video`} onClick={(e) => e.stopPropagation()}>
        <div className="cf-sample-head">
          <b>{name}</b>
          <span>A {sample.seconds}-second sample, made the way your video will be. The story and names are made up.</span>
          <button ref={closeRef} type="button" className="cf-sample-close" onClick={onClose} aria-label="Close the sample">✕</button>
        </div>
        <video src={sample.video} poster={sample.poster} controls autoPlay playsInline preload="auto" />
      </div>
    </div>
  )
}

/** A mini slide drawn from a presentation look's own three colours. */
function Swatch({ swatch, title = 'Your title' }: { swatch: [string, string, string]; title?: string }) {
  const [paper, ink, accent] = swatch
  return (
    <span className="cf-look-swatch" style={{ background: paper }}>
      <span className="cf-look-swatch-bar" style={{ background: accent }} />
      <span className="cf-look-swatch-title" style={{ color: ink }}>{title}<span style={{ color: accent }}>.</span></span>
    </span>
  )
}

// ── What to make ────────────────────────────────────────────────────────────

const OUTPUT_NAME: Record<MakeOutput, string> = {
  video: 'Video',
  interactive: 'Presentation',
  deck: 'Slide deck',
  pptx: 'PowerPoint file',
  pdf: 'PDF file',
}
const OUTPUT_HINT: Record<MakeOutput, string> = {
  video: 'A narrated video. A voice walks them through it.',
  interactive: 'An interactive presentation. They click through at their own pace, with narration.',
  deck: 'Silent slides for a meeting.',
  pptx: 'A PowerPoint file.',
  pdf: 'A PDF file.',
}

/** Video or presentation, each with the server's price (… while it loads). */
export function OutputPicker({ offered, value, onChange, options }: {
  offered: MakeOutput[]
  value: MakeOutput
  onChange: (o: MakeOutput) => void
  options: Partial<Record<MakeOutput, OutputQuote>> | null
}) {
  return (
    <div className="cf-chips" role="radiogroup" aria-label="Make">
      {offered.map((o) => {
        const q = options?.[o]
        return (
          <button key={o} type="button" role="radio" aria-checked={value === o} className="cf-chip" title={OUTPUT_HINT[o]} onClick={() => onChange(o)}>
            {OUTPUT_NAME[o]} <small>{q ? formatCredits(q.total) : '…'}</small>
          </button>
        )
      })}
    </div>
  )
}

// ── The voice ───────────────────────────────────────────────────────────────

/** Voices in VOICE_OPTIONS order — Sarah (nova) first, the default. ▶ plays
 *  a sample without choosing it; pressing the name chooses it. */
export function VoicePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [playing, setPlaying] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => () => { audioRef.current?.pause() }, [])

  function toggle(id: string) {
    audioRef.current?.pause()
    audioRef.current = null
    if (playing === id) { setPlaying(null); return }
    const a = new Audio(`/samples/solo-${id}.mp3`)
    a.onended = () => setPlaying(null)
    a.play().catch(() => setPlaying(null))
    audioRef.current = a
    setPlaying(id)
  }

  return (
    <div className="cf-chips" role="radiogroup" aria-label="The voice">
      {VOICE_OPTIONS.map((v) => {
        const on = value === v.id
        return (
          <span key={v.id} className={`cf-chip ${on ? 'is-on' : ''}`} style={{ padding: '6px 14px 6px 6px' }}>
            <button
              type="button"
              className="cf-scene-edit"
              style={{ padding: 6, display: 'inline-grid', placeItems: 'center' }}
              onClick={() => toggle(v.id)}
              aria-label={playing === v.id ? `Stop ${v.name} sample` : `Play ${v.name} sample`}
            >
              {playing === v.id ? <Square size={14} /> : <Play size={14} />}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(v.id)}
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
            >
              {v.name} <small>{v.gender.toLowerCase()}</small>
            </button>
          </span>
        )
      })}
    </div>
  )
}
