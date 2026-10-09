'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Film, GalleryVerticalEnd, Presentation, type LucideIcon } from 'lucide-react'
import s from './make.module.css'
import { formatCredits } from './usePriceQuote'
import { PRES_LOOKS, VIDEO_LOOKS, VIDEO_SAMPLE_KINDS, type VideoLookId } from './looks'
import { VOICE_OPTIONS } from '../../../../_lib/types'
import type { MakeOutput, OutputQuote } from '../../../../_lib/price-quote'

// ── The look ────────────────────────────────────────────────────────────────

export function VideoLookPicker({ value, onChange, onZoom }: {
  value: VideoLookId
  onChange: (id: VideoLookId) => void
  onZoom: (url: string) => void
}) {
  const sel = VIDEO_LOOKS.find((l) => l.id === value) ?? VIDEO_LOOKS[0]
  return (
    <>
      <div className={s.looks} role="radiogroup" aria-label="The look">
        {VIDEO_LOOKS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={value === l.id}
            className={`${s.look} ${value === l.id ? s.lookOn : ''}`}
            onClick={() => onChange(l.id)}
          >
            {l.id === 'slides' ? <span className={s.lookBadge}>Recommended</span> : null}
            <img className={s.lookThumb} src={`/style-samples/${l.id}-cover.png`} alt="" loading="lazy" />
            <div className={s.lookName}>{l.name}</div>
          </button>
        ))}
      </div>
      <div className={s.lookDetail}>
        <p><strong>{sel.name}.</strong> {sel.tagline}</p>
        <div className={s.samples}>
          {VIDEO_SAMPLE_KINDS.map((kind) => {
            const url = `/style-samples/${sel.id}-${kind}.png`
            return (
              <button key={kind} type="button" className={s.sample} onClick={() => onZoom(url)} aria-label={`Enlarge ${sel.name} ${kind} sample`}>
                <img src={url} alt={`${sel.name} ${kind} sample`} loading="lazy" />
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

export function PresLookPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const sel = PRES_LOOKS.find((l) => l.id === value) ?? PRES_LOOKS[0]
  return (
    <>
      <div className={s.looks} role="radiogroup" aria-label="The look">
        {PRES_LOOKS.map((l) => {
          const [paper, ink, accent] = l.swatch
          return (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={value === l.id}
              className={`${s.look} ${value === l.id ? s.lookOn : ''}`}
              onClick={() => onChange(l.id)}
            >
              {/* A mini slide drawn from the template's own colors. */}
              <div className={s.lookSwatch} style={{ background: paper }}>
                <div style={{ width: 30, height: 3, background: accent, borderRadius: 2, marginBottom: 7 }} />
                <div style={{ fontSize: 'var(--fs-ui)', fontWeight: 800, color: ink, lineHeight: 1.15 }}>Your title<span style={{ color: accent }}>.</span></div>
                <div style={{ marginTop: 7, display: 'flex', gap: 'var(--space-1)' }}>
                  <span style={{ flex: 2, height: 5, background: ink, opacity: 0.25, borderRadius: 3 }} />
                  <span style={{ flex: 1, height: 5, background: accent, opacity: 0.7, borderRadius: 3 }} />
                </div>
              </div>
              <div className={s.lookName}>{l.name}</div>
            </button>
          )
        })}
      </div>
      <p className={s.note}><strong>{sel.name}.</strong> {sel.tagline} You can switch looks after it’s built, free.</p>
    </>
  )
}

// ── What to send ────────────────────────────────────────────────────────────

const OUTPUT_TEXT: Record<MakeOutput, { name: string; desc: string }> = {
  video: { name: 'Narrated video', desc: 'A voice walks them through it.' },
  interactive: { name: 'Interactive presentation', desc: 'They click through at their own pace, with narration.' },
  deck: { name: 'Slide deck', desc: 'Silent slides for a meeting. Download as PDF or PowerPoint.' },
  pptx: { name: 'PowerPoint file', desc: 'The file you started from the deck builder.' },
  pdf: { name: 'PDF file', desc: 'The file you started from the deck builder.' },
}

/** One picture per output (lucide, 20px) — the same ones the Library's
 *  placeholders use, so a presentation looks like a presentation everywhere. */
const OUTPUT_ICON: Record<MakeOutput, LucideIcon> = {
  video: Film,
  interactive: Presentation,
  deck: GalleryVerticalEnd,
  pptx: Presentation,
  pdf: FileText,
}

export function OutputPicker({ offered, value, onChange, options }: {
  offered: MakeOutput[]
  value: MakeOutput
  onChange: (o: MakeOutput) => void
  options: Partial<Record<MakeOutput, OutputQuote>> | null
}) {
  return (
    <div className={s.outputs} role="radiogroup" aria-label="What do you want to send?">
      {offered.map((o) => {
        const on = value === o
        const q = options?.[o]
        const Icon = OUTPUT_ICON[o]
        return (
          <button key={o} type="button" role="radio" aria-checked={on} className={`${s.output} ${on ? s.outputOn : ''}`} onClick={() => onChange(o)}>
            <span className={`${s.radio} ${on ? s.radioOn : ''}`} aria-hidden />
            <span className={`${s.outputIcon} ${on ? s.outputIconOn : ''}`}><Icon size={20} /></span>
            <span className={s.outputBody}>
              <span className={s.outputName}>{OUTPUT_TEXT[o].name}</span>
              <span className={s.outputDesc} style={{ display: 'block' }}>{OUTPUT_TEXT[o].desc}</span>
            </span>
            <span className={s.outputPrice}>{q ? formatCredits(q.total) : '…'}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── The voice ───────────────────────────────────────────────────────────────

/** Voices in VOICE_OPTIONS order — Sarah (nova) first, the default. */
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
    <div className={s.chips} role="radiogroup" aria-label="The voice">
      {VOICE_OPTIONS.map((v) => {
        const on = value === v.id
        return (
          <div key={v.id} className={`${s.chip} ${on ? s.chipOn : ''}`}>
            <button
              type="button"
              className={s.play}
              onClick={() => toggle(v.id)}
              aria-label={playing === v.id ? `Stop ${v.name} sample` : `Play ${v.name} sample`}
            >
              {playing === v.id ? '■' : '▶'}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(v.id)}
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
            >
              {v.name} <span className={s.chipSub}>{v.gender.toLowerCase()}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
